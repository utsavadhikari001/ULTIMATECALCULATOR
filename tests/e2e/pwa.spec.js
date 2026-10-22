import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('caches the native engine module and reloads offline after installation', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cachedAssets = await page.evaluate(async () => {
    const cache = await caches.open('ultimate-calculator-v5');
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  expect(cachedAssets.some(path => path.endsWith('/src/core/calculator-engine.js'))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#result-display')).toHaveText('0');
  await expect.poll(() => page.evaluate(() => typeof window.calculate)).toBe('function');
  expect(await page.evaluate(() => window.calculate('6*7'))).toBe(42);
  await context.setOffline(false);
});
