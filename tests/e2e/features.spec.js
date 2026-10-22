import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('percentage tools update from user input', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="tools"]').click();
  await page.locator('#pct-rate').fill('15');
  await page.locator('#pct-base').fill('200');
  await expect(page.locator('#pct-of-result')).toHaveText('30');

  await page.locator('#pct-adjust-base').fill('80');
  await page.locator('#pct-adjust-rate').fill('25');
  await page.locator('#pct-direction').selectOption('decrease');
  await expect(page.locator('#pct-adjust-result')).toHaveText('60');

  await page.locator('#pct-old').fill('0');
  await page.locator('#pct-new').fill('10');
  await expect(page.locator('#pct-change-result')).toHaveText('Undefined from zero');
});

test('programmer tool converts bases and performs bitwise operations', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="tools"]').click();
  await page.locator('#tool-nav [data-tool="programmer"]').click();
  await page.locator('#programmer-a').fill('25');
  await page.locator('#programmer-b').fill('3');
  await page.locator('[data-bitop="and"]').click();
  await expect(page.locator('#programmer-result')).toHaveText('1');
  await expect(page.locator('#prog-result-bin')).toHaveText('1');
  await expect(page.locator('#prog-result-hex')).toHaveText('1');

  await page.locator('#programmer-base').selectOption('16');
  await expect(page.locator('#prog-a-dec')).toHaveText('25');
});

test('equation solver returns the expected linear root', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="tools"]').click();
  await page.locator('#tool-nav [data-tool="equation"]').click();
  await page.locator('#equation-input').fill('2x + 5 = 17');
  await page.locator('#solve-equation').click();
  await expect(page.locator('#equation-result')).toContainText('x = 6');
});

test('finance outputs update and remain finite for valid inputs', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="tools"]').click();
  await page.locator('#tool-nav [data-tool="finance"]').click();
  await expect(page.locator('#finance-simple')).toHaveText('12,500.00');
  await expect(page.locator('#finance-compound')).not.toHaveText('—');
  await expect(page.locator('#finance-interest')).not.toHaveText('—');
  await expect(page.locator('#finance-payment')).not.toHaveText('—');

  await page.locator('#finance-principal').fill('0');
  await expect(page.locator('#finance-simple')).toHaveText('0.00');
});

test('converter swap preserves the converted quantity', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="converter"]').click();
  await page.locator('#convert-input').fill('1000');
  await expect(page.locator('#convert-output')).toHaveText('1');
  await page.locator('#swap-units').click();
  await expect(page.locator('#convert-input')).toHaveValue('1');
  await expect(page.locator('#convert-output')).toHaveText('1,000');
});

test('graph zoom and reset controls remain operable', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="graph"]').click();
  const zoom = page.locator('#graph-zoom-label');
  await expect(zoom).toHaveText('100%');
  await page.locator('#graph-zoom-in').click();
  await expect(zoom).not.toHaveText('100%');
  await page.locator('#graph-reset').click();
  await expect(zoom).toHaveText('100%');
});

test('application shell fits a narrow mobile viewport without page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(page.locator('#calculator-view')).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});

test('keyboard input can complete a basic calculation', async ({ page }) => {
  await page.keyboard.type('7+8');
  await page.keyboard.press('Enter');
  await expect(page.locator('#result-display')).toHaveText('15');
});
