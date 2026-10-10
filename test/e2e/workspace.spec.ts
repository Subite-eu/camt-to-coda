import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { execFileSync } from 'node:child_process';

async function load(page: Page, file: string) {
  await page.goto('/');
  await page.getByLabel('Choose CAMT or CODA file').setInputFiles(resolve('examples', file));
  await expect(page.getByRole('heading', { name: 'Review conversion', exact: true })).toBeVisible();
}
async function acceptNotes(page: Page) {
  const checkbox = page.getByRole('checkbox', { name: /I reviewed the conversion notes/ });
  if (await checkbox.count()) await checkbox.check();
}
async function download(page: Page) {
  await acceptNotes(page);
  const received = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  const artifact = await received;
  return { name: artifact.suggestedFilename(), text: readFileSync((await artifact.path())!, 'utf8') };
}
async function accessible(page: Page) {
  await page.evaluate(() => Promise.all(document.getAnimations().map(a => a.finished.catch(() => {}))));
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('first use is accessible and explains local processing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Drop a CAMT XML or CODA file' })).toBeVisible();
  await expect(page.getByText(/bank data is not uploaded/)).toBeVisible();
  await accessible(page);
});

test('forward conversion preserves every statement and downloads a ZIP', async ({ page }) => {
  await load(page, 'camt/camt-multiple-statements.xml');
  await expect(page.getByLabel('Statement', { exact: true })).toHaveValue('0');
  await expect(page.getByRole('region', { name: 'Statement summary' })).toContainText('112.345 EUR');
  await page.getByLabel('Statement', { exact: true }).selectOption('1');
  await expect(page.getByRole('region', { name: 'Statement summary' })).toContainText('21.000 EUR');
  await acceptNotes(page);
  const received = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download all (2)' }).click();
  const artifact = await received;
  const files = Object.values(unzipSync(readFileSync((await artifact.path())!))).map(strFromU8);
  expect(files).toHaveLength(2);
  expect(files.some(f => f.includes('BE68539007547034'))).toBe(true);
  expect(files.some(f => f.includes('BE71096123456769'))).toBe(true);
  await accessible(page);
});

test('reverse privacy preview and download contain the same safe multi-statement artifact', async ({ page }) => {
  await load(page, 'coda/coda-multiple-statements.cod');
  await expect(page.getByLabel('Statement', { exact: true }).locator('option')).toHaveCount(2);
  await page.getByRole('switch', { name: 'Anonymize exported artifact' }).click();
  await expect(page.getByRole('heading', { name: 'Review conversion', exact: true })).toBeVisible();
  const artifact = await download(page);
  expect(artifact.name).toMatch(/anon/i);
  expect(artifact.text.match(/<Stmt>/g)).toHaveLength(2);
  for (const secret of ['BE68539007547034', 'BE71096123456769', 'Example Company', 'BANK-EXAMPLE', 'E2E-EXAMPLE', 'Example invoice']) expect(artifact.text).not.toContain(secret);
  expect(artifact.text).toContain('ANON-');
  execFileSync('xmllint', ['--nonet', '--noout', '--schema', resolve('specifications/CAMT/camt.053.001.08.xsd'), '-'], { input: artifact.text, stdio: ['pipe', 'pipe', 'pipe'] });
  await page.getByRole('button', { name: 'Inspect fields', exact: true }).click();
  const resultTab = page.getByRole('tab', { name: 'Result', exact: true });
  if (await resultTab.isVisible()) await resultTab.click();
  await expect(page.getByText(/Output · CAMT/, { exact: true })).toBeVisible();
  await expect(page.locator('#result-document')).toContainText('ANON-');
  await expect(page.locator('#result-document')).not.toContainText('BE68539007547034');
  await accessible(page);
});

