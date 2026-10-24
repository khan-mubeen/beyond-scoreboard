// GET /api/site/teams and /api/site/teams/:slug
import { leagueNow } from "@/shared/clock";
import type { TeamPageData, TeamsPageData } from "@/shared/types";
import { followedIds } from "./favorites";
import type { Viewer } from "./identity";
import { tableNote, teamDetail, teamsWorld } from "./teams-data";

export async function teamsPage(viewer: Viewer): Promise<TeamsPageData> {
  const w = await teamsWorld(await followedIds(viewer.user));
  return { teams: w.items, note: tableNote(), asOf: leagueNow().toISOString(), source: w.ctx.source };
}

export async function teamPage(viewer: Viewer, slug: string): Promise<TeamPageData | null> {
  const d = await teamDetail(slug, await followedIds(viewer.user));
  return d && { ...d, asOf: leagueNow().toISOString(), source: "live" };
}
