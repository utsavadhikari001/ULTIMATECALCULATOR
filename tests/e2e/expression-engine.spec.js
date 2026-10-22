import { expect, test } from '@playwright/test';

async function calculateInPage(page, expression) {
  return page.evaluate(source => calculate(source), expression);
}

async function expectError(page, expression, message) {
  const result = await page.evaluate(source => {
    try { calculate(source); return null; }
    catch (error) { return { name: error.name, message: error.message }; }
  }, expression);
  expect(result).toEqual({ name: 'CalculatorError', message });
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('operator precedence and right-associative powers', async ({ page }) => {
  expect(await calculateInPage(page, '2 + 3 * 4')).toBe(14);
  expect(await calculateInPage(page, '2^3^2')).toBe(512);
});

test('preserves unary-minus and exponent precedence', async ({ page }) => {
  expect(await calculateInPage(page, '-2^2')).toBe(-4);
  expect(await calculateInPage(page, '(-2)^2')).toBe(4);
});

test('supports implicit multiplication and parentheses', async ({ page }) => {
  expect(await calculateInPage(page, '2(3 + 4)')).toBe(14);
  expect(await calculateInPage(page, '2pi')).toBeCloseTo(2 * Math.PI, 12);
});

test('evaluates percentages and factorials', async ({ page }) => {
  expect(await calculateInPage(page, '200 + 10%')).toBe(220);
  expect(await calculateInPage(page, '50%')).toBe(0.5);
  expect(await calculateInPage(page, '5!')).toBe(120);
  expect(await calculateInPage(page, '0!')).toBe(1);
});

test('evaluates scientific functions in degree mode', async ({ page }) => {
  expect(await calculateInPage(page, 'sin(30)')).toBeCloseTo(0.5, 12);
  expect(await calculateInPage(page, 'sqrt(81)')).toBe(9);
  expect(await calculateInPage(page, 'sin(90°)')).toBeCloseTo(1, 12);
});

test('evaluates trigonometric functions in radian mode', async ({ page }) => {
  const value = await page.evaluate(() => {
    const previousMode = state.angleMode;
    state.angleMode = 'RAD';
    try { return calculate('sin(pi/2)'); }
    finally { state.angleMode = previousMode; }
  });
  expect(value).toBeCloseTo(1, 12);
});

test('rejects division by zero and invalid square roots', async ({ page }) => {
  await expectError(page, '1/0', 'Cannot divide by zero');
  await expectError(page, 'sqrt(-1)', 'Invalid square root');
});

test('rejects invalid factorials and logarithm domains', async ({ page }) => {
  await expectError(page, '(-1)!', 'Factorial requires a whole number from 0 to 170');
  await expectError(page, 'ln(0)', 'Invalid logarithm');
});

test('rejects incomplete and unknown expressions', async ({ page }) => {
  await expectError(page, '2+', 'Incomplete expression');
  await expectError(page, 'unknown(2)', 'Invalid expression');
});
