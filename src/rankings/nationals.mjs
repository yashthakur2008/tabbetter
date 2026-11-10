// Parser for the NSDA National Tournament results packet.
//
// The packet publishes a placement table per event with the columns
// `Code Name School State ... Place`. Rows without a published place are
// discarded rather than assigned a rank.
export const NATIONALS = {
  season: "2025-2026",
  tournament: "NSDA National Tournament",
  location: "Richmond, Virginia",
  provider: "National Speech & Debate Association",
  methodology:
    "Official national placement published in the tournament results packet.",
  sourceUrl:
    "https://s3.amazonaws.com/tabroom-files/tourns/37602/results/70808/2026-NationalSpeechAndDebateTournament-ResultsPacketv2.pdf",
  // The packet is published under this Tabroom tournament, so a ranking can be
  // traced back to the pairings and results it came from.
  tournamentUrl:
    "https://www.tabroom.com/index/tourn/index.mhtml?tourn_id=37602",
  events: [
    "Dramatic Interp",
    "Duo Interp",
    "Humorous Interp",
    "Informative Speaking",
    "International Extemp",
    "Original Oratory",
    "Program Oral Interp",
    "United States Extemp",
    "Lincoln-Douglas",
    "Policy Debate",
    "Public Forum",
    "Congressional Debate",
    "Extemporaneous Debate",
    "Extemp Commentary",
    "Expository",
    "Original Spoken Word Poetry",
    "Prose",
    "Impromptu",
    "Poetry",
    "Storytelling",
  ],
};

// Words that appear inside a school name and therefore cannot end a person's
// name. Used only to reject truncated school fragments.
const SCHOOL_TAIL =
  /^(High|Senior|Sr|Jr|Junior|Middle|Prep|Preparatory|Catholic|Christian|Collegiate|College|Community|Country|Day|Episcopal|Charter|Magnet|Memorial|Central|North|South|East|West|Valley|Hills|Park|Ridge|Lake|Academy|Academies|Institute|International|Regional|Township|County|City|Area|Union|Public|Independent|Classical|Science|Arts|Technology|STEM|Early|New|Saint|St|Mount|Mt)$/i;

// A lone word that completes a wrapped school name.
// A wrapped school name continues on the next line, which starts with the
// remaining school word and then runs into the state and score columns.
const SCHOOL_TAIL_WORD =
  /^(School|Schools|Academy|Academies|HS|High|Prep|College|University|Institute|Campus|Center|Centre)\b/i;

export function parsePlacement(text) {
  const match = /^(\d{1,3})(st|nd|rd|th)$/.exec(String(text ?? "").trim());
  return match ? Number(match[1]) : null;
}

// School names end immediately before the two-letter state code, which is the
// last token before the score columns begin.
const STATE = /\b([A-Z]{2})\b/;

function splitEntry(text) {
  const match = STATE.exec(text);
  if (!match) return null;
  const before = text.slice(0, match.index).trim();
  return { before, state: match[1], after: text.slice(match.index + 2).trim() };
}

// School names repeat across many entries while personal names do not, so the
// boundary is learned from the data instead of guessed from keywords.
export function buildSchoolLexicon(sections) {
  const counts = new Map();
  for (const text of Object.values(sections || {}))
    for (const line of String(text ?? "").split(/\r?\n/)) {
      const parts = splitEntry(line.trim());
      if (!parts) continue;
      const words = parts.before.split(/\s+/).filter(Boolean);
      // Every suffix of two or more words is a school candidate.
      for (let i = 1; i < words.length; i++) {
        const suffix = words.slice(i).join(" ");
        if (suffix.length < 4) continue;
        if (!counts.has(suffix)) counts.set(suffix, new Set());
        counts.get(suffix).add(words.slice(0, i).join(" "));
      }
    }
  // A suffix is a school only if several different names precede it. A
  // duplicated "surname + school" string has a single distinct prefix and is
  // rejected. A fragment such as "School" is rejected separately because the
  // word before it is almost always part of the same school name.
  const lexicon = new Map();
  for (const [suffix, prefixes] of counts) {
    if (prefixes.size < 3) continue;
    // Reject a fragment: if nearly every prefix ends in a school word, the
    // suffix is the tail of a longer school name rather than a whole one.
    let schoolish = 0;
    for (const prefix of prefixes) {
      const last = prefix.split(/\s+/).pop() || "";
      if (SCHOOL_TAIL.test(last)) schoolish++;
    }
    if (schoolish / prefixes.size > 0.5) continue;
    lexicon.set(suffix, prefixes.size);
  }
  return lexicon;
}

