import type { VerificationReport } from "@/shared/types";
import { Badge } from "@/shared/ui";

/** what the validator let through and what it blocked, claim by claim */
export function VerificationPanel({ report }: { report: VerificationReport }) {
  return (
    <section className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold">Verification</h3>
        <Badge tone={report.blockedCount ? "bad" : "good"}>
          {report.claims.length - report.blockedCount} passed · {report.blockedCount} blocked
        </Badge>
      </header>
      <ul className="flex flex-col gap-2 text-sm">
        {report.claims.map((c, i) => (
          <li key={i} className={`rounded-card border p-3 ${c.passed ? "border-line" : "border-bad/60 bg-bad/10"}`}>
            <div className="flex items-start justify-between gap-3">
              <span className={c.passed ? "" : "line-through decoration-bad"}>{c.text}</span>
              <Badge tone={c.passed ? "good" : "bad"}>{c.passed ? "passed" : (c.errorType ?? "blocked")}</Badge>
            </div>
            <div className="mt-1 font-mono text-xs text-muted">
              cites {c.factIds.join(", ") || "nothing"}
              {c.reason && ` · ${c.reason}`}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
