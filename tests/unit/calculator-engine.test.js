import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, CalculatorError, formatNumber } from '../../src/core/calculator-engine.js';

const evaluate = (expression, settings = {}) => calculate(expression, {}, settings);

test('respects arithmetic precedence and right-associative exponentiation', () => {
  assert.equal(evaluate('2 + 3 * 4'), 14);
  assert.equal(evaluate('2^3^2'), 512);
});

test('preserves unary minus and exponent precedence', () => {
  assert.equal(evaluate('-2^2'), -4);
  assert.equal(evaluate('(-2)^2'), 4);
});

test('supports implicit multiplication, constants, and previous answer', () => {
  assert.equal(evaluate('2(3+4)'), 14);
  assert.ok(Math.abs(evaluate('2pi') - 2 * Math.PI) < 1e-12);
  assert.equal(evaluate('ans+2', { answer: 40 }), 42);
});

test('handles percentages, factorials, and modulo', () => {
  assert.equal(evaluate('200 + 10%'), 220);
  assert.equal(evaluate('50%'), 0.5);
  assert.equal(evaluate('5!'), 120);
  assert.equal(evaluate('0!'), 1);
  assert.equal(evaluate('10 mod 3'), 1);
});

test('uses explicit degree/radian settings and degree markers', () => {
  assert.ok(Math.abs(evaluate('sin(30)', { angleMode: 'DEG' }) - 0.5) < 1e-12);
  assert.ok(Math.abs(evaluate('sin(pi/2)', { angleMode: 'RAD' }) - 1) < 1e-12);
  assert.ok(Math.abs(evaluate('sin(90°)') - 1) < 1e-12);
});

test('rejects division by zero and invalid mathematical domains', () => {
  assert.throws(() => evaluate('1/0'), error => error instanceof CalculatorError && error.message === 'Cannot divide by zero');
  assert.throws(() => evaluate('sqrt(-1)'), error => error instanceof CalculatorError && error.message === 'Invalid square root');
  assert.throws(() => evaluate('ln(0)'), error => error instanceof CalculatorError && error.message === 'Invalid logarithm');
  assert.throws(() => evaluate('(-1)!'), error => error instanceof CalculatorError && error.message.includes('Factorial requires'));
});

test('rejects incomplete and unknown expressions', () => {
  assert.throws(() => evaluate('2+'), CalculatorError);
  assert.throws(() => evaluate('unknown(2)'), CalculatorError);
  assert.throws(() => evaluate('1 @ 2'), CalculatorError);
});

test('rejects non-finite calculation results and formats finite values', () => {
  assert.throws(() => evaluate('10^1000'), error => error instanceof CalculatorError && error.message === 'Result is too large');
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber(Infinity), '—');
});
