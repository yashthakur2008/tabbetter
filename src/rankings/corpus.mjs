// Bounded corpus assembly for archived rankings.
// Every record keeps its provenance. Only events whose published methodology is
// a competitive Elo rating are included; participation points are not ratings.
export const PROVIDER = "DebateDrills x NSD x DebateLand";
export const METHODOLOGY =
  "Elo rating from published tournament results, as computed by the source project.";
export const SUPPORTED_EVENTS = ["LD", "PF"];

function seasonSpan(season) {
  const match = /^(\d{4})-(\d{4})$/.exec(String(season ?? ""));
  if (!match) return null;
  // Competition seasons run roughly August through July.
  return { start: Date.UTC(Number(match[1]), 7, 1), end: Date.UTC(Number(match[2]), 6, 31) };
}

export function seasonWindow(seasons, { from, to }) {
  const fromTime = Date.parse(from);
  const toTime = Date.parse(to);
  return (seasons || []).filter((season) => {
    const span = seasonSpan(season);
    if (!span) return false;
    return span.end >= fromTime && span.start <= toTime;
  });
}

export function buildCorpus(groups, options) {
  const { from, to, sourceUrl, retrievedAt } = options;
  const seasons = new Set(seasonWindow((groups || []).map((g) => g.season), options));
  const byKey = new Map();
  const seen = new Set();
  for (const group of groups || []) {
    if (!seasons.has(group.season)) continue;
    if (!SUPPORTED_EVENTS.includes(group.event)) continue;
    seen.add(group.season + "|" + group.event);
    for (const row of group.rankings || []) {
      const key = [group.season, group.event, row.code].join("|");
      const existing = byKey.get(key);
      // The same entry can appear in both full and top-500 exports.
      if (existing && existing.rank <= row.rank) continue;
      byKey.set(key, {
        season: group.season,
        event: group.event,
        code: row.code,
        name: row.name,
        rank: row.rank,
        elo: row.elo,
        provider: PROVIDER,
        methodology: METHODOLOGY,
        sourceUrl,
        retrievedAt,
      });
    }
  }
  const competitors = [...byKey.values()];
  return {
    generatedAt: new Date(retrievedAt || Date.now()).toISOString(),
    window: { from, to },
    provider: PROVIDER,
    methodology: METHODOLOGY,
    sourceUrl,
    events: SUPPORTED_EVENTS.filter((event) =>
      competitors.some((c) => c.event === event),
    ),
    seasons: [...seasons].sort(),
    cohorts: [...seen].sort(),
    competitors,
  };
}

export function coverageReport(corpus) {
  const rows = [];
  for (const cohort of corpus?.cohorts || []) {
    const [season, event] = cohort.split("|");
    const competitors = corpus.competitors.filter(
      (c) => c.season === season && c.event === event,
    ).length;
    rows.push({ season, event, competitors, covered: competitors > 0 });
  }
  return rows;
}

// Provenance is identical across rows, so storage keeps it once on the corpus
// and rehydration reattaches it to every record.
export function serializeCorpus(corpus) {
  return {
    generatedAt: corpus.generatedAt,
    window: corpus.window,
    provider: corpus.provider,
    methodology: corpus.methodology,
    sourceUrl: corpus.sourceUrl,
    events: corpus.events,
    seasons: corpus.seasons,
    cohorts: corpus.cohorts,
    rows: corpus.competitors.map((c) => [c.season, c.event, c.code, c.name, c.rank, c.elo]),
  };
}
export function hydrateCorpus(packed) {
  const retrievedAt = packed.generatedAt;
  return {
    ...packed,
    rows: undefined,
    competitors: (packed.rows || []).map(([season, event, code, name, rank, elo]) => ({
      season,
      event,
      code,
      name,
      rank,
      elo,
      provider: packed.provider,
      methodology: packed.methodology,
      sourceUrl: packed.sourceUrl,
      retrievedAt,
    })),
  };
}
