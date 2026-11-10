import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNationalsEvent, parsePlacement, buildSchoolLexicon, NATIONALS } from '../src/rankings/nationals.mjs';

// Schools repeat across entries; the lexicon is learned the same way in production.
const lex = (...schools) => new Set(schools);

test('placements parse ordinals and leave unplaced rows null', () => {
  assert.equal(parsePlacement('13th'), 13);
  assert.equal(parsePlacement('1st'), 1);
  assert.equal(parsePlacement('2nd'), 2);
  assert.equal(parsePlacement('3rd'), 3);
  assert.equal(parsePlacement('21st'), 21);
  assert.equal(parsePlacement(''), null);
  assert.equal(parsePlacement('Rnd'), null);
  assert.equal(parsePlacement(undefined), null);
});

test('a speech placement row yields code, name, school, state and place', () => {
  const rows = parseNationalsEvent(
    'Dramatic Interp',
    [
      'Code Name School State R7 R8 R9 R10 R11 R12 Elims Semis Place',
      '2092 Yutong Jiang Lakeville North High School MN 1 2 1 3 1 2 3 4 6 1 5 4 91 58 14th',
      '2099 Jett Campbell Choctaw High School OK 5 1 1 1 2 1 6 4 1 1 5 1 85 56 13th',
    ].join('\n'),
    lex('Lakeville North High School', 'Choctaw High School'),
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    event: 'Dramatic Interp',
    code: '2092',
    names: ['Yutong Jiang'],
    school: 'Lakeville North High School',
    state: 'MN',
    place: 14,
  });
  assert.equal(rows[1].school, 'Choctaw High School');
  assert.equal(rows[1].state, 'OK');
});

test('a debate row with win-loss strings parses the same way', () => {
  const rows = parseNationalsEvent(
    'Lincoln-Douglas',
    [
      'Code Name School State R7 R8 R9 R10 R11 R12 R13 R14 R15 Rnd EB PB Place',
      '1604 Neil Heckman Oakwood High School OH LWW WWW WLL BYE WLL 11 10 8 13th',
      '1700 Omar Obeidat Lexington MA WWW LWW LWW LWW LWL LLL 12 10 9 11th',
    ].join('\n'),
    lex('Oakwood High School', 'Lexington'),
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].names, ['Neil Heckman']);
  assert.equal(rows[0].school, 'Oakwood High School');
  assert.equal(rows[0].place, 13);
  assert.equal(rows[1].school, 'Lexington', 'a school with no suffix still parses');
  assert.equal(rows[1].state, 'MA');
});

test('a two-person team entry keeps both names and is never split', () => {
  const rows = parseNationalsEvent(
    'Public Forum',
    [
      'Code Name School State R7 R8 Rnd EB PB Place',
      '1114 Arnav Agarwal',
      'Ronav Ganesh',
      'Lincoln East High School NE WLW WWW LLL BYE LLW 11 9 9 14th',
    ].join('\n'),
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].names, ['Arnav Agarwal', 'Ronav Ganesh']);
  assert.equal(rows[0].school, 'Lincoln East High School');
  assert.equal(rows[0].place, 14);
});

test('header, prose and unplaced rows are skipped rather than guessed', () => {
  const rows = parseNationalsEvent(
    'Dramatic Interp',
    [
      'Dramatic Interp',
      'Lanny D. and B. J. Naegelin Dramatic Interpretation presented by Simpson College',
      'Code Name School State R7 Place',
      '2019 Bianca Rios Harlingen HS South TX 1 2 1 2 70 48',
      '2092 Yutong Jiang Lakeville North High School MN 1 2 91 58 14th',
    ].join('\n'),
    lex('Lakeville North High School', 'Harlingen HS South'),
  );
  assert.equal(rows.length, 1, 'a row with no published place is not invented a rank');
  assert.equal(rows[0].code, '2092');
});

test('the covered nationals events are declared and include speech and debate', () => {
  assert.ok(NATIONALS.events.includes('Lincoln-Douglas'));
  assert.ok(NATIONALS.events.includes('Public Forum'));
  assert.ok(NATIONALS.events.includes('Dramatic Interp'));
  assert.ok(NATIONALS.events.includes('Congressional Debate') || NATIONALS.events.length >= 15);
  assert.match(NATIONALS.sourceUrl, /tabroom-files|speechanddebate/);
  assert.equal(NATIONALS.season, '2025-2026');
});

test('the school lexicon learns repeated schools and rejects name noise', () => {
  const lexicon = buildSchoolLexicon({
    A: [
      '2092 Yutong Jiang Lakeville North High School MN 1 2 14th',
      '2108 Ethan Phan Lakeville North High School NE 3 1 9th',
      '2110 Maya Cruz Lakeville North High School MN 2 2 8th',
      '2111 Ada Lin Lakeville North High School MN 2 2 7th',
    ].join('\n'),
  });
  assert.ok(lexicon.has('Lakeville North High School'), 'a school seen under several names is learned');
  assert.equal(lexicon.has('Jiang Lakeville North High School'), false, "a competitor's surname is not part of the school");
  assert.equal(lexicon.has('School'), false, 'a bare fragment is not a school');
});

test('a three-word personal name is not split into the school', () => {
  const rows = parseNationalsEvent(
    'Dramatic Interp',
    '2040 Evan Arthur White St Andrews Episcopal School MS 1 6 3 2 76 41 11th',
    new Set(['St Andrews Episcopal School']),
  );
  assert.deepEqual(rows[0].names, ['Evan Arthur White']);
  assert.equal(rows[0].school, 'St Andrews Episcopal School');
});

test('a repeated page header never becomes a competitor', () => {
  const rows = parseNationalsEvent(
    'Duo Interp',
    [
      '2578 Jocelyn Coto',
      'Finalists Spoke Code Name School State Finals All Finals Elims Total Place',
      '2600 Avi Gupta',
      'Kostantina Bala',
      'Archbishop Mitty High School CA 1 2 3rd',
    ].join('\n'),
    new Set(['Archbishop Mitty High School']),
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].names, ['Avi Gupta', 'Kostantina Bala']);
  assert.equal(rows[0].place, 3);
  assert.doesNotMatch(JSON.stringify(rows), /Finalists|Code Name/);
});

test('a school name wrapped across two lines is rejoined, not split into the name', () => {
  const rows = parseNationalsEvent(
    'Informative Speaking',
    ['4000 Kate Hong Etiwanda High', 'School CA 1 2 3 8th'].join('\n'),
    new Set(['Etiwanda High School']),
  );
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].names, ['Kate Hong']);
  assert.equal(rows[0].school, 'Etiwanda High School');
  assert.equal(rows[0].place, 8);
});

test('supplemental events use letter-prefixed codes and still parse', () => {
  const rows = parseNationalsEvent(
    'Impromptu',
    'S5555 Abir Dass The Village High School TX 1 5 1 2 58 6.94 27 14th',
    new Set(['The Village High School']),
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].code, 'S5555');
  assert.deepEqual(rows[0].names, ['Abir Dass']);
  assert.equal(rows[0].place, 14);
});

test('a row whose school cannot be identified is discarded, not published with a guess', () => {
  const rows = parseNationalsEvent(
    'Informative Speaking',
    '4000 Someone From An Unknown Long School Name XX 1 2 3 8th',
    new Set(['A Different School']),
  );
  assert.deepEqual(rows, [], 'no school match means no published row');
});
