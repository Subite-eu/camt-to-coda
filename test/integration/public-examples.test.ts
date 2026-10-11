import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { parseCamt } from "../../src/core/camt-parser.js";
import { parseCoda } from "../../src/core/coda-parser.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { statementToXml, statementsToXml } from "../../src/core/camt-writer.js";
import { validateCamt } from "../../src/validation/camt-validator.js";
import { validateCoda } from "../../src/validation/coda-validator.js";
import type { CamtStatement } from "../../src/core/model.js";

interface ExpectedStatement {
  account: string; currency: string; opening: number; closing: number;
  amounts: number[]; signs: string[]; transactionCodes?: string[];
  openingSign?: string; closingSign?: string; detailCount?: number;
  reason?: string; reversal?: boolean; purpose?: string;
  detailAmounts?: number[]; detailBankReferences?: string[];
  detailSigns?: string[]; detailCounterparties?: string[]; detailReasons?: (string | null)[];
  remittance?: string; structuredReference?: string; counterparty?: string; endToEndId?: string;
}
interface Example {
  id: string; format: "camt" | "coda"; path: string; valid: boolean;
  schema?: string; features: string[]; expected: ExpectedStatement[];
}
const libraryPath = resolve("examples/manifest.json");

describe("required public original-source example library", () => {
  it("is committed and covers both source formats and all advertised CAMT versions", () => {
    const library = JSON.parse(readFileSync(libraryPath, "utf8")) as { cases: Example[] };
    expect(library.cases.some((c) => c.format === "coda" && c.valid)).toBe(true);
    for (const type of ["052", "053"]) for (let version = 2; version <= 13; version++) {
      expect(library.cases.some((c) => c.schema === `camt.${type}.001.${String(version).padStart(2, "0")}` && c.valid)).toBe(true);
    }
  });
});

function checkStatement(actual: CamtStatement, expected: ExpectedStatement) {
  expect(actual.account.iban ?? actual.account.otherId).toBe(expected.account);
  expect(actual.account.currency).toBe(expected.currency);
  expect(actual.openingBalance.amount).toBe(expected.opening);
  expect(actual.closingBalance.amount).toBe(expected.closing);
  expect(actual.openingBalance.creditDebit).toBe(expected.openingSign ?? "CRDT");
  expect(actual.closingBalance.creditDebit).toBe(expected.closingSign ?? "CRDT");
  expect(actual.entries.map((e) => e.amount)).toEqual(expected.amounts);
  expect(actual.entries.map((e) => e.creditDebit)).toEqual(expected.signs);
  if (expected.transactionCodes) {
    const movements = statementToCoda(actual).lines.filter(l => l.recordType === "2.1" && l.fields.find(f => f.name === "detailNumber")?.value === "0000");
    expect(movements.map(l => l.fields.find(f => f.name === "transactionCode")?.value)).toEqual(expected.transactionCodes);
  }
  const details = actual.entries.flatMap((e) => e.details);
  const monetary = details.filter(d => d.amount !== undefined);
  if (expected.detailSigns) expect(monetary.map(d => d.creditDebit)).toEqual(expected.detailSigns);
  if (expected.detailCounterparties) expect(monetary.map(d => d.counterparty?.name)).toEqual(expected.detailCounterparties);
  if (expected.detailReasons) expect(monetary.map(d => d.returnInfo?.reasonCode ?? null)).toEqual(expected.detailReasons);
  if (expected.detailAmounts) expect(details.flatMap(d => d.amount !== undefined ? [d.amount] : [])).toEqual(expected.detailAmounts);
  if (expected.detailBankReferences) expect(details.flatMap(d => d.refs?.accountServicerRef ? [d.refs.accountServicerRef] : [])).toEqual(expected.detailBankReferences);
  if (expected.detailCount !== undefined) expect(details).toHaveLength(expected.detailCount);
  if (expected.reason) expect(actual.entries.some(e => e.returnInfo?.reasonCode === expected.reason)).toBe(true);
  if (expected.reversal !== undefined) expect(actual.entries.some(e => e.returnInfo?.isReversal === expected.reversal)).toBe(true);
  if (expected.purpose) expect(details.some(d => d.purpose === expected.purpose)).toBe(true);
  if (expected.remittance) expect(details.some((d) => d.remittanceInfo?.unstructured === expected.remittance)).toBe(true);
  if (expected.structuredReference) expect(details.some((d) => d.remittanceInfo?.structured?.creditorRef === expected.structuredReference)).toBe(true);
  if (expected.counterparty) expect(details.some((d) => d.counterparty?.name === expected.counterparty)).toBe(true);
  if (expected.endToEndId) expect(details.some((d) => d.refs?.endToEndId === expected.endToEndId)).toBe(true);
}

