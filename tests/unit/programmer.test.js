import assert from 'node:assert/strict';
import test from 'node:test';
import { CalculatorError } from '../../src/core/calculator-engine.js';
import { baseString, calculateBitwise, displayInt32, parseBaseInteger } from '../../src/features/programmer.js';

test('parses and formats signed integers across supported bases', () => {
  assert.equal(parseBaseInteger('25', 10), 25n);
  assert.equal(parseBaseInteger('0x19', 16), 25n);
  assert.equal(parseBaseInteger('31', 8), 25n);
  assert.equal(parseBaseInteger('11001', 2), 25n);
  assert.equal(baseString(-25n, 16), '-19');
  assert.throws(() => parseBaseInteger('102', 2), CalculatorError);
});

test('calculates bitwise operations using signed 32-bit rules', () => {
  assert.equal(calculateBitwise('and', 25n, 3n).value, 1);
  assert.equal(calculateBitwise('or', 8n, 3n).value, 11);
  assert.equal(calculateBitwise('xor', 8n, 3n).value, 11);
  assert.equal(calculateBitwise('not', 0n, null).value, -1);
  assert.equal(calculateBitwise('shl', 1n, 3n).value, 8);
  assert.equal(calculateBitwise('shr', -8n, 1n).value, -4);
});

test('formats negative signed 32-bit values consistently', () => {
  assert.equal(displayInt32(-1, 10), '-1');
  assert.equal(displayInt32(-1, 16), 'FFFFFFFF');
  assert.equal(calculateBitwise('and', 25n, 3n, 16).hex, '1');
});

test('rejects unsupported bitwise operations', () => {
  assert.throws(() => calculateBitwise('rotate', 1n, 2n), /Unknown bitwise operation/);
});
