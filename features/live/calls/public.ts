import type { Call, PublicCall } from "@/shared/types";

/** strips the answer. the only way a call leaves the server */
export function toPublicCall(call: Call): PublicCall {
  const { correctOptionId: _hidden, ...rest } = call;
  return rest;
}
