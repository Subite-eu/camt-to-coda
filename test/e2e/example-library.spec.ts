import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ExampleMetadata = {
  id: string; filename: string; provenance: string; publisher: string;
  bank: string; countryBasis: string; source?: { url: string };
};
const { examples } = JSON.parse(readFileSync(resolve('examples/download-catalog.json'), 'utf8')) as { examples: ExampleMetadata[] };
const ing = examples.find(example => example.id === 'bank:ing-01')!;
const thirdParty = examples.find(example => example.id === 'third-party:acsone-02')!;
const synthetic = examples.find(example => example.id === 'synthetic:coda-card-purchases')!;

test('all 252 example files can be browsed in pages of 20 without requesting publisher originals', async ({ page }) => {
  const sourceUrls = new Set(examples.flatMap(example => example.source ? [example.source.url] : []));
  const publisherRequests: string[] = [];
  await page.route('**/*', async route => {
    if (sourceUrls.has(route.request().url())) {
      publisherRequests.push(route.request().url());
      await route.abort();
    } else await route.continue();
  });
  await page.goto('/#examples');
  await expect(page.getByRole('heading', { level: 1, name: 'Example files', exact: true })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /of 252 examples/ })).toHaveText('252 of 252 examples');
  await expect(page.getByRole('button', { name: 'Previous examples' })).toBeDisabled();
  const ids: string[] = [];
  for (let index = 0; index < 13; index++) {
    await expect(page.getByText(`Page ${index + 1} of 13`, { exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(index === 12 ? 12 : 20);
    ids.push(...await page.getByRole('article').evaluateAll(rows => rows.map(row => row.getAttribute('aria-label')!)));
    if (index < 12) await page.getByRole('button', { name: 'Next examples' }).click();
  }
  expect(new Set(ids).size).toBe(252);
  expect([...ids].sort()).toEqual(examples.map(example => example.id).sort());
  await expect(page.getByRole('button', { name: 'Next examples' })).toBeDisabled();
  await page.getByRole('button', { name: 'Previous examples' }).click();
  await expect(page.getByText('Page 12 of 13', { exact: true })).toBeVisible();
  expect(publisherRequests).toEqual([]);
});

test('format, provenance, country and publisher filters retain explicit bank source scope', async ({ page }) => {
  await page.goto('/#examples');
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption({ label: 'CAMT' });
  await page.getByRole('combobox', { name: 'Provenance', exact: true }).selectOption({ label: 'Bank-published original' });
  await page.getByRole('combobox', { name: 'Country / scope', exact: true }).selectOption({ label: 'Belgium' });
  await page.getByRole('combobox', { name: 'Bank or publisher', exact: true }).selectOption({ label: 'ING' });
  const row = page.getByRole('article', { name: ing.id, exact: true });
  await expect(row.getByRole('heading', { name: ing.filename, exact: true })).toBeVisible();
  await expect(row.getByText('Bank-published original', { exact: true })).toBeVisible();
  await expect(row).toContainText('Bank: ING · Publisher: ING');
  await expect(row).toContainText(ing.countryBasis);
  await expect(row.getByRole('button', { name: 'Save original file', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption({ label: 'CODA' });
  await expect(page.getByText(/No examples match these filters/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await expect(page.getByRole('status').filter({ hasText: /of 252 examples/ })).toHaveText('252 of 252 examples');
  await expect(page.getByRole('article')).toHaveCount(20);
});

test('third-party CODA and synthetic examples never imply bank authorship and retain rejection labels', async ({ page }) => {
  await page.goto('/#examples');
  await page.getByRole('combobox', { name: 'Format', exact: true }).selectOption({ label: 'CODA' });
  await page.getByRole('combobox', { name: 'Provenance', exact: true }).selectOption({ label: 'Third-party fixture' });
  await expect(page.getByRole('status').filter({ hasText: /of 252 examples/ })).toHaveText('29 of 252 examples');
  await page.getByLabel('Search example files').fill(thirdParty.filename);
  const thirdPartyRow = page.getByRole('article', { name: thirdParty.id, exact: true });
  await expect(thirdPartyRow.getByText('Third-party fixture', { exact: true })).toBeVisible();
  await expect(thirdPartyRow).toContainText(`Bank: Bank not verified · Publisher: ${thirdParty.publisher}`);
  await expect(thirdPartyRow).toContainText(thirdParty.countryBasis);
  await page.getByLabel('Search example files').fill('Coda_faulty_version.txt');
  await expect(page.getByRole('article').getByText('Expected rejection', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByRole('combobox', { name: 'Provenance', exact: true }).selectOption({ label: 'Synthetic test data' });
  await expect(page.getByRole('status').filter({ hasText: /of 252 examples/ })).toHaveText('104 of 252 examples');
  await page.getByRole('combobox', { name: 'Country / scope', exact: true }).selectOption({ label: 'Not country-specific' });
  await page.getByLabel('Search example files').fill(synthetic.filename);
  const syntheticRow = page.getByRole('article', { name: synthetic.id, exact: true });
  await expect(syntheticRow.getByText('Synthetic test data', { exact: true })).toBeVisible();
  await expect(syntheticRow).toContainText('No bank affiliation');
  await expect(syntheticRow).toContainText(synthetic.countryBasis);
});

test('synthetic original download preserves committed bytes and converts after upload', async ({ page }) => {
  await page.goto('/#examples');
  await page.getByLabel('Search example files').fill(synthetic.filename);
  const row = page.getByRole('article', { name: synthetic.id, exact: true });
  const received = page.waitForEvent('download');
  await row.getByRole('button', { name: 'Download test file', exact: true }).click();
  const download = await received;
  expect(download.suggestedFilename()).toBe(synthetic.filename);
  const downloaded = readFileSync((await download.path())!);
  expect(downloaded).toEqual(readFileSync(resolve('examples/coda/coda-card-purchases.cod')));
  await page.getByRole('link', { name: /Return to converter/ }).click();
  await page.getByLabel('Choose CAMT or CODA file').setInputFiles({ name: download.suggestedFilename(), mimeType: 'text/plain', buffer: downloaded });
  await expect(page.getByRole('region', { name: 'Statement summary' })).toContainText('816.350 EUR');
  const result = page.getByRole('region', { name: 'Converted file' });
  const notes = result.getByRole('checkbox', { name: /I reviewed/ });
  if (await notes.count()) await notes.check();
  await expect(result.getByRole('button', { name: 'Download CAMT (.xml)', exact: true })).toBeEnabled();
});

test('Try in converter opens the selected synthetic example', async ({ page }) => {
  await page.goto('/#examples');
  await page.getByLabel('Search example files').fill(synthetic.filename);
  await page.getByRole('article', { name: synthetic.id, exact: true }).getByRole('button', { name: 'Try in converter', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Statement summary' })).toContainText('816.350 EUR');
  await expect(page.getByRole('heading', { name: 'Example files', exact: true })).toHaveCount(0);
});

test('failed publisher retrieval retains a direct source link and offers manual download guidance', async ({ page }) => {
  await page.route(ing.source!.url, route => route.abort('failed'));
  await page.goto('/#examples');
  await page.getByLabel('Search example files').fill(ing.filename);
  const row = page.getByRole('article', { name: ing.id, exact: true });
  await row.getByRole('button', { name: 'Save original file', exact: true }).click();
  await expect(row.getByRole('alert')).toContainText(/publisher download/i);
  await expect(row.getByRole('link', { name: /Publisher CAMT download/ })).toHaveAttribute('href', ing.source!.url);
  await expect(row.getByRole('button', { name: 'Save original file', exact: true })).toBeEnabled();
});

test('example and bank catalog navigation preserves a loaded conversion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sample: CAMT 053 statement', exact: true }).click();
  const summary = page.getByRole('region', { name: 'Statement summary' });
  await expect(summary).toBeVisible();
  const before = await summary.innerText();
  await page.getByRole('link', { name: 'Example files', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Example files', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Bank catalog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bank reporting catalog' })).toBeVisible();
  await page.getByRole('link', { name: /Return to converter/ }).click();
  await expect(summary).toHaveText(before, { useInnerText: true });
  await expect(page.getByRole('button', { name: 'Download CODA (.cod)', exact: true })).toBeEnabled();
});

test('example files remain accessible and fit desktop and mobile screens', async ({ page }) => {
  await page.goto('/#examples');
  await expect(page.getByRole('heading', { level: 1, name: 'Example files', exact: true })).toBeVisible();
  await expect(page.getByLabel('Search example files')).toBeInViewport();
  await expect(page.getByRole('group', { name: 'Conversion direction' })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('combobox', { name: 'Provenance', exact: true }).selectOption({ label: 'Third-party fixture' });
  await page.getByLabel('Search example files').fill(thirdParty.filename);
  await page.getByRole('article', { name: thirdParty.id, exact: true }).getByText('Provenance, verification and usage terms', { exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
