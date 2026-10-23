import type { PublicCall } from "@/shared/types";

/** answers at or after locksAt are late */
export function isLate(call: Pick<PublicCall, "locksAt">, gameTimeSeconds: number): boolean {
  return gameTimeSeconds >= call.locksAt;
}

export function isOpen(call: Pick<PublicCall, "opensAt" | "locksAt">, gameTimeSeconds: number): boolean {
  return gameTimeSeconds >= call.opensAt && !isLate(call, gameTimeSeconds);
}
