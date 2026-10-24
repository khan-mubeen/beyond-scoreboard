// demo data: the profile "Mikko Korhonen", 10 leaderboard fans with points (this week and
// earlier), and a few comments. safe to run twice: existing seed users are left alone.
// the reward config lives in features/site/server/rewards.config.json. run: npm run db:seed
export {};

try {
  process.loadEnvFile(".env");
} catch {
  // no .env, use the shell environment
}

const { checkDb, getDb } = await import("./index");
const mode = await checkDb();
const db = getDb();

// fictional fans; [name, points this week, points earlier this season]
const FANS: [string, number, number][] = [
  ["Mikko Korhonen", 120, 1130],
  ["Laura Nieminen", 340, 2000],
  ["Jussi Virtanen", 180, 800],
  ["Emilia Laine", 160, 600],
  ["Antti Heikkinen", 140, 550],
  ["Sanna Mäkinen", 100, 420],
  ["Ville Hämäläinen", 80, 380],
  ["Noora Koskinen", 60, 300],
  ["Petteri Lehto", 40, 260],
  ["Aino Salminen", 20, 140],
  ["Oskari Järvinen", 0, 90],
];

const slug = (name: string) => name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-");
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

let created = 0;
const ids: string[] = [];
for (const [name, week, earlier] of FANS) {
  const anonId = `seed:${slug(name)}`;
  let user = await db.users.getByAnonId(anonId);
  if (!user) {
    user = await db.users.create(anonId, name);
    created++;
    // "this week" points land a day ago, earlier points three weeks back
    if (week) await db.points.award({ userId: user.id, matchId: null, callId: null, points: week, reason: "seed: calls this week", createdAt: hoursAgo(20) });
    if (earlier) await db.points.award({ userId: user.id, matchId: null, callId: null, points: earlier, reason: "seed: earlier this season", createdAt: hoursAgo(24 * 21) });
  }
  ids.push(user.id);
}

// a couple of comments on the most recent finished game in the snapshot, if there is one
const recentMatch = process.env.SEED_MATCH_ID ?? "2027-2701404";
const existing = await db.comments.list(recentMatch, 5);
if (existing.length === 0) {
  const lines = ["What a turning point in the second period!", "The playoff race is getting interesting.", "That power play was clinical."];
  for (const [i, text] of lines.entries()) await db.comments.create({ matchId: recentMatch, userId: ids[i + 1], text });
}

console.log(`seed done (${mode}): ${created} new fans, ${FANS.length - created} already there; comments on ${recentMatch}`);
console.log("rewards config: features/site/server/rewards.config.json");
