// Discovery composition owns its DOM and async lifecycle. Shared filtering is in
// discovery.mjs; app.js retains routing, bookmarks and the optional LD corpus.
const discoveryState = {
  metadata: {}, eventIds: [], eventMatch: "any", origin: null, radius: "",
  includeOnline: true, sort: "date", suggestionsDismissed: false, candidates: [], locationMessage: "",
  root: null, generation: 0, geoGeneration: 0, metadataGeneration: 0,
  calendarGeneration: 0, metadataBusy: false, calendarBusy: false,
  metadataAbort: null, geoAbort: null, calendarAbort: null,
  visible: 24, preview: null, previewTrigger: null, animation: null,
};
const discoveryServerFilters = ["state", "country", "year", "circuit_id"];
function discoveryActive() {
  return discoveryState.root?.isConnected && ["discover", "saved"].includes(route().name);
}
function discoveryBase() {
  const items = route().name === "saved" ? saved : calendar?.tournaments || [];
  const calendarIds = new Set((calendar?.tournaments || []).map(t => t.id));
  return items.filter(t =>
    (!filter.state || route().name !== "saved" || t.state === filter.state || t.location === filter.state) &&
    (!filter.country || route().name !== "saved" || t.country === filter.country) &&
    (!filter.circuit_id || route().name !== "saved" || calendarIds.has(t.id)) &&
    (!filter.year || route().name !== "saved" || calendarIds.has(t.id)) &&
    (!filter.mode || (t.modes || []).includes(filter.mode)) &&
    (!filter.registration || (t.registration || "").startsWith(filter.registration)) &&
    (!filter.judges || t.judgeSignup));
}
function discoveryResults() {
  if (discoveryState.calendarBusy) return [];
  return discoverTournaments(discoveryBase(), discoveryState.metadata, {
    query: filter.q, eventIds: discoveryState.eventIds, eventMatch: discoveryState.eventMatch,
    origin: discoveryState.origin,
    radiusKm: discoveryState.origin && discoveryState.radius !== "" ? Number(discoveryState.radius) * 1.609344 : null,
    includeOnline: discoveryState.includeOnline, sort: discoveryState.sort,
  });
}
function discoverySelect(id, label, options, value, empty) {
  return '<label class="discovery-control"><span>' + esc(label) + '</span><select id="' + id + '" aria-label="' + esc(label) + '">' + opts(options, value, empty) + '</select></label>';
}
function discoveryEventChoices(events) {
  return events.map(e => '<label><input type="checkbox" data-event="' + attr(e.id) + '" ' + (discoveryState.eventIds.includes(e.id) ? 'checked' : '') + '> <span>' + esc(e.label) + '</span></label>').join('');
}
function discoveryShellHTML() {
  const f = calendar?.filters || {};
  return '<section class="discovery-workspace" aria-label="Tournament discovery">' +
    '<header class="discovery-intro"><h1>' + (route().name === 'saved' ? 'Your next stages, saved.' : 'Find your next stage.') + '</h1><p>Discover speech and debate tournaments by event, circuit, and location.</p></header>' +
    '<div class="discovery-search"><label for="discovery-search">Search tournaments and available competitors</label><div><input id="discovery-search" type="search" autocomplete="off" placeholder="Tournament, city, or competitor school…" value="' + attr(filter.q) + '"><kbd aria-hidden="true">⌘ / Ctrl K</kbd></div></div><div id="discovery-suggestions"></div>' +
    '<div class="discovery-filters"><details id="discovery-events"><summary>Events <span aria-hidden="true">⌄</span></summary><div class="discovery-popover discovery-event-panel"><h2>Published events</h2><label class="discovery-control">Match selected events<select id="discovery-event-match"><option value="any">ANY selected event</option><option value="all" ' + (discoveryState.eventMatch === 'all' ? 'selected' : '') + '>ALL selected events</option></select></label><div class="discovery-event-groups">' +
    ['speech', 'debate'].map(group => '<fieldset><legend>' + (group === 'speech' ? 'Speech' : 'Debate') + '</legend>' + discoveryEventChoices(DISCOVERY_EVENTS.filter(e => e.group === group)) + '</fieldset>').join('') +
    '</div><fieldset><legend>Other / regional</legend><div id="discovery-other-events">Regional labels appear here when published details are checked.</div></fieldset><p>Only published offerings count. Unchecked tournaments may also offer your events.</p></div></details>' +
    discoverySelect('discovery-circuit_id', 'Circuit', f.circuit_id || f.circuit || [], filter.circuit_id, 'All circuits') +
    '<details id="discovery-location"><summary>Location <span aria-hidden="true">⌄</span></summary><div class="discovery-popover"><h2>Find a nearby stage</h2><p>Location is optional and stays in memory. Distances are approximate straight-line estimates, not driving distances.</p><form id="discovery-location-form"><label for="discovery-place">City or ZIP / postal code</label><input id="discovery-place" minlength="2" maxlength="100" required autocomplete="off" aria-describedby="discovery-geocoder-note"><p id="discovery-geocoder-note">Searching sends the place you type to Open-Meteo / GeoNames through TabBetter. Your browser position is never sent to this service.</p><button type="submit">Search places</button></form><button type="button" id="discovery-near-me">Find near me</button><button type="button" id="discovery-clear-location">Clear location</button><p id="discovery-location-status" role="status"></p><div id="discovery-candidates"></div></div></details>' +
    '<label class="discovery-control"><span>Distance</span><select id="discovery-radius" aria-describedby="discovery-radius-note" ' + (!discoveryState.origin ? 'disabled' : '') + '>' + opts([25,50,100,250].map(n => ({value:String(n),label:n + ' miles'})), discoveryState.radius, discoveryState.origin ? 'Any distance' : 'Set location first') + '</select></label>' +
    '<details id="discovery-more"><summary>More filters <span aria-hidden="true">⌄</span></summary><div class="discovery-popover discovery-advanced">' +
    discoverySelect('discovery-state', 'State / province', f.state || [], filter.state, 'All states / provinces') +
    discoverySelect('discovery-country', 'Country', f.country || [], filter.country, 'All countries') +
    discoverySelect('discovery-year', 'School year ending', f.year || [], filter.year, 'Upcoming dates') +
    discoverySelect('discovery-mode', 'Format', ['In person','Online','Hybrid'].map(value=>({value,label:value})), filter.mode, 'All formats') +
    discoverySelect('discovery-registration', 'Registration', [{value:'Due',label:'Accepting registration'},{value:'Open',label:'Opens later'},{value:'Closed',label:'Closed'}], filter.registration, 'All registration') +
    '<label><input id="discovery-judges" type="checkbox" ' + (filter.judges ? 'checked' : '') + '> Seeking judges</label><label><input id="discovery-online" type="checkbox" ' + (discoveryState.includeOnline ? 'checked' : '') + '> Include online tournaments (separate group with location)</label></div></details>' +
    '<details id="discovery-actions"><summary>Actions <span aria-hidden="true">⌄</span></summary><div class="discovery-popover"><button id="discovery-export">Export filtered CSV</button><button id="discovery-print">Print results</button><button id="discovery-open">Open by link</button></div></details><button id="discovery-clear-all">Clear all</button></div>' +
    '<p class="visually-hidden" id="discovery-radius-note">Set a location to enable distance filters.</p><div class="discovery-active"><div id="discovery-chips"></div></div>' +
    '<div id="discovery-calendar-status" role="status"></div><div class="discovery-results-head"><div><h2 id="discovery-count" tabindex="-1" aria-live="polite"></h2><p id="discovery-coverage"></p><button id="discovery-check-next">Check next 12</button><button id="discovery-retry-details" hidden>Retry failed checks</button></div><label class="discovery-control">Sort<select id="discovery-sort">' +
    [{id:'date',label:'Date'},{id:'distance',label:'Nearest first'},{id:'matches',label:'Preferred-event matches'},{id:'name',label:'Name A–Z'}].map(s=>'<option value="'+s.id+'" '+(discoveryState.sort===s.id?'selected':'')+'>'+s.label+'</option>').join('') +
    '</select></label></div><p id="discovery-sort-note" role="status"></p><div id="discovery-results"></div><button id="discovery-show-more">Show more tournaments</button><div id="discovery-source">' + (calendar?.fetchedAt ? sourceLine(calendar, '10 min') : '') + '</div>' +
    '<dialog id="discovery-preview" class="discovery-preview" aria-labelledby="discovery-preview-title"><button id="discovery-preview-close" autofocus>Close preview</button><div id="discovery-preview-content"></div></dialog></section>' + footer;
}
function discoveryStatus(t) {
  const status = t.discovery.metadataStatus;
  if (status === 'unknown') return 'Details not checked';
  if (status === 'failed') return 'Could not check details. Try checking again.';
  if (status === 'unavailable') return 'Details unavailable from the public source';
  return t.discovery.events.length ? 'Published event details' : 'Events not published';
}
function discoveryDistance(t) {
  if (!discoveryState.origin) return '';
  if (discoveryOnline(t)) return 'Online · no physical distance';
  const km = t.discovery.distanceKm;
  if (km === null) return 'Distance unavailable';
  return 'Approx. ' + Math.round(km / 1.609344) + ' miles · straight-line' + (discoveryState.metadata[t.id]?.coordinates?.approximate ? ' · event city estimate' : '');
}
function discoveryEventsHTML(t, expanded = false) {
  const events = t.discovery.events;
  const label = e => '<span class="discovery-event' + (discoveryState.eventIds.includes(e.id) ? ' is-match' : '') + '" title="Published as: ' + attr(e.sourceLabel) + '">' + esc(e.label) + '</span>';
  if (!events.length) return '<span class="discovery-hint">' + esc(discoveryStatus(t)) + '</span>';
  return events.slice(0, expanded ? events.length : 4).map(label).join(' ') + (!expanded && events.length > 4 ? '<details class="discovery-event-overflow"><summary>+' + (events.length - 4) + ' more</summary>' + events.slice(4).map(label).join(' ') + '</details>' : '');
}
function discoverySaveHTML(t) {
  return '<button data-discovery-save="' + attr(t.id) + '" aria-pressed="' + isSaved(t.id) + '" aria-label="' + (isSaved(t.id) ? 'Unsave ' : 'Save ') + attr(t.name) + '">' + (isSaved(t.id) ? 'Saved' : 'Save') + '</button>';
}
function discoveryRowHTML(t) {
  return '<article class="discovery-row' + (discoveryState.preview?.id === t.id ? ' is-previewed' : '') + '" data-discovery-row="' + attr(t.id) + '"><div class="discovery-date">' + esc(t.dates || 'Dates not published') + '</div><div class="discovery-row-main"><h3><a data-tournament-link="' + attr(t.id) + '" href="#tournament/' + attr(t.id) + '">' + esc(t.name) + '</a></h3><p>' + esc([t.city, t.location || t.state, (t.modes || []).join(' / ') || 'Format not published'].filter(Boolean).join(' · ')) + '</p><div class="discovery-events">' + discoveryEventsHTML(t) + '</div>' + (t.discovery.circuitLabels.length ? '<p>' + esc(t.discovery.circuitLabels.join(' · ')) + '</p>' : '') + (discoveryState.origin ? '<p>' + esc(discoveryDistance(t)) + '</p>' : '') + '</div><div class="discovery-row-actions"><span>' + esc(t.registration || 'Registration not published') + '</span><div><button data-preview="' + attr(t.id) + '" aria-haspopup="dialog" aria-label="Preview ' + attr(t.name) + '">Preview</button>' + discoverySaveHTML(t) + '</div></div></article>';
}
function discoveryCoverage() {
  const items = discoveryBase();
  const checked = items.filter(t => discoveryState.metadata[t.id]);
  const available = checked.filter(t => discoveryState.metadata[t.id].status === 'available').length;
  const failed = checked.filter(t => discoveryState.metadata[t.id].status === 'failed').length;
  return checked.length + ' of ' + items.length + ' listed tournaments checked · ' + available + ' with published details' + (failed ? ' · ' + failed + ' failed checks' : '') + '. Matches may be incomplete.';
}
function discoveryDrawResults() {
  if (!discoveryActive()) return;
  const results = discoveryResults();
  const shown = results.slice(0, discoveryState.visible);
  // Do not replace the controls, dialog, or search while details arrive.
  const region = $('#discovery-results');
  const focus = document.activeElement;
  const focusedId = focus?.dataset?.preview || focus?.dataset?.discoverySave || focus?.dataset?.tournamentLink;
  const focusKind = focus?.dataset?.preview ? 'data-preview' : focus?.dataset?.discoverySave ? 'data-discovery-save' : 'data-tournament-link';
  let onlineHeading = false;
  region.innerHTML = shown.length ? shown.map(t => {
    let heading = '';
    if (discoveryState.origin && discoveryOnline(t) && !onlineHeading) {
      onlineHeading = true;
      heading = '<h3 class="discovery-online-heading">Online tournaments</h3><p class="discovery-hint">Included separately, not within your radius.</p>';
    }
    return heading + discoveryRowHTML(t);
  }).join('') : '<div class="discovery-empty"><h3>No matches in the checked listing.</h3><p>Try fewer filters or check more published details. Unchecked events and missing locations cannot be confirmed as matches.</p></div>';
  if (focusedId && !focus.isConnected) (region.querySelector('[' + focusKind + '="' + focusedId + '"]') || $('#discovery-count')).focus();
  $('#discovery-count').textContent = results.length + (results.length === 1 ? ' tournament' : ' tournaments');
  $('#discovery-coverage').textContent = discoveryCoverage();
  const next = discoveryUnchecked();
  $('#discovery-check-next').disabled = discoveryState.metadataBusy || discoveryState.calendarBusy || !next.length;
  $('#discovery-check-next').textContent = discoveryState.metadataBusy ? 'Checking published details…' : next.length ? 'Check next ' + Math.min(12, next.length) : 'Listed details checked';
  $('#discovery-show-more').hidden = results.length <= discoveryState.visible;
  $('#discovery-retry-details').hidden = !discoveryBase().some(t => discoveryState.metadata[t.id]?.status === 'failed');
  $('#discovery-retry-details').disabled = discoveryState.metadataBusy || discoveryState.calendarBusy;
  discoveryState.animation?.cancel();
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && region.animate) discoveryState.animation = region.animate([{opacity:0.65},{opacity:1}], {duration:180});
}
function discoveryChips() {
  const chips = [];
  const add = (kind, value, label) => chips.push('<button data-remove-filter="' + kind + '" data-value="' + attr(value) + '" aria-label="Remove ' + attr(label) + '">' + esc(label) + ' <span aria-hidden="true">×</span></button>');
  if (filter.q) add('q', '', 'Search: ' + filter.q);
  for (const id of discoveryState.eventIds) add('event', id, DISCOVERY_EVENTS.find(e=>e.id===id)?.label || id.replace(/^other:/,''));
  for (const key of ['circuit_id','state','country','year','mode','registration']) if (filter[key]) {
    const options = calendar?.filters?.[key] || calendar?.filters?.[key === 'circuit_id' ? 'circuit' : key] || [];
    add(key, '', (key === 'circuit_id' ? 'Circuit: ' : '') + (options.find(o=>o.value===filter[key])?.label || filter[key]));
  }
  if (filter.judges) add('judges', '', 'Seeking judges');
  if (discoveryState.origin) add('location', '', discoveryState.origin.label);
  if (discoveryState.radius) add('radius', '', discoveryState.radius + ' miles');
  if (!discoveryState.includeOnline) add('online', '', 'Online excluded');
  $('#discovery-chips').innerHTML = chips.join('');
}
function discoverySuggestions() {
  if (!discoveryActive()) return;
  const people = searchEverything(filter.q).competitors;
  $('#discovery-suggestions').innerHTML = filter.q.trim() && !discoveryState.suggestionsDismissed ? '<section class="discovery-suggestions"><h2>Available past competitors</h2><p>Optional Lincoln-Douglas corpus only, not a comprehensive person search. School search applies to this corpus.</p>' + (people.length ? people.map(c => '<a href="#competitor/' + attr(encodeURIComponent(c.event) + '/' + encodeURIComponent(c.season) + '/' + encodeURIComponent(c.code)) + '">' + esc(c.name || c.code) + '<span>' + esc([c.school,c.code,c.season].filter(Boolean).join(' · ')) + '</span></a>').join('') : '<p>No available competitor matches. Tournament results are below.</p>') + '</section>' : '';
}
function discoveryRefresh() {
  if (!discoveryActive()) return;
  if (discoveryState.sort === 'matches' && !discoveryState.eventIds.length) {
    discoveryState.sort = 'date';
    $('#discovery-sort').value = 'date';
    $('#discovery-sort-note').textContent = 'Select preferred events before sorting by matches.';
  }
  discoveryChips();
  discoveryDrawResults();
}
function discoveryUnchecked() {
  // The explicit button advances through query/advanced-filter candidates, not
  // event-filter matches (unknown events must remain checkable).
  return discoverTournaments(discoveryBase(), {}, {query:filter.q}).filter(t => !discoveryState.metadata[t.id]);
}
async function discoveryJSON(url, controller, options = {}) {
  const response = await fetch(url, {signal:controller.signal, ...options});
  if (!response.ok) throw Error('Public data is temporarily unavailable.');
  return response.json();
}
async function discoveryCheckNext(retry = false) {
  if (!discoveryActive() || discoveryState.metadataBusy || discoveryState.calendarBusy) return;
  const candidates = retry ? discoveryBase().filter(t => discoveryState.metadata[t.id]?.status === 'failed') : discoveryUnchecked();
  const ids = candidates.slice(0,12).map(t=>t.id);
  if (!ids.length) return;
  const generation = ++discoveryState.metadataGeneration;
  discoveryState.metadataAbort?.abort();
  const controller = discoveryState.metadataAbort = new AbortController();
  discoveryState.metadataBusy = true;
  discoveryDrawResults();
  try {
    const data = await discoveryJSON('/api/discovery?ids=' + ids.map(encodeURIComponent).join(','), controller);
    if (!discoveryActive() || generation !== discoveryState.metadataGeneration) return;
    const items = new Map((data.items || []).map(item => [String(item.id),item]));
    for (const id of ids) discoveryState.metadata[id] = items.get(String(id)) || {id,status:'unavailable',events:[]};
  } catch (error) {
    if (!discoveryActive() || generation !== discoveryState.metadataGeneration) return;
    if (error.name !== 'AbortError') for (const id of ids) discoveryState.metadata[id] = {id,status:'failed',events:[]};
  } finally {
    if (generation === discoveryState.metadataGeneration && discoveryActive()) {
      discoveryState.metadataBusy = false;
      const others = new Map();
      for (const item of Object.values(discoveryState.metadata)) for (const event of classifyEvents(item.events)) if (event.group === 'other') others.set(event.id,event);
      $('#discovery-other-events').innerHTML = others.size ? discoveryEventChoices([...others.values()]) : 'No other regional labels in checked details yet.';
      discoveryDrawResults();
      discoveryUpdatePreview();
    }
  }
}
function discoveryLocationDraw() {
  if (!discoveryActive()) return;
  $('#discovery-location-status').textContent = discoveryState.locationMessage;
  $('#discovery-candidates').innerHTML = discoveryState.candidates.map((c,i) => '<button data-place-index="' + i + '">Use ' + esc(c.label) + '</button>').join('');
  $('#discovery-radius').disabled = !discoveryState.origin;
  $('#discovery-radius').value = discoveryState.radius;
  const anyDistance = $('#discovery-radius').querySelector('option[value=""]');
  if (anyDistance) anyDistance.textContent = discoveryState.origin ? 'Any distance' : 'Set location first';
  $('#discovery-radius-note').textContent = discoveryState.origin ? 'From ' + discoveryState.origin.label + ' · approximate straight-line distances' : 'Set a location to enable distance filters.';
  discoveryRefresh();
  discoveryUpdatePreview();
}
function discoveryClearLocation() {
  ++discoveryState.geoGeneration;
  discoveryState.geoAbort?.abort();
  discoveryState.origin = null;
  discoveryState.radius = '';
  discoveryState.candidates = [];
  discoveryState.locationMessage = 'Location cleared. Nothing is stored on this device.';
  if (discoveryState.sort === 'distance') discoveryState.sort = 'date';
  if (discoveryActive()) {
    $('#discovery-place').value = '';
    $('#discovery-sort').value = discoveryState.sort;
    discoveryLocationDraw();
  }
}
async function discoveryFindPlace(query) {
  if (!discoveryActive()) return;
  const text = String(query).trim();
  if (text.length < 2 || text.length > 100) return;
  const generation = ++discoveryState.geoGeneration;
  discoveryState.geoAbort?.abort();
  const controller = discoveryState.geoAbort = new AbortController();
  discoveryState.candidates = [];
  discoveryState.locationMessage = 'Searching Open-Meteo / GeoNames…';
  discoveryLocationDraw();
  try {
    const data = await discoveryJSON('/api/locations?q=' + encodeURIComponent(text), controller, {cache:'no-store'});
    if (!discoveryActive() || generation !== discoveryState.geoGeneration) return;
    discoveryState.candidates = (data.results || []).filter(p => typeof p.label === 'string' && distanceKm(p,p) !== null).slice(0,5);
    discoveryState.locationMessage = discoveryState.candidates.length ? 'Choose a place. Results from Open-Meteo / GeoNames.' : 'No places found. Try a city and country or a nearby city.';
  } catch (error) {
    if (!discoveryActive() || generation !== discoveryState.geoGeneration) return;
    discoveryState.locationMessage = 'Place search unavailable. Try again, or use Find near me.';
  }
  discoveryLocationDraw();
}
function discoveryLocate() {
  if (!discoveryActive()) return;
  const generation = ++discoveryState.geoGeneration;
  discoveryState.geoAbort?.abort();
  discoveryState.candidates = [];
  discoveryState.locationMessage = 'Waiting for your location permission…';
  discoveryLocationDraw();
  if (!navigator.geolocation) {
    discoveryState.locationMessage = 'Browser location is unavailable. Search for a city or postal code instead.';
    return discoveryLocationDraw();
  }
  navigator.geolocation.getCurrentPosition(position => {
    if (!discoveryActive() || generation !== discoveryState.geoGeneration) return;
    // Coarsen locally. Browser coordinates are never sent to the geocoder.
    const origin = {label:'Your approximate location', latitude:Math.round(position.coords.latitude*100)/100, longitude:Math.round(position.coords.longitude*100)/100};
    if (distanceKm(origin,origin) === null) return;
    discoveryState.origin = origin;
    discoveryState.locationMessage = 'Using your approximate location for this workspace only.';
    discoveryLocationDraw();
  }, () => {
    if (!discoveryActive() || generation !== discoveryState.geoGeneration) return;
    discoveryState.locationMessage = 'Location permission was denied or timed out. Search for a city or postal code instead.';
    discoveryLocationDraw();
  }, {enableHighAccuracy:false, timeout:10000, maximumAge:300000});
}
async function discoveryReloadCalendar() {
  if (!discoveryActive()) return;
  const generation = ++discoveryState.calendarGeneration;
  const token = ++routeToken;
  discoveryState.calendarAbort?.abort();
  discoveryState.metadataAbort?.abort();
  ++discoveryState.metadataGeneration;
  discoveryState.metadataBusy = false;
  const controller = discoveryState.calendarAbort = new AbortController();
  const params = new URLSearchParams();
  for (const key of discoveryServerFilters) if (filter[key]) params.set(key,filter[key]);
  discoveryState.calendarBusy = true;
  $('#discovery-calendar-status').textContent = 'Loading this calendar selection…';
  $('#discovery-results').setAttribute('aria-busy','true');
  $('#discovery-results').innerHTML = '';
  $('#discovery-check-next').disabled = true;
  try {
    const data = await discoveryJSON('/api/calendar?' + params, controller);
    if (!discoveryActive() || generation !== discoveryState.calendarGeneration || token !== routeToken) return;
    calendar = data;
    $('#discovery-calendar-status').textContent = '';
    $('#discovery-source').innerHTML = sourceLine(calendar,'10 min');
    for (const key of discoveryServerFilters) {
      const select = $('#discovery-' + key);
      const choices = calendar.filters?.[key] || calendar.filters?.[key === 'circuit_id' ? 'circuit' : key] || [];
      // Keep the currently selected published option even if the source omits it.
      if (choices.length) select.innerHTML = opts(choices.some(o=>o.value===filter[key]) || !filter[key] ? choices : [...choices,{value:filter[key],label:filter[key]}],filter[key],key === 'year' ? 'Upcoming dates' : 'All ' + (key === 'circuit_id' ? 'circuits' : key));
    }
  } catch (error) {
    if (!discoveryActive() || generation !== discoveryState.calendarGeneration || token !== routeToken) return;
    // Never present a previous circuit's results as this selection's matches.
    calendar = {tournaments:[],filters:calendar?.filters || {}};
    $('#discovery-source').innerHTML = '';
    $('#discovery-calendar-status').innerHTML = 'Calendar unavailable for these filters. <button id="discovery-retry">Try again</button> <a href="https://www.tabroom.com/index/index.mhtml">Official calendar ↗</a>';
  } finally {
    if (discoveryActive() && generation === discoveryState.calendarGeneration && token === routeToken) {
      discoveryState.calendarBusy = false;
      $('#discovery-results').removeAttribute('aria-busy');
      discoveryRefresh();
      discoveryCheckNext();
    }
  }
}
function discoveryClearAll() {
  const reload = discoveryServerFilters.some(key=>filter[key]);
  for (const key of Object.keys(filter)) filter[key] = key === 'judges' ? false : '';
  discoveryState.eventIds = [];
  discoveryState.eventMatch = 'any';
  discoveryState.sort = 'date';
  discoveryState.includeOnline = true;
  discoveryState.visible = 24;
  discoveryState.suggestionsDismissed = false;
  discoveryClearLocation();
  if (discoveryActive()) {
    discoverySyncControls();
    $('#discovery-sort-note').textContent = '';
    discoverySuggestions();
    discoveryRefresh();
    if (reload) discoveryReloadCalendar();
  }
}
function discoverySyncControls() {
  $('#discovery-search').value = filter.q;
  for (const key of [...discoveryServerFilters,'mode','registration']) $('#discovery-'+key).value = filter[key];
  $('#discovery-judges').checked = filter.judges;
  $('#discovery-online').checked = discoveryState.includeOnline;
  $('#discovery-event-match').value = discoveryState.eventMatch;
  $('#discovery-sort').value = discoveryState.sort;
  $('#discovery-radius').value = discoveryState.radius;
  for (const checkbox of discoveryState.root.querySelectorAll('[data-event]')) checkbox.checked = discoveryState.eventIds.includes(checkbox.dataset.event);
}
function discoveryExport() {
  downloadCSV(discoveryResults().map(t=>({Date:t.dates,Tournament:t.name,City:t.city,Location:t.location,Format:(t.modes || []).join(', '),Events:t.discovery.events.map(e=>e.sourceLabel).join(', '),Circuits:t.discovery.circuitLabels.join(', '),Details:discoveryStatus(t),Distance:discoveryDistance(t),Registration:t.registration,Source:t.sourceUrl || href(t.id)})), 'tabbetter-tournaments.csv');
}
function discoveryPreview(id, trigger) {
  const t = discoveryResults().find(t=>t.id===id);
  if (!t) return;
  discoveryState.preview = t;
  discoveryState.previewTrigger = trigger;
  discoveryUpdatePreview();
  const dialog = $('#discovery-preview');
  dialog.showModal();
  $('#discovery-preview-close').focus();
  for (const row of discoveryState.root.querySelectorAll('[data-discovery-row]')) row.classList.toggle('is-previewed',row.dataset.discoveryRow===id);
}
function discoveryUpdatePreview() {
  if (!discoveryActive() || !discoveryState.preview) return;
  const t = discoverTournaments([discoveryState.preview], discoveryState.metadata, {origin:discoveryState.origin})[0];
  const metadata = discoveryState.metadata[t.id];
  const focused = document.activeElement;
  const focusKey = focused?.dataset?.discoverySave ? '[data-discovery-save]' : focused?.tagName === 'A' ? 'a[href="' + focused.getAttribute('href') + '"]' : null;
  const content = $('#discovery-preview-content');
  const hadFocus = focusKey && content.contains?.(focused);
  content.innerHTML = '<h2 id="discovery-preview-title">' + esc(t.name) + '</h2><p>' + esc([t.dates,t.city,t.location,(t.modes || []).join(' / ')].filter(Boolean).join(' · ')) + '</p><p>' + esc(discoveryDistance(t)) + '</p><h3>Publication &amp; registration</h3><p>' + esc(discoveryStatus(t)) + '</p><p>' + esc(t.registration || 'Registration not published') + '</p><h3>Offered events</h3><div class="discovery-events">' + discoveryEventsHTML(t,true) + '</div><h3>Published circuits</h3><p>' + esc(t.discovery.circuitLabels.join(' · ') || 'Circuit affiliation not published in checked details') + '</p><p class="discovery-hint">' + (metadata?.fetchedAt ? 'Details checked ' + esc(new Date(metadata.fetchedAt).toLocaleString()) : 'Details have not been checked yet.') + '</p><a href="' + attr(metadata?.sourceUrl || href(t.id)) + '" target="_blank" rel="noopener">Official source ↗</a><div class="discovery-preview-actions"><a href="#tournament/' + attr(t.id) + '">Open tournament →</a>' + discoverySaveHTML(t) + '</div>';
  if (hadFocus) content.querySelector(focusKey)?.focus();
}
function discoverySave(id) {
  const t = discoveryBase().find(t=>t.id===id) || (discoveryState.preview?.id===id ? discoveryState.preview : null);
  if (!t) return;
  save(t);
  // Updating buttons in place preserves the focused save control and dialog.
  for (const button of discoveryState.root.querySelectorAll('[data-discovery-save]')) if (button.dataset.discoverySave===id) {
    button.textContent = isSaved(id) ? 'Saved' : 'Save';
    button.setAttribute('aria-pressed',String(isSaved(id)));
    button.setAttribute('aria-label',(isSaved(id)?'Unsave ':'Save ')+t.name);
  }
  if (route().name === 'saved') discoveryDrawResults();
}
function discoveryKeydown(event) {
  if (!discoveryActive() || event.isComposing) return;
  const active = document.activeElement;
  const editable = ['INPUT','TEXTAREA','SELECT'].includes(active?.tagName) || active?.isContentEditable;
  if ((event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) && !editable && !$('#discovery-preview').open) {
    event.preventDefault();
    $('#discovery-search').focus();
  }
  if (event.key === 'Escape' && !$('#discovery-preview').open) {
    const open = [...discoveryState.root.querySelectorAll('.discovery-filters > details[open]')].pop();
    if (open) { open.open = false; open.querySelector('summary').focus(); event.preventDefault(); }
    else { discoveryState.suggestionsDismissed = true; $('#discovery-suggestions').innerHTML = ''; }
  }
}
function discoveryClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  const data = button.dataset;
  if (data.preview) return discoveryPreview(data.preview,button);
  if (data.discoverySave) return discoverySave(data.discoverySave);
  if (data.placeIndex !== undefined) {
    const place = discoveryState.candidates[Number(data.placeIndex)];
    if (!place) return;
    ++discoveryState.geoGeneration;
    discoveryState.geoAbort?.abort();
    discoveryState.origin = {label:place.label,latitude:place.latitude,longitude:place.longitude};
    discoveryState.candidates = [];
    discoveryState.locationMessage = 'Using ' + place.label + ' for this workspace only.';
    discoveryLocationDraw();
    $('#discovery-clear-location').focus();
    return;
  }
  if (data.removeFilter) {
    const kind = data.removeFilter;
    if (kind === 'event') discoveryState.eventIds = discoveryState.eventIds.filter(id=>id!==data.value);
    else if (kind === 'location') discoveryClearLocation();
    else if (kind === 'radius') discoveryState.radius = '';
    else if (kind === 'online') discoveryState.includeOnline = true;
    else filter[kind] = kind === 'judges' ? false : '';
    discoverySyncControls(); discoverySuggestions(); discoveryRefresh();
    $('#discovery-clear-all').focus();
    if (discoveryServerFilters.includes(kind)) discoveryReloadCalendar();
    return;
  }
  const actions = {
    'discovery-retry-details':()=>discoveryCheckNext(true),
    'discovery-check-next':()=>discoveryCheckNext(), 'discovery-near-me':discoveryLocate,
    'discovery-clear-location':discoveryClearLocation, 'discovery-clear-all':discoveryClearAll,
    'discovery-export':discoveryExport, 'discovery-print':()=>window.print(),
    'discovery-open':()=>$('#jump').showModal(), 'discovery-retry':discoveryReloadCalendar,
    'discovery-preview-close':()=>$('#discovery-preview').close(),
    'discovery-show-more':()=>{discoveryState.visible+=24; discoveryDrawResults();},
  };
  actions[button.id]?.();
}
function discoveryChange(event) {
  const target = event.target;
  if (target.dataset.event) {
    const ids = new Set(discoveryState.eventIds);
    target.checked ? ids.add(target.dataset.event) : ids.delete(target.dataset.event);
    discoveryState.eventIds = [...ids];
  } else {
    const key = target.id.replace('discovery-','');
    if (discoveryServerFilters.includes(key)) { filter[key]=target.value; discoveryChips(); return discoveryReloadCalendar(); }
    if (['mode','registration'].includes(key)) filter[key] = target.value;
    if (key === 'judges') filter.judges = target.checked;
    if (key === 'event-match') discoveryState.eventMatch = target.value;
    if (key === 'online') discoveryState.includeOnline = target.checked;
    if (key === 'radius') discoveryState.radius = target.value;
    if (key === 'sort') {
      const message = target.value === 'distance' && !discoveryState.origin ? 'Set a location before sorting by distance.' : target.value === 'matches' && !discoveryState.eventIds.length ? 'Select preferred events before sorting by matches.' : '';
      $('#discovery-sort-note').textContent = message;
      if (message) { target.value=discoveryState.sort; return; }
      discoveryState.sort=target.value;
    }
  }
  discoveryState.visible=24;
  discoveryRefresh();
}
function unmountDiscoveryWorkspace() {
  ++discoveryState.generation;
  ++discoveryState.metadataGeneration;
  ++discoveryState.calendarGeneration;
  ++discoveryState.geoGeneration;
  discoveryState.metadataAbort?.abort();
  discoveryState.calendarAbort?.abort();
  discoveryState.geoAbort?.abort();
  discoveryState.animation?.cancel();
  window.removeEventListener('keydown',discoveryKeydown);
  discoveryState.motionMedia?.removeEventListener('change',discoveryCancelMotion);
  discoveryState.root = null;
  discoveryState.metadataBusy = false;
  discoveryState.calendarBusy = false;
  discoveryState.origin = null;
  discoveryState.radius = '';
  discoveryState.candidates = [];
  discoveryState.locationMessage = '';
  discoveryState.preview = null;
  discoveryState.previewTrigger = null;
  if (discoveryState.sort==='distance') discoveryState.sort='date';
}
function discoveryCancelMotion() { discoveryState.animation?.cancel(); }
function renderDiscoveryWorkspace() {
  if (!['discover','saved'].includes(route().name)) return;
  if (discoveryActive()) unmountDiscoveryWorkspace();
  $('#app').innerHTML = discoveryShellHTML();
  discoveryState.root = $('.discovery-workspace');
  const generation = ++discoveryState.generation;
  discoveryState.root.onclick = discoveryClick;
  discoveryState.root.onchange = discoveryChange;
  $('#discovery-search').oninput = event => {
    discoveryState.suggestionsDismissed = false;
    filter.q=event.target.value; discoveryState.visible=24;
    discoverySuggestions(); discoveryRefresh();
  };
  $('#discovery-location-form').onsubmit = event => {event.preventDefault(); discoveryFindPlace($('#discovery-place').value);};
  $('#discovery-preview').onclose = () => {
    const trigger = discoveryState.previewTrigger;
    const id = discoveryState.preview?.id;
    discoveryState.preview=null;
    discoveryState.previewTrigger=null;
    for (const row of discoveryState.root?.querySelectorAll('[data-discovery-row]') || []) row.classList.remove('is-previewed');
    if (discoveryActive()) (trigger?.isConnected ? trigger : discoveryState.root.querySelector('[data-preview="' + id + '"]') || $('#discovery-count')).focus();
  };
  for (const disclosure of discoveryState.root.querySelectorAll('.discovery-filters > details')) disclosure.ontoggle = () => {
    if (disclosure.open) for (const other of discoveryState.root.querySelectorAll('.discovery-filters > details')) if(other!==disclosure) other.open=false;
  };
  window.addEventListener('keydown',discoveryKeydown);
  discoveryState.motionMedia=window.matchMedia('(prefers-reduced-motion: reduce)');
  discoveryState.motionMedia.addEventListener('change',discoveryCancelMotion);
  discoveryRefresh();
  discoverySuggestions();
  ensureSearchIndex().then(()=>{if(discoveryActive() && generation===discoveryState.generation) discoverySuggestions();});
  discoveryCheckNext();
}
// app.js may have rendered before this classic script was initialized. It does
// not fetch a second calendar or bind the legacy directory in this handoff.
if (['discover','saved'].includes(route().name) && calendar) renderDiscoveryWorkspace();
