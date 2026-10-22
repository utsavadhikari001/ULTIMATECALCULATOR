import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('loads the application shell and initial calculator state', async ({ page }) => {
  await expect(page).toHaveTitle(/Ultimate Calculator/);
  await expect(page.locator('#calculator-view')).toBeVisible();
  await expect(page.locator('#result-display')).toHaveText('0');
  await expect(page.locator('#mode-nav')).toBeVisible();
});

test('evaluates arithmetic using operator precedence', async ({ page }) => {
  for (const key of ['2', '+', '3', '×', '4']) {
    await page.locator(`#calculator-view .key[data-key="${key}"]`).click();
  }

  await page.locator('#calculator-view [data-action="equals"]').click();
  await expect(page.locator('#result-display')).toHaveText('14');
});

test('switches between light and dark themes', async ({ page }) => {
  const root = page.locator('html');

  await page.locator('#theme-trigger').click();
  await page.locator('[data-theme-choice="light"]').click();
  await expect(root).toHaveAttribute('data-theme', 'light');
  await expect.poll(() => root.evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#087F73');

  await page.locator('#theme-trigger').click();
  await page.locator('[data-theme-choice="dark"]').click();
  await expect(root).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => root.evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#35C5B0');
});

test('converts length units', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="converter"]').click();
  await expect(page.locator('#converter-view')).toBeVisible();

  await page.locator('#convert-input').fill('1000');
  await expect(page.locator('#convert-output')).toHaveText('1');
});

test('calculates statistics for a supplied data set', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="tools"]').click();
  await page.locator('#tool-nav [data-tool="statistics"]').click();
  await page.locator('#statistics-input').fill('1, 2, 3');

  await expect(page.locator('#stat-count')).toHaveText('3');
  await expect(page.locator('#stat-sum')).toHaveText('6');
  await expect(page.locator('#stat-mean')).toHaveText('2');
});

test('opens graphing mode and exposes its equation editor', async ({ page }) => {
  await page.locator('#mode-nav [data-mode="graph"]').click();

  await expect(page.locator('#graph-view')).toBeVisible();
  await expect(page.locator('#graph-equation-0')).toBeVisible();
  await expect(page.locator('#graph-canvas')).toBeVisible();
});

test('system theme follows the browser color preference', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.locator('#theme-trigger').click();
  await page.locator('[data-theme-choice="system"]').click();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
  await expect.poll(() => page.locator('html').evaluate(el => getComputedStyle(el).getPropertyValue('--accent').trim())).toBe('#087F73');
});
