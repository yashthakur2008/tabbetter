// Identity linking.
//
// Tabroom has no OAuth and no official API, and its paradigm pages redirect to
// a login form, so there is no anonymous way to prove that a visitor controls a
// Tabroom account. The only honest options are to collect a Tabroom password
// (which this project promises never to do) or to treat the link as a claim.
//
// This module implements the claim: a visitor points at a person who already
// appears in a tournament's *public* export, and that choice is stored on their
// own device. Nothing is verified, nothing is transmitted, and the vocabulary
// here says so. `confidence` exists to drive honest wording in the interface,
// never to imply authentication.

/** Strip case, accents, punctuation and honorifics so "O'Brien" matches "obrien". */
export function normalizeName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(?:mr|mrs|ms|mx|dr|prof|coach)\.?\s+/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Entry codes are often "Last & Last" or "School AB"; names are "First Last". */
function nameTokens(value) {
  return new Set(normalizeName(value).split(" ").filter((t) => t.length > 1));
}

/**
 * People in a public export, as linkable candidates.
 *
 * Entries can be two-person teams, so a team contributes its own record rather
 * than being split into guesses about which half is which person.
 */
export function linkableCandidates(tournament) {
  const people = [];
  for (const entry of tournament?.entries ?? []) {
    if (!entry?.id) continue;
    people.push({
      kind: "entry",
      id: String(entry.id),
      name: String(entry.code || entry.name || ""),
      school: String(entry.school || ""),
      event: String(entry.event || ""),
    });
  }
  for (const judge of tournament?.judges ?? []) {
    if (!judge?.id) continue;
    const name = String(judge.name || "");
    // Withheld judge names are not a person a visitor can recognise.
    if (!name || name === "Name not published") continue;
    people.push({
      kind: "judge",
      id: String(judge.id),
      name,
      school: String(judge.school || ""),
      event: String(judge.category || ""),
    });
  }
  return people;
}

/** Rank candidates against typed text. Returns the best matches first. */
export function searchCandidates(candidates, query, limit = 8) {
  const wanted = nameTokens(query);
  if (!wanted.size) return [];
  const scored = [];
  for (const person of candidates) {
    const have = nameTokens(person.name);
    let hits = 0;
    for (const token of wanted) {
      if (have.has(token)) hits += 1;
      // A typed prefix such as "swamin" should still find "Swaminathan".
      else if ([...have].some((t) => t.startsWith(token) || token.startsWith(t)))
        hits += 0.5;
    }
    if (!hits) continue;
    scored.push({ person, score: hits / wanted.size });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.person.name.localeCompare(b.person.name))
    .slice(0, limit)
    .map((s) => s.person);
}

/**
 * The stored claim. Deliberately small: a display name, the school and the
 * tournament it was chosen from, so later matching has something to compare.
 */
export function createClaim(person, tournamentId) {
  if (!person?.id || !person?.name) return null;
  return {
    kind: person.kind === "judge" ? "judge" : "entry",
    name: person.name,
    school: person.school || "",
    normalized: normalizeName(person.name),
    sourceTournamentId: String(tournamentId ?? ""),
    sourceEntityId: String(person.id),
    linkedAt: new Date().toISOString(),
    // Named so that no caller can mistake this for an authenticated session.
    verified: false,
  };
}

/**
 * How strongly a candidate in some *other* tournament looks like the claim.
 *
 * Names repeat across the country, so a name alone is never better than
 * "possible". Agreement on school is what separates a likely match from a
 * coincidence, and the interface is expected to say which one it is.
 */
export function matchConfidence(claim, person) {
  if (!claim || !person) return "none";
  const claimed = nameTokens(claim.normalized || claim.name);
  const found = nameTokens(person.name);
  if (!claimed.size || !found.size) return "none";
  let shared = 0;
  for (const token of claimed) if (found.has(token)) shared += 1;
  const overlap = shared / Math.max(claimed.size, found.size);
  if (overlap < 0.5) return "none";
  const sameSchool =
    claim.school && person.school &&
    normalizeName(claim.school) === normalizeName(person.school);
  if (overlap === 1 && sameSchool) return "likely";
  return "possible";
}

/** Candidates in one tournament that could be the linked person. */
export function findMatches(claim, tournament) {
  const matches = [];
  for (const person of linkableCandidates(tournament)) {
    const confidence = matchConfidence(claim, person);
    if (confidence === "none") continue;
    matches.push({ ...person, confidence });
  }
  return matches.sort((a, b) =>
    a.confidence === b.confidence ? 0 : a.confidence === "likely" ? -1 : 1,
  );
}

/**
 * Rounds involving the linked person, drawn only from published pairings.
 *
 * A tournament that has not published a round simply contributes nothing, which
 * is why the caller must not present this as a complete obligation list.
 */
export function personalSchedule(claim, tournament) {
  const matches = findMatches(claim, tournament);
  if (!matches.length) return [];
  const entryIds = new Set(matches.filter((m) => m.kind === "entry").map((m) => m.id));
  const judgeNames = new Set(
    matches.filter((m) => m.kind === "judge").map((m) => normalizeName(m.name)),
  );
  const confidence = matches.some((m) => m.confidence === "likely") ? "likely" : "possible";
  const rounds = [];
  for (const round of tournament?.rounds ?? []) {
    for (const section of round?.sections ?? []) {
      for (const ballot of section?.ballots ?? []) {
        const asEntry = ballot?.entryId && entryIds.has(String(ballot.entryId));
        const asJudge = ballot?.judge && judgeNames.has(normalizeName(ballot.judge));
        if (!asEntry && !asJudge) continue;
        rounds.push({
          role: asEntry ? "competing" : "judging",
          roundName: String(round.name || round.label || ""),
          event: String(round.event || ""),
          room: String(section.room || ""),
          flight: String(section.flight || ""),
          side: String(ballot.side || ""),
          opponent: asEntry ? "" : String(ballot.entry || ""),
          judge: asEntry ? String(ballot.judge || "") : "",
          confidence,
        });
      }
    }
  }
  return rounds;
}
