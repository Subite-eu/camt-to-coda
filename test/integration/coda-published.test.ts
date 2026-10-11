import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import manifest from "../../examples/coda-published/manifest.json";
import research from "../../examples/coda-published/research.json";
import { parseCoda } from "../../src/core/coda-parser.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { codaToStatement } from "../../src/core/coda-to-statement.js";
import { parseCamt } from "../../src/core/camt-parser.js";
import type { CodaLine } from "../../src/core/field-defs/types.js";
import type { CamtStatement } from "../../src/core/model.js";

const required = process.env.CODA_CORPUS_REQUIRED === "1";
const directory = resolve(process.env.CODA_CORPUS_DIR ?? "private-examples/coda-published");
type Source = typeof manifest.cases[number];
type ExpectedStatement = Source["expected"]["statements"][number];
const hash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const field = (line: CodaLine, name: string) => line.fields.find(f => f.name === name)?.value;

// Literal facts were independently sliced from the source using Python/Decimal,
// with the CODA 2.6 specification as authority. Do not regenerate expectations
// by running this repository's parser or converter.
function checkStatement(statement: CamtStatement, expected: ExpectedStatement, requiredXmlDetailAmount = false) {
  expect(statement.account.iban ?? statement.account.otherId).toBe(expected.account);
  expect(statement.account.currency).toBe(expected.currency);
  const money = (amount: number, debit: string) => (debit === "DBIT" ? -amount : amount).toFixed(3);
  expect(money(statement.openingBalance.amount, statement.openingBalance.creditDebit)).toBe(expected.opening_balance_signed);
  expect(money(statement.closingBalance.amount, statement.closingBalance.creditDebit)).toBe(expected.closing_balance_signed);
  const booked = expected.movements.filter(m => m.detail_sequence === "0000");
  expect(statement.entries).toHaveLength(expected.record21_detail0000_count);
  expect(statement.entries.map(e => money(e.amount, e.creditDebit))).toEqual(booked.map(m => m.amount_signed));
  for (const [index, movement] of booked.entries()) {
    const details = expected.movements.filter(m => m.sequence === movement.sequence && m.detail_sequence !== "0000");
    // CAMT v03–06 requires TxDtls/Amt. A sole information detail inherits
    // its aggregate's exact amount; it is not a new booked movement.
    const expectedAmounts = requiredXmlDetailAmount && !details.length ? [movement.amount_signed] : details.map(d => d.amount_signed);
    expect(statement.entries[index].details.filter(d => d.amount !== undefined).map(d => money(d.amount!, d.creditDebit!)))
      .toEqual(expectedAmounts);
  }
}

