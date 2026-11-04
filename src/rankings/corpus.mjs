// Bounded corpus assembly for archived rankings.
// Every record keeps its provenance. Only events whose published methodology is
// a competitive Elo rating are included; participation points are not ratings.
export const PROVIDER = "DebateDrills x NSD x DebateLand";
export const METHODOLOGY =
  "Elo rating from published tournament results, as computed by the source project.";
export const SUPPORTED_EVENTS = ["LD", "PF"];
// The rating archive abbreviates events that the official packet spells out.
// Both must resolve to one event so a competitor is not split in two.
const EVENT_ALIASES = {
  LD: "Lincoln-Douglas",
  PF: "Public Forum",
  CX: "Policy Debate",
  Policy: "Policy Debate",
  Congress: "Congressional Debate",
  Parli: "Parliamentary",
};
export function canonicalEvent(event) {
  const name = String(event ?? "").trim();
  return EVENT_ALIASES[name] || name;
}

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
    // Events are declared by their source group. Elo events come from the
    // rating archive; placement events come from official results packets.
    if (!group.event) continue;
    const event = canonicalEvent(group.event);
    seen.add(group.season + "|" + event);
    for (const row of group.rankings || []) {
      const key = [group.season, event, row.code].join("|");
      const existing = byKey.get(key);
      // The same entry can appear in both full and top-500 exports.
      if (existing && existing.rank <= row.rank) continue;
      byKey.set(key, {
        season: group.season,
        event,
        code: row.code,
        name: row.name,
        rank: row.rank,
        elo: row.elo ?? null,
        school: row.school ?? null,
        tournament: group.tournament || null,
        tournamentUrl: group.tournamentUrl || null,
        provider: group.provider || PROVIDER,
        methodology: group.methodology || METHODOLOGY,
        sourceUrl: group.sourceUrl || sourceUrl,
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
    events: [...new Set(competitors.map((c) => c.event))].sort(),
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

// Share identical provenance, not merely a publisher name: one publisher can
// publish multiple tournaments, seasons and methodologies.
export function serializeCorpus(corpus) {
  const sources = [];
  const sourceIndices = new Map();
  const rows = corpus.competitors.map((c) => {
    const source = {
      provider: c.provider,
      methodology: c.methodology,
      sourceUrl: c.sourceUrl,
      tournament: c.tournament,
      tournamentUrl: c.tournamentUrl,
    };
    const key = JSON.stringify(source);
    if (!sourceIndices.has(key)) {
      sourceIndices.set(key, sources.length);
      sources.push(source);
    }
    return [
      c.season, c.event, c.code, c.name, c.rank, c.elo, c.school,
      sourceIndices.get(key),
    ];
  });
  return {
    generatedAt: corpus.generatedAt,
    window: corpus.window,
    provider: corpus.provider,
    methodology: corpus.methodology,
    sourceUrl: corpus.sourceUrl,
    events: corpus.events,
    seasons: corpus.seasons,
    cohorts: corpus.cohorts,
    sources,
    rows,
  };
}
export function hydrateCorpus(packed) {
  const retrievedAt = packed.generatedAt;
  return {
    ...packed,
    rows: undefined,
    competitors: (packed.rows || []).map(
      ([season, event, code, name, rank, elo, school, source_i]) => {
        const source = (packed.sources || [])[source_i] || packed;
        const provider = source.provider;
        return {
          season,
          event,
          code,
          name,
          rank,
          elo: elo ?? null,
          school: school ?? null,
          tournament: source.tournament || null,
          tournamentUrl: source.tournamentUrl || null,
          provider: provider || packed.provider,
          methodology: source.methodology || packed.methodology,
          sourceUrl: source.sourceUrl || packed.sourceUrl,
          retrievedAt,
        };
      },
    ),
  };
}
