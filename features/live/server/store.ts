// in-memory room store. data is lost on restart, which is fine for the demo.
// a database can implement the same RoomStore interface later.
// the server is one long-running node process, so module scope is shared by every request.
import { randomUUID } from "node:crypto";
import { DEMO_GAME_ID } from "@/shared/mock";
import type { Answer, Player } from "@/shared/types";
import type { RoomClock } from "../replay/control";

export interface Room extends RoomClock {
  code: string;
  gameId: string;
  /** ms epoch */
  createdAt: number;
}

export interface RoomStore {
  createRoom(gameId: string): Room;
  getRoom(code: string): Room | undefined;
  updateRoom(code: string, patch: Partial<Omit<Room, "code">>): Room | undefined;
  addPlayer(code: string, nickname: string): Player | undefined;
  listPlayers(code: string): Player[];
  /** false when this player already answered this call */
  saveAnswer(code: string, answer: Answer): boolean;
  listAnswers(code: string): Answer[];
}

const CODE_LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O, they look like 1 and 0

class MemoryRoomStore implements RoomStore {
  private rooms = new Map<string, Room>();
  private players = new Map<string, Player[]>();
  private answers = new Map<string, Map<string, Answer>>();

  createRoom(gameId: string, code = this.freeCode()): Room {
    const room: Room = {
      code,
      gameId,
      phase: "lobby",
      replayStartedAt: null,
      pausedAt: null,
      offsetSeconds: 0,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    this.players.set(code, []);
    this.answers.set(code, new Map());
    return room;
  }

  getRoom(code: string) {
    return this.rooms.get(code);
  }

  updateRoom(code: string, patch: Partial<Omit<Room, "code">>) {
    const room = this.rooms.get(code);
    if (!room) return undefined;
    const next = { ...room, ...patch };
    this.rooms.set(code, next);
    return next;
  }

  addPlayer(code: string, nickname: string) {
    const list = this.players.get(code);
    if (!list) return undefined;
    const player: Player = { id: randomUUID(), roomCode: code, nickname, joinedAt: Date.now() };
    list.push(player);
    return player;
  }

  listPlayers(code: string) {
    return this.players.get(code) ?? [];
  }

  saveAnswer(code: string, answer: Answer) {
    const byKey = this.answers.get(code);
    const key = `${answer.playerId}:${answer.callId}`;
    if (!byKey || byKey.has(key)) return false;
    byKey.set(key, answer);
    return true;
  }

  listAnswers(code: string) {
    return [...(this.answers.get(code)?.values() ?? [])];
  }

  private freeCode(): string {
    for (;;) {
      const code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join(
        "",
      );
      if (!this.rooms.has(code)) return code;
    }
  }
}

export const store = new MemoryRoomStore();

// a room that always exists, so /room/TEST works without creating one
store.createRoom(DEMO_GAME_ID, "TEST");
