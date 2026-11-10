// National Parliamentary Debate League rankings.
//
// NPDL publishes a team ranking: two debaters share one entry and one point
// total. It is never presented as an individual rating.
export const NPDL = {
  provider: "National Parliamentary Debate League",
  event: "Parliamentary",
  entryKind: "team",
  season: "2026-2027",
  // NPDL publishes a rolling current-season table; the season matches the page.
  methodology:
    "Season points from published tournament results, as computed by the NPDL under Article XXI.",
  sourceUrl: "https://www.parliamentarydebate.org/rankings-2026-27",
};

export function parseNpdlRankings(text) {
  const rows = [];
  // Each line is parsed in place. Ranks repeat across regions, so a row must
  // never be looked up by its rank.
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const cells = line.split(",");
    if (cells.length < 6) continue;
    const rank = Number(String(cells[0] ?? "").trim());
    const points = Number(String(cells[5] ?? "").trim());
    if (!Number.isInteger(rank) || rank < 1) continue;
    if (!Number.isFinite(points)) continue;
    const names = [cells[3], cells[4]]
      .map((n) => String(n ?? "").trim())
      .filter(Boolean);
    if (!names.length) continue;
    rows.push({
      rank,
      school: String(cells[1] ?? "").trim(),
      region: String(cells[2] ?? "").trim(),
      names,
      points,
    });
  }
  return rows;
}
