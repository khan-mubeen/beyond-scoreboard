// when the "Kaleva Sports · NEW" spotlight shows on the kaleva.fi front page: in demo mode or with
// ?tour=1 on every load (the demo is shown to a new audience each time), otherwise once per
// visitor. pure, plus the storage it reads (blocked storage: shown, and not remembered)

export const SPOTLIGHT_KEY = "kaleva:spotlight-sports-seen";

export function shouldShowSpotlight(a: { demo: boolean; tour: boolean; seen: boolean }): boolean {
  return a.demo || a.tour || !a.seen;
}

export function spotlightSeen(): boolean {
  try {
    return localStorage.getItem(SPOTLIGHT_KEY) === "1";
  } catch {
    return false;
  }
}

export function markSpotlightSeen() {
  try {
    localStorage.setItem(SPOTLIGHT_KEY, "1");
  } catch {
    // private mode: it may show again next time
  }
}
