import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateStatistics, parseStatisticsInput } from '../../src/features/statistics.js';

test('parses comma, whitespace and newline separated values', () => {
  assert.deepEqual(parseStatisticsInput('1, 2\n3;4'), [1, 2, 3, 4]);
  assert.deepEqual(parseStatisticsInput('  '), []);
});

test('rejects non-finite data', () => {
  assert.throws(() => parseStatisticsInput('1, nope, 3'), /Use finite numbers/);
  assert.throws(() => calculateStatistics([1, Infinity]), /finite number/);
});

test('calculates descriptive statistics for population data', () => {
  const result = calculateStatistics([1, 2, 3], 'population');
  assert.equal(result.count, 3);
  assert.equal(result.sum, 6);
  assert.equal(result.mean, 2);
  assert.equal(result.median, 2);
  assert.equal(result.range, 2);
  assert.equal(result.variance, 2 / 3);
  assert.ok(Math.abs(result.deviation - Math.sqrt(2 / 3)) < 1e-12);
  assert.deepEqual(result.modes, []);
});

test('calculates sample variance and multiple modes', () => {
  const result = calculateStatistics([1, 1, 2, 2, 3], 'sample');
  assert.equal(result.variance, 0.7);
  assert.deepEqual(result.modes, [1, 2]);
});

test('returns no sample variance for a single observation', () => {
  const result = calculateStatistics([9], 'sample');
  assert.equal(result.mean, 9);
  assert.ok(Number.isNaN(result.variance));
});
