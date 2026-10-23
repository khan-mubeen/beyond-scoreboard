import { useSyncExternalStore } from "react";

// a phone remembers its player id per room, so a reload keeps your score
const key = (code: string) => `powerplay:player:${code}`;
const EVENT = "powerplay:player";

function read(code: string): string | null {
  try {
    return localStorage.getItem(key(code));
  } catch {
    return null;
  }
}

export function savePlayerId(code: string, playerId: string) {
  try {
    localStorage.setItem(key(code), playerId);
  } catch {
    // private mode: the id lives until reload
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function usePlayerId(code: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(code),
    () => null,
  );
}
