'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { screen } = require('../web/pool-screen');
const current = new Date('2026-11-07T12:00:00Z');
const find = (rows, name) => rows.find(x => x.item === name);
// Realistic builder question: can a gentle, sewered lot with shallow seasonal water support a pool?
const rows = screen({jurisdiction: 'Ogden Valley City', water_table_in: 12, slope: 1.3,
  relief: 10, sfha: false, sewer: 'Example Sewer District', culinary: 'Example Water Supplier'}, current);
assert.match(find(rows, 'Pool location and setbacks').headline, /10 ft/);
assert.equal(find(rows, 'Pool excavation and groundwater').status, 'watch');
assert.equal(find(rows, 'Pool feasibility').status, 'verify');
assert.match(find(rows, 'Pool grading and ground conditions').headline, /1.3%.*10 ft/);
assert.match(find(rows, 'Pool utilities, drainage and access').detail, /Example Sewer District/);
assert.doesNotMatch(find(rows, 'Pool utilities, drainage and access').detail, /if septic/);
assert.ok(rows.every(x => x.status !== 'ok' && x.cost === null));
// Missing layers must not be interpreted as safe or pool-capable.
const missing = screen({}, current);
assert.match(find(missing, 'Pool flood and geologic constraints').detail, /unavailable or incomplete/);
assert.match(find(missing, 'Pool excavation and groundwater').detail, /No usable groundwater/);
assert.equal(find(missing, 'Pool location and setbacks'), undefined);
assert.match(find(missing, 'Pool utilities, drainage and access').detail, /reserve area/);
// Shallow boring evidence still flags risk even if regional soil estimates are deep.
assert.equal(find(screen({water_table_in: 120, boreholes: {gwMin: 2, nearestKm: 0.2}}, current),
  'Pool excavation and groundwater').status, 'watch');
assert.equal(find(screen({slope: 15, sfha: true}, current), 'Pool grading and ground conditions').status, 'watch');
assert.equal(find(screen({sfha: true}, current), 'Pool flood and geologic constraints').status, 'watch');
assert.match(find(screen({}, new Date('2027-01-01')), 'State pool code').headline, /new verification/);
const html = fs.readFileSync('public/platform.html', 'utf8');
assert.ok(html.indexOf('root.PoolScreen =') < html.indexOf('root.LotReport ='));
assert.match(html, /\['check_pool', 'Pool feasibility'\]/);
assert.match(html, /\['pool', 'Pool feasibility'\]/);
console.log('Pool screen: realistic lot, missing evidence, jurisdiction isolation, hazard flags, code expiry and build integration passed.');