function schemaCheck(xml: string, schema: string) {
  execFileSync("xmllint", ["--nonet", "--noout", "--schema", resolve(`specifications/CAMT/${schema}.xsd`), "-"], {
    input: xml, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
  });
}

// Missing manifests are a failing requirement above, never an optional suite skip.
let cases: Example[] = [];
try { cases = JSON.parse(readFileSync(libraryPath, "utf8")).cases; } catch { /* explicit test above reports this */ }
for (const example of cases) {
  describe(example.id, () => {
    const source = readFileSync(resolve("examples", example.path), "utf8");
    if (!example.valid) {
      it("rejects the intentionally invalid original input", () => {
        let rejected = false;
        try {
          if (example.format === "camt") rejected = parseCamt(source).some((s) => !validateCamt(s).valid);
          else rejected = !validateCoda(parseCoda(source)).valid;
        } catch { rejected = true; }
        expect(rejected).toBe(true);
      });
      return;
    }
    if (example.format === "camt") {
      it("validates the original CAMT source against its independent XSD", () => schemaCheck(source, example.schema!));
    }
    it("preserves the literal independently specified statement values", () => {
      const statements = example.format === "camt" ? parseCamt(source) : (codaToCamt(source) as ReturnType<typeof codaToCamt> & { statements: CamtStatement[] }).statements;
      expect(statements).toHaveLength(example.expected.length);
      statements.forEach((s, i) => checkStatement(s, example.expected[i]));
    });
    it("preserves representable money, parties and communications through a full round trip", () => {
      const statements = example.format === "camt" ? parseCamt(source) : (codaToCamt(source) as ReturnType<typeof codaToCamt> & { statements: CamtStatement[] }).statements;
      for (const [i, statement] of statements.entries()) {
        const forward = statementToCoda(statement);
        expect(validateCoda(forward.lines).errors).toEqual([]);
        expect(forward.lines.every((l) => l.raw.length === 128)).toBe(true);
        const reverse = codaToCamt(forward.lines.map((l) => l.raw).join("\n"));
        schemaCheck(reverse.xml, "camt.053.001.08");
        checkStatement(parseCamt(reverse.xml)[0], example.expected[i]);
      }
    });
  });
}

describe("generated output version matrix", () => {
  for (let version = 2; version <= 13; version++) {
    const schema = `camt.053.001.${String(version).padStart(2, "0")}`;
    it(`generates schema-conformant ${schema} from independently authored CODA`, () => {
      const example = cases.find((c) => c.id === "coda-basic-eur");
      expect(example).toBeDefined();
      const source = readFileSync(resolve("examples", example!.path), "utf8");
      const statement = codaToCamt(source).statement;
      const xml = statementToXml(statement, schema);
      schemaCheck(xml, schema);
      checkStatement(parseCamt(xml)[0], example!.expected[0]);
    });
  }
});


describe("every valid original CODA across every reverse XML schema", () => {
  for (const example of cases.filter(c => c.valid && c.format === "coda")) {
    for (let version = 2; version <= 13; version++) {
      const schema = `camt.053.001.${String(version).padStart(2, "0")}`;
      it(`${example.id} → ${schema} preserves values or explicitly rejects unrepresentable detail amounts`, () => {
        const statements = codaToCamt(readFileSync(resolve("examples", example.path), "utf8")).statements;
        const unsupportedDetails = version >= 3 && version <= 6 && statements.some(s => s.entries.some(e => e.details.length > 1 && e.details.some(d => d.amount === undefined)));
        if (unsupportedDetails) {
          expect(() => statementsToXml(statements, schema)).toThrow(/requires an amount for each transaction detail/);
          return;
        }
        const xml = statementsToXml(statements, schema);
        schemaCheck(xml, schema);
        const reparsed = parseCamt(xml);
        expect(reparsed).toHaveLength(example.expected.length);
        reparsed.forEach((s,i) => checkStatement(s, example.expected[i]));
      });
    }
  }
});
