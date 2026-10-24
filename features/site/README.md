# site

The Kaleva Sports pages from `docs/design/`: Sports home, the live and finished match pages, and Kaleva Rewards. Front-end only for now: every screen reads typed mock data.

## How it fits

- **Data:** `data.ts` is the only place screens get data from (`useSiteChrome`, `useHomePage`, `useMatchDetail`, `useRewardsPage`). Today it reads `shared/mock/site/`. When the api exists, these hooks fetch instead and the screens stay the same.
- **Theme:** site routes set `data-theme="site"` on `<html>` (see `app/main.tsx`). That theme redefines the shared tokens in `shared/styles/tokens.css` to white, black and Kaleva red (`#d80016`, sampled from the designs). Room and dev pages keep the dark theme. Components use token classes only, never raw colours.
- **Layout:** full width, like YouTube. `SiteLayout` owns the sidebar. Home, rewards and the placeholder pages dock it at the far left on screens of 1024px and up, and the hamburger hides or shows it (the choice is remembered). Match pages, and every page below 1024px, open it as a drawer from the left over a 50% black layer. Esc, the layer or the menu button closes it.
- **Fonts:** Playfair Display for editorial headlines, Inter for the UI (Google Fonts, linked in `index.html`).
- **Images:** placeholders in `public/placeholders/` (team circles, initials, rink gradients). Every path lives in the mock data, so real images are a data change.
- **Reuse:** `zoneLabel` comes from `@/features/stakes`, and the match story is a story `Content`.

## Routes

| route                                                    | screen                                                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/`                                                      | `SportsHome`                                                                           |
| `/match/:id`                                             | `MatchPage`: `LiveMatch` or `FinishedMatch` by status, `Placeholder` for an unknown id |
| `/rewards`                                               | `Rewards`                                                                              |
| `/calls`, `/calls/history`, `/achievements`, `/settings` | `Placeholder` ("Coming soon")                                                          |

Mock match ids: `karpat-assat-live`, `karpat-assat-final`.

## Local-only behaviour (until the api lands)

- **Call It!:** answers, the countdown and the reveal (`components/use-call-it.ts`). One state per page shared by the side card, the tab and the mobile sheet.
- **Discussion:** comments post to a local list.
- **Other buttons:** Invite copies the room link. Reminder, subscribe and offer buttons show toasts.
- **Rooms:** "Join room" links to the real watch party rooms (`/room/:code`, `/host`, `/screen`).

## Test alone

- `npm run dev`, then open the routes above at 1440, 768 and 390 px.
- `npm test -- features/site` runs the copy guardrails over all mock text, plus data and format checks.

## Todo

- Fetch from the api in `data.ts`, and send the Call It! result from the server after the call locks.
- Real images, video and lineups. "View all" and "Full table" links.
- The date selector is static.
