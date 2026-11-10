import { clean, normalizeExport } from './data.mjs';
import { distanceKm } from './discovery.mjs';

const discoveryRegions = Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(s => s.split(':')));
const discoveryPlaceKey = value => String(value || '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const discoverySafeLabel = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 160 && !/[<>\x00-\x1f\x7f]/.test(value);

// Small evidence tokenizer, not an HTML renderer. Tag boundaries and attributes
// are quote-aware. Raw elements/comments never contribute source evidence.
function discoveryElements(html) {
  const nodes = [], stack = [];
  let i = 0;
  while (i < html.length) {
    const start = html.indexOf('<', i);
    if (start < 0) break;
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4);
      i = end < 0 ? html.length : end + 3;
      continue;
    }
    const match = /^<(\/?)([a-z][a-z0-9:-]*)(?=[\s/>])/i.exec(html.slice(start));
    if (!match) { i = start + 1; continue; }
    let end = start + match[0].length, quote = '';
    for (; end < html.length; end++) {
      const char = html[end];
      if (quote) { if (char === quote) quote = ''; }
      else if (char === '"' || char === "'") quote = char;
      else if (char === '>') break;
    }
    if (end === html.length) break;
    const tag = match[2].toLowerCase();
    i = end + 1;
    if (match[1]) {
      const index = stack.findLastIndex(node => node.tag === tag);
      if (index >= 0) {
        stack[index].end = start;
        stack.length = index;
      }
      continue;
    }
    if (['script','style','textarea','template','noscript','iframe','title','xmp','noembed','noframes'].includes(tag)) {
      const close = new RegExp('<\\/' + tag + '\\s*>', 'ig');
      close.lastIndex = i;
      const found = close.exec(html);
      i = found ? close.lastIndex : html.length;
      continue;
    }
    const attrs = Object.create(null);
    const source = html.slice(start + match[0].length, end);
    for (const attribute of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const name = attribute[1].toLowerCase();
      // First exact attribute wins, like HTML. data-href and quoted decoys
      // remain separate attributes rather than supplying navigation evidence.
      if (!(name in attrs)) attrs[name] = clean(attribute[2] ?? attribute[3] ?? attribute[4] ?? '');
    }
    const node = {tag, attrs, start: i, end: i, parent: stack.at(-1) || null};
    nodes.push(node);
    if (!['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'].includes(tag) && !/\/\s*$/.test(source)) stack.push(node);
  }
  return nodes;
}

