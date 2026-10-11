import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('channel overview deep links and separates current CAMT APIs from adjacent account data', async ({ page }) => {
  await page.goto('/#bank-catalog?section=channels');
  await expect(page.getByRole('button', { name: 'Communication channels', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('table', { name: 'Communication channels by region' })).toBeVisible();
  await page.getByLabel('Region', { exact: true }).selectOption('Asia');
  await page.getByLabel('Country / market').selectOption('Indonesia');
  await page.getByLabel('Delivery channel').selectOption('api');
  await page.getByLabel('Automation', { exact: true }).selectOption('possible');
  await page.getByLabel('Delivered content').selectOption('reporting-files');
  await page.getByLabel('Search delivery information').fill('DBS');
  const entry = page.getByRole('article', { name: 'DBS Indonesia communication channels', exact: true });
  await entry.getByText(/Customer delivery and automation/).click();
  await expect(entry.getByText(/CAMT statement push\/pull/)).toBeVisible();
  await expect(entry.getByText(/JSON statement push\/pull/)).toHaveCount(0);
  await expect(entry).toContainText('IGWEB');
  await expect(entry.getByRole('link', { name: /DBS Indonesia Corporate Connectivity application/ })).toHaveAttribute('href', /^https:\/\/www\.dbs\.id\//);
  await page.getByLabel('Delivered content').selectOption('account-data');
  await expect(entry.getByText(/JSON statement push\/pull/)).toBeVisible();
  await page.getByLabel('Search delivery information').fill('no-such-bank');
  await expect(page.getByText(/No documented channels match/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset channel filters' }).click();
  await page.getByRole('button', { name: 'Filter channels to Oceania' }).click();
  await expect(page.getByLabel('Region', { exact: true })).toHaveValue('Oceania');
  await expect(page.getByRole('article', { name: 'DBS Indonesia communication channels' })).toHaveCount(0);
});

test('optional bank delivery evidence has sources and survives navigation without losing a conversion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Sample: CAMT 053 statement', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Statement summary' })).toBeVisible();
  await page.getByRole('link', { name: 'Bank catalog', exact: true }).click();
  await page.getByLabel('Search banks and reporting formats').fill('Westpac');
  const bank = page.getByRole('article', { name: 'Westpac', exact: true });
  await bank.getByText(/Customer delivery and automation/).click();
  await expect(bank.getByText(/BankRec via iLink — API/)).toBeVisible();
  await expect(bank.getByText(/QuickStream downloadable/)).toBeVisible();
  await page.getByRole('button', { name: 'Communication channels', exact: true }).click();
  await page.getByRole('link', { name: /Return to converter/ }).click();
  await expect(page.getByRole('region', { name: 'Statement summary' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download CODA (.cod)', exact: true })).toBeEnabled();
});

test('channel overview is accessible and keeps wide regional information within its scroll container', async ({ page }) => {
  await page.goto('/#bank-catalog?section=channels');
  await expect(page.getByRole('table', { name: 'Communication channels by region' })).toBeVisible();
  await page.getByLabel('Search delivery information').fill('Westpac');
  await page.getByText(/Customer delivery and automation/).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 375, height: 812 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
