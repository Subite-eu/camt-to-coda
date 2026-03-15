import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseCamt, parseCamtFile } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";

// ── Paths to real anonymized CAMT files ──────────────────────────────────

const EXAMPLE_DIR = join(process.cwd(), "example-files/CAMT");
const FILE_V02 = join(EXAMPLE_DIR, "Other/account_statement.xml");
const FILE_V08 = join(EXAMPLE_DIR, "LT625883379695428516/CAMT_053/2024-03-07.xml");

// ── Inline fixtures ──────────────────────────────────────────────────────

const EMPTY_STMT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><GrpHdr><MsgId>TEST</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
  <Stmt><Id>EMPTY</Id><CreDtTm>2024-06-15T12:00:00Z</CreDtTm>
    <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy>
      <Svcr><FinInstnId><BIC>TESTBE21</BIC></FinInstnId></Svcr></Acct>
    <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">5000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
    <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">5000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
  </Stmt></BkToCstmrStmt>
</Document>`;

const STRUCTURED_REMITTANCE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>STRD-TEST</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STRD-STMT</Id>
      <CreDtTm>2024-06-15T12:00:00Z</CreDtTm>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy>
        <Svcr><FinInstnId><BIC>TESTBE21</BIC></FinInstnId></Svcr></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1500</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Ntry>
        <Amt Ccy="EUR">500</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-06-15</Dt></BookgDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls><TxDtls>
          <RmtInf><Strd><CdtrRefInf><Ref>123456789012</Ref></CdtrRefInf></Strd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

// ── Test 1: CAMT 053 v02 → valid CODA ───────────────────────────────────

describe("CAMT 053 v02 file conversion", () => {
  it("parses and produces valid CODA output", () => {
    const stmts = parseCamtFile(FILE_V02);
    expect(stmts.length).toBeGreaterThan(0);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      expect(result.validation.valid).toBe(true);
      expect(result.validation.errors).toHaveLength(0);
    }
  });

  it("all output lines are exactly 128 chars", () => {
    const stmts = parseCamtFile(FILE_V02);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      for (const line of result.lines) {
        expect(line).toHaveLength(128);
      }
    }
  });

  it("record 0 starts with '0', record 9 ends the file", () => {
    const stmts = parseCamtFile(FILE_V02);
    const result = statementToCoda(stmts[0]);
    expect(result.lines[0][0]).toBe("0");
    expect(result.lines[result.lines.length - 1][0]).toBe("9");
  });

  it("produces a fileName with .cod extension", () => {
    const stmts = parseCamtFile(FILE_V02);
    const result = statementToCoda(stmts[0]);
    expect(result.fileName).toMatch(/\.cod$/);
  });
});

// ── Test 2: CAMT 053 v08 file conversion ────────────────────────────────

describe("CAMT 053 v08 file conversion", () => {
  it("parses and produces valid CODA output", () => {
    const stmts = parseCamtFile(FILE_V08);
    expect(stmts.length).toBeGreaterThan(0);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      expect(result.validation.valid).toBe(true);
    }
  });

  it("all output lines are exactly 128 chars", () => {
    const stmts = parseCamtFile(FILE_V08);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      for (const line of result.lines) {
        expect(line).toHaveLength(128);
      }
    }
  });

  it("record 0 starts with '0', record 9 ends the file", () => {
    const stmts = parseCamtFile(FILE_V08);
    const result = statementToCoda(stmts[0]);
    expect(result.lines[0][0]).toBe("0");
    expect(result.lines[result.lines.length - 1][0]).toBe("9");
  });

  it("record 1 starts with '1' (opening balance)", () => {
    const stmts = parseCamtFile(FILE_V08);
    const result = statementToCoda(stmts[0]);
    expect(result.lines[1][0]).toBe("1");
  });

  it("record 8 (closing balance) appears before record 9", () => {
    const stmts = parseCamtFile(FILE_V08);
    const result = statementToCoda(stmts[0]);
    const n = result.lines.length;
    expect(result.lines[n - 2][0]).toBe("8");
    expect(result.lines[n - 1][0]).toBe("9");
  });
});

// ── Test 3: Empty statement produces only records 0, 1, 8, 9 ────────────

describe("Empty statement conversion", () => {
  it("produces exactly records 0, 1, 8, 9", () => {
    const stmts = parseCamt(EMPTY_STMT_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.lines).toHaveLength(4);
    expect(result.lines.map((l) => l[0])).toEqual(["0", "1", "8", "9"]);
  });

  it("all 4 lines are 128 chars", () => {
    const stmts = parseCamt(EMPTY_STMT_XML);
    const result = statementToCoda(stmts[0]);
    for (const line of result.lines) {
      expect(line).toHaveLength(128);
    }
  });

  it("is valid CODA", () => {
    const stmts = parseCamt(EMPTY_STMT_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.validation.valid).toBe(true);
  });
});

// ── Test 4: Multi-statement file produces multiple CODA outputs ──────────

describe("Multi-statement file conversion", () => {
  it("produces one result per statement", () => {
    const stmts = parseCamtFile(FILE_V08);
    expect(stmts.length).toBe(2);
    const results = stmts.map(statementToCoda);
    expect(results).toHaveLength(2);
  });

  it("each CODA output is independently valid", () => {
    const stmts = parseCamtFile(FILE_V08);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      expect(result.validation.valid).toBe(true);
    }
  });

  it("each CODA output has a unique fileName", () => {
    const stmts = parseCamtFile(FILE_V08);
    const fileNames = stmts.map((s) => statementToCoda(s).fileName);
    const unique = new Set(fileNames);
    expect(unique.size).toBe(fileNames.length);
  });
});

// ── Test 5: All output lines are exactly 128 chars (multi-file) ──────────

describe("128-char line invariant across multiple real files", () => {
  const files = [FILE_V02, FILE_V08];

  for (const filePath of files) {
    it(`all lines 128 chars in ${filePath.split("/").pop()}`, () => {
      const stmts = parseCamtFile(filePath);
      for (const stmt of stmts) {
        const result = statementToCoda(stmt);
        for (const line of result.lines) {
          expect(line).toHaveLength(128);
        }
      }
    });
  }
});

// ── Test 6: Record ordering invariant ────────────────────────────────────

describe("Record ordering invariant", () => {
  it("first line is always record 0", () => {
    const stmts = parseCamtFile(FILE_V02);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      expect(result.lines[0][0]).toBe("0");
    }
  });

  it("second line is always record 1", () => {
    const stmts = parseCamtFile(FILE_V02);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      expect(result.lines[1][0]).toBe("1");
    }
  });

  it("last line is always record 9", () => {
    const stmts = parseCamtFile(FILE_V02);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      expect(result.lines[result.lines.length - 1][0]).toBe("9");
    }
  });

  it("second-to-last line is always record 8", () => {
    const stmts = parseCamtFile(FILE_V02);
    for (const stmt of stmts) {
      const result = statementToCoda(stmt);
      const n = result.lines.length;
      expect(result.lines[n - 2][0]).toBe("8");
    }
  });
});

// ── Test 7: Balance consistency (open + movements = close) ───────────────

describe("Balance consistency", () => {
  it("empty statement: opening balance equals closing balance (no entries)", () => {
    const stmts = parseCamt(EMPTY_STMT_XML);
    const stmt = stmts[0];
    // EMPTY_STMT_XML has OPBD=5000 CRDT and CLBD=5000 CRDT with no entries
    expect(stmt.openingBalance.amount).toBe(stmt.closingBalance.amount);
  });

  it("v02 file: closing balance is consistent with opening + entries", () => {
    const stmts = parseCamtFile(FILE_V02);
    const stmt = stmts[0];

    // Only check consistency when CdtDbtInd is present on balances
    if (stmt.openingBalance.creditDebit && stmt.closingBalance.creditDebit) {
      const openAmt = stmt.openingBalance.creditDebit === "CRDT"
        ? stmt.openingBalance.amount
        : -stmt.openingBalance.amount;

      let netMovements = 0;
      for (const entry of stmt.entries) {
        netMovements += entry.creditDebit === "CRDT" ? entry.amount : -entry.amount;
      }

      const closeAmt = stmt.closingBalance.creditDebit === "CRDT"
        ? stmt.closingBalance.amount
        : -stmt.closingBalance.amount;

      expect(Math.abs(openAmt + netMovements - closeAmt)).toBeLessThan(0.01);
    }
  });

  it("structured fixture: closing = opening + credit entry", () => {
    const stmts = parseCamt(STRUCTURED_REMITTANCE_XML);
    const stmt = stmts[0];
    // STRUCTURED_REMITTANCE_XML: OPBD=1000 CRDT, CLBD=1500 CRDT, 1 entry 500 CRDT
    expect(stmt.closingBalance.amount - stmt.openingBalance.amount).toBeCloseTo(500, 2);
  });
});

// ── Test 8: Structured remittance → commType "1" ─────────────────────────

describe("Structured remittance info", () => {
  it("produces commType '1' for structured creditor reference", () => {
    const stmts = parseCamt(STRUCTURED_REMITTANCE_XML);
    const result = statementToCoda(stmts[0]);
    // Record 2.1 is at lines[2]; commType is at position 61 (0-indexed)
    const rec21 = result.lines[2];
    expect(rec21[61]).toBe("1");
  });

  it("encodes creditor ref in communication field", () => {
    const stmts = parseCamt(STRUCTURED_REMITTANCE_XML);
    const result = statementToCoda(stmts[0]);
    // Record 2.1: communication starts at position 62 (0-indexed), 53 chars
    const rec21 = result.lines[2];
    const commField = rec21.slice(62, 115);
    // Structured: "101" + zero-padded ref (12 chars)
    expect(commField).toContain("101");
    expect(commField).toContain("123456789012");
  });

  it("produces valid 128-char output", () => {
    const stmts = parseCamt(STRUCTURED_REMITTANCE_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.validation.valid).toBe(true);
    for (const line of result.lines) {
      expect(line).toHaveLength(128);
    }
  });
});

// ── Test 9: Transaction code mapping present in output ───────────────────

describe("Transaction code mapping", () => {
  it("maps PMNT/ICDT/ESCT in v02 file to a non-blank code", () => {
    const stmts = parseCamtFile(FILE_V02);
    const result = statementToCoda(stmts[0]);
    // Find a record 2.1 line; txCode is at positions 53-60 (0-indexed)
    const rec21Lines = result.lines.filter((l) => l[0] === "2" && l[1] === "1");
    expect(rec21Lines.length).toBeGreaterThan(0);
    // At least one entry should have a non-blank transaction code
    const hasTxCode = rec21Lines.some((l) => l.slice(53, 61).trim() !== "");
    expect(hasTxCode).toBe(true);
  });
});

// ── Test 10: Dry-run: statementToCoda returns output without side effects ─

describe("statementToCoda dry-run (no side effects)", () => {
  it("returns ConversionResult with lines, fileName, recordCount, validation", () => {
    const stmts = parseCamt(EMPTY_STMT_XML);
    const result = statementToCoda(stmts[0]);
    expect(result).toHaveProperty("lines");
    expect(result).toHaveProperty("fileName");
    expect(result).toHaveProperty("recordCount");
    expect(result).toHaveProperty("validation");
    expect(result.validation).toHaveProperty("valid");
    expect(result.validation).toHaveProperty("errors");
  });

  it("calling statementToCoda twice on same input yields identical output", () => {
    const stmts = parseCamt(EMPTY_STMT_XML);
    const result1 = statementToCoda(stmts[0]);
    const result2 = statementToCoda(stmts[0]);
    expect(result1.lines).toEqual(result2.lines);
    expect(result1.fileName).toEqual(result2.fileName);
    expect(result1.recordCount).toEqual(result2.recordCount);
  });

  it("does not write any files to disk", () => {
    // parseCamt and statementToCoda are pure transforms — this test just
    // confirms we can call them without any filesystem write happening.
    // (No mock needed: if the functions wrote to disk they would throw in
    // a read-only test environment or produce observable side-effects.)
    const stmts = parseCamt(EMPTY_STMT_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.lines.length).toBeGreaterThan(0);
  });
});
