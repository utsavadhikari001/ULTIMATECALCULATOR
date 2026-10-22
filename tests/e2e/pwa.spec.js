import { expect, test } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test('caches the native engine module and reloads offline after installation', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

  const cachedAssets = await page.evaluate(async () => {
    const cache = await caches.open('ultimate-calculator-v8');
    return (await cache.keys()).map(request => new URL(request.url).pathname);
  });
  expect(cachedAssets.some(path => path.endsWith('/src/core/calculator-engine.js'))).toBe(true);
  expect(cachedAssets.some(path => path.endsWith('/src/features/statistics.js'))).toBe(true);
  expect(cachedAssets.some(path => path.endsWith('/src/features/finance.js'))).toBe(true);

  const pageErrors = [];
  const failedRequests = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#result-display')).toHaveText('0');
  const offlineState = await page.evaluate(() => ({
    calculate: typeof window.calculate,
    scriptUrls: [...document.scripts].map(script => script.src),
    heading: document.querySelector('h1')?.textContent
  }));
  expect(offlineState.calculate, JSON.stringify({ offlineState, pageErrors, failedRequests })).toBe('function');
  expect(await page.evaluate(() => window.calculate('6*7'))).toBe(42);
  await context.setOffline(false);
});