// These witnesses are derived from raw source positions, independently of the
// production validator. A rejection snapshot alone could bless a false positive.
function hasSourceDefect(source: Source, lines: string[]): boolean {
  switch (source.expected.rejection) {
    case "Must end with Record 9": return lines.at(-1)?.[0] !== "9";
    case "57 chars (expected 128)": return lines.some(l => l.length === 57);
    case "Closing accountNumber differs from opening": return source.expected.statements.some(s => {
      if (!s.closing_line) return false;
      const width = s.account_structure === "0" ? 12 : 34;
      return lines[s.opening_line - 1].slice(5, 5 + width).trim() !== lines[s.closing_line - 1].slice(4, 4 + width).trim();
    });
    case "Multiple-file flag contradicts following file": return lines.some((l, i) => l[0] === "9" && l[127] !== (i === lines.length - 1 ? "2" : "1"));
    case "Invalid OGM type101 reference/checksum": return lines.some(l => {
      const start = l.startsWith("21") ? 62 : l.startsWith("31") ? 40 : -1;
      if (start < 0 || l[start - 1] !== "1" || l.slice(start, start + 3) !== "101") return false;
      const reference = l.slice(start + 3, start + 15);
      return !/^\d{12}$/.test(reference) || Number(reference.slice(10)) !== (Number(reference.slice(0, 10)) % 97 || 97) || !!l.slice(start + 15, start === 62 ? 115 : 113).trim();
    });
    case "Invalid communicationType": return lines.some(l => l.startsWith("21") && !["0", "1"].includes(l[61]) || l.startsWith("31") && !["0", "1"].includes(l[39]));
    case "Invalid nextCode": return lines.some(l => /^[23][123]/.test(l) && !["0", "1"].includes(l[125]));
    case "Next code contradicts following record": return lines.some((l, i) => {
      const following: Record<string, string[]> = { "21": ["22", "23"], "22": ["23"], "23": [], "31": ["32"], "32": ["33"], "33": [] };
      const nextTypes = following[l.slice(0, 2)];
      return nextTypes && l[125] !== (nextTypes.includes(lines[i + 1]?.slice(0, 2)) ? "1" : "0");
    });
    case "Orphan or nonascending monetary detail": {
      let aggregate = "", previousDetail = 0;
      for (const line of lines) {
        if (line[0] === "0") { aggregate = ""; previousDetail = 0; }
        if (line.slice(0, 2) !== "21") continue;
        const detail = Number(line.slice(6, 10));
        if (!detail) { aggregate = line.slice(2, 6); previousDetail = 0; }
        else if (line.slice(2, 6) !== aggregate || detail <= previousDetail) return true;
        else previousDetail = detail;
      }
      return false;
    }
    case "Record 9 requires Record 8": return !lines.some(l => l[0] === "8");
    case 'Invalid CAMT counterparty BIC "000000000"': return !!(lines[92]?.startsWith("22") && lines[92].slice(98, 109).trim() === "000000000");
    default: return false;
  }
}

