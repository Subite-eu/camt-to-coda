import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import catalog from "../../examples/download-catalog.json" with { type: "json" };

test.skip(process.env.EXAMPLE_DOWNLOADS_REQUIRED !== "1", "Run npm run test:examples:downloads to require fresh publisher containers");
// Originals and downloads stay ephemeral, including on failure.
test.use({ trace: "off", screenshot: "off", video: "off" });
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const ids = ["bank:ing-01", "bank:abn-01", "bank:bmo-01", "bank:bank-of-korea-01", "third-party:acsone-02", "third-party:tryton-01", "bank:huntington-052", "bank:huntington-053"];

for (const id of ids) test(`publisher download preserves pinned original bytes: ${id}`, async ({ page }) => {
  test.setTimeout(90_000);
  const example = catalog.examples.find(e => e.id === id)!;
  if (!("source" in example)) throw new Error("Expected publisher source");
  const source = example.source;
  // Acquire fresh originals outside browser CORS policy. Interception below
  // reproduces a CORS-permitted publisher response without rehosting files in
  // the product; the ordinary suite separately checks browser-blocked fallback.
  // GitHub explicitly allows cross-origin access: exercise its live browser
  // response without interception, including the publisher's actual CORS policy.
  const response = await fetch(source.url, { signal: AbortSignal.timeout(45_000), headers: { "User-Agent": "Mozilla/5.0 (camt2coda compatibility tests)" } });
  expect(response.ok, `Publisher HTTP status for ${id}`).toBe(true);
  const container = Buffer.from(await response.arrayBuffer());
  expect(container.length).toBe(source.downloadBytes);
  expect(hash(container)).toBe(source.downloadSha256);
  if (id !== "third-party:acsone-02") await page.route(source.url, route => route.fulfill({ status: 200, body: container,
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
  if (id.startsWith("bank:huntington-")) {
    await expect(row.getByText("Extracted inline XML", { exact: true })).toBeVisible();
    await row.getByText("Provenance, verification and usage terms", { exact: true }).click();
    await expect(row).toContainText("Filename assigned by this library");
    const localDownloadEvent = page.waitForEvent("download");
    const network: string[] = [];
    page.on("request", request => network.push(request.url()));
    await row.getByLabel(/Choose saved publisher Markdown/).setInputFiles({ name: "publisher.md", mimeType: "text/markdown", buffer: container });
    const localDownload = await localDownloadEvent;
    expect(localDownload.suggestedFilename()).toBe(example.filename);
    expect(readFileSync((await localDownload.path())!)).toEqual(original);
    expect(network).toEqual([]);
    await row.getByLabel(/Choose saved publisher Markdown/).setInputFiles({ name: "changed.md", mimeType: "text/markdown", buffer: Buffer.from("changed publisher page") });
    await expect(row.getByRole("alert")).toContainText("does not match the verified publisher source");
    await page.getByRole("link", { name: /Return to converter/ }).click();
    await page.getByLabel("Choose CAMT or CODA file").setInputFiles({ name: example.filename, mimeType: "application/xml", buffer: original });
    await expect(page.getByRole("region", { name: "Statement summary" })).toBeVisible();
    const converted = page.getByRole("region", { name: "Converted file" });
    if (id.endsWith("052")) {
      await expect(converted.getByRole("heading", { name: "Download unavailable" })).toBeVisible();
      await expect(converted.getByRole("button", { name: "Download CODA (.cod)", exact: true })).toBeDisabled();
    } else {
      await expect(page.getByRole("region", { name: "Statement summary" })).toContainText("52500.000 USD");
      const notes = converted.getByRole("checkbox", { name: /I reviewed/ });
      if (await notes.count()) await notes.check();
      await expect(converted.getByRole("button", { name: "Download CODA (.cod)", exact: true })).toBeEnabled();
    }
  }
});
