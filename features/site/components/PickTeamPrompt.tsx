import { useState } from "react";
import type { TeamListItem } from "@/shared/types";
import { followTeam, useMe, useTeams } from "../data";
import { Modal } from "./Modal";
import { TeamLogo } from "./TeamLogo";

const KEY = "ks_pick_team_done";
const done = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return true;
  }
};
const markDone = () => {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // private mode: asked again next time
  }
};

/** first visit: "pick your team" (kärpät first), skippable. following personalises home and notifications */
export function PickTeamPrompt() {
  const me = useMe().data;
  const [open, setOpen] = useState(() => !done());
  const teams = useTeams().data?.teams ?? [];
  const show = open && !!me && me.follows.length === 0 && teams.length > 0;
  const ordered: TeamListItem[] = [...teams.filter((t) => t.slug === "kärpät"), ...teams.filter((t) => t.slug !== "kärpät").sort((a, b) => a.team.name.localeCompare(b.team.name, "fi"))];

  function close() {
    markDone();
    setOpen(false);
  }

  return (
    <Modal open={show} onClose={close} title="Pick your team">
      <p className="text-sm text-muted">We'll put its games first and tell you when it plays. You can change this any time on Teams.</p>
      <ul className="mt-4 grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {ordered.map((t, i) => (
          <li key={t.team.id}>
            <button
              type="button"
              onClick={() => {
                void followTeam(t.team.id, true);
                close();
              }}
              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold hover:border-accent ${i === 0 ? "border-accent bg-accent-soft" : "border-line"}`}
            >
              <TeamLogo team={t.team} size={28} />
              <span className="truncate">{t.team.name}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={close} className="mt-4 w-full rounded-lg border border-line py-2.5 text-sm font-semibold hover:bg-surface-2">
        Skip for now
      </button>
    </Modal>
  );
}