describe("reviewed third-party CODA provenance", () => {
  it("keeps unique source identities, rights, pinned bytes and the bank provenance gap explicit", () => {
    expect(manifest.retrievalPolicy).toBe("external-only");
    expect(manifest.bankPublishedCompleteOriginals).toBe(0);
    expect(manifest.cases).toHaveLength(29);
    expect(new Set(manifest.cases.map(c => c.id)).size).toBe(29);
    expect(new Set(manifest.cases.map(c => c.normalizedSha256)).size).toBe(29);
    expect(manifest.cases.filter(c => c.expected.modelValid).map(c => c.id)).toEqual(["acsone-02", "wimverstuyf-05", "wimverstuyf-06", "tryton-01"]);
    expect(manifest.cases.filter(c => c.expected.conversionValid).map(c => c.id)).toEqual(["acsone-02", "wimverstuyf-05", "wimverstuyf-06"]);
    expect(manifest.cases.filter(c => c.classification === "complete-developer-fixture")).toHaveLength(23);
    expect(manifest.factExtraction.method).toContain("no camt2coda parser/converter invoked");
    for (const source of manifest.cases) {
      expect(source.bankPublished).toBe(false);
      expect(source.storage).toBe("external-only");
      expect(source.format).toBe("CODA");
      expect(source.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      for (const pin of [source.sourceSha256, source.downloadSha256, source.normalizedSha256]) expect(pin).toMatch(/^[a-f0-9]{64}$/);
      expect(source.sourceBytes).toBeGreaterThan(0);
      expect(source.downloadBytes).toBeGreaterThan(0);
      if (!source.tarMember) expect(source.downloadBytes).toBe(source.sourceBytes);
      expect(source.url).toMatch(/^https:\/\//);
      expect(source.license.length).toBeGreaterThan(0);
      expect(source.licenseUrl).toMatch(/^https:\/\//);
      expect(source.rightsNote).toContain("no bank-specific authorship");
      if (source.tarMember) expect(source.url).toMatch(/^https:\/\/files\.pythonhosted\.org\/packages\/.*\.tar\.gz$/);
      else expect(source.url).toMatch(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[a-f0-9]{40}\//);
      expect(source.expected.rejection === null).toBe(source.expected.conversionValid);
      if (source.expected.modelValid) {
        const outputs = source.expected.outputVersions!;
        const versions = [...outputs.schemaValid, ...outputs.rejections.flatMap(r => r.versions)];
        expect(versions.sort()).toEqual(Array.from({ length: 12 }, (_, i) => String(i + 2).padStart(2, "0")));
        expect(outputs.schemaValid.length > 0).toBe(source.expected.conversionValid);
      }
    }
  });
  it("records both official Belgian leads and unavailable or generated examples without promoting them to bank originals", () => {
    expect(research.verifiedOn).toBe(manifest.verifiedOn);
    expect(research.leads.map(l => l.publisher)).toEqual(expect.arrayContaining(["Belfius", "KBC", "BNP Paribas Fortis", "ING", "Crelan", "Argenta", "Beobank", "Banque Van Breda", "Febelfin", "Odoo", "Codabox"]));
    expect(research.leads.some(l => l.kind === "false-positive-csv-template")).toBe(true);
    expect(research.leads.some(l => l.kind === "synthetic-vendor-example-not-acquired")).toBe(true);
  });
});

// Ordinary offline tests check metadata. Required CI enables every case and
// readFileSync makes a missing original an error, never a silent skip.
describe.skipIf(!required)("original third-party CODA corpus", () => {
  for (const source of manifest.cases) {
    describe(source.id, () => {
      const original = () => {
        const bytes = readFileSync(resolve(directory, source.id + ".cod"));
        expect(bytes.length).toBe(source.sourceBytes);
        expect(hash(bytes)).toBe(source.sourceSha256);
        return new TextDecoder(source.encoding, { fatal: true }).decode(bytes);
      };
      it("preserves original bytes and the publisher's character widths, encoding and record counts", () => {
        const content = original();
        const lines = content.replace(/\r\n?/g, "\n").split("\n");
        if (lines.at(-1) === "") lines.pop();
        expect(hash(lines.join("\n"))).toBe(source.normalizedSha256);
        expect(lines).toHaveLength(source.lineCount);
        const widths: Record<string, number> = {}, records: Record<string, number> = {};
        for (const line of lines) {
          widths[line.length] = (widths[line.length] ?? 0) + 1;
          const record = /^[23]/.test(line) ? line.slice(0, 2) : line[0];
          records[record] = (records[record] ?? 0) + 1;
        }
        expect(widths).toEqual(source.characterWidths);
        expect(records).toEqual(source.recordCounts);
        expect(content.includes("\r\n")).toBe(source.lineEnding === "CRLF");
      });
      it("matches independently extracted literal account, balance and movement fields or rejects malformed width", () => {
        const content = original();
        if (!source.expected.parserValid) {
          expect(() => parseCoda(content)).toThrow(source.expected.rejection!);
          return;
        }
        const parsed = parseCoda(content);
        expect(parsed).toHaveLength(source.lineCount);
        for (const statement of source.expected.statements) {
          const opening = parsed[statement.opening_line - 1];
          expect(field(opening, "accountNumber")?.trim()).toBe(statement.account);
          expect(field(opening, "currency")).toBe(statement.currency);
          expect(field(opening, "accountStructure")).toBe(statement.account_structure);
          expect(field(opening, "balanceSign")).toBe(statement.opening_balance_sign_raw);
          expect(field(opening, "balanceAmount")).toBe(statement.opening_balance_amount_raw);
          if (statement.closing_line) {
            const closing = parsed[statement.closing_line - 1];
            expect(field(closing, "balanceSign")).toBe(statement.closing_balance_sign_raw);
            expect(field(closing, "balanceAmount")).toBe(statement.closing_balance_amount_raw);
            expect(closing.raw.slice(4, 41)).toBe(statement.closing_account_zone_raw);
          }
          expect(statement.movements).toHaveLength(statement.record21_count);
          for (const movement of statement.movements) {
            const line = parsed[movement.line - 1];
            expect(line.recordType).toBe("2.1");
            expect(field(line, "sequenceNumber")).toBe(movement.sequence);
            expect(field(line, "detailNumber")).toBe(movement.detail_sequence);
            expect(field(line, "amountSign")).toBe(movement.sign_raw);
            expect(field(line, "amount")).toBe(movement.amount_raw);
          }
        }
      });
      if (!source.expected.conversionValid) {
        it("rejects the documented defect and independently demonstrates it in the unchanged source", () => {
          const content = original();
          const lines = content.replace(/\r\n?/g, "\n").split("\n").filter(Boolean);
          expect(hasSourceDefect(source, lines), source.expected.rejection ?? "Missing negative expectation").toBe(true);
          expect(() => codaToCamt(content)).toThrow(source.expected.rejection!);
        });
      }
      if (source.expected.modelValid) {
        it("reconstructs independently verified account, balance, booked and detailed movement facts", () => {
          checkStatement(codaToStatement(parseCoda(original())), source.expected.statements[0]);
        });
        for (const version of Array.from({ length: 12 }, (_, index) => String(index + 2).padStart(2, "0"))) {
          const schema = `camt.053.001.${version}`;
          const rejection = source.expected.outputVersions!.rejections.find(r => r.versions.includes(version))?.reason;
          const title = rejection ? `explicitly rejects the documented source/representation limitation for ${schema}` : `converts valid source to schema-valid ${schema}, preserving booked and monetary detail amounts`;
          it(title, () => {
            const content = original();
            if (source.id === "tryton-01") {
              // CODA source line93, record2.2 positions99–109: published
              // counterparty placeholder, not a valid ISO20022 BIC/BICFI.
              expect(content.split(/\r\n?|\n/)[92].slice(98, 109).trim()).toBe("000000000");
              if (version === "02") {
                const movements = source.expected.statements[0].movements;
                expect(movements.some(detail => detail.detail_sequence !== "0000" && movements.some(aggregate => aggregate.sequence === detail.sequence && aggregate.detail_sequence === "0000" && aggregate.sign_raw !== detail.sign_raw))).toBe(true);
              }
            }
            if (rejection) {
              if (rejection.includes("requires an amount for each transaction detail")) {
                const raw = content.split(/\r\n?|\n/);
                // Aggregate summary communication/reference plus separately
                // numbered monetary details cannot all supply independent amounts.
                expect(source.expected.statements.some(s => s.movements.some(aggregate => {
                  if (aggregate.detail_sequence !== "0000" || !s.movements.some(d => d.sequence === aggregate.sequence && d.detail_sequence !== "0000")) return false;
                  return !!raw[aggregate.line - 1].slice(62, 115).trim() || raw.some(line => line.startsWith(`22${aggregate.sequence}0000`) && !!line.slice(63, 98).trim());
                }))).toBe(true);
              }
              expect(() => codaToCamt(content, schema)).toThrow(rejection);
              return;
            }
            const result = codaToCamt(content, schema);
            expect(result.validation.valid).toBe(true);
            expect(result.statements).toHaveLength(source.expected.statements.length);
            result.statements.forEach((s, i) => checkStatement(s, source.expected.statements[i]));
            const xsd = spawnSync("xmllint", ["--nonet", "--noout", "--schema", resolve(`specifications/CAMT/${schema}.xsd`), "-"], { input: result.xml, encoding: "utf8" });
            expect(xsd.error).toBeUndefined();
            expect(xsd.status, xsd.stderr).toBe(0);
            const reparsed = parseCamt(result.xml);
            expect(reparsed).toHaveLength(source.expected.statements.length);
            reparsed.forEach((s, i) => checkStatement(s, source.expected.statements[i], Number(version) >= 3 && Number(version) <= 6));
          });
        }
      }
    });
  }
});
