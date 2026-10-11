import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

for (const scenario of [
  { search: 'salary', format: 'camt', label: 'CAMT · Salary payments', closing: '1050.000 EUR', movements: 3 },
  { search: 'card purchases', format: 'coda', label: 'CODA · Card purchases', closing: '816.350 EUR', movements: 3 },
  { search: 'USD international', format: 'camt', label: 'CAMT · USD international transfer', closing: '8750.000 USD', movements: 1 },
  { search: 'GBP international', format: 'coda', label: 'CODA · GBP international receipt', closing: '2735.250 GBP', movements: 1 },
  { search: 'busy month', format: 'camt', label: 'CAMT · Busy month · 45 movements', closing: '850.000 EUR', movements: 45 },
  { search: 'version 13', format: 'camt', label: 'CAMT 052 · version 13', closing: '112.345 EUR', movements: 1 },
]) {
  test(`built-in sample: ${scenario.label}`, async ({ page }) => {
    await page.goto('/');
    const library = page.getByRole('region', { name: 'Sample library' });
    await library.getByRole('searchbox', { name: 'Search samples' }).fill(scenario.search);
    await library.getByLabel('Sample format', { exact: true }).selectOption(scenario.format);
    await library.getByRole('button', { name: `Load sample: ${scenario.label}`, exact: true }).click();
    await expect(page.getByRole('region', { name: 'Statement summary' })).toContainText(scenario.closing);
    const result = page.getByRole('region', { name: 'Converted file' });
    const notes = result.getByRole('checkbox', { name: /I reviewed/ });
    if (await notes.count()) await notes.check();
    const receive = page.waitForEvent('download');
    await result.getByRole('button', { name: /^Download (CODA|CAMT)/ }).click();
    const download = await receive;
    const text = readFileSync((await download.path())!, 'utf8');
    if (scenario.format === 'camt') {
      expect(download.suggestedFilename()).toMatch(/\.cod$/);
      expect(text.split('\n').filter(l => l.startsWith('21') && l.slice(6, 10) === '0000')).toHaveLength(scenario.movements);
      expect(text.split('\n').every(l => l.length === 128)).toBe(true);
    } else {
      expect(download.suggestedFilename()).toMatch(/\.xml$/);
      expect(text.match(/<Ntry>/g)).toHaveLength(scenario.movements);
    }
  });
}

test('converted download is visible without scrolling and clearly names its format', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sample: CAMT 053 statement', exact: true }).click();
  const result = page.getByRole('region', { name: 'Converted file' });
  const button = result.getByRole('button', { name: 'Download CODA (.cod)', exact: true });
  await expect(button).toBeEnabled();
  await expect(result.getByRole('heading', { name: 'Ready to download' })).toBeVisible();
  const box = (await button.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
  await expect(result).toContainText('.cod');
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
});

test('invalid sample choices are explicit and never offer a usable download', async ({ page }) => {
  await page.goto('/');
  const library = page.getByRole('region', { name: 'Sample library' });
  await library.getByRole('searchbox', { name: 'Search samples' }).fill('missing trailer');
  await expect(library.getByRole('button', { name: /Load sample:/ })).toHaveCount(0);
  await library.getByRole('checkbox', { name: 'Include invalid examples' }).check();
  await expect(library.getByText('Expected error', { exact: true })).toBeVisible();
  await library.getByRole('button', { name: 'Load sample: CODA · Missing trailer', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversion needs attention' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CAMT (.xml)', exact: true })).toBeDisabled();
});

test('acknowledging notes cannot unlock an invalid converted file', async ({ page }) => {
  const xml = readFileSync(resolve('examples/camt/camt-repeated-entry-details.xml'), 'utf8')
    .replace('<Amt Ccy="EUR">112.345</Amt>', '<Amt Ccy="USD">112.345</Amt>');
  await page.goto('/');
  await page.getByLabel('Choose CAMT or CODA file').setInputFiles({ name: 'invalid.xml', mimeType: 'application/xml', buffer: Buffer.from(xml) });
  await expect(page.getByRole('heading', { name: 'Review conversion', exact: true })).toBeVisible();
  const result = page.getByRole('region', { name: 'Converted file' });
  await result.getByRole('checkbox', { name: /I reviewed/ }).check();
  await expect(result.getByRole('button', { name: 'Download CODA (.cod)', exact: true })).toBeDisabled();
  await expect(result.getByRole('heading', { name: 'Download unavailable' })).toBeVisible();
});
