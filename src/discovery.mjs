// Pure, browser-safe discovery contracts. Only published event labels are classified.
export const DISCOVERY_EVENTS = [
  ['di', 'Dramatic Interpretation', 'speech', ['DI']],
  ['duo', 'Duo Interpretation', 'speech', ['Duo']],
  ['hi', 'Humorous Interpretation', 'speech', ['HI']],
  ['poi', 'Program Oral Interpretation', 'speech', ['POI']],
  ['prose', 'Prose', 'speech', ['Prose Interpretation']],
  ['poetry', 'Poetry', 'speech', ['Poetry Interpretation']],
  ['storytelling', 'Storytelling', 'speech', []],
  ['commentary', 'Commentary', 'speech', []],
  ['declamation', 'Declamation', 'speech', ['DEC']],
  ['expository', 'Expository', 'speech', ['Expository Speaking']],
  ['ix', 'International Extemp', 'speech', ['International Extemporaneous Speaking', 'IX', 'FX', 'Foreign Extemp']],
  ['usx', 'Domestic Extemp', 'speech', ['United States Extemp', 'US Extemp', 'Domestic Extemporaneous Speaking', 'USX', 'DX']],
  ['extemp', 'Extemporaneous Speaking', 'speech', ['Extemp']],
  ['impromptu', 'Impromptu', 'speech', ['Impromptu Speaking']],
  ['info', 'Informative', 'speech', ['Informative Speaking', 'Info']],
  ['oo', 'Original Oratory', 'speech', ['OO', 'Oratory']],
  ['osw', 'Original Spoken Word Poetry', 'speech', ['OSW', 'Spoken Word Poetry']],
  ['bq', 'Big Questions', 'debate', ['BQ', 'Big Questions Debate']],
  ['congress', 'Congressional Debate', 'debate', ['Congress', 'Student Congress']],
  ['extemp-debate', 'Extemporaneous Debate', 'debate', ['Extemp Debate']],
  ['ld', 'Lincoln-Douglas', 'debate', ['LD', 'Lincoln Douglas', 'Lincoln Douglas Debate']],
  ['policy', 'Policy', 'debate', ['CX', 'Policy Debate', 'Cross Examination Debate']],
  ['pf', 'Public Forum', 'debate', ['PF', 'PFD', 'Public Forum Debate']],
  ['ws', 'World Schools', 'debate', ['WSD', 'World Schools Debate']],
  ['parli', 'Parliamentary', 'debate', ['Parli', 'Parliamentary Debate']],
].map(([id, label, group, aliases]) => ({ id, label, group, aliases }));

function discoveryLabel(value) {
  return String(value ?? '').toLowerCase().replace(/[–—-]/g, ' ').replace(/\s+/g, ' ').trim();
}
function discoveryEventKey(value) {
  return discoveryLabel(value)
    .replace(/^(?:(?:varsity|junior varsity|jv|novice|open|middle school|high school)\s+)+/, '')
    .replace(/(?:\s+(?:varsity|junior varsity|jv|novice|open|middle school|high school))+$/, '')
    .trim();
}
export function classifyEvents(events) {
  const result = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const sourceLabel = typeof event === 'string' ? event.trim() : typeof event?.name === 'string' ? event.name.trim() : typeof event?.sourceLabel === 'string' ? event.sourceLabel.trim() : '';
    if (!sourceLabel) continue;
    const key = discoveryEventKey(sourceLabel);
    const known = DISCOVERY_EVENTS.find(e => [e.label, ...e.aliases].some(a => discoveryLabel(a) === key));
    const id = known?.id || 'other:' + discoveryLabel(sourceLabel);
    if (!result.has(id)) result.set(id, { id, label: known?.label || sourceLabel, group: known?.group || 'other', sourceLabel });
  }
  return [...result.values()];
}
export function distanceKm(a, b) {
  const valid = p => p && Number.isFinite(p.latitude) && Number.isFinite(p.longitude) && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
  if (!valid(a) || !valid(b)) return null;
  const rad = Math.PI / 180;
  const h = Math.sin((b.latitude - a.latitude) * rad / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin((b.longitude - a.longitude) * rad / 2) ** 2;
  return 6371.0088 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, h))));
}
function discoveryOnline(tournament) {
  const modes = Array.isArray(tournament.modes) ? tournament.modes.map(discoveryLabel) : [];
  return modes.includes('online') && !modes.some(m => ['hybrid', 'in person'].includes(m));
}
export function discoverTournaments(tournaments, metadata = {}, options = {}) {
  metadata ||= {};
  options ||= {};
  const selected = [...new Set(Array.isArray(options.eventIds) ? options.eventIds : [])];
  const query = discoveryLabel(options.query);
  const radius = Number.isFinite(options.radiusKm) && options.radiusKm >= 0 ? options.radiusKm : null;
  const compare = (a, b) => String(a).localeCompare(String(b), 'en');
  const stable = (a, b) => compare(a.sortDate || a.start || '9999', b.sortDate || b.start || '9999') || compare(a.name || '', b.name || '') || compare(a.id, b.id);
  return (Array.isArray(tournaments) ? tournaments : []).map(t => {
    const m = metadata[t.id];
    const events = classifyEvents(m?.events);
    return { ...t, discovery: {
      events,
      distanceKm: discoveryOnline(t) ? null : distanceKm(options.origin, m?.coordinates),
      eventMatches: selected.filter(id => events.some(e => e.id === id)).length,
      metadataStatus: m?.status || 'unknown',
      circuitLabels: (Array.isArray(m?.circuits) ? m.circuits : []).filter(c => c?.id && typeof c.label === 'string').map(c => c.label),
    } };
  }).filter(t => {
    if (query && !discoveryLabel([t.name, t.city, t.location, t.state, t.country].join(' ')).includes(query)) return false;
    if (selected.length && (options.eventMatch === 'all' ? t.discovery.eventMatches !== selected.length : !t.discovery.eventMatches)) return false;
    if (discoveryOnline(t)) return options.includeOnline !== false;
    return radius === null || (t.discovery.distanceKm !== null && t.discovery.distanceKm <= radius);
  }).sort((a, b) => {
    const onlineGroup = options.origin ? Number(discoveryOnline(a)) - Number(discoveryOnline(b)) : 0;
    if (onlineGroup) return onlineGroup;
    let order = 0;
    if (options.sort === 'distance') order = (a.discovery.distanceKm ?? Infinity) - (b.discovery.distanceKm ?? Infinity);
    if (options.sort === 'matches') order = b.discovery.eventMatches - a.discovery.eventMatches;
    if (options.sort === 'name') order = compare(a.name || '', b.name || '');
    return order || stable(a, b);
  });
}
