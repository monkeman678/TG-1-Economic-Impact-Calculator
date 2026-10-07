const test = require('node:test');
const assert = require('node:assert/strict');
const {plan} = require('../dist/mission.js');
const losses = require('../dist/loss-data.json');

test('default mission uses rounded labor billing and state loss benchmark', () => {
  const m = plan({});
  assert.equal(m.n, 5);
  assert.equal(m.count, 10);
  assert.equal(m.manual.cost, 4640);
  assert.equal(m.uas.cost, 2640);
  assert.equal(m.expectedLoss, 2529.6);
  assert.equal(m.scenarios[2].economics.labor, 120);
  assert.equal(m.rate.tg1Crew, 3);
});

test('all routes share samples and scanning returns directly after final detection', () => {
  for (const area of [6.4, 40, 160, 640, 1000]) {
    for (const damage of [0, 1, 40, 100]) {
      for (const distribution of ['Clustered', 'Random', 'Scattered']) {
        const m = plan({area, damage, distribution, seed: 41});
        assert.equal(new Set(m.detected.map(c => c.id)).size, m.count);
        assert.equal(m.scanPath.at(-1).type, 'ground');
        if (m.count) assert.equal(m.scanPath.at(-2).id, m.detected.at(-1).id);
        for (const s of m.scenarios) {
          assert.equal(s.coordinates, m.detected);
          for (const c of m.detected) assert(s.path.some(p => p.id === c.id));
          assert.equal(s.economics.labor, Math.ceil(s.hours) * 120);
          assert(Math.abs(s.economics.saved - (m.expectedLoss - s.economics.cost)) < 1e-8);
        }
      }
    }
  }
});

test('state defaults, unknown states, zero estimates and custom rates remain distinct', () => {
  for (const [state, d] of Object.entries(losses.states)) assert.equal(plan({state}).expectedLoss, 160 * d.lossPerAcre);
  assert.equal(plan({state: 'Alaska'}).expectedLoss, null);
  assert.equal(plan({state: 'Alaska'}).scenarios[2].economics.saved, null);
  assert.equal(plan({state: 'North Dakota'}).expectedLoss, 0);
  assert.equal(plan({state: 'Alaska', lossPerAcre: 50}).expectedLoss, 8000);
});

test('editable costs preserve coordinates and fixed TG-1 crew/rate', () => {
  const m = plan({manualCrew: 8, manualWage: 10, manualCapacity: 2, manualChemical: 20, tg1Crew: 99, tg1TeamHourly: 999});
  assert.equal(m.manual.hours, 10);
  assert.equal(m.manual.cost, 4000);
  assert.equal(m.rate.tg1Crew, 3);
  assert.equal(m.rate.tg1TeamHourly, 120);
  assert.deepEqual(m.damageIds, plan({}).damageIds);
  for (const input of [{area: 0}, {manualCrew: 1.5}, {uasCapacity: 0}, {chemical: -1}]) assert.throws(() => plan(input));
});
