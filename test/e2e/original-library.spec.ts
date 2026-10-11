import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { convertForward, convertReverse } from '../../src/web/browser-entry.js';

const { cases } = JSON.parse(readFileSync(resolve('examples/manifest.json'), 'utf8')) as {
  cases: { id: string; path: string; format: 'camt' | 'coda'; valid: boolean; expected?: { account: string }[] }[];
};
const staticPaths = new Set(['/', '/favicon.ico', ...readdirSync(resolve('dist-web/assets')).map(file => `/assets/${file}`)]);

// Real uploads and downloads exercise the deployed worker and browser adapters.
// Literal semantic and XSD expectations are separately enforced by public-examples.test.ts.
for (const example of cases) {
  test(`original source: ${example.id}`, async ({ page, baseURL }) => {
    const source = readFileSync(resolve('examples', example.path), 'utf8');
    const runtimeErrors: string[] = [];
    const unexpectedNetwork: string[] = [];
    const origin = new URL(baseURL!).origin;
    page.on('pageerror', error => {
      // Cloudflare injects analytics at the edge. This test environment blocks
      // its endpoint; WebKit reports that specific CORS failure as pageerror.
      if (/^\/cloudflareinsights\.com\/cdn-cgi\/rum due to access control checks\.$/.test(error.message)) {
        test.info().annotations.push({ type: 'external-telemetry', description: error.message });
      } else runtimeErrors.push(error.message);
    });
    page.on('request', request => {
      const url = new URL(request.url());
      const isStatic = request.method() === 'GET' && !url.search && url.origin === origin && staticPaths.has(url.pathname);
      const isBeacon = request.method() === 'GET' && url.origin === 'https://static.cloudflareinsights.com'
        && /^\/beacon\.min\.js(?:\/v[a-f0-9]+)?$/.test(url.pathname) && !url.search;
      const isTelemetry = request.method() === 'POST' && url.href === 'https://cloudflareinsights.com/cdn-cgi/rum';
      // Reject unexpected submissions regardless of encoding, including JSON,
      // multipart and base64; also reject unexpected GET paths/query strings.
      if (!isStatic && !isBeacon && !isTelemetry) unexpectedNetwork.push(`${request.method()} ${url.href}`);
      if (isTelemetry && example.expected?.some(statement => (request.postData() ?? '').includes(statement.account)))
        unexpectedNetwork.push('Source account identifier found in telemetry');
    });
    page.on('websocket', socket => unexpectedNetwork.push(`WebSocket ${socket.url()}`));
    await page.goto('/');
    await page.getByLabel('Choose CAMT or CODA file').setInputFiles(resolve('examples', example.path));
    if (!example.valid) {
      await expect(page.getByRole('heading', { name: /Review conversion|Conversion needs attention/ })
        .or(page.getByRole('alert')).first()).toBeVisible();
      const notes = page.getByRole('checkbox', { name: /I reviewed the conversion notes/ });
      if (await notes.count()) await notes.check();
      await expect(page.getByRole('button', { name: /^Download/ }).and(page.locator(':enabled'))).toHaveCount(0);
    } else {
      await expect(page.getByRole('heading', { name: 'Review conversion', exact: true })).toBeVisible();
      const expected = example.format === 'camt'
        ? convertForward(source).files.map(file => file.lines.map(line => line.raw).join('\n'))
        : [convertReverse(source).xml];
      for (const [index, text] of expected.entries()) {
        if (expected.length > 1) await page.getByLabel('Statement', { exact: true }).selectOption(String(index));
        const notes = page.getByRole('checkbox', { name: /I reviewed the conversion notes/ });
        if (await notes.count()) await notes.check();
        const received = page.waitForEvent('download');
        await page.getByRole('button', { name: /^Download (CODA|CAMT)/ }).click();
        const artifact = await received;
        expect(readFileSync((await artifact.path())!, 'utf8')).toBe(text);
      }
    }
    expect(runtimeErrors).toEqual([]);
    expect(unexpectedNetwork, 'Only static assets and the known edge analytics endpoint may use the network').toEqual([]);
  });
}
