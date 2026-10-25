// the link audit: every internal link target written in features/site (components, screens,
// server-built hrefs) is a page of the app, and every "#anchor" exists. plus the ui copy sweep:
// every string a site screen shows passes the betting guardrails
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isRoute } from "@/app/routes";
import { checkText } from "@/shared/guardrails";

const ROOT = new URL("../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === "tests" ? [] : files(p);
    return /\.(tsx?|json)$/.test(f) ? [p] : [];
  });
const sources = files(ROOT).map((path) => ({ path, text: readFileSync(path, "utf8") }));
const withoutComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/** href targets: href="/x", href: "/x", href={`/x/${id}`}, Href: "#x", ActionLink href="#y" */
function targets(): { path: string; target: string }[] {
  const out: { path: string; target: string }[] = [];
  const re = /\b(?:href|Href)\s*[=:]\s*\{?\s*(["'`])((?:\/|#)[^"'`]*)\1/g;
  for (const { path, text } of sources) {
    for (const m of withoutComments(text).matchAll(re)) out.push({ path, target: m[2].replace(/\$\{[^}]*\}/g, "x") });
  }
  return out;
}

const ids = new Set(sources.flatMap(({ text }) => [...text.matchAll(/\bid=["{]`?"?([a-z][\w-]*)/g)].map((m) => m[1])));

describe("link audit", () => {
  const all = targets();

  it("finds the site's links", () => {
    expect(all.length).toBeGreaterThan(25);
  });

  it("every internal link is a page of the app", () => {
    const dead = all.filter(({ target }) => target.startsWith("/") && !isRoute(target.split(/[?#]/)[0]));
    expect(dead).toEqual([]);
  });

  it("no link goes nowhere (#) and every #anchor exists on a page", () => {
    const anchors = all.map(({ path, target }) => ({ path, hash: target.split("#")[1] })).filter((x) => x.hash !== undefined);
    expect(anchors.filter((a) => a.hash === "")).toEqual([]);
    expect(anchors.filter((a) => a.hash && !ids.has(a.hash))).toEqual([]);
  });

  it("knows the routes", () => {
    for (const p of ["/", "/leaderboard", "/match/2027-2701404", "/teams/k%C3%A4rp%C3%A4t", "/calls/history", "/guidelines", "/sports/ai", "/editor"]) expect(isRoute(p), p).toBe(true);
    expect(isRoute("/nope")).toBe(false);
  });
});

describe("ui copy", () => {
  it("no screen or component shows a betting word or odds format", () => {
    const ui = sources.filter(({ path }) => /[\\/](components|screens)[\\/].+\.tsx$/.test(path));
    expect(ui.length).toBeGreaterThan(20);
    const flagged: string[] = [];
    for (const { path, text } of ui) {
      const code = withoutComments(text);
      const strings = [...code.matchAll(/(["'`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map((m) => m[2]);
      const jsx = [...code.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
      for (const s of [...strings, ...jsx]) if (checkText(s).length) flagged.push(`${path}: ${s}`);
    }
    expect(flagged).toEqual([]);
  });
});
