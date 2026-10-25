import { describe, expect, it } from "vitest";
import { checkText } from "@/shared/guardrails";
import { allSiteMocks } from "@/shared/mock/site";

/** every string in a mock, with where it lives */
function strings(value: unknown, path: string): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => strings(v, `${path}[${i}]`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => strings(v, `${path}.${k}`));
  return [];
}

describe("site copy guardrails", () => {
  const all = Object.entries(allSiteMocks).flatMap(([name, mock]) => strings(mock, name));

  it("sweeps a real amount of copy", () => {
    expect(all.length).toBeGreaterThan(200);
  });

  it.each(Object.keys(allSiteMocks))("%s mock has no betting words or odds formats", (name) => {
    const flagged = all.filter(([p]) => p.startsWith(name)).filter(([, text]) => checkText(text).length > 0);
    expect(flagged).toEqual([]);
  });

  it("states chances as percentages, or a change as an arrow ('▲6 playoff chance'), never in 'pts' (the fans' points)", () => {
    const chances = all.filter(([, t]) => /chance/i.test(t) && /\d/.test(t));
    expect(chances.length).toBeGreaterThan(0);
    for (const [path, text] of chances) {
      expect(text, path).toMatch(/\d+%|[▲▼]\d+/);
      expect(text, path).not.toMatch(/\d+ pts\b.*chance|chance.*[+−-]\d+ pts\b/i);
    }
  });
});
