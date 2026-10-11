import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('catalog filters official banks and country references, including empty states', async ({ page }) => {
  await page.goto('/#bank-catalog');
  await expect(page.getByRole('heading', { name: 'Bank reporting catalog' })).toBeVisible();
  await page.getByLabel('Region', { exact: true }).selectOption('Africa');
  await expect(page.getByRole('heading', { name: 'FNB / FirstRand Bank' })).toBeVisible();
  await page.getByLabel('Resource type').selectOption('sample-file');
  await expect(page.getByText(/No banks match/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByRole('button', { name: /Country & regional references/ }).click();
  await page.getByLabel('Country / market').selectOption('France');
  await expect(page.getByRole('heading', { name: /CFONB/ })).toBeVisible();
  await expect(page.getByText(/National CAMT 053 and CAMT 054/)).toBeVisible();
  await page.getByLabel('Search authorities and message formats').fill('not-a-real-authority');
  await expect(page.getByText(/No references match/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByLabel('Country / market').selectOption('Portugal');
  await expect(page.getByText(/no CAMT reporting/)).toBeVisible();
});

test('returning from the catalog preserves a converted source and its downloadable result', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sample: CAMT 053 statement', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Statement summary' })).toBeVisible();
  const before = await page.getByRole('heading', { name: 'Statement summary' }).locator('..').innerText();
  await page.getByRole('link', { name: 'Bank catalog', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bank reporting catalog' })).toBeVisible();
  await page.getByRole('link', { name: /Return to converter/ }).click();
  await expect(page.getByRole('heading', { name: 'Statement summary' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Statement summary' }).locator('..')).toHaveText(before, { useInnerText: true });
  await expect(page.getByRole('button', { name: /Download CODA/ })).toBeEnabled();
});

test('catalog is accessible and fits narrow and wide screens', async ({ page }) => {
  await page.goto('/#bank-catalog');
  await expect(page.getByRole('heading', { name: 'Bank reporting catalog' })).toBeVisible();
  await expect(page.getByRole("group", { name: "Conversion direction" })).toHaveCount(0);
  await expect(page.getByLabel("Search banks and reporting formats")).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: /Country & regional references/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('expanded sources distinguish embedded bank samples, interbank reporting and Belgian CODA services', async ({ page }) => {
  await page.goto('/#bank-catalog');
  await page.getByLabel('Country / market').selectOption('Canada');
  await page.getByLabel('Resource type').selectOption('sample-file');
  const bmo = page.getByRole('article', { name: 'BMO / Bank of Montreal' });
  await expect(bmo.getByRole('link', { name: /before 21 February 2027/ })).toHaveAttribute('href', /\.XLSX$/);
  await expect(bmo.getByText('Downloadable sample · Public file').first()).toBeVisible();
  await page.getByRole('button', { name: 'Reset filters' }).click();
  await page.getByLabel('Country / market').selectOption('Belgium');
  await page.getByLabel('Search banks and reporting formats').fill('CODA');
  await expect(page.getByRole('heading', { name: 'Crelan', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Argenta', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Country & regional references/ }).click();
  await page.getByLabel('Country / market').selectOption('South Korea');
  await expect(page.getByRole('heading', { name: /Bank of Korea/ })).toBeVisible();
  await expect(page.getByRole('article', { name: /Bank of Korea/ }).getByText(/not a national corporate CAMT profile/)).toBeVisible();
});

test('North America separates Canadian and US services and links bank specifications with their limits', async ({ page }) => {
  await page.goto('/#bank-catalog');
  await page.getByLabel('Region', { exact: true }).selectOption('North America');
  await expect(page.getByRole('link', { name: /Full North America bank-by-bank review/ })).toHaveAttribute('href', /north-america-review\.md$/);
  await page.getByLabel('Country / market').selectOption('Canada');
  await page.getByLabel('Search banks and reporting formats').fill('RBC');
  const canada = page.getByRole('article', { name: 'RBC / Royal Bank of Canada', exact: true });
  await canada.getByText('Scope and source notes', { exact: true }).click();
  await expect(canada).toContainText('Exact schema versions are unstated');
  await expect(page.getByRole('heading', { name: /RBC Clear/ })).toHaveCount(0);
  await page.getByLabel('Country / market').selectOption('United States');
  const clear = page.getByRole('article', { name: /RBC Clear/ });
  await expect(clear).toContainText('camt.054 v8');
  await clear.getByText('Scope and source notes', { exact: true }).click();
  await expect(clear).toContainText('client-gated');
  await page.getByLabel('Search banks and reporting formats').fill('Huntington');
  const huntington = page.getByRole('article', { name: 'Huntington National Bank', exact: true });
  await expect(huntington.getByRole('link', { name: /CAMT.052 field guide/ })).toHaveAttribute('href', 'https://developer.huntington.com/enterprisepayments/docs/camt052');
  await expect(huntington.getByRole('link', { name: /Complete inline XML example with camt.053/ })).toBeVisible();
  await expect(huntington.getByRole('link', { name: 'View 2 CAMT example files' })).toHaveAttribute('href', '#examples?bank=huntington');
  await page.getByLabel('Search banks and reporting formats').fill('Scotiabank');
  await page.getByLabel('Country / market').selectOption('Mexico');
  const mexico = page.getByRole('article', { name: 'Scotiabank Mexico', exact: true });
  await expect(mexico).toContainText('financial-institution / vostro reporting');
  await mexico.getByText('Scope and source notes', { exact: true }).click();
  await expect(mexico).toContainText('does not establish corporate camt.054 entitlement');
});
