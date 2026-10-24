// one server runs the live engine: the leader. its lease is the settings row "engine_leader",
// claimed and renewed through claim_engine_leader (one atomic compare-and-set in postgres, on the
// database's clock): renewed every 5 s, valid for 15 s. every other server is a follower: it
// serves http only (its match loops mirror the leader's calls from the database) and tries to
// take the lease every 2 s, so a leader that dies is replaced within about 15 s. a leader that
// stops cleanly releases the lease at once. the memory db is one process: always the leader
import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import { getDb } from "@/shared/db";

export const LEASE_TTL_S = 15;
const RENEW_MS = 5000;
const TRY_MS = 2000;

/** this process, as the lease names it */
export const INSTANCE = `${hostname()}:${process.pid}:${randomUUID().slice(0, 6)}`;

let leader = false;
let holder: string | null = null;
/** our local idea of when the lease runs out (a second early, for the network) */
let validUntil = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
const listeners = new Set<(leader: boolean) => void>();

export const isLeader = () => leader;

/** for /healthz and the debug view */
export const leaderInfo = () => ({
  role: leader ? ("leader" as const) : ("follower" as const),
  instance: INSTANCE,
  holder,
});

/** called with true when this server becomes the leader, false when it stops being one */
export function onLeadership(fn: (leader: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function become(next: boolean) {
  if (next === leader) return;
  leader = next;
  console.log(
    next
      ? `engine: leader (${INSTANCE})`
      : `engine: follower mode, ${holder ?? "another server"} runs the live engine; serving http only`,
  );
  for (const fn of listeners) fn(next);
}

async function step() {
  try {
    const lease = await getDb().leader.claim(INSTANCE, LEASE_TTL_S);
    holder = lease.holder;
    if (lease.leader) validUntil = Date.now() + (LEASE_TTL_S - 1) * 1000;
    become(lease.leader);
  } catch (err) {
    // the database didn't answer: lead on only while our last lease is surely still ours
    if (leader && Date.now() > validUntil) {
      console.warn(`engine: lease not renewed (${(err as Error).message}); stepping down`);
      become(false);
    }
  }
  if (running) timer = setTimeout(() => void step(), leader ? RENEW_MS : TRY_MS);
  timer?.unref?.();
}

/** the first claim (await it: the engine starts as leader or follower), then the renew loop */
export async function startLeadership() {
  if (running) return;
  running = true;
  await step();
  if (!leader) console.log(`engine: follower mode, ${holder ?? "another server"} holds the lease; serving http only`);
}

/** a clean shutdown: let go of the lease so a follower takes over on its next try */
export async function stopLeadership() {
  running = false;
  if (timer) clearTimeout(timer);
  timer = null;
  if (leader)
    await getDb()
      .leader.release(INSTANCE)
      .catch(() => {});
  become(false);
}