// One instance per worker isolate. No visitor coordinates, cookies or credentials.
export function createDiscoveryApi() {
  const metadata = new Map(), pendingMetadata = new Map(), pendingPlaces = new Map(), cityCache = new Map();
  const queue = [];
  let active = 0, minute = 0, minuteCount = 0, day = 0, dayCount = 0;
  function bounded(fn) {
    if (queue.length >= 48) return Promise.reject(Error('Discovery busy'));
    return new Promise((resolve, reject) => {
      queue.push({fn, resolve, reject});
      drain();
    });
  }
  function drain() {
    while (active < 3 && queue.length) {
      const job = queue.shift(); active++;
      Promise.resolve().then(job.fn).then(job.resolve, job.reject).finally(() => { active--; drain(); });
    }
  }
  function budget() {
    const now = Date.now(), m = Math.floor(now / 60000), d = Math.floor(now / 86400000);
    if (m !== minute) { minute = m; minuteCount = 0; }
    if (d !== day) { day = d; dayCount = 0; }
    if (minuteCount >= 60 || dayCount >= 5000) throw Error('Geocoding limit reached');
    minuteCount++; dayCount++;
  }
  async function text(url, maxBytes) {
    return bounded(async () => {
      if (url.startsWith('https://geocoding-api.open-meteo.com/')) budget();
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), redirect: 'error', credentials: 'omit', headers: { 'User-Agent': 'TabBetter/0.1 public discovery companion' } });
      if (!response.ok) throw Error('Public source unavailable');
      if (Number(response.headers.get('content-length')) > maxBytes) throw Error('Source too large');
      const reader = response.body?.getReader();
      if (!reader) throw Error('Empty source');
      const chunks = []; let length = 0;
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maxBytes) { await reader.cancel(); throw Error('Source too large'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return new TextDecoder().decode(bytes);
    });
  }
  function put(cache, key, value, ttl) {
    if (cache.size >= 200) cache.delete(cache.keys().next().value);
    cache.set(key, { value, until: Date.now() + ttl });
  }
  function get(cache, key) {
    const item = cache.get(key);
    if (item?.until > Date.now()) return item.value;
    cache.delete(key);
    return undefined;
  }
  async function places(name, country = '') {
    const params = new URLSearchParams({ name, count: '5', language: 'en', format: 'json' });
    if (/^[A-Z]{2}$/.test(country)) params.set('countryCode', country);
    const key = params.toString();
    if (!pendingPlaces.has(key)) {
      pendingPlaces.set(key, (async () => {
        const raw = JSON.parse(await text('https://geocoding-api.open-meteo.com/v1/search?' + params, 100000));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || raw.error || (raw.results !== undefined && !Array.isArray(raw.results))) throw Error('Invalid geocoder response');
        const result = raw.results || [];
        for (const r of result) {
          if (!r || !Number.isSafeInteger(r.id) || r.id <= 0 || !discoverySafeLabel(r.name) || distanceKm(r, r) === null || !/^[A-Z]{2}$/.test(r.country_code || '') || !discoverySafeLabel(r.country) || (r.admin1 !== undefined && !discoverySafeLabel(r.admin1))) throw Error('Invalid geocoder candidate');
        }
        return result.slice(0, 5);
      })().finally(() => pendingPlaces.delete(key)));
    }
    return pendingPlaces.get(key);
  }
  function regionMatch(candidate, region) {
    return !region || discoveryPlaceKey(candidate.admin1) === discoveryPlaceKey(discoveryRegions[region.toUpperCase()] || region);
  }
  async function coordinates(place) {
    const city = place.city?.trim(), state = place.state?.trim() || '', country = place.country?.trim().toUpperCase() || '';
    if (!city || !discoverySafeLabel(city) || /online|virtual|zoom|\b(?:utc|gmt|tbd|tba|unspecified)\b|\//i.test(city) || (!state && !country) || (country && !/^[A-Z]{2}$/.test(country))) return null;
    const key = JSON.stringify([city, state, country]);
    const found = get(cityCache, key); if (found !== undefined) return found;
    try {
      const results = (await places(city, country)).filter(r => /^PPL/.test(r.feature_code || '') && discoveryPlaceKey(r.name) === discoveryPlaceKey(city) && regionMatch(r, state) && (!country || r.country_code === country));
      const result = results.length === 1 ? { latitude: results[0].latitude, longitude: results[0].longitude, approximate: true, label: [results[0].name, results[0].admin1, results[0].country].filter(Boolean).join(', '), attribution: 'Open-Meteo / GeoNames' } : null;
      put(cityCache, key, result, 86400000);
      return result;
    } catch { return null; }
  }
  function publicPage(html, id) {
    const empty = { events: [], circuits: [], city: '', state: '', country: '' };
    const nodes = discoveryElements(html);
    const hasClass = (node, name) => node?.tag === 'div' && (node.attrs.class || '').split(/\s+/).includes(name);
    const label = node => clean(html.slice(node.start, node.end));
    const link = node => {
      if (node.tag !== 'a' || !node.attrs.href) return null;
      try {
        const url = new URL(node.attrs.href, 'https://www.tabroom.com/index/tourn/');
        return url.origin === 'https://www.tabroom.com' ? url : null;
      } catch { return null; }
    };
    const mains = nodes.filter(node => hasClass(node, 'main'));
    if (mains.length !== 1) return empty;
    const header = nodes.filter(node => node.parent === mains[0]);
    const title = header.findIndex(node => node.tag === 'h2' && discoverySafeLabel(label(node)));
    if (title < 0 || header[title + 1]?.tag !== 'h5') return empty;

    // The same published sidebar must identify this tournament via both its
    // Invitation Home and Events & Divisions links. Never trust a random event
    // link, an unrelated heading, or another tournament's affiliation block.
    const sidebars = nodes.filter(node => hasClass(node, 'sidenote') && hasClass(node.parent, 'menu'));
    const identified = sidebars.filter(sidebar => {
      const links = nodes.filter(node => node.parent === sidebar && node.tag === 'a');
      return [['Invitation Home', '/index/tourn/main.mhtml'], ['Events & Divisions', '/index/tourn/events.mhtml']].every(([text, path]) => {
        const matches = links.filter(node => label(node) === text);
        return matches.length === 1 && link(matches[0])?.pathname === path && link(matches[0])?.searchParams.get('tourn_id') === id;
      });
    });
    if (identified.length !== 1) return empty;
    const events = new Map(), circuits = new Map();
    let section = '';
    for (const node of nodes.filter(node => node.parent === identified[0])) {
      if (/^h[1-6]$/.test(node.tag)) { section = node.tag === 'h6' ? label(node) : ''; continue; }
      const url = link(node), text = label(node);
      if (!url || !discoverySafeLabel(text)) continue;
      const eventId = url.searchParams.get('event_id');
      if (section === 'Events' && url.pathname === '/index/tourn/events.mhtml' && url.searchParams.get('tourn_id') === id && /^[1-9]\d{0,8}$/.test(eventId || '')) events.set(eventId, { id: eventId, name: text });
      const circuitId = url.searchParams.get('circuit_id');
      if (section === 'Circuits' && url.pathname === '/index/circuit/index.mhtml' && /^[1-9]\d{0,7}$/.test(circuitId || '')) circuits.set(circuitId, { id: circuitId, label: text, sourceUrl: url.href });
    }
    const place = /^\d{4}\s*[—–-]\s*(.+),\s*([A-Za-z ]+)(?:\/([A-Za-z]{2}))?$/.exec(label(header[title + 1]));
    return { events: [...events.values()], circuits: [...circuits.values()], city: place?.[1] || '', state: place?.[3] ? place[2] : '', country: place?.[3] || (place?.[2]?.length === 2 ? place[2] : '') };
  }
  async function enrich(id) {
    const base = { id, events: [], status: 'unavailable', coordinates: null, circuits: [], sourceUrl: 'https://www.tabroom.com/index/tourn/events.mhtml?tourn_id=' + id, fetchedAt: new Date().toISOString() };
    let normalized;
    try {
      const raw = JSON.parse(await text('https://www.tabroom.com/api/download_data.mhtml?tourn_id=' + id, 12000000));
      normalized = normalizeExport(raw, id);
      if (normalized.events.length) {
        base.events = normalized.events; base.status = 'available'; base.sourceUrl = normalized.sourceUrl;
      }
    } catch { /* Public event list remains available before registration/export. */ }
    try {
      const pageUrl = 'https://www.tabroom.com/index/tourn/events.mhtml?tourn_id=' + id;
      const published = publicPage(await text(pageUrl, 1000000), id);
      base.circuits = published.circuits;
      if (base.status !== 'available') {
        base.events = published.events;
        base.sourceUrl = pageUrl;
        if (published.events.length) base.status = 'available';
      }
      if (!normalized?.city) normalized = published;
    } catch { /* Keep successful export data or explicit per-item unavailable. */ }
    if (normalized) base.coordinates = await coordinates(normalized);
    return base;
  }
  async function item(id) {
    const cached = get(metadata, id); if (cached) return cached;
    if (!pendingMetadata.has(id)) {
      if (pendingMetadata.size >= 48) return { id, events: [], status: 'unavailable', coordinates: null, circuits: [], sourceUrl: 'https://www.tabroom.com/index/tourn/events.mhtml?tourn_id=' + id, fetchedAt: new Date().toISOString() };
      pendingMetadata.set(id, enrich(id).then(value => { put(metadata, id, value, value.status === 'available' ? 600000 : 60000); return value; }).finally(() => pendingMetadata.delete(id)));
    }
    return pendingMetadata.get(id);
  }
  return {
    async discovery(ids) { return { items: await Promise.all(ids.map(item)), partial: true }; },
    async locations(query) {
      const parts = query.split(',').map(p => p.trim());
      let country = '', region = parts[1] || '';
      if (parts.length === 3) country = parts[2].toUpperCase();
      else if (/^[A-Za-z]{2}$/.test(region) && !Object.hasOwn(discoveryRegions, region.toUpperCase())) { country = region.toUpperCase(); region = ''; }
      if (discoveryRegions[region.toUpperCase()] && !country) country = 'US';
      const results = (await places(parts[0], country)).filter(r => regionMatch(r, region) && (!country || r.country_code === country));
      return { results: results.map(r => ({ id: String(r.id), label: [r.name, r.admin1, r.country].filter(Boolean).join(', '), latitude: r.latitude, longitude: r.longitude })), attribution: 'Open-Meteo / GeoNames' };
    },
  };
}
