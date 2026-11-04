// Imports the public ranking archive into a bounded local corpus.
//
// Usage: node scripts/import-rankings.mjs [--from=YYYY-MM-DD] [--to=YYYY-MM-DD]
//
// Redistribution of the generated corpus is gated on source permission; see
// docs/rankings-sources.md. By default the corpus is written outside the build
// so nothing is published before that is resolved.
import fs from "node:fs";
import path from "node:path";
import { parseRankingRows } from "../src/rankings/parse.mjs";
import { buildCorpus, coverageReport, serializeCorpus, seasonWindow, SUPPORTED_EVENTS } from "../src/rankings/corpus.mjs";
import { parseNationalsEvent, buildSchoolLexicon, NATIONALS } from "../src/rankings/nationals.mjs";
import { parseNpdlRankings, NPDL } from "../src/rankings/npdl.mjs";

const REPO = "skumar-ml/debate-rankings";
const SOURCE_URL = "https://github.com/" + REPO;
const RAW = "https://raw.githubusercontent.com/" + REPO + "/master/";
const API = "https://api.github.com/repos/" + REPO + "/contents/";

const args = new Map(
  process.argv.slice(2).map((a) => a.split("=")).filter((p) => p.length === 2),
);
// Default to the last completed season only. Older seasons are available with
// an explicit --from/--to.
const from = args.get("--from") || "2025-08-01";
const to = args.get("--to") || "2026-07-31";
const out = args.get("--out") || "build/rankings-corpus.json";

async function listing(dir) {
  const response = await fetch(API + dir);
  if (!response.ok) return [];
  const body = await response.json();
  return Array.isArray(body) ? body : [];
}
async function text(url) {
  const response = await fetch(url);
  return response.ok ? response.text() : null;
}

// Season layouts differ: older seasons use <season>/<EVENT>_Rankings/, newer
// seasons use <season>/<EVENT>/. Both are probed; neither is assumed.
const CANDIDATES = (season, event) => [
  season + "/" + event + "_Rankings/" + event + "Rankings.csv",
  season + "/" + event + "_Rankings/Rankings.csv",
  season + "/" + event + "/" + event + "Rankings.csv",
  season + "/" + event + "/Rankings.csv",
];

const root = await listing("");
const seasons = root
  .filter((e) => e.type === "dir" && /^\d{4}-\d{4}$/.test(e.name))
  .map((e) => e.name)
  .sort();

const groups = [];
for (const season of seasonWindow(seasons, { from, to })) {
  for (const event of SUPPORTED_EVENTS) {
    let rankings = [];
    let found = null;
    for (const candidate of CANDIDATES(season, event)) {
      const body = await text(RAW + candidate);
      if (body === null) continue;
      rankings = parseRankingRows(body);
      found = candidate;
      if (rankings.length) break;
    }
    groups.push({ season, event, rankings });
    console.log(
      "JCODE_PROGRESS " +
        JSON.stringify({
          message: season + " " + event + ": " + rankings.length + " rows" + (found ? "" : " (no ranking file)"),
        }),
    );
  }
}

// NSDA National Tournament: official placements across every event it reports.
// The packet is a PDF, so its extracted sections are supplied by
// scripts/extract-nationals.mjs and cached next to the corpus.
const nationalsPath = args.get("--nationals") || "build/nationals-sections.json";
if (seasonWindow([NATIONALS.season], { from, to }).length && fs.existsSync(nationalsPath)) {
  const sections = JSON.parse(fs.readFileSync(nationalsPath, "utf8"));
  const lexicon = buildSchoolLexicon(sections);
  for (const [event, text] of Object.entries(sections)) {
    const placed = parseNationalsEvent(event, text, lexicon);
    if (!placed.length) continue;
    groups.push({
      season: NATIONALS.season,
      event,
      provider: NATIONALS.provider,
      methodology: NATIONALS.methodology,
      sourceUrl: NATIONALS.sourceUrl,
      tournament: NATIONALS.tournament,
      tournamentUrl: NATIONALS.tournamentUrl,
      rankings: placed.map((row) => ({
        rank: row.place,
        code: row.code,
        name: row.names.join(" & "),
        elo: null,
        school: row.school,
      })),
    });
    console.log(
      "JCODE_PROGRESS " +
        JSON.stringify({ message: "nationals " + event + ": " + placed.length + " placed" }),
    );
  }
}

// NPDL parliamentary team rankings.
const npdlCsv =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQF5psWXOYYAiwJxzm1gdz0lLxHgfz1L1tgBj_Vu_hxkNafIIspTG2ToRuQIsUbaYqOK3I2puooSryQ/pub?gid=1327342258&single=true&output=csv";
const npdlBody = seasonWindow([NPDL.season], { from, to }).length
  ? await text(npdlCsv)
  : null;
if (npdlBody) {
  const teams = parseNpdlRankings(npdlBody);
  if (teams.length)
    groups.push({
      season: NPDL.season,
      event: NPDL.event,
      provider: NPDL.provider,
      methodology: NPDL.methodology,
      sourceUrl: NPDL.sourceUrl,
      rankings: teams.map((t) => ({
        rank: t.rank,
        // A parliamentary entry is a team; the school plus both surnames is
        // the published identity.
        code: [t.school, t.names.join(" & ")].filter(Boolean).join(" "),
        name: t.names.join(" & "),
        elo: t.points,
        school: t.school,
      })),
    });
  console.log(
    "JCODE_PROGRESS " + JSON.stringify({ message: "NPDL: " + teams.length + " teams" }),
  );
}

const corpus = buildCorpus(groups, {
  from,
  to,
  sourceUrl: SOURCE_URL,
  retrievedAt: new Date().toISOString(),
});
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(serializeCorpus(corpus)));
console.table(coverageReport(corpus));
console.log(
  "Wrote " + out + " · " + corpus.competitors.length + " competitors · " +
    (fs.statSync(out).size / 1024).toFixed(1) + " KB",
);
