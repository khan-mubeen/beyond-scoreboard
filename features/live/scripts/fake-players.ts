// joins fake players to a running server and answers every open call.
// talks to the server over http only, never imports server/.
// run: npm run fake-players -- [roomCode] [count]   (needs `npm run dev` running)
import type { JoinResponse, RoomState } from "@/shared/types";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const code = process.argv[2] ?? "TEST";
const count = Number(process.argv[3] ?? 30);
const MAX_MINUTES = 90;

async function post(path: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const players: string[] = [];
for (let i = 1; i <= count; i++) {
  const { status, body } = await post(`/api/rooms/${code}/join`, { nickname: `fan${i}` });
  if (status !== 201) throw new Error(`join failed: ${status} ${JSON.stringify(body)}`);
  players.push((body as JoinResponse).playerId);
}
console.log(`${players.length} players joined room ${code}. waiting for calls (start the replay from the host page)`);

const answered = new Set<string>();
const started = Date.now();
for (;;) {
  const res = await fetch(`${BASE}/api/rooms/${code}/state`);
  const state = (await res.json()) as RoomState;
  const call = state.activeCall;
  if (call && !answered.has(call.id)) {
    answered.add(call.id);
    const results = await Promise.all(
      players.map((playerId) => {
        const option = call.options[Math.floor(Math.random() * call.options.length)];
        return post(`/api/rooms/${code}/answers`, { playerId, callId: call.id, optionId: option.id });
      }),
    );
    const ok = results.filter((r) => r.status === 201).length;
    console.log(`${call.id}: ${ok}/${players.length} answers accepted`);
  }
  if (state.phase === "final") {
    console.log(
      "final. top 3:",
      state.leaderboard
        .slice(0, 3)
        .map((e) => `${e.nickname} ${e.score}`)
        .join(", "),
    );
    break;
  }
  if (Date.now() - started > MAX_MINUTES * 60_000) throw new Error("replay did not finish in time");
  await new Promise((r) => setTimeout(r, 1000));
}
