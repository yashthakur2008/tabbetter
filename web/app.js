const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const attr = esc;
const external = (url, label, cls = "btn") =>
  '<a class="' +
  cls +
  '" href="' +
  attr(url) +
  '" target="_blank" rel="noopener">' +
  esc(label) +
  " ↗</a>";
const official = "https://www.tabroom.com";
const href = (id, p = "main") =>
  official + "/index/tourn/" + p + ".mhtml?tourn_id=" + encodeURIComponent(id);
const footer =
  '<footer class="footer"><span>TabBetter · Less searching. More debating. · <a href="#about">Our mission & team</a></span><span>Independent companion · Not affiliated with Tabroom or NSDA.</span></footer>';
function readSaved() {
  try {
    const v = JSON.parse(localStorage.getItem("tabbetter-saved") || "[]");
    return Array.isArray(v) ? v.filter((x) => x && /^\d+$/.test(x.id)) : [];
  } catch {
    return [];
  }
}
let saved = readSaved(),
  calendar = null,
  circuits = null,
  tournament = null,
  invitation = null,
  lastId = "",
  routeToken = 0,
  layout = "table",
  page = 1,
  detailFilter = "",
  detailEvent = "",
  roundFilter = "",
  peopleSearch = "";
const filter = {
  q: "",
  state: "",
  country: "",
  year: "",
  circuit_id: "",
  mode: "",
  registration: "",
  judges: false,
  sort: "",
};
const isSaved = (id) => saved.some((x) => x.id === id);
function save(t) {
  if (isSaved(t.id)) saved = saved.filter((x) => x.id !== t.id);
  else
    saved.push({
      id: t.id,
      name: t.name,
      dates: t.dates || formatDate(t.start),
      city: t.city,
      location: t.location || t.state,
      state: t.state || "",
      country: t.country || "",
      modes: t.modes || [],
      registration: t.registration || "",
      sourceUrl: href(t.id),
    });
  try {
    localStorage.setItem("tabbetter-saved", JSON.stringify(saved));
  } catch {
    toast("Your browser could not save this bookmark.");
  }
  toast(
    isSaved(t.id)
      ? "Tournament saved on this device."
      : "Tournament removed from saved.",
  );
}
function toast(t) {
  $(".toast").textContent = t;
  $(".toast").style.display = "block";
  clearTimeout(window.tt);
  window.tt = setTimeout(() => ($(".toast").style.display = "none"), 3000);
}
function sourceLine(data, ttl) {
  return (
    '<div class="source-line"><span>' +
    (data.stale ? "Cached copy · source unavailable" : "Public Tabroom data") +
    " · Retrieved " +
    esc(
      new Date(data.fetchedAt).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    ) +
    " · " +
    ttl +
    " cache</span>" +
    external(data.sourceUrl || official, "Official source", "") +
    "</div>"
  );
}
function formatDate(s, tz) {
  if (!s) return "Not published";
  try {
    const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
    if (Number.isNaN(+d)) return s;
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz || undefined,
      timeZoneName: "short",
    });
  } catch {
    return s;
  }
}
async function api(path) {
  const r = await fetch(path + (path.includes("?") ? "&" : "?") + "schema=3");
  const d = await r.json();
  if (!r.ok) throw Error(d.error || "Source unavailable");
  return d;
}
function route() {
  const [name = "discover", id = "", sub = "overview", event = ""] =
    location.hash.slice(1).split("/");
  return { name: name || "discover", id, sub, event };
}
function navigate(p) {
  location.hash = p;
}
function loading(t = "Loading public tournament data…") {
  $("#app").innerHTML = '<div class="loading">' + esc(t) + "</div>";
}
function errorHTML(e) {
  return (
    '<div class="error"><b>Tabroom could not provide this data.</b><br>' +
    esc(e.message || e) +
    "<br>Use the official site while we reconnect. " +
    external(official, "Open Tabroom", "") +
    "</div>"
  );
}
function hero(title, text, kicker = "YOUR NEXT ROUND STARTS HERE") {
  return (
    '<section class="hero-directory"><div><div class="eyebrow">' +
    esc(kicker) +
    "</div><h1>" +
    esc(title) +
    "</h1><p>" +
    esc(text) +
    '</p></div><div class="hero-art" aria-hidden="true"><div class="art-card"></div><div class="art-card"></div></div></section>'
  );
}
function sidebarHTML() {
  return '<aside class="aside"><div class="card sidecard"><h3>Your tournament toolkit</h3><a class="linkrow" href="#judging">Judging assignments <span>→</span></a><a class="linkrow" href="#results">Rounds & results <span>→</span></a><a class="linkrow" href="#paradigms">Judge paradigms <span>→</span></a><a class="linkrow" href="#account">School & registration <span>↗</span></a></div><div class="card sidecard"><h3>Closer to home</h3><p class="sub" style="font-size:12px">Find the next tournament in your circuit.</p><button class="linkrow reset" data-cfl style="width:100%;text-decoration:none">Coast Forensic League <span>→</span></button><button class="linkrow reset" data-ca style="width:100%;text-decoration:none">California tournaments <span>→</span></button></div><div class="support-card"><strong>A calmer tournament day.</strong><p>Save a tournament to keep its entries, judges and published rounds one click away.</p><a href="#saved" style="font-size:11px;color:var(--warning)">Your saved tournaments →</a></div><div class="sync" style="padding:18px 4px">Public pages, organized.<br>Freshness is shown on every view.<br>Account actions open on Tabroom.</div></aside>';
}
function opts(options, value, all) {
  return (
    '<option value="">' +
    all +
    "</option>" +
    options
      .map(
        (o) =>
          '<option value="' +
          attr(o.value) +
          '" ' +
          (o.value === value ? "selected" : "") +
          ">" +
          esc(o.label) +
          "</option>",
      )
      .join("")
  );
}
function calendarShell() {
  const r = route();
  const isBookmarks = r.name === "saved";
  const data = calendar?.tournaments || [];
  $("#app").innerHTML =
    hero(
      isBookmarks
        ? "Your tournaments. One place."
        : "Find your next tournament.",
      isBookmarks
        ? "The tournaments you saved, ready when you are."
        : "The Tabroom calendar you know, with room to breathe. Search, filter and keep the tournaments that matter.",
    ) +
    '<div class="stats"><div class="stat"><div class="stat-icon">⚑</div><b>' +
    data.length +
    '</b><span>tournaments in<br>this source listing</span></div><div class="stat"><div class="stat-icon">◎</div><b>' +
    new Set(data.filter((t) => t.state).map((t) => t.state)).size +
    '</b><span>locations across<br>the current listing</span></div><div class="stat"><div class="stat-icon">☆</div><b>' +
    saved.length +
    '</b><span>saved tournaments<br>on this device</span></div></div><div class="directory-grid"><section><div class="switch-row"><div><h2>' +
    (isBookmarks ? "Saved tournaments" : "Upcoming tournaments") +
    '</h2><div class="smalltext" style="margin-top:7px">' +
    (filter.year
      ? "School year ending " + esc(filter.year)
      : "Find your circuit. Find your people.") +
    '</div></div><button class="btn" id="jump-open">＋ Open by link</button></div><div class="search-wrap"><span>⌕</span><input id="search" class="search" aria-label="Search tournaments" placeholder="Search tournaments, cities or states…" value="' +
    attr(filter.q) +
    '"></div><div class="filters"><select id="state" aria-label="State or province">' +
    opts(
      calendar?.filters.state || [],
      filter.state,
      "All states / provinces",
    ) +
    '</select><select id="country" aria-label="Country">' +
    opts(calendar?.filters.country || [], filter.country, "All countries") +
    '</select><select id="circuit_id" aria-label="Circuit">' +
    opts(
      calendar?.filters.circuit_id || calendar?.filters.circuit || [],
      filter.circuit_id,
      "All circuits",
    ) +
    '</select><select id="year" aria-label="School year ending">' +
    opts(calendar?.filters.year || [], filter.year, "Upcoming dates") +
    '</select><select id="mode" aria-label="Mode">' +
    opts(
      ["In person", "Online", "Hybrid"].map((x) => ({ value: x, label: x })),
      filter.mode,
      "All formats",
    ) +
    '</select><select id="registration" aria-label="Registration status">' +
    opts(
      [
        { value: "Due", label: "Accepting registration" },
        { value: "Open", label: "Opens later" },
        { value: "Closed", label: "Closed" },
      ],
      filter.registration,
      "All registration",
    ) +
    '</select></div><div style="display:flex;justify-content:space-between;align-items:center"><label class="smalltext"><input type="checkbox" id="judge-only" ' +
    (filter.judges ? "checked" : "") +
    '> Seeking judges</label><button class="reset" id="reset">Reset filters</button></div><div class="list-header"><span class="smalltext" id="count"></span><div style="display:flex;gap:9px"><select id="sort" aria-label="Sort tournaments" style="font-size:11px;padding:7px;max-width:125px">' +
    opts(
      [
        { value: "name", label: "Name A–Z" },
        { value: "date", label: "Date" },
        { value: "city", label: "City A–Z" },
      ],
      filter.sort,
      "Source order",
    ) +
    '</select><button class="btn hide-small" id="print">Print</button><button class="btn" id="export">↓ CSV</button><div class="view-toggle"><button id="table-view" aria-label="Table view" class="' +
    (layout === "table" ? "active" : "") +
    '">☷</button><button id="cards-view" aria-label="Card view" class="' +
    (layout === "cards" ? "active" : "") +
    '">▦</button></div></div></div><div id="listing"></div><div class="pager" id="pager"></div>' +
    (calendar ? sourceLine(calendar, "10 min") : "") +
    "</section>" +
    sidebarHTML() +
    "</div>" +
    footer;
  bindDirectory();
  drawCalendar();
}
function filteredTournaments() {
  let a = route().name === "saved" ? saved : calendar?.tournaments || [];
  return a
    .filter(
      (t) =>
        (!filter.q ||
          [t.name, t.city, t.location]
            .join(" ")
            .toLowerCase()
            .includes(filter.q.toLowerCase())) &&
        (!filter.state ||
          route().name !== "saved" ||
          t.state === filter.state ||
          t.location === filter.state) &&
        (!filter.country ||
          route().name !== "saved" ||
          t.country === filter.country) &&
        (!filter.mode || t.modes.includes(filter.mode)) &&
        (!filter.registration ||
          t.registration.startsWith(filter.registration)) &&
        (!filter.judges || t.judgeSignup),
    )
    .sort((a, b) =>
      filter.sort === "name"
        ? a.name.localeCompare(b.name)
        : filter.sort === "city"
          ? a.city.localeCompare(b.city)
          : filter.sort === "date"
            ? (a.sortDate || a.dates).localeCompare(b.sortDate || b.dates)
            : 0,
    );
}
function saveButton(t) {
  return (
    '<button class="save-btn ' +
    (isSaved(t.id) ? "saved" : "") +
    '" data-save="' +
    t.id +
    '" aria-label="' +
    (isSaved(t.id) ? "Unsave" : "Save") +
    " " +
    attr(t.name) +
    '">' +
    (isSaved(t.id) ? "★" : "☆") +
    "</button>"
  );
}
function modeBadge(t) {
  return (t.modes.length ? t.modes : ["Not specified"])
    .map(
      (m) =>
        '<span class="badge ' +
        (m === "Online" ? "online" : m === "Hybrid" ? "hybrid" : "") +
        '">' +
        esc(m) +
        "</span>",
    )
    .join(" ");
}
// Progressive enhancement: never hide cards while waiting for the observer.
const revealedCards = new Set();
const pendingReveals = new Map();
let cardRevealObserver;
function revealCards(root, selector, namespace) {
  try {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    for (const [node] of pendingReveals) {
      if (!node.isConnected) {
        cardRevealObserver.unobserve(node);
        pendingReveals.delete(node);
      }
    }
    if (!root?.querySelectorAll || !window.IntersectionObserver) return;
    if (!cardRevealObserver) {
      cardRevealObserver = new window.IntersectionObserver((entries) => {
        let stagger = 0;
        for (const { target, isIntersecting } of entries) {
          if (!isIntersecting || !pendingReveals.has(target)) continue;
          const key = pendingReveals.get(target);
          pendingReveals.delete(target);
          cardRevealObserver.unobserve(target);
          if (!target.isConnected || revealedCards.has(key)) continue;
          revealedCards.add(key);
          if (media.matches) continue;
          target.style.setProperty("--reveal-delay", Math.min(stagger++ * 40, 160) + "ms");
          target.classList.add("card-reveal");
        }
      }, { threshold: 0.01 });
    }
    for (const node of root.querySelectorAll(selector)) {
      // Outcomes and scores are deliberately excluded from refresh identity.
      const identity = node.querySelector("[data-open]")?.dataset.open || [
        node.querySelector("header")?.textContent,
        ...Array.from(node.querySelectorAll(".versus strong"), (entry) => entry.textContent),
      ];
      const key = JSON.stringify([namespace, identity]);
      if (media.matches) revealedCards.add(key);
      if (revealedCards.has(key) || pendingReveals.has(node)) continue;
      pendingReveals.set(node, key);
      cardRevealObserver.observe(node);
    }
  } catch { /* Animation is optional. Content remains visible if APIs fail. */ }
}
function drawCalendar() {
  const a = filteredTournaments(),
    size = 15;
  page = Math.max(1, Math.min(page, Math.ceil(a.length / size) || 1));
  const subset = a.slice((page - 1) * size, page * size);
  $("#count").textContent =
    a.length + " tournament" + (a.length !== 1 ? "s" : "") + " found";
  $("#listing").innerHTML = !a.length
    ? '<div class="card empty"><h2>' +
      (route().name === "saved"
        ? "Nothing saved yet."
        : "No tournaments match.") +
      "</h2><p>" +
      (route().name === "saved"
        ? "Star a tournament to keep it here."
        : "Try a different search or clear your filters.") +
      '</p><button class="btn" id="empty-reset">' +
      (route().name === "saved" ? "Explore tournaments" : "Clear filters") +
      "</button></div>"
    : layout === "table"
      ? '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Tournament</th><th class="hide-medium">Location</th><th class="hide-small">Format</th><th class="hide-small">Registration</th><th aria-label="Save"></th></tr></thead><tbody>' +
        subset
          .map(
            (t) =>
              '<tr><td class="date-cell">' +
              esc(t.dates) +
              '</td><td><button class="name-btn" data-open="' +
              t.id +
              '">' +
              esc(t.name) +
              '</button><div style="font-size:10px;color:var(--muted);margin-top:5px">' +
              esc([t.city, t.location].filter(Boolean).join(" · ")) +
              (t.judgeSignup ? " · Seeking judges" : "") +
              '</div></td><td class="hide-medium">' +
              esc(t.location || "—") +
              '</td><td class="hide-small">' +
              modeBadge(t) +
              '</td><td class="hide-small"><span class="badge ' +
              (t.registration.startsWith("Due") ? "open" : "") +
              '">' +
              esc(t.registration || "See invitation") +
              "</span></td><td>" +
              saveButton(t) +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table></div>"
      : '<div class="cards">' +
        subset
          .map(
            (t) =>
              '<article class="card tournament-card"><span class="tiny">' +
              esc(t.dates) +
              "</span>" +
              saveButton(t) +
              '<h3><button class="name-btn" data-open="' +
              t.id +
              '">' +
              esc(t.name) +
              "</button></h3><p>" +
              esc([t.city, t.location].filter(Boolean).join(" · ")) +
              '</p><div class="chips">' +
              modeBadge(t) +
              '<span class="badge ' +
              (t.registration.startsWith("Due") ? "open" : "") +
              '">' +
              esc(t.registration) +
              "</span></div></article>",
          )
          .join("") +
        "</div>";
  revealCards($("#listing"), ".tournament-card", "tournament");
  $("#pager").innerHTML = a.length
    ? "<span>Showing " +
      ((page - 1) * size + 1) +
      "–" +
      Math.min(page * size, a.length) +
      " of " +
      a.length +
      '</span><div><button class="btn" id="prev" ' +
      (page === 1 ? "disabled" : "") +
      '>←</button><button class="btn" id="next" ' +
      (page * size >= a.length ? "disabled" : "") +
      ">→</button></div>"
    : "";
  $("#prev")?.addEventListener("click", () => {
    page--;
    drawCalendar();
  });
  $("#next")?.addEventListener("click", () => {
    page++;
    drawCalendar();
  });
  bindSaves(a);
  $("#empty-reset")?.addEventListener("click", () => {
    if (route().name === "saved") navigate("discover");
    else resetFilters();
  });
}
function bindSaves(a) {
  document
    .querySelectorAll("[data-open]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          navigate("tournament/" + b.dataset.open + "/overview")),
    );
  document.querySelectorAll("[data-save]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = a.find((t) => t.id === b.dataset.save);
        if (t) save(t);
        calendarShell();
      }),
  );
}
function resetFilters() {
  Object.keys(filter).forEach((k) => (filter[k] = k === "judges" ? false : ""));
  page = 1;
  loadCalendar();
}
function bindDirectory() {
  $("#search").oninput = (e) => {
    filter.q = e.target.value;
    page = 1;
    drawCalendar();
  };
  for (const key of ["state", "country", "circuit_id", "year"])
    $("#" + key).onchange = (e) => {
      filter[key] = e.target.value;
      page = 1;
      loadCalendar();
    };
  for (const key of ["mode", "registration"])
    $("#" + key).onchange = (e) => {
      filter[key] = e.target.value;
      page = 1;
      drawCalendar();
    };
  $("#judge-only").onchange = (e) => {
    filter.judges = e.target.checked;
    page = 1;
    drawCalendar();
  };
  $("#reset").onclick = resetFilters;
  $("#table-view").onclick = () => {
    layout = "table";
    calendarShell();
  };
  $("#cards-view").onclick = () => {
    layout = "cards";
    calendarShell();
  };
  $("#print").onclick = () => window.print();
  $("#sort").onchange = (e) => {
    filter.sort = e.target.value;
    page = 1;
    drawCalendar();
  };
  $("#export").onclick = () =>
    downloadCSV(
      filteredTournaments().map((t) => ({
        Date: t.dates,
        Tournament: t.name,
        City: t.city,
        Location: t.location,
        Format: t.modes.join(", "),
        Registration: t.registration,
        Source: t.sourceUrl,
      })),
      "tabbetter-tournaments.csv",
    );
  $("#jump-open").onclick = () => $("#jump").showModal();
  document.querySelector("[data-ca]").onclick = () => {
    filter.state = "CA";
    page = 1;
    loadCalendar();
  };
  document.querySelector("[data-cfl]").onclick = () => {
    filter.circuit_id = "67";
    filter.state = "";
    page = 1;
    loadCalendar();
  };
}
async function loadCalendar() {
  const token = ++routeToken;
  loading("Loading the Tabroom calendar…");
  const p = new URLSearchParams();
  for (const k of ["state", "country", "year", "circuit_id"])
    if (filter[k]) p.set(k, filter[k]);
  try {
    const d = await api("/api/calendar?" + p);
    if (token !== routeToken) return;
    calendar = d;
    calendarShell();
  } catch (e) {
    if (token === routeToken)
      $("#app").innerHTML =
        errorHTML(e) +
        '<button class="btn" id="retry">Try again</button>' +
        footer;
    $("#retry")?.addEventListener("click", loadCalendar);
  }
}
function downloadCSV(rows, name) {
  if (!rows.length) {
    toast("Nothing to export for these filters.");
    return;
  }
  const keys = Object.keys(rows[0]);
  const quote = (v) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  download(
    [keys, ...rows.map((r) => keys.map((k) => r[k]))]
      .map((r) => r.map(quote).join(","))
      .join("\r\n"),
    name,
    "text/csv;charset=utf-8",
  );
}
function download(content, name, type) {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
async function circuitsPage() {
  const token = ++routeToken;
  loading("Loading circuits…");
  try {
    if (!circuits) circuits = await api("/api/circuits");
    if (token !== routeToken) return;
    $("#app").innerHTML =
      hero(
        "Find your circuit.",
        "Local leagues, national circuits and everything in between. Browse the public Tabroom directory.",
        "YOUR COMMUNITY, CONNECTED",
      ) +
      '<div class="list-header"><h2>Circuits directory</h2><span class="smalltext">' +
      circuits.circuits.length +
      ' circuits</span></div><input class="search" id="circuit-search" placeholder="Search circuits, abbreviations or locations…" aria-label="Search circuits"><div id="circuit-list"></div>' +
      sourceLine(circuits, "1 hour") +
      footer;
    const draw = () => {
      const q = $("#circuit-search").value.toLowerCase();
      const a = circuits.circuits.filter((c) =>
        [c.name, c.abbr, c.location].join(" ").toLowerCase().includes(q),
      );
      $("#circuit-list").innerHTML =
        '<div class="table-wrap"><table><thead><tr><th>Circuit</th><th>Location</th><th>Tournaments</th><th></th></tr></thead><tbody>' +
        a
          .map(
            (c) =>
              '<tr><td><button class="name-btn circuit-name" data-circuit="' +
              c.id +
              '">' +
              esc(c.name) +
              '</button><div class="smalltext">' +
              esc(c.abbr) +
              "</div></td><td>" +
              esc(c.location) +
              "</td><td>" +
              esc(c.count) +
              "</td><td>" +
              external(c.sourceUrl, "Official calendar", "smalltext") +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table></div>";
      document.querySelectorAll("[data-circuit]").forEach(
        (b) =>
          (b.onclick = () => {
            filter.circuit_id = b.dataset.circuit;
            filter.state = "";
            filter.q = "";
            calendar = null;
            navigate("discover");
          }),
      );
    };
    $("#circuit-search").oninput = draw;
    draw();
  } catch (e) {
    if (token === routeToken) $("#app").innerHTML = errorHTML(e) + footer;
  }
}
async function loadTournament(id) {
  const token = ++routeToken;
  if (!/^\d{1,8}$/.test(id)) {
    $("#app").innerHTML = errorHTML("Invalid tournament ID");
    return;
  }
  loading();
  detailFilter = "";
  detailEvent = "";
  roundFilter = "";
  if (lastId !== id) {
    tournament = null;
    invitation = null;
    lastId = id;
  }
  const outcomes = await Promise.allSettled([
    api("/api/tournament?id=" + id),
    api("/api/invitation?id=" + id),
  ]);
  if (token !== routeToken) return;
  tournament = outcomes[0].status === "fulfilled" ? outcomes[0].value : null;
  invitation = outcomes[1].status === "fulfilled" ? outcomes[1].value : null;
  if (!tournament && !invitation) {
    $("#app").innerHTML =
      errorHTML(outcomes[0].reason) +
      external(href(id), "Open official tournament") +
      footer;
    return;
  }
  renderDetail();
}
function renderDetail() {
  const { id, sub, event } = route();
  if (sub === "entries" && event) detailEvent = event;
  const d = tournament,
    inv = invitation,
    t = d || inv;
  const tabs = [
    ["overview", "Invitation"],
    ["events", "Events"],
    ["entries", "Entries"],
    ["schools", "Schools"],
    ["judges", "Judges"],
    ["pairings", "Pairings"],
    ["results", "Results"],
    ["schedule", "Schedule"],
    ["resources", "Resources"],
  ];
  $("#app").innerHTML =
    '<div class="detail-header"><a href="#discover" class="smalltext">← All tournaments</a><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-top:20px"><div><div class="eyebrow">TOURNAMENT WORKSPACE</div><h1>' +
    esc(t.name) +
    '</h1><div class="meta">' +
    esc([d?.city, d?.state, d?.country].filter(Boolean).join(" · ")) +
    (d?.start
      ? " &nbsp; | &nbsp; " + esc(formatDate(d.start, d.timezone))
      : "") +
    '</div></div><button class="btn" id="save-detail">' +
    (isSaved(id) ? "★ Saved" : "☆ Save") +
    '</button></div></div><nav class="subnav" aria-label="Tournament sections">' +
    tabs
      .map(
        ([key, name]) =>
          '<button class="' +
          (sub === key ? "active" : "") +
          '" data-sub="' +
          key +
          '">' +
          name +
          "</button>",
      )
      .join("") +
    '</nav><div class="detail-layout"><section id="detail-content"></section><aside class="aside"><div class="card sidecard"><h3>Official tournament</h3>' +
    external(href(id), "Invitation", "linkrow") +
    external(href(id, "fields"), "Entry lists", "linkrow") +
    external(href(id, "judges"), "Judge lists", "linkrow") +
    external(href(id, "postings"), "Pairings & postings", "linkrow") +
    external(href(id, "results"), "Results", "linkrow") +
    external(href(id, "judge_signups"), "Judge signup", "linkrow") +
    external(
      official + "/user/home.mhtml",
      "Registration & ballots",
      "linkrow",
    ) +
    "</div>" +
    (d
      ? '<div class="card sidecard"><h3>Dates & deadlines</h3><p class="smalltext">Registration opens<br><b>' +
        esc(formatDate(d.regStart, d.timezone)) +
        '</b></p><p class="smalltext">Registration closes<br><b>' +
        esc(formatDate(d.regEnd, d.timezone)) +
        '</b></p><p class="notice">Consult the invitation for official deadlines and policies.</p></div>'
      : "") +
    '<div class="hint"><strong>Know what is current.</strong><p>Public exports refresh at most every five minutes per cached resource. Assignments can change; verify on Tabroom.</p></div><button class="btn" id="refresh-detail" style="margin-top:18px;width:100%;justify-content:center">↻ Check for updates</button></aside></div>' +
    sourceLine(d || inv, d ? "5 min" : "10 min") +
    footer;
  document
    .querySelectorAll("[data-sub]")
    .forEach(
      (b) =>
        (b.onclick = () => navigate("tournament/" + id + "/" + b.dataset.sub)),
    );
  $("#save-detail").onclick = () => {
    save(t);
    renderDetail();
  };
  $("#refresh-detail").onclick = () => loadTournament(id);
  const target = $("#detail-content");
  if (!d && sub !== "overview" && sub !== "resources") {
    target.innerHTML =
      '<div class="error">The structured export is unavailable. The invitation is still accessible.</div>' +
      external(href(id), "Open official tournament");
    return;
  }
  if (sub === "overview") {
    target.innerHTML =
      (d
        ? '<div class="count-row"><span><b>' +
          d.entries.length +
          "</b> entries</span><span><b>" +
          d.judges.length +
          "</b> judges</span><span><b>" +
          d.events.length +
          "</b> events</span><span><b>" +
          d.schools.length +
          "</b> schools</span></div>"
        : "") +
      (inv?.paragraphs.length
        ? '<div class="card prose">' +
          inv.paragraphs.map((p) => "<p>" + esc(p) + "</p>").join("") +
          "</div>"
        : '<div class="card empty">The invitation text is not available in this view. ' +
          external(href(id), "Read the official invitation") +
          "</div>");
  } else if (sub === "events") {
    target.innerHTML =
      '<h2 style="margin-bottom:20px">Events & divisions</h2><div class="resource-grid">' +
      d.events
        .map(
          (e) =>
            '<article class="card"><span class="tiny">' +
            esc(e.abbr || e.type) +
            "</span><h3>" +
            esc(e.name) +
            "</h3><p>" +
            esc(e.category) +
            '</p><button class="btn event-entries" data-event-id="' +
            attr(e.id) +
            '">View entries →</button></article>',
        )
        .join("") +
      "</div>";
    document.querySelectorAll(".event-entries").forEach(
      (b) =>
        (b.onclick = () => {
          navigate("tournament/" + id + "/entries/" + b.dataset.eventId);
        }),
    );
  } else if (sub === "schools") {
    target.innerHTML =
      '<h2 style="margin-bottom:20px">Participating schools</h2><div class="table-wrap"><table><thead><tr><th>School</th><th>Code</th></tr></thead><tbody>' +
      d.schools
        .map(
          (s) =>
            "<tr><td>" +
            esc(s.name) +
            "</td><td>" +
            esc(s.code || "—") +
            "</td></tr>",
        )
        .join("") +
      "</tbody></table></div>";
  } else if (sub === "entries" || sub === "judges") {
    target.innerHTML =
      '<div class="entry-search"><input class="search" id="detail-search" aria-label="Search ' +
      esc(sub) +
      '" placeholder="' +
      (sub === "entries"
        ? "Search entries, codes or schools…"
        : "Search judges or schools…") +
      '" value="' +
      attr(detailFilter) +
      '"><select id="detail-event" aria-label="Filter ' +
      esc(sub) +
      '">' +
      opts(
        sub === "entries"
          ? d.events.map((e) => ({ value: e.id, label: e.name }))
          : [...new Set(d.judges.map((j) => j.category))].map((c) => ({
              value: c,
              label: c,
            })),
        detailEvent,
        sub === "entries" ? "All events" : "All judge pools",
      ) +
      '</select></div><div id="people-list"></div>';
    $("#detail-search").oninput = (e) => {
      detailFilter = e.target.value;
      drawPeople(sub);
    };
    $("#detail-event").onchange = (e) => {
      detailEvent = e.target.value;
      drawPeople(sub);
    };
    drawPeople(sub);
  } else if (sub === "pairings" || sub === "results") {
    target.innerHTML =
      '<div class="entry-search"><input class="search" id="round-search" aria-label="Search rounds" placeholder="Search entry, judge or room…" value="' +
      attr(detailFilter) +
      '"><select id="round-filter" aria-label="Round">' +
      opts(
        d.rounds.map((r) => ({ value: r.id, label: r.event + " · " + r.name })),
        roundFilter,
        "All published rounds",
      ) +
      '</select></div><div id="round-list"></div>';
    $("#round-search").oninput = (e) => {
      detailFilter = e.target.value;
      drawRounds(sub);
    };
    $("#round-filter").onchange = (e) => {
      roundFilter = e.target.value;
      drawRounds(sub);
    };
    drawRounds(sub);
  } else if (sub === "schedule") {
    const times = d.timeslots;
    target.innerHTML =
      '<div class="switch-row"><h2>Published schedule</h2><button class="btn" id="ics">↓ Calendar</button></div><p class="sub" style="font-size:12px;margin-bottom:18px">Times shown in ' +
      esc(d.timezone) +
      ". Refer to the invitation for event-specific start times.</p>" +
      (times.length
        ? '<div class="card schedule">' +
          times
            .map(
              (t) =>
                '<div class="schedule-row"><span class="dot"></span><div><strong>' +
                esc(t.name) +
                "</strong><small>" +
                esc(formatDate(t.start, d.timezone)) +
                " – " +
                esc(formatDate(t.end, d.timezone)) +
                "</small></div></div>",
            )
            .join("") +
          "</div>"
        : '<div class="card empty">No structured schedule has been published. Check the invitation.</div>');
    $("#ics").onclick = exportICS;
  } else if (sub === "resources") {
    const links = (inv?.links || []).filter(
      (l) => !l.url.includes("/user/login"),
    );
    target.innerHTML =
      '<h2 style="margin-bottom:20px">Tournament links & resources</h2><div class="card">' +
      links.map((l) => external(l.url, l.label, "linkrow")).join("") +
      "</div>";
  } else target.innerHTML = '<div class="card empty">Section not found.</div>';
}
function drawPeople(sub) {
  const d = tournament,
    q = detailFilter.toLowerCase();
  let rows = (sub === "entries" ? d.entries : d.judges).filter(
    (r) =>
      (!detailEvent ||
        (sub === "entries" ? r.eventId : r.category) === detailEvent) &&
      Object.values(r).join(" ").toLowerCase().includes(q),
  );
  const visible = rows.slice(0, 300);
  $("#people-list").innerHTML =
    '<p class="smalltext">' +
    rows.length +
    " " +
    esc(sub) +
    (rows.length > 300 ? " · Showing first 300; narrow your search." : "") +
    "</p>" +
    (rows.length
      ? '<div class="table-wrap"><table><thead><tr><th>' +
        (sub === "entries" ? "Entry" : "Judge") +
        "</th><th>School</th><th>" +
        (sub === "entries" ? "Event" : "Pool") +
        "</th></tr></thead><tbody>" +
        visible
          .map(
            (r) =>
              '<tr><td><strong style="color:var(--text)">' +
              esc(sub === "entries" ? r.code || r.name : r.name) +
              "</strong>" +
              (sub === "entries" && r.name && r.name !== r.code
                ? '<div class="smalltext">' + esc(r.name) + "</div>"
                : "") +
              "</td><td>" +
              esc(r.school || "Not published") +
              "</td><td>" +
              esc(sub === "entries" ? r.event : r.category) +
              "</td></tr>",
          )
          .join("") +
        "</tbody></table></div>"
      : '<div class="card empty">No matching ' + esc(sub) + ".</div>");
}
// Public exports omit event side settings. Never infer speech sides from numbers.
function roundSideLabel(round, ballot) {
  if (round.eventType === "wudc") {
    const position = String(ballot.speakerorder);
    return /^[1-4]$/.test(position) ? ["OG", "OO", "CG", "CO"][Number(position) - 1] : "Entry";
  }
  const side = String(ballot.side);
  if (!["1", "2"].includes(side)) return "Entry";
  if (round.eventType !== "speech" && /\b(?:parli|parliamentary)\b/i.test(round.event || ""))
    return '<span title="Conventional Parli label; event side settings are not in the public export">' +
      (side === "1" ? "Gov" : "Opp") + '</span>';
  return round.eventType === "debate" ? (side === "1" ? "Aff" : "Neg") : "Entry";
}
function judgePersonId(ballot) {
  const id = String(ballot.judgePersonId ?? "");
  return /^[1-9]\d*$/.test(id) ? id : "";
}
function renderRoundJudge(ballot) {
  const id = judgePersonId(ballot);
  return esc(ballot.judge || "Judge not published") + (id ? " · " + external(
    official + "/index/paradigm.mhtml?judge_person_id=" + id,
    "Paradigm on Tabroom (login required)", "paradigm-link",
  ) : "");
}
// Treat only an explicit binary decision as a published vote. Never coerce blanks.
function ballotOutcome(ballot) {
  const decisions = ballot.scores.filter((score) => score.tag === "winloss");
  if (decisions.length !== 1) return "unpublished";
  const value = String(decisions[0].value).trim();
  return value === "1" ? "win" : value === "0" ? "loss" : "unpublished";
}
function ballotJudgeKey(ballot) {
  return judgePersonId(ballot) ? "person:" + judgePersonId(ballot)
    : ballot.judgeId ? "registration:" + ballot.judgeId : "name:" + (ballot.judge || "");
}
function entryResultTone(entry, sectionBallots = entry.ballots) {
  const coverage = new Set(entry.ballots.map(ballotJudgeKey));
  if (sectionBallots.some((ballot) => !coverage.has(ballotJudgeKey(ballot)))) return "neutral";
  const votes = entry.ballots.map(ballotOutcome);
  if (!votes.length || votes.includes("unpublished")) return "neutral";
  return votes.every((vote) => vote === votes[0]) ? votes[0] : "neutral";
}
function renderEntryBallots(entry) {
  const outcomes = entry.ballots.map(ballotOutcome);
  const wins = outcomes.filter((value) => value === "win").length;
  const losses = outcomes.filter((value) => value === "loss").length;
  return '<div class="ballot-summary">Published ballots only · total panel size unknown<br>Published votes: ' + wins + ' win · ' + losses +
    ' loss</div><ul class="ballot-list">' + entry.ballots.map((ballot, index) => {
      const outcome = outcomes[index];
      const label = outcome === "unpublished" ? "Outcome not published" : outcome.toUpperCase();
      const scores = ballot.scores.filter((score) => score.tag !== "winloss")
        .map((score) => score.tag + ": " + score.value).join(" · ");
      return '<li>' + renderRoundJudge(ballot) +
        ' <span class="badge outcome-' + outcome + '">' + label + '</span>' +
        (scores ? '<small>' + esc(scores) + '</small>' : '') + '</li>';
    }).join('') + '</ul><small>Panel outcome not confirmed. Published ballots may be incomplete.</small>';
}
function initTheme() {
  const choices = ["system", "light", "dark", "midnight"];
  let preference = "system";
  try {
    const stored = localStorage.getItem("tabbetter-theme");
    if (choices.includes(stored)) preference = stored;
  } catch { /* Storage can be unavailable in private browsing. */ }
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const select = $("#theme");
  const apply = () => {
    document.documentElement.dataset.theme = preference === "system"
      ? (media.matches ? "dark" : "light") : preference;
    select.value = preference;
  };
  select.addEventListener("change", () => {
    preference = choices.includes(select.value) ? select.value : "system";
    try { localStorage.setItem("tabbetter-theme", preference); } catch { /* Keep session choice. */ }
    apply();
  });
  media.addEventListener("change", apply);
  apply();
}
function drawRounds(sub) {
  const d = tournament,
    q = detailFilter.toLowerCase();
  const cards = [];
  for (const r of d.rounds) {
    if (roundFilter && r.id !== roundFilter) continue;
    for (const s of r.sections) {
      const text = [
        r.name,
        r.event,
        s.room,
        ...s.ballots.map((b) => b.entry + " " + b.judge),
      ]
        .join(" ")
        .toLowerCase();
      if (q && !text.includes(q)) continue;
      const grouped = new Map();
      for (const [index, ballot] of s.ballots.entries()) {
        // Missing IDs cannot safely identify the same entry.
        const key = ballot.entryId || "unidentified-" + index;
        if (!grouped.has(key)) grouped.set(key, { ...ballot, ballots: [] });
        grouped.get(key).ballots.push(ballot);
      }
      const entries = [...grouped.values()];
      const judges = [...new Map(s.ballots
        .filter((b) => b.judge || judgePersonId(b) || b.judgeId)
        .map((b) => [judgePersonId(b) ? "person:" + judgePersonId(b)
          : b.judgeId ? "registration:" + b.judgeId : "name:" + b.judge, b])).values()];
      cards.push(
        '<article class="card round-card"><header><h3>' +
          esc(r.event) +
          " · " +
          esc(r.name) +
          '</h3><span class="badge">' +
          esc(s.room || "Room not published") +
          (s.flight ? " · Flight " + esc(s.flight) : "") +
          '</span></header><div class="versus">' +
          entries
            .map(
              (b, i) =>
                (i ? '<span class="smalltext">vs.</span>' : "") +
                '<div class="entry-result' +
                (sub === "results" ? ' entry-result-' + entryResultTone(b, s.ballots) : '') +
                '"><small>' +
                roundSideLabel(r, b) +
                "</small><strong>" +
                esc(b.entry) +
                "</strong>" +
                (sub === "results"
                  ? renderEntryBallots(b)
                  : "") +
                "</div>",
            )
            .join("") +
          "</div>" +
          (sub === "results" && !entries.length
            ? '<p class="smalltext">Outcome not published. No ballots in this export.</p>'
            : "") +
          '<div class="round-meta">' +
          (s.bye ? "Bye · " : "") +
          "Judge" +
          (judges.length === 1 ? "" : "s") +
          ": " +
          (judges.map(renderRoundJudge).join(", ") || "Not published") +
          (r.start ? " · " + esc(formatDate(r.start, d.timezone)) : "") +
          "</div></article>",
      );
    }
  }
  $("#round-list").innerHTML = cards.length
    ? '<p class="smalltext">' +
      cards.length +
      " matching sections</p>" +
      cards.slice(0, 100).join("")
    : '<div class="card empty"><h2>' +
      (sub === "results"
        ? "No published results in this export."
        : "No published pairings in this export.") +
      "</h2><p>This does not confirm that no assignment exists.<br>The tournament may publish information elsewhere or require sign-in.</p>" +
      external(
        href(d.id, sub === "results" ? "results" : "postings"),
        "Check official " + sub,
      ) +
      "</div>";
  if (sub === "results") revealCards($("#round-list"), ".round-card", "results:" + d.id);
  if (sub === "results" && d.resultSets.length) {
    $("#round-list").insertAdjacentHTML(
      "beforeend",
      '<h2 style="margin:25px 0 15px">Published standings</h2>' +
        d.resultSets
          .map(
            (s) =>
              '<div class="card"><h3>' +
              esc(s.event) +
              " · " +
              esc(s.label) +
              "</h3>" +
              s.results
                .slice(0, 100)
                .map(
                  (r) =>
                    '<p class="smalltext">' +
                    esc(r.place || r.rank) +
                    " · " +
                    esc(
                      d.entries.find((e) => e.id === r.entryId)?.code ||
                        r.school ||
                        "Entry " + r.entryId,
                    ) +
                    "</p>",
                )
                .join("") +
              "</div>",
          )
          .join(""),
    );
  }
}
function exportICS() {
  const d = tournament;
  const stamp = (s) =>
    s.replace(/[-: ]/g, "").replace(/^(\d{8})(\d{6})$/, "$1T$2") + "Z";
  const safe = (s) =>
    String(s || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  const events = d.timeslots.filter(
    (t) =>
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t.start) &&
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t.end),
  );
  if (!events.length) {
    toast("No structured schedule is available to export.");
    return;
  }
  download(
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TabBetter//Schedule//EN",
      ...events.flatMap((t, i) => [
        "BEGIN:VEVENT",
        "UID:" + d.id + "-" + i + "@tabbetter",
        "DTSTAMP:" +
          new Date()
            .toISOString()
            .replace(/[-:]/g, "")
            .replace(/\.\d{3}/, ""),
        "DTSTART:" + stamp(t.start),
        "DTEND:" + stamp(t.end),
        "SUMMARY:" + safe(d.name + " — " + t.name),
        "URL:" + href(d.id),
        "END:VEVENT",
      ]),
      "END:VCALENDAR",
    ].join("\r\n"),
    "tabbetter-" + d.id + ".ics",
    "text/calendar",
  );
}
function toolPage(name) {
  const titles = {
    results: [
      "Rounds, results & the bigger picture.",
      "Open a tournament to view the results included in its public export.",
    ],
    judging: [
      "Your judging desk.",
      "Find your name in a tournament’s published pairings. Official ballots and private assignments stay in your Tabroom account.",
    ],
    paradigms: [
      "Get to know your judge.",
      "Tabroom currently requires sign-in for judge paradigms. Open the official directory using your existing account.",
    ],
    account: [
      "Your team. Your tournament season.",
      "School administration, registration and official ballots are managed through your Tabroom account.",
    ],
    help: [
      "A little help goes a long way.",
      "Official guides for competitors, judges, coaches and tournament staff.",
    ],
    about: [
      "Tabroom, with room to breathe.",
      "TabBetter is a nonprofit initiative making speech and debate tournament information clearer and easier to use.",
    ],
  };
  const [title, text] = titles[name] || titles.help;
  let content = "";
  if (["results", "judging"].includes(name)) {
    content =
      '<div class="card" style="margin-top:24px"><h2>Open a tournament workspace</h2><p class="sub" style="font-size:12px;margin:12px 0 20px">Paste its Tabroom link, then use ' +
      (name === "results"
        ? "Results"
        : "Pairings to search for your judge name") +
      '. Data is limited to what the tournament has publicly published.</p><button class="btn dark" id="tool-jump">＋ Open a tournament</button> ' +
      external(
        name === "results"
          ? official + "/index/results/"
          : official + "/user/home.mhtml",
        name === "results"
          ? "Official results directory"
          : "My official assignments",
      ) +
      '</div><div class="account-banner">' +
      (name === "judging"
        ? "No account is linked to TabBetter. A public pairing search does not show your full judging obligation or guarantee that you are free to leave."
        : "Private ballots and written feedback are not included in public exports. They remain available through your authorized Tabroom account.") +
      "</div>";
  }
  if (name === "paradigms")
    content =
      '<div class="card" style="margin-top:24px"><h2>Judge paradigm directory</h2><p class="sub" style="font-size:13px;margin:14px 0 20px">Read judges’ preferences and experience before the round.</p>' +
      external(
        official + "/index/paradigm.mhtml",
        "Browse paradigms on Tabroom",
        "btn dark",
      ) +
      '</div><div class="account-banner">This feature opens on Tabroom because its paradigm directory requires sign-in. TabBetter does not collect your Tabroom password.</div>';
  if (name === "account")
    content =
      '<div class="resource-grid" style="margin-top:24px">' +
      [
        [
          "School & registration",
          "Manage rosters, entries, judge commitments, fees and tournament registration.",
          official + "/user/home.mhtml",
        ],
        [
          "Official ballots",
          "Receive assignments, start rounds, submit ballots and read your feedback.",
          official + "/user/home.mhtml",
        ],
        [
          "Preferences & conflicts",
          "Manage judge preferences and conflicts where enabled by the tournament.",
          official + "/user/home.mhtml",
        ],
        [
          "Account & notifications",
          "Manage your profile, linked accounts and Tabroom notifications.",
          official + "/user/login/profile.mhtml",
        ],
      ]
        .map(
          ([h, p, u]) =>
            '<article class="card"><h3>' +
            h +
            "</h3><p>" +
            p +
            "</p>" +
            external(u, "Open on Tabroom") +
            "</article>",
        )
        .join("") +
      "</div>";
  if (name === "help")
    content =
      '<div class="resource-grid" style="margin-top:24px">' +
      [
        [
          "Competitors",
          "Link your account, receive pairings and find your results.",
          "https://docs.tabroom.com/account/students",
        ],
        [
          "Judges",
          "Assignments, online ballots and tournament expectations.",
          "https://docs.tabroom.com/account/judges",
        ],
        [
          "Coaches & schools",
          "Registration, rosters, preferences and school results.",
          "https://docs.tabroom.com/account/coaches",
        ],
        [
          "Tournament directors",
          "Settings, entries, paneling, schematics, tabulation and results.",
          "https://docs.tabroom.com/quick-start/quick-start",
        ],
        [
          "Service status",
          "Check whether an NSDA service is experiencing an outage.",
          "https://status.speechanddebate.org",
        ],
        [
          "Contact tournament staff",
          "For missing rooms or assignments, use the contact information in the tournament invitation.",
          official + "/index/help.mhtml",
        ],
      ]
        .map(
          ([h, p, u]) =>
            '<article class="card"><h3>' +
            h +
            "</h3><p>" +
            p +
            "</p>" +
            external(u, "Open guide") +
            "</article>",
        )
        .join("") +
      "</div>";
  if (name === "about")
    content =
      '<div class="card prose" style="margin-top:24px"><img class="about-brand" src="/logo.png" alt="TabBetter"><h2>Made for the moments between rounds.</h2><p><strong>Yash Thakur — Co-founder</strong></p><p style="margin-top:15px">Discover tournaments, save your circuit’s calendar, browse entries and judges, and read published pairings without losing your place.</p><p>TabBetter uses public Tabroom pages and public JSON exports. Every data view shows its source and retrieval time. Availability depends on the tournament’s publication settings and Tabroom access.</p><p>This is an early build, not complete feature parity. Account actions, ballot submission, paradigms and tournament administration open on the official site. Automatic assignment-change notifications are not connected.</p><h2>Source & acknowledgments</h2><p>Tabroom is developed by the National Speech & Debate Association. Its code and schema helped us understand public data relationships. TabBetter’s interface and adapters are independently implemented.</p>' +
      external("https://github.com/speechanddebate/tabroom", "Legacy source") +
      " " +
      external(
        "https://github.com/speechanddebate/Tabroomv4",
        "Current v4 source",
      ) +
      " " +
      external(official + "/index/help.mhtml", "Data access notes") +
      "</div>";
  $("#app").innerHTML =
    hero(title, text, "YOUR TOURNAMENT TOOLKIT") + content + footer;
  $("#tool-jump")?.addEventListener("click", () => {
    $("#jump-form").dataset.dest = name === "results" ? "results" : "pairings";
    $("#jump").showModal();
  });
}
async function renderRoute() {
  routeToken++;
  const r = route();
  $("#crumb").textContent =
    {
      discover: "Tournaments",
      saved: "Saved tournaments",
      circuits: "Circuits",
      tournament: "Tournament",
      results: "Results",
      judging: "Judging",
      paradigms: "Paradigms",
      account: "School & registration",
      help: "Help & resources",
      about: "About TabBetter",
    }[r.name] || "Tournaments";
  document
    .querySelectorAll("[data-nav]")
    .forEach((b) => b.classList.toggle("active", b.dataset.nav === r.name));
  document.title =
    (r.name === "tournament" && tournament ? tournament.name + " · " : "") +
    "TabBetter";
  if (r.name === "discover" || r.name === "saved") {
    if (calendar) calendarShell();
    else await loadCalendar();
  } else if (r.name === "circuits") await circuitsPage();
  else if (r.name === "tournament") {
    if (lastId === r.id && (tournament || invitation)) renderDetail();
    else await loadTournament(r.id);
  } else {
    routeToken++;
    toolPage(r.name);
  }
}
document
  .querySelectorAll("[data-nav]")
  .forEach((b) => (b.onclick = () => navigate(b.dataset.nav)));
