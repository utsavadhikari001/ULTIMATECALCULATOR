import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('basic arithmetic expression regression', async ({ page }) => {
  const value = await page.evaluate(() => calculate('2 + 3 * 4'));
  expect(value).toBe(14);
});