test('expert field navigation is keyboard usable and maps the selected movement', async ({ page }) => {
  await load(page, 'camt/camt.053.001.08.xml');
  await page.getByRole('button', { name: 'Inspect movement 1' }).click();
  const resultTab = page.getByRole('tab', { name: 'Result', exact: true });
  if (await resultTab.isVisible()) await resultTab.click();
  const field = page.getByRole('button', { name: /Record 2.1, amount, position 33-47/ });
  await expect(field).toBeVisible();
  await field.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('group', { name: 'CODA fields' }).locator(':focus')).toHaveCount(1);
  await field.click();
  await expect(page.getByRole('region', { name: 'Selected field' })).toContainText('12.345');
  await accessible(page);
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Select a movement, CODA field/)).toBeVisible();
});

test('invalid input keeps the original source and offers recovery', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose CAMT or CODA file').setInputFiles(resolve('examples/invalid/camt-unclosed.xml'));
  await expect(page.getByRole('heading', { name: 'Conversion needs attention' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download', exact: true })).toBeDisabled();
  await expect(page.getByText('Original source', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Load another file', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Drop a CAMT XML or CODA file' })).toBeVisible();
});

test('oversized files are rejected before conversion with an actionable limit', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose CAMT or CODA file').setInputFiles({ name: 'large.xml', mimeType: 'application/xml', buffer: Buffer.alloc(5 * 1024 * 1024 + 1, 32) });
  await expect(page.getByRole('alert')).toContainText('5 MiB');
  await expect(page.getByRole('alert')).toContainText('CLI');
});

test('forward privacy download succeeds and removes source identifiers', async ({ page }) => {
  await load(page, 'camt/camt.053.001.08.xml');
  await page.getByRole('switch', { name: 'Anonymize exported artifact' }).click();
  await expect(page.getByRole('heading', { name: 'Review conversion', exact: true })).toBeVisible();
  const artifact = await download(page);
  expect(artifact.name).toMatch(/anon/i);
  const lines = artifact.text.trimEnd().split('\n');
  expect(lines.length).toBeGreaterThan(4);
  expect(lines.every(l => l.length === 128)).toBe(true);
  for (const secret of ['BE68539007547034', 'Example Company', 'Example Counterparty', 'BANK-EXAMPLE', 'E2E-EXAMPLE', 'Example invoice']) expect(artifact.text).not.toContain(secret);
  expect(artifact.text).toContain('000000000012345');
});

test('dark theme review and expert views remain accessible', async ({ page }) => {
  await load(page, 'camt/camt.053.001.08.xml');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await accessible(page);
  await page.getByRole('button', { name: 'Inspect movement 1' }).click();
  await accessible(page);
});

test('large valid statements keep review and inspection rendering bounded', async ({ page }) => {
  test.setTimeout(60_000);
  const original = readFileSync(resolve('examples/camt/camt.053.001.08.xml'), 'utf8');
  const movement = original.match(/<Ntry>[\s\S]*?<\/Ntry>/)![0];
  const source = original.replace(movement, movement.repeat(2000)).replace('>112.345</Amt>', '>24790.000</Amt>');
  expect(Buffer.byteLength(source)).toBeLessThan(5 * 1024 * 1024);
  await page.goto('/');
  await page.getByLabel('Choose CAMT or CODA file').setInputFiles({ name: 'large-valid.xml', mimeType: 'application/xml', buffer: Buffer.from(source) });
  await expect(page.getByRole('heading', { name: 'Review conversion', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Statement summary' })).toContainText('24790.000 EUR');
  await expect(page.getByRole('button', { name: /Inspect movement \d+/ })).toHaveCount(25);
  await page.getByRole('button', { name: 'Next movements' }).click();
  await expect(page.getByRole('button', { name: 'Inspect movement 26', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Inspect movement 26', exact: true }).click();
  const resultTab = page.getByRole('tab', { name: 'Result', exact: true });
  if (await resultTab.isVisible()) await resultTab.click();
  await expect(page.getByRole('button', { name: /Record 2.1, amount, position 33-47/ })).toBeVisible();
  expect(await page.getByRole('group', { name: 'CODA fields' }).getByRole('button').count()).toBeLessThan(40);
  expect(await page.locator('*').count()).toBeLessThan(4000);
  const artifact = await download(page);
  expect(artifact.text.split('\n').filter(l => l.startsWith('21'))).toHaveLength(2000);
});
