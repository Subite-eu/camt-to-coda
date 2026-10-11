import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import catalog from "../../examples/download-catalog.json" with { type: "json" };

test.skip(process.env.EXAMPLE_DOWNLOADS_REQUIRED !== "1", "Run npm run test:examples:downloads to require fresh publisher containers");
// Originals and downloads stay ephemeral, including on failure.
test.use({ trace: "off", screenshot: "off", video: "off" });
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const ids = ["bank:ing-01", "bank:abn-01", "bank:bmo-01", "bank:bank-of-korea-01", "third-party:acsone-02", "third-party:tryton-01"];

for (const id of ids) test(`publisher download preserves pinned original bytes: ${id}`, async ({ page }) => {
  test.setTimeout(90_000);
  const example = catalog.examples.find(e => e.id === id)!;
  if (!("source" in example)) throw new Error("Expected publisher source");
  const source = example.source;
  // Acquire fresh originals outside browser CORS policy. Interception below
  // reproduces a CORS-permitted publisher response without rehosting files in
  // the product; the ordinary suite separately checks browser-blocked fallback.
  const response = await fetch(source.url, { signal: AbortSignal.timeout(45_000) });
  expect(response.ok, `Publisher HTTP status for ${id}`).toBe(true);
  const container = Buffer.from(await response.arrayBuffer());
  expect(container.length).toBe(source.downloadBytes);
  expect(hash(container)).toBe(source.downloadSha256);
  await page.route(source.url, route => route.fulfill({ status: 200, body: container,
    headers: { "access-control-allow-origin": "*", "content-type": "application/octet-stream" } }));
  await page.goto("/#examples");
  await page.getByLabel("Bank or publisher").selectOption(example.publisherId);
  await page.getByLabel("Search example files").fill(example.filename);
  const row = page.getByRole("article", { name: id, exact: true });
  await expect(row).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await row.getByRole("button", { name: "Save original file" }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(example.filename);
  const original = readFileSync((await download.path())!);
  expect(original.length).toBe(source.sourceBytes);
  expect(hash(original)).toBe(source.sourceSha256);
  await expect(row.getByRole("alert")).toHaveCount(0);
});