$("#jump-cancel").onclick = () => {
  delete $("#jump-form").dataset.dest;
  $("#jump").close();
};
$("#jump-form").onsubmit = (e) => {
  e.preventDefault();
  try {
    const text = $("#jump-url").value.trim();
    let id = text;
    if (!/^\d+$/.test(id)) {
      const u = new URL(text);
      if (!["tabroom.com", "www.tabroom.com"].includes(u.hostname))
        throw Error();
      id = u.searchParams.get("tourn_id");
    }
    if (!/^\d{1,8}$/.test(id || "")) throw Error();
    const dest = $("#jump-form").dataset.dest || "overview";
    delete $("#jump-form").dataset.dest;
    $("#jump").close();
    navigate("tournament/" + id + "/" + dest);
  } catch {
    toast("Enter a numeric tournament ID or a Tabroom tournament URL.");
  }
};
window.addEventListener("hashchange", () => {
  detailFilter = "";
  detailEvent = "";
  roundFilter = "";
  page = 1;
  renderRoute();
  window.scrollTo(0, 0);
});
window.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)
  ) {
    const search = $("#search");
    if (search) {
      e.preventDefault();
      search.focus();
    }
  }
});
setInterval(() => {
  if (!document.hidden) {
    const r = route();
    if (r.name === "tournament") loadTournament(r.id);
  }
}, 300000);
initTheme();
renderRoute();
