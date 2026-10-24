// pure: finnish case forms of the 17 liiga team names. finnish inflects names ("Kärppien voitto",
// "Tapparalle"), so templates ask for a form ({F2:gen}) instead of gluing endings on, and the
// validator accepts any listed form of a known team. abbreviations take a colon (HIFK:n), and
// their vowel harmony follows how they are said (HIFK = "hoo-ii-äf-koo" -> HIFK:ta, HIFK:hon)

export const FI_CASES = ["nom", "gen", "par", "ine", "ela", "ill", "ade", "abl", "all", "ess"] as const;
export type FiCase = (typeof FI_CASES)[number];

type Forms = Record<FiCase, string>;
const forms = (...f: string[]): Forms => Object.fromEntries(FI_CASES.map((c, i) => [c, f[i]])) as Forms;

/** nominative, genitive, partitive, inessive, elative, illative, adessive, ablative, allative, essive */
export const FI_TEAM_FORMS: Record<string, Forms> = {
  HIFK: forms("HIFK", "HIFK:n", "HIFK:ta", "HIFK:ssa", "HIFK:sta", "HIFK:hon", "HIFK:lla", "HIFK:lta", "HIFK:lle", "HIFK:na"),
  HPK: forms("HPK", "HPK:n", "HPK:ta", "HPK:ssa", "HPK:sta", "HPK:hon", "HPK:lla", "HPK:lta", "HPK:lle", "HPK:na"),
  Ilves: forms("Ilves", "Ilveksen", "Ilvestä", "Ilveksessä", "Ilveksestä", "Ilvekseen", "Ilveksellä", "Ilvekseltä", "Ilvekselle", "Ilveksenä"),
  Jokerit: forms("Jokerit", "Jokereiden", "Jokereita", "Jokereissa", "Jokereista", "Jokereihin", "Jokereilla", "Jokereilta", "Jokereille", "Jokereina"),
  Jukurit: forms("Jukurit", "Jukurien", "Jukureita", "Jukureissa", "Jukureista", "Jukureihin", "Jukureilla", "Jukureilta", "Jukureille", "Jukureina"),
  JYP: forms("JYP", "JYP:n", "JYP:tä", "JYP:ssä", "JYP:stä", "JYP:hen", "JYP:llä", "JYP:ltä", "JYP:lle", "JYP:nä"),
  "K-Espoo": forms("K-Espoo", "K-Espoon", "K-Espoota", "K-Espoossa", "K-Espoosta", "K-Espooseen", "K-Espoolla", "K-Espoolta", "K-Espoolle", "K-Espoona"),
  KalPa: forms("KalPa", "KalPan", "KalPaa", "KalPassa", "KalPasta", "KalPaan", "KalPalla", "KalPalta", "KalPalle", "KalPana"),
  KooKoo: forms("KooKoo", "KooKoon", "KooKoota", "KooKoossa", "KooKoosta", "KooKoohon", "KooKoolla", "KooKoolta", "KooKoolle", "KooKoona"),
  Kärpät: forms("Kärpät", "Kärppien", "Kärppiä", "Kärpissä", "Kärpistä", "Kärppiin", "Kärpillä", "Kärpiltä", "Kärpille", "Kärppinä"),
  Lukko: forms("Lukko", "Lukon", "Lukkoa", "Lukossa", "Lukosta", "Lukkoon", "Lukolla", "Lukolta", "Lukolle", "Lukkona"),
  Pelicans: forms("Pelicans", "Pelicansin", "Pelicansia", "Pelicansissa", "Pelicansista", "Pelicansiin", "Pelicansilla", "Pelicansilta", "Pelicansille", "Pelicansina"),
  SaiPa: forms("SaiPa", "SaiPan", "SaiPaa", "SaiPassa", "SaiPasta", "SaiPaan", "SaiPalla", "SaiPalta", "SaiPalle", "SaiPana"),
  Sport: forms("Sport", "Sportin", "Sporttia", "Sportissa", "Sportista", "Sporttiin", "Sportilla", "Sportilta", "Sportille", "Sporttina"),
  Tappara: forms("Tappara", "Tapparan", "Tapparaa", "Tapparassa", "Tapparasta", "Tapparaan", "Tapparalla", "Tapparalta", "Tapparalle", "Tapparana"),
  TPS: forms("TPS", "TPS:n", "TPS:ää", "TPS:ssä", "TPS:stä", "TPS:ään", "TPS:llä", "TPS:ltä", "TPS:lle", "TPS:nä"),
  Ässät: forms("Ässät", "Ässien", "Ässiä", "Ässissä", "Ässistä", "Ässiin", "Ässillä", "Ässiltä", "Ässille", "Ässinä"),
};

/** a team name in a case; a name not in the table stays as it is (never a guessed ending) */
export function teamCase(name: string, c: FiCase): string {
  return FI_TEAM_FORMS[name]?.[c] ?? name;
}

export const isTeamName = (name: string) => name in FI_TEAM_FORMS;

/** every listed form of a team, for the validator */
export const teamForms = (name: string): string[] => (FI_TEAM_FORMS[name] ? Object.values(FI_TEAM_FORMS[name]) : []);

/** a finnish surname's genitive, for the validator to accept "Virtasen" for "Virtanen" (nominative and genitive only) */
export function surnameGenitive(surname: string): string {
  if (surname.endsWith("nen")) return `${surname.slice(0, -3)}sen`;
  if (/[aeiouyäö]$/i.test(surname)) return `${surname}n`;
  return `${surname}in`;
}

/** the goal kinds the ledger has (english labels) in finnish, as adverbs: "ylivoimalla" */
export const FI_GOAL_KIND: Record<string, string> = {
  "power play": "ylivoimalla",
  "5-on-3 power play": "kahden miehen ylivoimalla",
  shorthanded: "alivoimalla",
  "empty net": "tyhjään maaliin",
  "extra attacker": "ilman maalivahtia",
  "penalty shot": "rangaistuslaukauksesta",
  "shootout goal": "voittolaukauksesta",
};
