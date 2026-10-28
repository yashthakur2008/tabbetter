// Identity resolution for archived competitors.
// Codes identify a tournament entry, not necessarily one person. Names are
// never merged across institutions, and a team entry is never split.
const TEAM_SEPARATOR = /\s(?:&|and)\s|\//i;
// A bare two-letter token is ambiguous when it is also a US state code:
// "CA" may mean California or Canada. Such values yield no location at all.
const US_STATES = new Set(
  ("AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO " +
    "MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC")
    .split(" "),
);

export function competitorKey({ season, event, code }) {
  return JSON.stringify([String(season ?? ""), String(event ?? ""), String(code ?? "")]);
}

export function parseLocation(location) {
  const text = String(location ?? "").trim();
  const [first, second] = text.split("/").map((part) => part.trim());
  // Only an explicit "<STATE>/US" pair establishes a US state. A bare token is
  // ambiguous in the source data and yields no state.
  if (second === "US" && /^[A-Z]{2}$/.test(first || ""))
    return { state: first, country: "US" };
  if (!second && /^[A-Z]{2,3}$/.test(first || "") && first !== "US" && !US_STATES.has(first))
    return { state: null, country: first };
  return { state: null, country: null };
}

export function linkRoster(entries) {
  const roster = new Map();
  for (const entry of entries || []) {
    const code = String(entry?.code ?? "").trim();
    if (!code) continue;
    const existing = roster.get(code) || {
      names: [],
      institution: String(entry?.institution ?? "").trim() || null,
      location: String(entry?.location ?? "").trim(),
    };
    const name = String(entry?.entry ?? "").trim();
    if (name && !existing.names.includes(name)) existing.names.push(name);
    if (existing.institution !== (String(entry?.institution ?? "").trim() || null))
      existing.conflictingInstitution = true;
    roster.set(code, existing);
  }
  return roster;
}

export function resolvePerson(code, roster) {
  const record = roster?.get?.(String(code ?? ""));
  if (!record)
    return { status: "unknown", name: null, institution: null, state: null };
  const { state } = parseLocation(record.location);
  const institution = record.institution || null;
  const single = record.names.length === 1 ? record.names[0] : null;
  // Multiple roster names, or one name holding a team separator, means the
  // entry covers more than one competitor.
  if (!single || TEAM_SEPARATOR.test(single) || record.conflictingInstitution)
    return { status: "ambiguous", name: null, institution, state };
  return { status: "resolved", name: single, institution, state };
}
