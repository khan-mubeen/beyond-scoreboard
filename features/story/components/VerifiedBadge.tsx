import type { Content } from "@/shared/types";
import { Badge } from "@/shared/ui";

export function VerifiedBadge({ status }: { status: Content["status"] }) {
  return status === "verified" ? (
    <Badge tone="good">✓ every number checked against the fact ledger</Badge>
  ) : (
    <Badge>template text, built straight from the fact ledger</Badge>
  );
}
