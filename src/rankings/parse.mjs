// Parsers for the public NSD x DebateDrills x DebateLand ranking archive.
// Source values are preserved verbatim. Missing data stays null; it is never
// rounded to zero or reinterpreted as a loss.
function splitLines(text) {
  if (typeof text !== "string") return [];
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
}
function splitRow(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        value += '"';
        i++;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      fields.push(value);
      value = "";
    } else value += char;
  }
  fields.push(value);
  return fields;
}
function number(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}
export function parseRankingRows(text) {
  const rows = [];
  for (const line of splitLines(text)) {
    const [rank, code, name, elo] = splitRow(line);
    const rankValue = number(rank);
    const eloValue = number(elo);
    if (rankValue === null || eloValue === null) continue;
    if (!String(code || "").trim() || !String(name || "").trim()) continue;
    rows.push({
      rank: rankValue,
      code: String(code),
      name: String(name).trim(),
      elo: eloValue,
    });
  }
  return rows;
}
export function parseEntries(text) {
  const lines = splitLines(text);
  const entries = [];
  for (const line of lines.slice(1)) {
    const [institution, location, entry, code, record] = splitRow(line);
    if (!String(code || "").trim()) continue;
    entries.push({
      institution: String(institution ?? "").trim(),
      location: String(location ?? "").trim(),
      entry: String(entry ?? "").trim(),
      code: String(code).trim(),
      record: String(record ?? "").trim(),
    });
  }
  return entries;
}
export function parseRoundRows(text) {
  const lines = splitLines(text);
  const rows = [];
  for (const line of lines.slice(1)) {
    const [aff, neg, judge, win, affPoints, negPoints] = splitRow(line);
    const side = String(win ?? "").trim().toLowerCase();
    if (!String(aff ?? "").trim() && !String(neg ?? "").trim()) continue;
    rows.push({
      aff: String(aff ?? "").trim(),
      neg: String(neg ?? "").trim(),
      judge: String(judge ?? "").trim(),
      // Only an explicit Aff or Neg is a published outcome.
      winner: side === "aff" ? "aff" : side === "neg" ? "neg" : null,
      affPoints: number(affPoints),
      negPoints: number(negPoints),
    });
  }
  return rows;
}
