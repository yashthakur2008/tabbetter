import test from 'node:test';
import assert from 'node:assert/strict';
import { competitorKey, linkRoster, resolvePerson, parseLocation } from '../src/rankings/identity.mjs';

const roster = (entries) => linkRoster(entries);

test('competitor keys keep seasons and events distinct', () => {
  const a = competitorKey({ season: '2025-2026', event: 'LD', code: 'Harker AB' });
  assert.notEqual(a, competitorKey({ season: '2024-2025', event: 'LD', code: 'Harker AB' }));
  assert.notEqual(a, competitorKey({ season: '2025-2026', event: 'PF', code: 'Harker AB' }));
  assert.equal(a, competitorKey({ season: '2025-2026', event: 'LD', code: 'Harker AB' }));
});

test('state is read only from an explicit US location', () => {
  assert.deepEqual(parseLocation('CA/US'), { state: 'CA', country: 'US' });
  assert.deepEqual(parseLocation('TW'), { state: null, country: 'TW' });
  // Observed in real 2025-2026 Berkeley data: a bare state with no country.
  assert.deepEqual(parseLocation('CA'), { state: null, country: null });
  assert.deepEqual(parseLocation(''), { state: null, country: null });
});

test('a single-name entry resolves to a person with its institution', () => {
  const map = roster([{ institution: 'Archbishop Mitty', location: 'CA/US', entry: 'Ayush Gupta', code: 'Archbishop Mitty AG', record: '' }]);
  const person = resolvePerson('Archbishop Mitty AG', map);
  assert.equal(person.status, 'resolved');
  assert.equal(person.name, 'Ayush Gupta');
  assert.equal(person.institution, 'Archbishop Mitty');
  assert.equal(person.state, 'CA');
});

test('a two-person team entry is never split into individual competitors', () => {
  const map = roster([{ institution: 'College Prep', location: 'CA/US', entry: 'Falk & Sabnani', code: 'College Prep FS', record: '' }]);
  const person = resolvePerson('College Prep FS', map);
  assert.equal(person.status, 'ambiguous');
  assert.equal(person.name, null, 'a team is not one named person');
  assert.equal(person.institution, 'College Prep');
});

test('conflicting names for the same code stay ambiguous rather than picking one', () => {
  const map = roster([
    { institution: 'Harker', location: 'CA/US', entry: 'First Debater', code: 'Harker AB', record: '' },
    { institution: 'Harker', location: 'CA/US', entry: 'Second Debater', code: 'Harker AB', record: '' },
  ]);
  assert.equal(resolvePerson('Harker AB', map).status, 'ambiguous');
});

test('identical names at different institutions are never merged', () => {
  const map = roster([
    { institution: 'Lexington', location: 'MA/US', entry: 'Alex Kim', code: 'Lexington AK', record: '' },
    { institution: 'Peninsula', location: 'CA/US', entry: 'Alex Kim', code: 'Peninsula AK', record: '' },
  ]);
  const one = resolvePerson('Lexington AK', map);
  const two = resolvePerson('Peninsula AK', map);
  assert.equal(one.status, 'resolved');
  assert.equal(two.status, 'resolved');
  assert.notEqual(one.institution, two.institution);
  assert.notEqual(
    competitorKey({ season: '2025-2026', event: 'LD', code: 'Lexington AK' }),
    competitorKey({ season: '2025-2026', event: 'LD', code: 'Peninsula AK' }),
  );
});

test('an unknown code invents neither a name nor a school', () => {
  const person = resolvePerson('Mystery ZZ', roster([]));
  assert.equal(person.status, 'unknown');
  assert.equal(person.name, null);
  assert.equal(person.institution, null);
  assert.equal(person.state, null);
});

test('codes match the source exactly, including repeated internal spaces', () => {
  const map = roster([{ institution: 'Strake Jesuit', location: 'TX/US', entry: 'Zion Dixon', code: 'Strake Jesuit  ZD', record: '' }]);
  assert.equal(resolvePerson('Strake Jesuit  ZD', map).status, 'resolved');
  assert.equal(resolvePerson('Strake Jesuit ZD', map).status, 'unknown', 'a near-miss code must not silently match');
});
