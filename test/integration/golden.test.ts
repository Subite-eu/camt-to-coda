import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { parseCoda } from "../../src/core/coda-parser.js";
import { codaToStatement } from "../../src/core/coda-to-statement.js";
import { codaToCamt } from "../../src/core/reverse.js";
import type { CodaLine } from "../../src/core/field-defs/types.js";

// Golden cross-validation against a REAL Belgian CAMT/CODA pair for the same
// statement. The pair lives under specifications/private-examples/ which is
// gitignored (real account data) -- these tests skip when it is absent, so CI
// and other checkouts stay green.
const DIR = join(process.cwd(), "specifications/private-examples");
const BASE = "coda_BE21737051687303_EUR_2026_03_16_44_44";
const xmlPath = join(DIR, `${BASE}.xml`);
const codPath = join(DIR, `${BASE}.cod`);
const havePair = existsSync(xmlPath) && existsSync(codPath);

function field(line: CodaLine | undefined, name: string): string {
  return (line?.fields.find((f) => f.name === name)?.value ?? "").trim();
}
function firstOfType(lines: CodaLine[], type: string): CodaLine | undefined {
  return lines.find((l) => l.recordType === type);
}
function allOfType(lines: CodaLine[], type: string): CodaLine[] {
  return lines.filter((l) => l.recordType === type);
}

describe.skipIf(!havePair)("golden: real CAMT/CODA pair (private-examples)", () => {
  const realCod = havePair ? parseCoda(readFileSync(codPath, "utf-8")) : [];
  const camtXml = havePair ? readFileSync(xmlPath, "utf-8") : "";

  it("forward CAMT->CODA reproduces the real .cod balances, amounts, signs and transaction codes", () => {
    const stmt = parseCamt(camtXml)[0];
    const result = statementToCoda(stmt);
    const gen = result.lines;

    // every generated line is exactly 128 chars and the file balances
    expect(gen.every((l) => l.raw.length === 128)).toBe(true);
    expect(result.validation.warnings.filter((w) => /balance/i.test(w))).toHaveLength(0);

    // Record 1 / 8 balances match the real file
    expect(field(firstOfType(gen, "1"), "balanceAmount")).toBe(field(firstOfType(realCod, "1"), "balanceAmount"));
    expect(field(firstOfType(gen, "1"), "balanceSign")).toBe(field(firstOfType(realCod, "1"), "balanceSign"));
    expect(field(firstOfType(gen, "8"), "balanceAmount")).toBe(field(firstOfType(realCod, "8"), "balanceAmount"));

    // Record 2.1 movements: amount and sign match the real file.
    const genMov = allOfType(gen, "2.1");
    const realMov = allOfType(realCod, "2.1");
    expect(genMov).toHaveLength(realMov.length);
    for (let i = 0; i < realMov.length; i++) {
      expect(field(genMov[i], "amount")).toBe(field(realMov[i], "amount"));
      expect(field(genMov[i], "amountSign")).toBe(field(realMov[i], "amountSign"));
    }

    // Documented limitation: this real CAMT carries NO BkTxCd, so the converter
    // cannot derive the CODA transaction code (the bank set 00150000/00101000
    // from its own systems). The generated code is therefore blank. The
    // ISO<->CODA code mapping itself is validated by the round-trip test below.
    expect(field(genMov[0], "transactionCode")).toBe("");
    expect(field(realMov[0], "transactionCode")).toBe("00150000");
  });

  it("reverse: real .cod -> statement preserves balances and movements", () => {
    const stmt = codaToStatement(realCod);
    expect(stmt.openingBalance.amount).toBeCloseTo(23005.04, 3);
    expect(stmt.closingBalance.amount).toBeCloseTo(39679.56, 3);
    expect(stmt.entries).toHaveLength(2);
    expect(stmt.entries[0]).toMatchObject({ amount: 19000, creditDebit: "CRDT" });
    expect(stmt.entries[1]).toMatchObject({ amount: 2325.48, creditDebit: "DBIT" });
  });

  it("round-trip CODA->CAMT->CODA preserves the money and reconciles", () => {
    const realCodText = readFileSync(codPath, "utf-8");
    const { xml } = codaToCamt(realCodText);          // CODA -> CAMT
    const stmt = parseCamt(xml)[0];                    // CAMT -> model
    const result = statementToCoda(stmt);              // model -> CODA

    expect(result.validation.warnings.filter((w) => /balance/i.test(w))).toHaveLength(0);
    expect(field(firstOfType(result.lines, "1"), "balanceAmount")).toBe(field(firstOfType(realCod, "1"), "balanceAmount"));
    expect(field(firstOfType(result.lines, "8"), "balanceAmount")).toBe(field(firstOfType(realCod, "8"), "balanceAmount"));
    const genMov = allOfType(result.lines, "2.1");
    expect(genMov).toHaveLength(2);
    expect(genMov.map((l) => field(l, "amount"))).toEqual(
      allOfType(realCod, "2.1").map((l) => field(l, "amount"))
    );
  });
});
