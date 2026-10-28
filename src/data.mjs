// Convert markup into plain text, never sanitized HTML. The interface must
// escape these values before inserting them into any markup context.
const entities = {
  amp: "&",
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
};
function decodeEntitiesOnce(text) {
  return text.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z][a-z0-9]+));/gi,
    (whole, decimal, hex, named) => {
      if (named) return entities[named] ?? whole;
      const cp = decimal ? Number(decimal) : parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff && !(cp >= 0xd800 && cp <= 0xdfff)
        ? String.fromCodePoint(cp)
        : "�";
    },
  );
}
function tagEnd(html, start) {
  let quote = null;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return -1;
}
export function clean(value) {
  const html = String(value ?? ""),
    lower = html.toLowerCase();
  let out = "",
    i = 0,
    raw = null;
  while (i < html.length) {
    if (raw) {
      let close = lower.indexOf("</" + raw, i);
      while (close >= 0 && !/[\s/>]/.test(lower[close + raw.length + 2] || ">"))
        close = lower.indexOf("</" + raw, close + 2);
      if (close < 0) break;
      const end = tagEnd(html, close + 2);
      if (end < 0) break;
      i = end + 1;
      raw = null;
      out += " ";
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const end = html.indexOf("-->", i + 4);
      if (end < 0) break;
      i = end + 3;
      out += " ";
      continue;
    }
    if (html[i] === "<") {
      const tag = html.slice(i).match(/^<(\/?)([a-z][a-z0-9:-]*)(?=[\s/>])/i);
      const declaration = html[i + 1] === "!" || html[i + 1] === "?";
      if (tag || declaration) {
        const end = tagEnd(html, i + 1);
        if (end < 0) break;
        if (
          tag &&
          !tag[1] &&
          ["script", "style"].includes(tag[2].toLowerCase())
        )
          raw = tag[2].toLowerCase();
        i = end + 1;
        out += " ";
        continue;
      }
    }
    out += html[i++];
  }
  return decodeEntitiesOnce(out).replace(/\s+/g, " ").trim();
}
export function linksIn(html) {
  return [
    ...html.matchAll(
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ),
  ]
    .map((m) => {
      try {
        const url = new URL(
          m[1].replace(/&amp;/g, "&"),
          "https://www.tabroom.com",
        );
        return /^https?:$/.test(url.protocol)
          ? { label: clean(m[2]), url: url.href }
          : null;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
export function parseCalendar(html) {
  const table = html.match(
    /<table\b[^>]*id\s*=\s*["']tournlist["'][^>]*>([\s\S]*?)<\/table>/i,
  )?.[1];
  if (!table) throw Error("Calendar format changed");
  const tournaments = [];
  for (const row of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (m) => m[1],
    );
    if (cells.length < 6) continue;
    const link = linksIn(cells[1]).find((l) =>
      l.url.includes("/index/tourn/main.mhtml"),
    );
    if (!link) continue;
    const id = new URL(link.url).searchParams.get("tourn_id");
    if (!/^\d+$/.test(id || "")) continue;
    const modes = [];
    if (/has online events/i.test(cells[4])) modes.push("Online");
    if (/has in-person events/i.test(cells[4])) modes.push("In person");
    if (/has hybrid events/i.test(cells[4])) modes.push("Hybrid");
    const locationLink = linksIn(cells[3])[0];
    const locationUrl = locationLink && new URL(locationLink.url);
    const date = clean(cells[0]).match(/^(\d{1,2})\/(\d{1,2})/);
    const year = row[1].match(/data-text\s*=\s*["'](\d{4})-/)?.[1];
    const sortDate =
      date && year
        ? year + "-" + date[1].padStart(2, "0") + "-" + date[2].padStart(2, "0")
        : "";
    tournaments.push({
      id,
      name: link.label,
      dates: clean(cells[0]),
      sortDate,
      city: clean(cells[2]),
      location: clean(cells[3]),
      state: locationUrl?.searchParams.get("state") || "",
      country: locationUrl?.searchParams.get("country") || "",
      modes,
      registration: clean(cells[5]),
      judgeSignup: clean(cells[6]),
      judgeSignupUrl: clean(cells[6]) ? linksIn(cells[6])[0]?.url : null,
      sourceUrl: link.url,
    });
  }
  if (!tournaments.length) throw Error("No calendar rows recognized");
  const filters = {};
  for (const m of html.matchAll(
    /<select\b[^>]*name\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/select>/gi,
  )) {
    filters[m[1]] = [
      ...m[2].matchAll(
        /<option\b[^>]*value\s*=\s*["']([^"']*)["'][^>]*>([\s\S]*?)<\/option>/gi,
      ),
    ]
      .map((o) => ({ value: o[1], label: clean(o[2]) }))
      .filter((o) => o.value);
  }
  return { tournaments, filters };
}
export function parseCircuits(html) {
  const rows = [];
  for (const m of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const c = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (x) => x[1],
    );
    if (c.length < 4) continue;
    const link = linksIn(c[1]).find((l) =>
      new URL(l.url).searchParams.has("circuit_id"),
    );
    if (!link) continue;
    rows.push({
      id: new URL(link.url).searchParams.get("circuit_id"),
      abbr: clean(c[0]),
      name: link.label,
      location: clean(c[2]),
      count: clean(c[3]),
      sourceUrl: link.url,
      calendarUrl:
        linksIn(c[4] || "").find((l) => /ical|\.ics/i.test(l.url))?.url || null,
    });
  }
  if (!rows.length) throw Error("Circuit format changed");
  return rows;
}
export function parseInvitation(html, id) {
  const name = clean(html.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]);
  if (!name || /Log In to Tabroom|access denied|just a moment/i.test(name))
    throw Error("Tournament unavailable");
  let body = html.slice(html.indexOf("</h2>"));
  const start = body.indexOf("<h3");
  if (start >= 0) body = body.slice(start);
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((x) => clean(x[1]))
    .filter(Boolean)
    .slice(0, 180);
  const links = linksIn(html).filter(
    (l) =>
      l.label &&
      !/^(Home|Circuits|Results|Paradigms|Help|About|Sign Up|Join the NSDA|Privacy Policy|Terms|Login)$/i.test(
        l.label,
      ),
  );
  return {
    id,
    name,
    paragraphs,
    links: [...new Map(links.map((l) => [l.url, l])).values()].slice(0, 100),
    sourceUrl: "https://www.tabroom.com/index/tourn/main.mhtml?tourn_id=" + id,
  };
}
const arr = (x) => (Array.isArray(x) ? x : []);
const str = (x) => (x == null ? "" : String(x));
export function normalizeExport(raw, id) {
  if (
    !raw ||
    typeof raw !== "object" ||
    str(raw.id) !== id ||
    !["1", "true"].includes(str(raw.public))
  )
    throw Error("Not a matching public export");
  const schools = arr(raw.schools).map((s) => ({
    id: str(s.id),
    name: str(s.name),
    code: str(s.code),
  }));
  const schoolNames = new Map(schools.map((s) => [s.id, s.name]));
  const entries = [];
  for (const s of arr(raw.schools))
    for (const e of arr(s.entries)) {
      if (Number(e.dropped) || Number(e.waitlist)) continue;
      entries.push({
        id: str(e.id),
        name: str(e.name),
        code: str(e.code),
        school: schoolNames.get(str(e.school)) || str(s.name),
        eventId: str(e.event),
      });
    }
  const judges = [],
    events = [],
    rounds = [],
    resultSets = [];
  for (const c of arr(raw.categories)) {
    for (const j of arr(c.judges))
      judges.push({
        id: str(j.id),
        name:
          [j.first, j.last].filter(Boolean).join(" ") || "Name not published",
        school: schoolNames.get(str(j.school)) || "",
        category: str(c.name),
      });
    for (const e of arr(c.events)) {
      events.push({
        id: str(e.id),
        name: str(e.name),
        abbr: str(e.abbr),
        type: str(e.type),
        category: str(c.name),
      });
      for (const r of arr(e.rounds)) {
        const sections = arr(r.sections).map((s) => ({
          id: str(s.id),
          room: str(s.room),
          flight: str(s.flight),
          bye: Boolean(s.bye),
          ballots: arr(s.ballots).map((b) => ({
            entryId: str(b.entry),
            entry: str(b.entry_code || b.entry_name || "Entry not published"),
            judge:
              [b.judge_first, b.judge_last].filter(Boolean).join(" ") || "",
            side: str(b.side),
            scores: arr(b.scores)
              .filter((v) =>
                ["winloss", "rank", "point", "refute"].includes(v.tag),
              )
              .map((v) => ({ tag: str(v.tag), value: str(v.value) })),
          })),
        }));
        rounds.push({
          id: str(r.id),
          name: str(r.label || r.name),
          eventId: str(e.id),
          event: str(e.name),
          start: str(r.start_time),
          sections,
        });
      }
      for (const rs of arr(e.result_sets)) {
        if (Number(rs.published) !== 1) continue;
        resultSets.push({
          label: str(rs.label),
          event: str(e.name),
          results: arr(rs.results).map((r) => ({
            rank: str(r.rank),
            place: str(r.place),
            entryId: str(r.entry),
            school: schoolNames.get(str(r.school)) || "",
          })),
        });
      }
    }
  }
  const eventNames = new Map(events.map((e) => [e.id, e.name]));
  entries.forEach(
    (e) => (e.event = eventNames.get(e.eventId) || "Event " + e.eventId),
  );
  return {
    id,
    name: str(raw.name),
    city: str(raw.city),
    state: str(raw.state),
    country: str(raw.country),
    timezone: str(raw.timezone) || "UTC",
    start: str(raw.start),
    end: str(raw.end),
    regStart: str(raw.reg_start),
    regEnd: str(raw.reg_end),
    schools,
    entries,
    judges,
    events,
    rounds,
    resultSets,
    timeslots: arr(raw.timeslots).map((t) => ({
      name: str(t.name),
      start: str(t.start),
      end: str(t.end),
    })),
    sourceUrl: "https://www.tabroom.com/api/download_data.mhtml?tourn_id=" + id,
  };
}
