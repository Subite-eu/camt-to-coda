import { describe, it, expect } from "vitest";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToXml } from "../../src/core/camt-writer.js";
import { codaToStatement } from "../../src/core/coda-to-statement.js";
import { parseCoda } from "../../src/core/coda-parser.js";
import { isSddReasonCode, SDD_REASON_CODES } from "../../src/core/sdd-reason-codes.js";
import type { CamtStatement, CamtEntry } from "../../src/core/model.js";
import type { CodaLine } from "../../src/core/field-defs/types.js";

function field(line: CodaLine | undefined, name: string): string {
  return (line?.fields.find((f) => f.name === name)?.value ?? "").trim();
}
function rec(lines: CodaLine[], type: string): CodaLine | undefined {
  return lines.find((l) => l.recordType === type);
}

function stmtWith(entry: Partial<CamtEntry>): CamtStatement {
  return {
    camtVersion: "053", messageId: "M", creationDate: "2024-01-01", statementId: "S",
    account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB" },
    openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-01-01" },
    closingBalance: { amount: 900, creditDebit: "CRDT", date: "2024-01-01" },
    reportDate: "2024-01-01",
    entries: [{
      amount: 100, currency: "EUR", creditDebit: "DBIT",
      bookingDate: "2024-01-01", valueDate: "2024-01-01",
      details: [{ counterparty: { name: "ACME" } }],
      ...entry,
    }],
  };
}

describe("SDD reason code reference (EPC173-14)", () => {
  it("recognizes valid reason codes and rejects unknown ones", () => {
    expect(isSddReasonCode("AM04")).toBe(true);
    expect(isSddReasonCode("md01")).toBe(true);
    expect(isSddReasonCode("XXXX")).toBe(false);
    expect(SDD_REASON_CODES.AM04.name).toBe("Insufficient Funds");
  });
});

describe("R-transactions: CAMT -> CODA (Record 2.2 pos 113/114-117)", () => {
  it("maps an ISO return reason to a Return (type 2) with the reason code", () => {
    const lines = statementToCoda(stmtWith({ returnInfo: { reasonCode: "AM04" } })).lines;
    expect(field(rec(lines, "2.2"), "rTransactionType")).toBe("2");
    expect(field(rec(lines, "2.2"), "isoReason")).toBe("AM04");
  });

  it("maps a reversal to type 4", () => {
    const lines = statementToCoda(stmtWith({ returnInfo: { isReversal: true } })).lines;
    expect(field(rec(lines, "2.2"), "rTransactionType")).toBe("4");
  });

  it("forces Record 2.2 to be emitted even without long comm or counterpart BIC", () => {
    const lines = statementToCoda(stmtWith({ returnInfo: { reasonCode: "MD01" } })).lines;
    expect(rec(lines, "2.2")).toBeDefined();
  });

  it("maps SEPA purpose to pos 122-125", () => {
    const lines = statementToCoda(stmtWith({ details: [{ purpose: "SALA" }] })).lines;
    expect(field(rec(lines, "2.2"), "purpose")).toBe("SALA");
  });
});

describe("R-transactions: CAMT parser", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
<GrpHdr><MsgId>M</MsgId><CreDtTm>2024-01-01</CreDtTm></GrpHdr>
<Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-01-01</Dt></Dt></Bal>
<Ntry><Amt Ccy="EUR">100</Amt><CdtDbtInd>DBIT</CdtDbtInd><RvslInd>true</RvslInd><BookgDt><Dt>2024-01-01</Dt></BookgDt>
<NtryDtls><TxDtls><Purp><Cd>SALA</Cd></Purp><RtrInf><Rsn><Cd>MD06</Cd></Rsn></RtrInf></TxDtls></NtryDtls></Ntry>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">900</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-01-01</Dt></Dt></Bal>
</Stmt></BkToCstmrStmt></Document>`;

  it("extracts RvslInd, RtrInf/Rsn/Cd and Purp", () => {
    const entry = parseCamt(xml)[0].entries[0];
    expect(entry.returnInfo).toEqual({ reasonCode: "MD06", isReversal: true });
    expect(entry.details[0].purpose).toBe("SALA");
  });
});

describe("R-transactions: round-trip CAMT -> CODA -> model -> CAMT", () => {
  it("preserves reason code and purpose through CODA", () => {
    const stmt = stmtWith({ returnInfo: { reasonCode: "AM04" }, details: [{ purpose: "SALA" }] });
    const coda = statementToCoda(stmt).lines.map((l) => l.raw).join("\n");
    const back = codaToStatement(parseCoda(coda)).entries[0];
    expect(back.returnInfo?.reasonCode).toBe("AM04");
    expect(back.details[0].purpose).toBe("SALA");
  });

  it("CAMT writer emits RvslInd, RtrInf/Rsn/Cd and Purp", () => {
    const xml = statementToXml(stmtWith({ returnInfo: { reasonCode: "MD06", isReversal: true }, details: [{ purpose: "SALA" }] }));
    expect(xml).toContain("<RvslInd>true</RvslInd>");
    expect(xml).toContain("<Cd>MD06</Cd>");
    expect(xml).toContain("<Cd>SALA</Cd>");
  });
});
