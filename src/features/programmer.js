import { CalculatorError } from '../core/calculator-engine.js';

export function parseBaseInteger(raw, base) {
  const text = String(raw).trim().replace(/_/g, '');
  if (!text) throw new CalculatorError('Enter an integer');
  const sign = text.startsWith('-') ? -1n : 1n;
  const unsignedText = text.replace(/^[+-]/, '');
  if (!unsignedText) throw new CalculatorError('Invalid integer for this base');
  const prefix = base === 16 ? /^0x/i : base === 8 ? /^0o/i : base === 2 ? /^0b/i : null;
  const digits = prefix ? unsignedText.replace(prefix, '') : unsignedText;
  const patterns = { 2: /^[01]+$/, 8: /^[0-7]+$/, 10: /^\d+$/, 16: /^[0-9a-f]+$/i };
  if (!patterns[base]?.test(digits)) throw new CalculatorError('Invalid integer for this base');
  try {
    if (base === 10) return sign * BigInt(digits);
    if (base === 16) return sign * BigInt(`0x${digits}`);
    if (base === 8) return sign * BigInt(`0o${digits}`);
    if (base === 2) return sign * BigInt(`0b${digits}`);
  } catch {
    throw new CalculatorError('Invalid integer for this base');
  }
  throw new CalculatorError('Invalid integer for this base');
}

export function baseString(value, base) {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const result = magnitude.toString(base).toUpperCase();
  return negative ? `-${result}` : result;
}

export function displayInt32(value, base) {
  const signed = BigInt(value);
  if (base === 10) return signed.toString(10);
  return BigInt.asUintN(32, signed).toString(base).toUpperCase();
}

export function calculateBitwise(operation, a, b, base = 10) {
  if (typeof a !== 'bigint' || (operation !== 'not' && typeof b !== 'bigint')) {
    throw new CalculatorError('Enter valid integers for the selected base.');
  }
  const a32 = Number(BigInt.asIntN(32, a));
  const b32 = b === null ? 0 : Number(BigInt.asIntN(32, b));
  let result;
  switch (operation) {
    case 'and': result = a32 & b32; break;
    case 'or': result = a32 | b32; break;
    case 'xor': result = a32 ^ b32; break;
    case 'not': result = ~a32; break;
    case 'nand': result = ~(a32 & b32); break;
    case 'nor': result = ~(a32 | b32); break;
    case 'shl': result = a32 << (b32 & 31); break;
    case 'shr': result = a32 >> (b32 & 31); break;
    default: throw new CalculatorError('Unknown bitwise operation');
  }
  return {
    value: result,
    result: displayInt32(result, base),
    bin: displayInt32(result, 2),
    oct: displayInt32(result, 8),
    dec: displayInt32(result, 10),
    hex: displayInt32(result, 16)
  };
}
