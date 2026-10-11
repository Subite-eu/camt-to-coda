import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import inventory from "../../examples/bank-catalog/source-inventory.json";
import banks from "../../examples/bank-catalog/catalog.json";
import { parseCamt } from "../../src/core/camt-parser.js";
import { convertForward, convertReverse } from "../../src/web/browser-entry.js";

const required = process.env.BANK_CATALOG_REQUIRED === "1";
for (const source of inventory.cases) {
  describe.skipIf(source.storage === "external-only" && !required)(source.id, () => {
    const path = source.repositoryPath ? resolve(source.repositoryPath) : resolve(process.env.BANK_CATALOG_DIR ?? "private-examples/bank-catalog", source.id + ".xml");
    it("preserves publisher bytes, document shape and independently counted content", () => {
      const bytes = readFileSync(path);
      expect(bytes.length).toBe(source.sourceBytes);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sourceSha256);
      const xml = bytes.toString("utf8");
      expect(XMLValidator.validate(xml)).toBe(true);
      const tree = new XMLParser({ preserveOrder: true, ignoreAttributes: false }).parse(xml);
      const counts = { reports: 0, entries: 0, transactionDetails: 0 };
      function count(nodes: Record<string, unknown>[]) {
        for (const node of nodes) for (const [tag, value] of Object.entries(node)) {
          const name = tag.split(":").at(-1);
          if (name === "Stmt" || name === "Rpt") counts.reports++;
          if (name === "Ntry") counts.entries++;
          if (name === "TxDtls") counts.transactionDetails++;
          if (Array.isArray(value)) count(value);
        }
      }
      count(tree);
      expect(counts).toEqual(source.counts);
    });
    it("records schema validity without repairing the original", () => {
      if (source.xsdStatus === "wrapped-reference") {
        expect(source.rootQName).toBe("{urn:swift:xsd:envelope}Envelope");
        return; // This repository does not ship the SWIFT Envelope schema.
      }
      const result = spawnSync("xmllint", ["--nonet", "--noout", "--schema", resolve(`specifications/CAMT/${source.intendedSchema}.xsd`), path], { encoding: "utf8" });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(source.xsdStatus === "valid" ? 0 : 3);
      if (source.xsdStatus === "missing-element-namespace") expect(result.stderr).toContain("No matching global declaration");
      if (source.id === "huntington-052") for (const element of ["Sts", "AcctSvcrRef", "Nm"]) expect(result.stderr).toContain(`element ${element}`);
    });
    if (source.bankId === "huntington") it("preserves illustrative source facts and documented conversion outcomes", () => {
      const xml = readFileSync(path, "utf8");
      const [statement] = parseCamt(xml);
      expect(statement.account.currency).toBe("USD");
      expect(statement.account.bic).toBe("HUNTUS33");
      const forward = convertForward(xml).files[0];
      expect(forward.lines.every(line => [...line.raw].length === 128)).toBe(true);
      if (source.id === "huntington-052") {
        expect(statement.account.otherId).toBe("123456789");
        expect(statement.entries.map(e => [e.amount, e.creditDebit])).toEqual([[1500, "CRDT"], [750, "DBIT"]]);
        expect(statement.entries[0].details[0].remittanceInfo?.unstructured).toBe("Payment for services rendered - Invoice #2026-045");
        expect(forward.validation.valid).toBe(false);
        expect(forward.validation.errors).toContain("Invalid opening balance date");
      } else {
        expect(statement.account.iban).toBe("US64HUNT12345678901234567890");
        expect([statement.openingBalance.amount, statement.closingBalance.amount]).toEqual([50000, 52500]);
        expect(statement.entries.map(e => [e.amount, e.creditDebit])).toEqual([[2500, "CRDT"]]);
        expect(statement.entries[0].details[0].counterparty?.iban).toBe("US64OTHR98765432109876543210");
        expect(statement.entries[0].details[0].remittanceInfo?.unstructured).toBe("Payment for Invoice INV-2026-001");
        expect(forward.validation.valid).toBe(true);
        const reverse = convertReverse(forward.lines.map(line => line.raw).join("\n"));
        expect(reverse.validation.valid).toBe(true);
        expect(reverse.statements[0].entries[0].amount).toBe(2500);
        expect(reverse.statements[0].closingBalance.amount).toBe(52500);
        const outputSchema = spawnSync("xmllint", ["--nonet", "--noout", "--schema", resolve("specifications/CAMT/camt.053.001.08.xsd"), "-"], { input: reverse.xml, encoding: "utf8" });
        expect(outputSchema.error).toBeUndefined();
        expect(outputSchema.status, outputSchema.stderr).toBe(0);
      }
    });
  });
}
it("has provenance for every catalog original and keeps redistribution boundaries explicit", () => {
  expect(inventory.cases).toHaveLength(121);
  expect(new Set(inventory.cases.map(s => s.id)).size).toBe(121);
  expect(new Set(inventory.cases.map(s => s.sourceSha256)).size).toBe(inventory.cases.length);
  expect(inventory.cases.filter(s => s.repositoryPath)).toHaveLength(22);
  // Reviewed publisher counts prevent archive-name spelling/case from assigning
  // a different bank's examples to an otherwise valid catalog identifier.
  const counts: Record<string, number> = {};
  for (const s of inventory.cases) counts[s.bankId] = (counts[s.bankId] ?? 0) + 1;
  expect(counts).toEqual({ ing: 2, abn: 2, nordea: 8, seb: 34, handelsbanken: 6, "danske-bank": 27, westpac: 1, ubs: 2, "deutsche-bundesbank": 22, postfinance: 6, lhv: 1, "slovenska-sporitelna": 1, bmo: 4, "bank-of-korea": 3, huntington: 2 });
  for (const s of inventory.cases) {
    expect(banks.banks.some(b => b.id === s.bankId)).toBe(true);
    expect(s.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(s.downloadSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(s.url).toMatch(/^https:\/\//);
    if (s.repositoryPath) {
      expect(s.bankId).toBe("deutsche-bundesbank");
      expect(s.storage).toBe("committed-unchanged-with-attribution");
      expect(s.repositoryPath).toMatch(/^examples\/bank-catalog\/europe\/germany\/deutsche-bundesbank\/(ebics|swift)\/[^/]+\.xml$/);
    } else expect(s.storage).toBe("external-only");
  }
  expect(readFileSync("examples/bank-catalog/europe/germany/deutsche-bundesbank/ATTRIBUTION.md", "utf8")).toContain("Quelle: Deutsche Bundesbank");
});
