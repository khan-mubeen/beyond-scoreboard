import { type FormEvent, useState } from "react";
import type { CreateRoomResponse } from "@/shared/types";
import { Button, Card } from "@/shared/ui";

/** create a room (host) or join one (phone) */
export function Landing() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    if (!res.ok) return setError("could not create a room");
    const { code } = (await res.json()) as CreateRoomResponse;
    window.location.assign(`/room/${code}/host`);
  }

  function join(e: FormEvent) {
    e.preventDefault();
    window.location.assign(`/room/${code.trim().toUpperCase()}`);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-gutter">
      <div>
        <h1 className="text-4xl font-bold">PowerPlay</h1>
        <p className="text-muted">
          Watch Liiga together. See what every goal does to the table, make live calls for points.
        </p>
      </div>
      <Card className="flex flex-col gap-3">
        <p className="font-semibold">Hosting a watch party?</p>
        <Button onClick={create}>Create a room</Button>
        {error && <p className="text-sm text-bad">{error}</p>}
      </Card>
      <Card>
        <form onSubmit={join} className="flex gap-2">
          <input
            className="flex-1 rounded-card border border-line bg-surface-2 px-3 py-2 font-mono uppercase"
            placeholder="ROOM"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            maxLength={6}
          />
          <Button type="submit" variant="ghost" disabled={!code.trim()}>
            Join
          </Button>
        </form>
      </Card>
      <a href="/dev" className="text-center text-sm text-muted underline">
        dev pages
      </a>
    </main>
  );
}
