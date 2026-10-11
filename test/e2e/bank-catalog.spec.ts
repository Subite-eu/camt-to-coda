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
