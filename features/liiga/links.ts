// the official liiga.fi page for a game. verified against liiga.fi (2026-10-24): the site's own
// game links are /fi/peli/{season}/{gameId}/{tilastot|seuranta}?koti=…&vieras=…&paiva=…, and the
// bare path redirects to the full one (a real game's page is titled "SaiPa – Kärpät | 20.10.2026",
// an unknown id gets only "Ottelu"). tilastot = the stats page, seuranta = live follow
export const LIIGA_GAMES_URL = "https://liiga.fi/fi/ohjelma";

export function liigaGameUrl(g: { season: number; gameId: number; status: string }): string {
  return `https://liiga.fi/fi/peli/${g.season}/${g.gameId}/${g.status === "final" ? "tilastot" : "seuranta"}`;
}
