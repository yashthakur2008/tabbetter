// Imports the public ranking archive into a bounded local corpus.
//
// Usage: node scripts/import-rankings.mjs [--from YYYY-MM-DD] [--to YYYY-MM-DD]
//
// Redistribution of the generated corpus is gated on source permission; see
// docs/rankings-sources.md. By default the corpus is written outside the build
// so nothing is published before that is resolved.
import fs from "node:fs";
import path from "node:path";
import { parseRankingRows } from "../src/rankings/parse.mjs";
import { buildCorpus, coverageReport, serializeCorpus, SUPPORTED_EVENTS } from "../src/rankings/corpus.mjs";

const REPO = "skumar-ml/debate-rankings";
const SOURCE_URL = "https://github.com/" + REPO;
const RAW = "https://raw.githubusercontent.com/" + REPO + "/master/";
const API = "https://api.github.com/repos/" + REPO + "/contents/";

const args = new Map(
  process.argv.slice(2).map((a) => a.split("=")).filter((p) => p.length === 2),
);
const from = args.get("--from") || "2021-10-28";
const to = args.get("--to") || "2026-10-28";
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
for (const season of seasons) {
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
