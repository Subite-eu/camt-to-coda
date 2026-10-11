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

it("rejects delivery-channel claims without evidence, precise scope or known classifications", () => {
  const channel = {
    kind: "api", label: "Statement API", automation: "automated", availability: "documented",
    formats: ["camt.053"], payload: "reporting-files", markets: [{ region: "Africa", country: "South Africa" }],
    scope: "Business accounts", setup: "Client agreement and credentials", verifiedOn: "2026-10-11",
    sources: [{ label: "Official service guide", url: "https://www.fnb.co.za/guide" }],
  };
  for (const invalid of [
    { ...channel, sources: [] }, { ...channel, kind: "unknown" }, { ...channel, automation: "yes" },
    { ...channel, payload: "xml-maybe" }, { ...channel, availability: "assumed" },
    { ...channel, formats: [] }, { ...channel, scope: "" }, { ...channel, setup: "" },
    { ...channel, markets: [{ region: "Europe", country: "France" }] },
    { ...channel, sources: [{ label: "Unsafe", url: "http://example.com" }] },
  ]) {
    const entries = structuredClone(banks.banks);
    Object.assign(entries[0], { communicationChannels: [invalid] });
    expect(() => validateCatalog(entries, refs.references, inventory.cases)).toThrow(/channel/i);
  }
});

it("generates regional channel evidence without counting JSON APIs as automated CAMT files", () => {
  const entry = structuredClone(banks.banks[0]);
  const common = { automation: "automated", availability: "documented", markets: entry.markets,
    setup: "Enrolment required", verifiedOn: "2026-10-11", sources: [{ label: "Official guide", url: "https://www.fnb.co.za/guide" }] };
  Object.assign(entry, { communicationChannels: [
    { ...common, kind: "sftp", label: "File feed", formats: ["camt.053"], payload: "reporting-files", scope: "Business-account CAMT files" },
    { ...common, kind: "api", label: "Data API", formats: ["JSON"], payload: "account-data", scope: "Account data only" },
  ] });
  const files: Map<string, string> = renderCatalog([entry], [], [], banks.verifiedOn);
  const overview = files.get("examples/bank-catalog/communication-channels.md")!;
  expect(overview).toContain("| Africa | 1 | 1 |");
  expect(overview).toContain("Data API");
  expect(overview).toContain("Account data only");
  expect(files.get("examples/bank-catalog/africa/south-africa/fnb/README.md")).toContain("Customer delivery and automation");
});