function splitNameSchool(before, lexicon) {
  const words = String(before ?? "").split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;
  // Take the longest known school suffix. Personal names are one to four
  // words, so the school may not start before the second word. The longest
  // match avoids leaving a trailing surname inside the school name.
  for (let i = 1; i <= Math.min(4, words.length - 1); i++) {
    const suffix = words.slice(i).join(" ");
    if (lexicon?.has(suffix))
      return { name: words.slice(0, i).join(" "), school: suffix };
  }
  return null;
}

// Guards against a mis-split row being published: a personal name is one to
// four words and a school is never a bare fragment.
function isPlausibleEntry({ name, school }) {
  if (!name || !school) return false;
  if (/^(HS|School|High School|Academy)$/i.test(school.trim())) return false;
  const words = name.trim().split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  return !/Code Name|Finalists|Spoke|Place/i.test(name + " " + school);
}

export function parseNationalsEvent(event, text, lexicon) {
  const rows = [];
  const raw = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  // The packet wraps long school names onto the next line. A short trailing
  // fragment that completes a school name belongs to the line above.
  const lines = [];
  for (const line of raw) {
    const prev = lines[lines.length - 1];
    if (prev && SCHOOL_TAIL_WORD.test(line) && !/^[A-Z]?\d{3,5}\s/.test(line) && !STATE.test(prev))
      lines[lines.length - 1] = prev + " " + line;
    else lines.push(line);
  }
  let pendingCode = null;
  let pendingNames = [];
  for (const line of lines) {
    // Page breaks repeat the table header and award captions. These are not
    // entries and must not be absorbed into a pending team.
    if (/Code\s+Name\s+School/i.test(line) || /^(Finalists|Spoke|Place|Elims|Semis)\b/i.test(line)) {
      pendingCode = null;
      pendingNames = [];
      continue;
    }
    const start = /^([A-Z]?\d{3,5})\s+(.*)$/.exec(line);
    if (start) {
      // A new entry begins. Any entry still waiting for its school line had no
      // published placement and is dropped.
      pendingCode = start[1];
      pendingNames = [];
      const body = start[2];
      const place = parsePlacement(body.split(/\s+/).pop());
      const parts = splitEntry(body);
      if (!parts || place === null) {
        // Either the names continue on the next line, or this row is unplaced.
        pendingNames = [body.trim()];
        if (parts && place === null) pendingNames = [];
        continue;
      }
      const split = splitNameSchool(parts.before, lexicon);
      // A row whose school cannot be identified is discarded rather than
      // published with a guessed name/school boundary.
      if (!split || !isPlausibleEntry(split)) continue;
      rows.push({
        event,
        code: pendingCode,
        names: [split.name],
        school: split.school,
        state: parts.state,
        place,
      });
      pendingCode = null;
      pendingNames = [];
      continue;
    }
    if (!pendingCode) continue;
    const parts = splitEntry(line);
    const place = parsePlacement(line.split(/\s+/).pop());
    if (!parts || place === null) {
      // A continuation line carrying a second team member's name.
      if (/^[A-Z][A-Za-z'’.\-]*( [A-Z][A-Za-z'’.\-]*){0,3}$/.test(line))
        pendingNames.push(line.trim());
      else {
        pendingCode = null;
        pendingNames = [];
      }
      continue;
    }
    const school = parts.before.trim();
    if (pendingNames.length && school && isPlausibleEntry({ name: pendingNames[0], school }))
      rows.push({
        event,
        code: pendingCode,
        names: pendingNames.slice(),
        school,
        state: parts.state,
        place,
      });
    pendingCode = null;
    pendingNames = [];
  }
  return rows;
}

