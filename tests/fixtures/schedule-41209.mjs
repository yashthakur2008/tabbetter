// Minimal exact public timeslot shape observed 2026-11-17. No roster data.
export const source4slots = [
  {name:'Round 1',start:'2026-10-24T15:30:00',end:'2026-10-24T17:15:00'},
  {name:'Round 2',start:'2026-10-24T17:45:00',end:'2026-10-24T19:45:00'},
  {name:'Round 3',start:'2026-10-24T20:15:00',end:'2026-10-24T22:00:00'},
  {name:'Round 4',start:'2026-10-24T22:30:00',end:'2026-10-25T00:30:00'},
];
// Expected UTC instants for each explicit user interpretation of these dates.
export const interpretedInstants = {
  UTC: {
    starts:['20261024T153000Z','20261024T174500Z','20261024T201500Z','20261024T223000Z'],
    ends:['20261024T171500Z','20261024T194500Z','20261024T220000Z','20261025T003000Z'],
  },
  'America/Los_Angeles': {
    starts:['20261024T223000Z','20261025T004500Z','20261025T031500Z','20261025T053000Z'],
    ends:['20261025T001500Z','20261025T024500Z','20261025T050000Z','20261025T073000Z'],
  },
};
