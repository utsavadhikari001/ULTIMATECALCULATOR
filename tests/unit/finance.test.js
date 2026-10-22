import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateFinance } from '../../src/features/finance.js';

test('calculates simple interest, compound growth and monthly payment', () => {
  const result = calculateFinance({ principal: 10000, annualRate: 5, years: 5, frequency: 12 });
  assert.equal(result.valid, true);
  assert.equal(result.simpleTotal, 12500);
  assert.ok(Math.abs(result.compoundTotal - 12833.587) < 0.01);
  assert.ok(Math.abs(result.interest - (result.compoundTotal - 10000)) < 1e-9);
  assert.ok(Math.abs(result.payment - 188.71) < 0.02);
});

test('handles zero interest and zero principal', () => {
  const zeroRate = calculateFinance({ principal: 10000, annualRate: 0, years: 5, frequency: 12 });
  assert.equal(zeroRate.compoundTotal, 10000);
  assert.equal(zeroRate.payment, 10000 / 60);

  const zeroPrincipal = calculateFinance({ principal: 0, annualRate: 5, years: 5, frequency: 12 });
  assert.equal(zeroPrincipal.compoundTotal, 0);
  assert.equal(zeroPrincipal.payment, 0);
});

test('returns invalid status for negative or non-finite inputs', () => {
  assert.equal(calculateFinance({ principal: -1, annualRate: 5, years: 5, frequency: 12 }).valid, false);
  assert.equal(calculateFinance({ principal: 100, annualRate: Infinity, years: 5, frequency: 12 }).valid, false);
});

test('does not invent a monthly payment for a zero-term loan', () => {
  const result = calculateFinance({ principal: 1000, annualRate: 5, years: 0, frequency: 12 });
  assert.equal(result.simpleTotal, 1000);
  assert.equal(result.compoundTotal, 1000);
  assert.ok(Number.isNaN(result.payment));
});
