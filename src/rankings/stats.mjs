// Performance statistics over archived rounds.
// Only published outcomes count. Missing decisions are excluded and disclosed,
// never converted into losses, and averages are never taken over zero rounds.
function sideOf(row, code) {
  if (row?.aff === code) return "aff";
  if (row?.neg === code) return "neg";
  return null;
}

export function sideSplit(rows, code) {
  const split = {
    aff: { wins: 0, losses: 0 },
    neg: { wins: 0, losses: 0 },
    excluded: 0,
    sampleSize: 0,
  };
  for (const row of rows || []) {
    const side = sideOf(row, code);
    if (!side) continue;
    if (!row.winner) {
      split.excluded += 1;
      continue;
    }
    split[side][row.winner === side ? "wins" : "losses"] += 1;
    split.sampleSize += 1;
  }
  return split;
}

export function speakerTrend(rows, code) {
  const byTournament = new Map();
  for (const row of rows || []) {
    const side = sideOf(row, code);
    if (!side) continue;
    const points = side === "aff" ? row.affPoints : row.negPoints;
    if (points === null || points === undefined) continue;
    const key = row.tournament ?? "";
    const bucket = byTournament.get(key) || { total: 0, rounds: 0 };
    bucket.total += points;
    bucket.rounds += 1;
    byTournament.set(key, bucket);
  }
  const trend = [];
  for (const [tournament, { total, rounds }] of byTournament) {
    if (!rounds) continue;
    trend.push({
      tournament,
      average: Math.round((total / rounds) * 100) / 100,
      rounds,
    });
  }
  return trend;
}

export function opponentSummary(rows, code) {
  const opponents = new Map();
  for (const row of rows || []) {
    const side = sideOf(row, code);
    if (!side) continue;
    const opponent = side === "aff" ? row.neg : row.aff;
    if (!opponent || opponent === code) continue;
    const record = opponents.get(opponent) || {
      opponent,
      meetings: 0,
      wins: 0,
      losses: 0,
    };
    record.meetings += 1;
    if (row.winner) record[row.winner === side ? "wins" : "losses"] += 1;
    opponents.set(opponent, record);
  }
  return [...opponents.values()];
}
