import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import inventory from "../../examples/bank-catalog/source-inventory.json";
import coda from "../../examples/coda-published/manifest.json";
import synthetic from "../../examples/catalog.json";

it("publishes every inventoried source with download pins and honest attribution, without customer facts", () => {
  const result = spawnSync(process.execPath, ["scripts/build-example-catalog.mjs", "--check"], { encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
  const catalog = JSON.parse(readFileSync("examples/download-catalog.json", "utf8"));
  expect(catalog.examples).toHaveLength(252);
  expect(new Set(catalog.examples.map((s: { id: string }) => s.id)).size).toBe(252);
  for (const [sources, prefix] of [[inventory.cases, "bank"], [coda.cases, "third-party"], [synthetic.cases, "synthetic"]] as const) {
    for (const source of sources) {
      const entry = catalog.examples.find((e: { id: string }) => e.id === `${prefix}:${source.id}`);
      expect(entry, source.id).toBeDefined();
      expect(entry.provenance).toBe(prefix);
      expect(entry.countries.length).toBeGreaterThan(0);
      if ("sourceSha256" in source) expect(entry.source.sourceSha256).toBe(source.sourceSha256);
    }
  }
  const nordea = catalog.examples.find((e: { id: string }) => e.id === "bank:nordea-01");
  expect(nordea.countries).toEqual(["Denmark"]);
  expect(nordea.countryBasis).toContain("filename");
  const seb = catalog.examples.find((e: { id: string }) => e.id === "bank:seb-01");
  expect(seb.countryBasis).toContain("Publisher service scope");
  const thirdParty = catalog.examples.find((e: { id: string }) => e.id === "third-party:acsone-02");
  expect(thirdParty.bank).toBe("Bank not verified");
  expect(thirdParty.countryBasis).toContain("CODA format");
  expect(thirdParty.publisher).toBe("acsone/pycoda");
  const text = JSON.stringify(catalog);
  for (const privateField of ["opening_balance", "movements", "closing_account_zone_raw", "record21_count", "mirrors"]) expect(text).not.toContain(`"${privateField}`);
});
