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

it("derives original and validation totals from the supplied inventory", () => {
  const sources = inventory.cases.filter(s => s.bankId === "ing");
  const files: Map<string, string> = renderCatalog(banks.banks, refs.references, sources, banks.verifiedOn);
  const index = files.get("examples/bank-catalog/README.md")!;
  expect(index).toContain("**2 different bank-published XML originals/payloads**");
  expect(index).toContain("2 validate against the bundled ISO XSD");
  expect(index).toContain("2 original XML files remain in an ignored/ephemeral cache");
  expect(index).not.toContain("95 validate");
  expect(index).not.toContain("other 82");
});

it("requires separate pins for an unchanged embedded XML payload", () => {
  const source = { ...inventory.cases[0], zipMember: "attachment.bin", zipMemberSha256: "a".repeat(64), zipMemberBytes: 100, sourceBytes: 20, payloadRange: { offset: 10, length: 20 } };
  expect(() => validateCatalog(banks.banks, refs.references, [source])).not.toThrow();
  for (const invalid of [{ ...source, zipMemberSha256: undefined }, { ...source, payloadRange: { offset: 90, length: 20 } }, { ...source, allowedRedirectOrigins: ["http://untrusted.example"] }]) {
    expect(() => validateCatalog(banks.banks, refs.references, [invalid])).toThrow(/payload|redirect/i);
  }
});

it("requires unambiguous bounded pins for unchanged inline XML", () => {
  const source = inventory.cases.find(s => s.id === "huntington-052")!;
  expect(() => validateCatalog(banks.banks, refs.references, [source])).not.toThrow();
  for (const invalid of [
    { ...source, inlineRange: { offset: -1, length: source.sourceBytes } },
    { ...source, inlineRange: { offset: 0.5, length: source.sourceBytes } },
    { ...source, inlineRange: { offset: source.downloadBytes, length: source.sourceBytes } },
    { ...source, inlineRange: { offset: 0, length: source.sourceBytes - 1 } },
    { ...source, zipMember: "original.xml" },
    { ...source, tarMember: "original.xml" },
  ]) expect(() => validateCatalog(banks.banks, refs.references, [invalid])).toThrow(/inline XML range/i);
});
