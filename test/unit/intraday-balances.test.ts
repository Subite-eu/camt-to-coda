import { describe, expect, it } from "vitest";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { validateCoda } from "../../src/validation/coda-validator.js";

// Independently authored regression: intraday booked and available balances
// differ, and their XML order must not decide which money reaches CODA.
const balance = (code: string, value: string) => `<Bal><Tp><CdOrPrtry><Cd>${code}</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">${value}</Amt><CdtDbtInd>DBIT</CdtDbtInd><Dt><Dt>2026-10-10</Dt></Dt></Bal>`;
function report(balances: string) {
  return `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02"><BkToCstmrAcctRpt><GrpHdr><MsgId>INTRADAY</MsgId><CreDtTm>2026-10-10T12:00:00Z</CreDtTm></GrpHdr><Rpt><Id>REPORT</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct>${balances}</Rpt></BkToCstmrAcctRpt></Document>`;
}

describe("intraday booked balances", () => {
  it("uses ITBD as the closing balance of an intraday report", () => {
    const [statement] = parseCamt(report(balance("OPBD", "100") + balance("ITBD", "100")));
    expect(statement.closingBalance).toEqual({ amount: 100, creditDebit: "DBIT", currency: "EUR", date: "2026-10-10" });
    expect(validateCoda(statementToCoda(statement).lines).errors).toEqual([]);
  });
  it("prefers booked balances regardless of XML order", () => {
    const [statement] = parseCamt(report(balance("OPAV", "80") + balance("PRCD", "110") + balance("OPBD", "100") + balance("CLAV", "70") + balance("ITAV", "60") + balance("ITBD", "100")));
    expect(statement.openingBalance.amount).toBe(100);
    expect(statement.closingBalance.amount).toBe(100);
  });
  it("prefers final booked closing balance and retains available-only compatibility", () => {
    expect(parseCamt(report(balance("ITBD", "100") + balance("CLBD", "90")))[0].closingBalance.amount).toBe(90);
    const [available] = parseCamt(report(balance("OPAV", "80") + balance("ITAV", "70")));
    expect(available.openingBalance.amount).toBe(80);
    expect(available.closingBalance.amount).toBe(70);
  });
});
