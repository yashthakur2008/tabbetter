// Source timestamps are not implicitly UTC or browser-local. Only explicit
// offsets, or the user's per-tournament interpretation, establish an instant.
function createScheduleChoice() {
  let tournamentId = '', choice = '';
  return {
    enter(id) { if (id !== tournamentId) { tournamentId = id; choice = ''; } },
    choose(value, options) { choice = options.includes(value) ? value : ''; },
    get() { return choice; },
  };
}
const scheduleChoice = createScheduleChoice();
function scheduleTimezone(zone) {
  if (!zone || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(zone)) return '';
  try {
    const canonical = new Intl.DateTimeFormat('en-US', {timeZone: zone}).resolvedOptions().timeZone;
    return canonical === 'UTC' ? 'UTC' : zone;
  }
  catch { return ''; }
}
function parseScheduleTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(String(value ?? ''));
  if (!match) throw Error('Malformed timestamp: ' + (value || 'missing value'));
  const [year, month, day, hour, minute, second] = match.slice(1, 7).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const date = new Date(wall);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59)
    throw Error('Invalid calendar timestamp: ' + value);
  const offset = match[7];
  let instant = null;
  if (offset) {
    const hours = offset === 'Z' ? 0 : Number(offset.slice(1, 3));
    const minutes = offset === 'Z' ? 0 : Number(offset.slice(4, 6));
    if (hours > 23 || minutes > 59) throw Error('Invalid timestamp offset: ' + value);
    instant = wall - (offset[0] === '-' ? -1 : 1) * (hours * 60 + minutes) * 60000;
  }
  return {wall, instant, raw: String(value).replace('T', ' ')};
}
function resolveScheduleTime(parsed, zone) {
  if (parsed.instant !== null) return parsed.instant;
  if (!zone) return null;
  if (zone === 'UTC') return parsed.wall;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  const localEpoch = instant => {
    const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(x => [x.type, x.value]));
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  };
  // Collect offsets on both sides of a possible transition, then round-trip
  // candidates. Zero matches is a gap; two matches is a fold. Never pick one.
  const offsets = new Set();
  for (let hours = -48; hours <= 48; hours += 6) {
    const sample = parsed.wall + hours * 3600000;
    offsets.add(localEpoch(sample) - sample);
  }
  const matches = [...offsets].map(offset => parsed.wall - offset).filter(instant => localEpoch(instant) === parsed.wall);
  if (matches.length !== 1) throw Error((matches.length ? 'Ambiguous' : 'Nonexistent') + ' local time ' + parsed.raw + ' in ' + zone + ' (timezone clock transition). Ask the organizer to confirm an explicit offset.');
  return matches[0];
}
function scheduleTimeLabel(parsed, instant, zone) {
  if (instant === null) return parsed.raw + ' (Timezone not specified in source)';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: zone, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(new Date(instant));
}
function analyzeSchedule(data, interpretation) {
  const slots = Array.isArray(data.timeslots) ? data.timeslots : [];
  const zone = scheduleTimezone(data.timezone);
  const options = zone ? [...new Set(['UTC', zone])] : ['UTC'];
  const result = {status: 'ready', message: '', rows: [], needsChoice: false, options};
  if (!slots.length) return {...result, status: 'empty', message: 'No structured schedule has been published. Check the invitation.'};
  const errors = [];
  for (const [index, slot] of slots.entries()) {
    const row = {name: slot.name || 'Round ' + (index + 1), startLabel: String(slot.start || 'Missing start'), endLabel: String(slot.end || 'Missing end')};
    result.rows.push(row);
    try {
      const start = parseScheduleTime(slot.start), end = parseScheduleTime(slot.end);
      result.needsChoice ||= start.instant === null || end.instant === null;
      const choice = options.includes(interpretation) ? interpretation : '';
      row.start = resolveScheduleTime(start, choice);
      row.end = resolveScheduleTime(end, choice);
      const displayZone = zone || (start.instant !== null && end.instant !== null ? 'UTC' : '');
      row.startLabel = displayZone ? scheduleTimeLabel(start, row.start, displayZone) : start.raw;
      row.endLabel = displayZone ? scheduleTimeLabel(end, row.end, displayZone) : end.raw;
      if (row.start !== null && row.end !== null && row.end <= row.start)
        throw Error('Invalid range: end must be after start.');
      // An unresolved entirely wall-time range can still be demonstrably invalid.
      if (row.start === null && row.end === null && end.wall <= start.wall)
        throw Error('Invalid range: end must be after start.');
    } catch (error) { errors.push(row.name + ': ' + error.message); }
  }
  if (!zone && result.needsChoice) errors.unshift('Invalid or missing tournament timezone. Ask the organizer to confirm it before calendar export.');
  if (errors.length) return {...result, status: 'invalid', message: errors.join(' ')};
  if (result.needsChoice && !options.includes(interpretation)) return {...result, status: 'choice', message: 'Timezone not specified in source. Choose how to interpret source times. This affects both displayed conversion and calendar export. Check the invitation or ask the organizer before choosing.'};
  if (!zone) return {...result, message: 'Tournament timezone ' + (data.timezone ? 'is invalid' : 'not published') + '. Source times include explicit offsets and are displayed in UTC. Calendar export uses these known instants, not an inferred tournament timezone.'};
  result.message = (result.needsChoice ? 'Source times interpreted as ' + interpretation + '. ' : 'Source times include explicit offsets. ') + 'Displayed in ' + data.timezone + '; calendar export uses the same instants.';
  return result;
}
function scheduleICS(data, result, now = new Date()) {
  if (result.status !== 'ready') throw Error(result.message || 'Choose a source-time interpretation before exporting.');
  const stamp = instant => new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const safe = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  // RFC 5545 physical lines are at most 75 UTF-8 octets, including continuation.
  const fold = line => {
    let output = '', length = 0;
    for (const character of line) {
      const point = character.codePointAt(0), bytes = point < 128 ? 1 : point < 2048 ? 2 : point < 65536 ? 3 : 4;
      if (length + bytes > 75) { output += '\r\n '; length = 1; }
      output += character; length += bytes;
    }
    return output;
  };
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TabBetter//Schedule//EN',
    ...result.rows.flatMap((row, index) => [
      'BEGIN:VEVENT', 'UID:' + data.id + '-' + index + '@tabbetter',
      'DTSTAMP:' + stamp(now), 'DTSTART:' + stamp(row.start), 'DTEND:' + stamp(row.end),
      'SUMMARY:' + safe(data.name + ' — ' + row.name),
      'URL:https://www.tabroom.com/index/tourn/main.mhtml?tourn_id=' + encodeURIComponent(data.id),
      'END:VEVENT',
    ]), 'END:VCALENDAR', '',
  ].map(fold).join('\r\n');
}
function renderSchedule(target, data) {
  const draw = () => {
    const result = analyzeSchedule(data, scheduleChoice.get());
    target.innerHTML = '<div class="switch-row"><h2>Published schedule</h2><button class="btn" id="ics"' +
      (['empty', 'invalid'].includes(result.status) ? ' disabled' : '') + '>↓ Calendar</button></div>' +
      '<p class="sub">Tournament timezone: ' + esc(data.timezone || 'Not published') +
      '. <a id="schedule-invitation" href="#tournament/' + attr(data.id) + '/overview">Check the invitation</a> for event-specific start times.</p>' +
      (result.needsChoice ? '<label for="schedule-interpretation">Interpret source times as</label><select id="schedule-interpretation" aria-describedby="schedule-feedback"><option value="">Choose an interpretation</option>' +
        result.options.map(zone => '<option value="' + attr(zone) + '"' + (scheduleChoice.get() === zone ? ' selected' : '') + '>' + esc(zone) + '</option>').join('') + '</select>' : '') +
      '<p id="schedule-feedback" class="sub" role="status">' + esc(result.message) + '</p>' +
      (result.rows.length ? '<div class="card schedule">' + result.rows.map(row => '<div class="schedule-row"><span class="dot"></span><div><strong>' + esc(row.name) + '</strong><small>' + esc(row.startLabel) + ' – ' + esc(row.endLabel) + '</small></div></div>').join('') + '</div>' : '');
    const select = target.querySelector('#schedule-interpretation');
    if (select) select.onchange = () => { scheduleChoice.choose(select.value, result.options); draw(); target.querySelector('#schedule-interpretation')?.focus(); };
    target.querySelector('#ics').onclick = () => {
      if (result.status !== 'ready') { select?.focus(); return; }
      download(scheduleICS(data, result), 'tabbetter-' + data.id + '.ics', 'text/calendar');
    };
  };
  draw();
}
