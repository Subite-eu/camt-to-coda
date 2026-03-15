import { describe, it, expect } from "vitest";
import { padRight, padLeft, formatBalance, formatDate } from "../src/core/coda-writer.js";
import { parseCamt } from "../src/core/camt-parser.js";
import { statementToCoda } from "../src/core/coda-writer.js";
import { mapTransactionCode } from "../src/core/transaction-codes.js";

describe("formatBalance", () => {
  it("formats zero", () => expect(formatBalance(0)).toBe("000000000000000"));
  it("formats integer", () => expect(formatBalance(1000)).toBe("000000001000000"));
  it("formats decimals", () => expect(formatBalance(123.45)).toBe("000000000123450"));
  it("formats large amount", () => expect(formatBalance(999999999999.999)).toBe("999999999999999"));
  it("always 15 chars", () => {
    for (const n of [0, 0.01, 1, 99.99, 1000000, 123456789.123]) {
      expect(formatBalance(n)).toHaveLength(15);
    }
  });
});

describe("formatDate", () => {
  it("formats ISO date", () => expect(formatDate("2024-03-07")).toBe("070324"));
  it("formats datetime", () => expect(formatDate("2024-11-30T23:59:59Z")).toBe("301124"));
  it("handles empty", () => expect(formatDate("")).toBe("000000"));
});

describe("padding", () => {
  it("padRight", () => {
    expect(padRight("AB", 5)).toBe("AB   ");
    expect(padRight("ABCDEF", 3)).toBe("ABC");
  });
  it("padLeft", () => {
    expect(padLeft("1", 4, "0")).toBe("0001");
    expect(padLeft("12345", 3, "0")).toBe("123");
  });
});

describe("transaction codes", () => {
  it("maps SEPA credit transfer", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ESCT")).toBe("04500001"));
  it("maps card payment (wildcard)", () =>
    expect(mapTransactionCode("PMNT", "CCRD", "ANYTHING")).toBe("04370000"));
  it("returns spaces for unknown", () =>
    expect(mapTransactionCode("XXXX", "YYYY", "ZZZZ")).toBe("        "));
  it("returns spaces for missing", () =>
    expect(mapTransactionCode()).toBe("        "));
});

describe("full conversion", () => {
  const SAMPLE_053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>TEST-MSG</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-001</Id>
      <CreDtTm>2024-06-15T12:00:00Z</CreDtTm>
      <Acct>
        <Id><IBAN>BE68793230773034</IBAN></Id>
        <Ccy>EUR</Ccy>
        <Ownr><Nm>Test Corp</Nm></Ownr>
        <Svcr><FinInstnId><BIC>TESTBE20</BIC></FinInstnId></Svcr>
      </Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">5000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">6000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">1000</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-06-15</Dt></BookgDt>
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>E2E-TEST-001</EndToEndId><TxId>TX001</TxId></Refs>
          <RltdPties>
            <Dbtr><Nm>Sender Corp</Nm></Dbtr>
            <DbtrAcct><Id><IBAN>BE91516952884376</IBAN></Id></DbtrAcct>
          </RltdPties>
          <RltdAgts><DbtrAgt><FinInstnId><BIC>SNDRBEBB</BIC></FinInstnId></DbtrAgt></RltdAgts>
          <RmtInf><Ustrd>Invoice payment 2024-001</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

  it("produces valid 128-char lines", () => {
    const stmts = parseCamt(SAMPLE_053);
    const result = statementToCoda(stmts[0]);
    expect(result.validation.valid).toBe(true);
    for (const line of result.lines) {
      expect(line).toHaveLength(128);
    }
  });

  it("produces correct record types", () => {
    const stmts = parseCamt(SAMPLE_053);
    const result = statementToCoda(stmts[0]);
    expect(result.lines[0][0]).toBe("0"); // header
    expect(result.lines[1][0]).toBe("1"); // opening balance
    expect(result.lines[2][0]).toBe("2"); // movement 2.1
    expect(result.lines[3][0]).toBe("2"); // movement 2.2
    expect(result.lines[4][0]).toBe("2"); // movement 2.3
    expect(result.lines[5][0]).toBe("8"); // closing balance
    expect(result.lines[6][0]).toBe("9"); // trailer
  });

  it("maps transaction code correctly", () => {
    const stmts = parseCamt(SAMPLE_053);
    const result = statementToCoda(stmts[0]);
    const rec21 = result.lines[2];
    expect(rec21.slice(53, 61)).toBe("04500001"); // PMNT/RCDT/ESCT
  });

  it("includes counterparty BIC in record 2.2", () => {
    const stmts = parseCamt(SAMPLE_053);
    const result = statementToCoda(stmts[0]);
    const rec22 = result.lines[3];
    expect(rec22.slice(98, 106)).toContain("SNDRBEBB");
  });

  it("includes counterparty IBAN in record 2.3", () => {
    const stmts = parseCamt(SAMPLE_053);
    const result = statementToCoda(stmts[0]);
    const rec23 = result.lines[4];
    expect(rec23.slice(10, 26)).toContain("BE91516952884376");
  });

  it("empty statement produces 4 records (0, 1, 8, 9)", () => {
    const xml = SAMPLE_053.replace(/<Ntry>[\s\S]*<\/Ntry>/, "");
    const stmts = parseCamt(xml);
    const result = statementToCoda(stmts[0]);
    expect(result.lines).toHaveLength(4);
    expect(result.lines.map((l) => l[0])).toEqual(["0", "1", "8", "9"]);
  });
});
