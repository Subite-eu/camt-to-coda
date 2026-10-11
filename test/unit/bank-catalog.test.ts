import { expect, it } from "vitest";
import banks from "../../examples/bank-catalog/catalog.json";
import refs from "../../examples/bank-catalog/country-references.json";
import inventory from "../../examples/bank-catalog/source-inventory.json";
// @ts-expect-error Tooling module is plain ESM JavaScript, not shipped TypeScript.
import { renderCatalog, validateCatalog } from "../../scripts/build-bank-catalog.mjs";

it("keeps primary references, honest scope and geographic indexes linked", () => {
  expect(() => validateCatalog(banks.banks, refs.references, inventory.cases)).not.toThrow();
  const files: Map<string, string> = renderCatalog(banks.banks, refs.references, inventory.cases, banks.verifiedOn);
  expect(files.get("examples/bank-catalog/europe/czech-republic/README.md")).toContain("Czech Banking Association");
  expect(files.has("examples/bank-catalog/africa/czechia/README.md")).toBe(false);
  expect(files.get("examples/bank-catalog/europe/france/README.md")).toContain("CFONB");
  expect(files.get("examples/bank-catalog/europe/belgium/README.md")).toContain("Febelfin");
  expect(files.get("examples/bank-catalog/europe/netherlands/README.md")).toContain("Betaalvereniging");
  expect(files.get("examples/bank-catalog/europe/portugal/README.md")).toContain("no CAMT reporting");
  expect(files.get("examples/bank-catalog/oceania/australia/westpac/README.md")).toContain("Original CAMT XML sample");
  expect(files.get("examples/bank-catalog/README.md")).toContain("not yet inventoried");
});
it("rejects duplicate identifiers, unlinked originals and unsafe or unlabeled resources", () => {
  expect(() => validateCatalog([...banks.banks, banks.banks[0]], refs.references, inventory.cases)).toThrow(/duplicate/);
  const b = structuredClone(banks.banks);
  b[0].resources[0].url = "http://example.org";
  expect(() => validateCatalog(b, refs.references, inventory.cases)).toThrow(/Invalid resource/);
  b[0].resources[0].url = "https://example.org";
  b[0].resources[0].access = "unknown";
  expect(() => validateCatalog(b, refs.references, inventory.cases)).toThrow(/Invalid resource/);
  expect(() => validateCatalog(banks.banks, refs.references, [{ ...inventory.cases[0], bankId: "unverified" }])).toThrow(/Unlinked/);
});
