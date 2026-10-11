import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { codaToCamt } from "../../src/core/reverse.js";

test.skip(process.env.BANK_CORPUS_REQUIRED !== "1", "Use npm run test:bank:e2e to fetch and require bank originals");
test.use({ trace: "off", screenshot: "off", video: "off" });
const directory = resolve(process.env.BANK_CORPUS_DIR ?? "private-examples/bank-published");
const manifest = JSON.parse(readFileSync(resolve("examples/bank-published/manifest.json"), "utf8")) as {
  cases: { id: string; sourceSha256: string; expected: { account: string; currency: string; opening: { amount: number }; closing: { amount: number }; entries: { amount: number; creditDebit: string; details: { amount: number }[] }[] }[] }[];
};

for (const source of manifest.cases) {
  test(`bank original upload and download: ${source.id}`, async ({ page, baseURL }) => {
    const path = resolve(directory, source.id + ".xml");
    const bytes = readFileSync(path);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sourceSha256);
    const submissions: string[] = [];
    page.on("request", request => {
      const url = new URL(request.url());
      const staticAsset = request.method() === "GET" && url.origin === new URL(baseURL!).origin && !url.search
        && (url.pathname === "/" || url.pathname === "/favicon.ico" || url.pathname.startsWith("/assets/"));
      const beacon = request.method() === "GET" && url.origin === "https://static.cloudflareinsights.com" && /^\/beacon\.min\.js(?:\/v[a-f0-9]+)?$/.test(url.pathname);
      const telemetry = request.method() === "POST" && url.href === "https://cloudflareinsights.com/cdn-cgi/rum";
      if (!staticAsset && !beacon && !telemetry) submissions.push(`${request.method()} ${url.href}`);
      if (telemetry && source.expected.some(s => (request.postData() ?? "").includes(s.account))) submissions.push("Source account appeared in telemetry");
    });
    await page.goto("/");
    await page.getByLabel("Choose CAMT or CODA file").setInputFiles(path);
    await expect(page.getByRole("heading", { name: "Review conversion", exact: true })).toBeVisible();
    const notes = page.getByRole("checkbox", { name: /I reviewed the conversion notes/ });
    if (await notes.count()) await notes.check();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Download CODA/ }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toMatch(/\.cod$/);
    const coda = readFileSync((await download.path())!, "utf8");
    expect(coda.split(/\r?\n/).every(line => line.length === 128)).toBe(true);
    const result = codaToCamt(coda);
    expect(result.validation.valid).toBe(true);
    expect(result.statements).toHaveLength(source.expected.length);
    result.statements.forEach((s, i) => {
      const literal = source.expected[i];
      expect(s.account.iban ?? s.account.otherId).toBe(literal.account);
      expect(s.account.currency).toBe(literal.currency);
      expect(s.openingBalance.amount).toBe(literal.opening.amount);
      expect(s.closingBalance.amount).toBe(literal.closing.amount);
      expect(s.entries.map(e => e.amount)).toEqual(literal.entries.map(e => e.amount));
      expect(s.entries.map(e => e.creditDebit)).toEqual(literal.entries.map(e => e.creditDebit));
      expect(s.entries.flatMap(e => e.details).filter(d => d.amount !== undefined).map(d => d.amount)).toEqual(literal.entries.flatMap(e => e.details).map(d => d.amount));
    });
    expect(submissions).toEqual([]);
  });
}

test("bank downloads remain clearly separate from the bundled synthetic picker", async ({ page }) => {
  await page.goto("/");
  const bank = page.getByRole("group", { name: "Bank-published CAMT examples" });
  await bank.locator("summary").click();
  await expect(bank.getByRole("link", { name: /^Download / })).toHaveCount(12);
  await expect(bank.getByText(/CODA samples remain synthetic/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
