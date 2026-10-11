import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import manifest from "../../examples/bank-published/manifest.json";
import catalog from "../../examples/bank-published/catalog.json";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { validateCoda } from "../../src/validation/coda-validator.js";
import type { CamtStatement } from "../../src/core/model.js";

const directory = resolve(process.env.BANK_CORPUS_DIR ?? "private-examples/bank-published");
const required = process.env.BANK_CORPUS_REQUIRED === "1";
type Expected = typeof manifest.cases[number]["expected"][number];

function checkMoney(statement: CamtStatement, expected: Expected, roundTrip = false) {
  expect(statement.account.iban ?? statement.account.otherId).toBe(expected.account);
  expect(statement.account.currency).toBe(expected.currency);
  for (const [actual, literal] of [[statement.openingBalance, expected.opening], [statement.closingBalance, expected.closing]] as const) {
    expect(actual.amount).toBe(literal.amount);
    expect(actual.creditDebit).toBe(literal.creditDebit);
    expect(actual.date).toBe(roundTrip ? literal.date.slice(0, 10) : literal.date);
  }
  expect(statement.entries).toHaveLength(expected.entries.length);
  statement.entries.forEach((entry, index) => {
    const e = expected.entries[index];
    expect(entry.amount).toBe(e.amount);
    expect(entry.creditDebit).toBe(e.creditDebit);
    expect(entry.currency).toBe(expected.currency);
    expect(entry.bookingDate?.slice(0, 10)).toBe(e.bookingDate?.slice(0, 10));
    expect(entry.valueDate?.slice(0, 10)).toBe(e.valueDate?.slice(0, 10));
    const details = roundTrip ? entry.details.filter(d => d.amount !== undefined) : entry.details;
    expect(details.map(d => d.amount)).toEqual(e.details.map(d => d.amount ?? undefined));
    if (roundTrip && e.batchCount) {
      expect(entry.details.filter(d => d.amount === undefined).map(d => d.remittanceInfo?.unstructured)).toEqual([`${e.batchCount} transaction(s)`]);
    }
    details.forEach((detail, i) => {
      const d = e.details[i];
      expect(detail.creditDebit).toBe(d.creditDebit);
      const name = roundTrip ? d.counterparty?.slice(0, 35).trimEnd() : d.counterparty;
      expect(detail.counterparty?.name ?? null).toBe(name ?? null);
      const ref = roundTrip && d.endToEndId === "NOTPROVIDED" ? null : d.endToEndId;
      expect(detail.refs?.endToEndId ?? null).toBe(ref);
    });
  });
}

function schema(xml: string, name: string) {
  return spawnSync("xmllint", ["--nonet", "--noout", "--schema", resolve(`specifications/CAMT/${name}.xsd`), "-"], { input: xml, encoding: "utf8" });
}

describe("reviewed bank provenance", () => {
  it("tracks primary publishers, immutable originals, usage terms and the honest CODA gap", () => {
    expect(manifest.retrievalPolicy).toBe("external-only");
    expect(manifest.cases).toHaveLength(12);
    expect(new Set(manifest.cases.map(c => c.id)).size).toBe(12);
    expect(new Set(manifest.cases.map(c => c.publisher))).toEqual(new Set(["ing", "abn", "nordea"]));
    for (const source of manifest.cases) {
      expect(new URL(source.url).protocol).toBe("https:");
      expect(source.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.downloadSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(source.expected.length).toBeGreaterThan(0);
      expect(source.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(manifest.publishers[source.publisher as keyof typeof manifest.publishers].termsUrl).toMatch(/^https:/);
    }
    expect(manifest.codaStatus).toMatchObject({ completeBankPublishedOriginals: 0, status: "acquisition-gap" });
    expect(catalog.map(s => s.id)).toEqual(manifest.cases.map(s => s.id));
    catalog.forEach((s, i) => {
      const original = manifest.cases[i];
      expect(s.url).toBe(original.url);
      expect(s.currency).toBe(original.expected[0].currency);
      expect(s.caution).toBe(!original.xsdValid || original.expected.some(e => e.balanceMismatch));
    });
  });
});

// Ordinary offline tests verify the manifest. The explicit bank test command
// and required CI job enable every original; missing files fail, never skip.
describe.skipIf(!required)("original bank-published compatibility corpus", () => {
  for (const source of manifest.cases) {
    describe(source.id, () => {
      const original = () => {
        const bytes = readFileSync(resolve(directory, source.id + ".xml"));
        expect(bytes.length).toBe(source.sourceBytes);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(source.sourceSha256);
        return bytes.toString("utf8");
      };
      it("checks the unchanged source against the authoritative XSD, retaining publisher defects", () => {
        const result = schema(original(), source.schema);
        expect(result.error).toBeUndefined();
        expect(result.status).toBe(source.xsdValid ? 0 : 3);
        if (!source.xsdValid) expect(result.stderr).toContain("Character content other than whitespace is not allowed");
      });
      it("matches independently extracted literal statement and transaction facts", () => {
        const statements = parseCamt(original());
        expect(statements).toHaveLength(source.expected.length);
        statements.forEach((s, i) => checkMoney(s, source.expected[i]));
      });
      it("produces validated 128-character CODA and warns about publisher balance mismatches", () => {
        parseCamt(original()).forEach((s, i) => {
          const result = statementToCoda(s);
          expect(result.validation.errors).toEqual([]);
          expect(validateCoda(result.lines).errors).toEqual([]);
          expect(result.lines.every(l => l.raw.length === 128)).toBe(true);
          expect(result.validation.warnings.some(w => w.startsWith("Balance mismatch:"))).toBe(source.expected[i].balanceMismatch);
          // Aggregate plus monetary detail rows retain bank batches without
          // double-counting the details in the account's trailer totals.
          expect(result.lines.filter(l => l.recordType === "2.1")).toHaveLength(s.entries.length + s.entries.flatMap(e => e.details).filter(d => d.amount !== undefined).length);
        });
      });
      for (let version = 2; version <= 13; version++) {
        const target = `camt.053.001.${String(version).padStart(2, "0")}`;
        it(`retains representable values or explicitly rejects summary/detail conflicts for ${target}`, () => {
          parseCamt(original()).forEach((s, i) => {
            const coda = statementToCoda(s).lines.map(l => l.raw).join("\n");
            if (version >= 3 && version <= 6 && source.expected[i].entries.some(e => e.batchCount)) {
              expect(() => codaToCamt(coda, target)).toThrow("requires an amount for each transaction detail");
              return;
            }
            const reverse = codaToCamt(coda, target);
            const result = schema(reverse.xml, target);
            expect(result.error).toBeUndefined();
            expect(result.status, result.stderr).toBe(0);
            expect(reverse.statements).toHaveLength(1);
            checkMoney(parseCamt(reverse.xml)[0], source.expected[i], true);
          });
        });
      }
    });
  }
});
