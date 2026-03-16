import { describe, it, expect } from "vitest";
import { statementToXml } from "../../src/core/camt-writer.js";
import type { CamtStatement } from "../../src/core/model.js";

const stmt: CamtStatement = {
  camtVersion: "053",
  messageId: "CODA-REVERSE-2024-03-15",
  creationDate: "2024-03-15",
  statementId: "STMT-001",
  account: {
    iban: "BE68539007547034",
    currency: "EUR",
    bic: "BBRUBEBB",
    ownerName: "ACME",
  },
  openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-03-15" },
  closingBalance: { amount: 1500, creditDebit: "CRDT", date: "2024-03-15" },
  entries: [
    {
      amount: 500,
      currency: "EUR",
      creditDebit: "CRDT",
      bookingDate: "2024-03-15",
      valueDate: "2024-03-15",
      transactionCode: { domain: "PMNT", family: "RCDT", subFamily: "ESCT" },
      details: [
        {
          refs: { endToEndId: "NOTPROVIDED" },
          remittanceInfo: { unstructured: "Invoice payment" },
          counterparty: {
            name: "Sender",
            iban: "BE91516952884376",
            bic: "SNDRBEBB",
          },
        },
      ],
    },
  ],
  reportDate: "2024-03-15",
};

describe("statementToXml", () => {
  it("produces XML declaration", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("uses default namespace camt.053.001.08", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain(
      'xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"'
    );
  });

  it("uses custom version when supplied", () => {
    const xml = statementToXml(stmt, "camt.053.001.06");
    expect(xml).toContain(
      'xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.06"'
    );
    expect(xml).not.toContain("camt.053.001.08");
  });

  it("includes message id", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<MsgId>CODA-REVERSE-2024-03-15</MsgId>");
  });

  it("includes statement id", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Id>STMT-001</Id>");
  });

  it("includes account IBAN", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<IBAN>BE68539007547034</IBAN>");
  });

  it("includes account BIC", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<BIC>BBRUBEBB</BIC>");
  });

  it("includes account owner name", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Nm>ACME</Nm>");
  });

  it("includes account currency", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Ccy>EUR</Ccy>");
  });

  it("includes opening balance with OPBD type", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Cd>OPBD</Cd>");
    expect(xml).toContain('<Amt Ccy="EUR">1000.00</Amt>');
  });

  it("includes closing balance with CLBD type", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Cd>CLBD</Cd>");
    expect(xml).toContain('<Amt Ccy="EUR">1500.00</Amt>');
  });

  it("includes entry amount with currency attribute", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain('<Amt Ccy="EUR">500.00</Amt>');
  });

  it("includes entry credit/debit indicator", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<CdtDbtInd>CRDT</CdtDbtInd>");
  });

  it("includes booking date", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<BookgDt><Dt>2024-03-15</Dt></BookgDt>");
  });

  it("includes value date", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<ValDt><Dt>2024-03-15</Dt></ValDt>");
  });

  it("includes transaction code domain, family, subFamily", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Cd>PMNT</Cd>");
    expect(xml).toContain("<Cd>RCDT</Cd>");
    expect(xml).toContain("<SubFmlyCd>ESCT</SubFmlyCd>");
  });

  it("maps CRDT counterparty as Dbtr (payer)", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Dbtr>");
    expect(xml).toContain("<Nm>Sender</Nm>");
    expect(xml).toContain("</Dbtr>");
    expect(xml).toContain("<DbtrAcct>");
    expect(xml).toContain("<IBAN>BE91516952884376</IBAN>");
    expect(xml).toContain("<DbtrAgt>");
    expect(xml).toContain("<BIC>SNDRBEBB</BIC>");
  });

  it("maps DBIT counterparty as Cdtr (payee)", () => {
    const debitStmt: CamtStatement = {
      ...stmt,
      entries: [
        {
          ...stmt.entries[0],
          creditDebit: "DBIT",
          details: [
            {
              counterparty: { name: "Payee", iban: "BE12345678901234", bic: "PAYEBEBB" },
            },
          ],
        },
      ],
    };
    const xml = statementToXml(debitStmt);
    expect(xml).toContain("<Cdtr>");
    expect(xml).toContain("<Nm>Payee</Nm>");
    expect(xml).toContain("</Cdtr>");
    expect(xml).toContain("<CdtrAcct>");
    expect(xml).toContain("<IBAN>BE12345678901234</IBAN>");
    expect(xml).toContain("<CdtrAgt>");
    expect(xml).toContain("<BIC>PAYEBEBB</BIC>");
  });

  it("includes remittance info (unstructured)", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<Ustrd>Invoice payment</Ustrd>");
  });

  it("includes structured remittance info", () => {
    const stmtWithStrd: CamtStatement = {
      ...stmt,
      entries: [
        {
          ...stmt.entries[0],
          details: [
            {
              remittanceInfo: {
                structured: { creditorRef: "RF18539007547034" },
              },
            },
          ],
        },
      ],
    };
    const xml = statementToXml(stmtWithStrd);
    expect(xml).toContain("<Ref>RF18539007547034</Ref>");
  });

  it("includes end-to-end id in refs", () => {
    const xml = statementToXml(stmt);
    expect(xml).toContain("<EndToEndId>NOTPROVIDED</EndToEndId>");
  });

  it("escapes special XML characters", () => {
    const stmtEsc: CamtStatement = {
      ...stmt,
      account: { ...stmt.account, ownerName: "ACME & Co <Test>" },
    };
    const xml = statementToXml(stmtEsc);
    expect(xml).toContain("ACME &amp; Co &lt;Test&gt;");
    expect(xml).not.toContain("ACME & Co <Test>");
  });

  it("omits optional elements when not present", () => {
    const minimalStmt: CamtStatement = {
      camtVersion: "053",
      messageId: "MSG-001",
      creationDate: "2024-01-01",
      statementId: "S-001",
      account: { currency: "EUR" },
      openingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-01-01" },
      closingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-01-01" },
      entries: [],
      reportDate: "2024-01-01",
    };
    const xml = statementToXml(minimalStmt);
    expect(xml).not.toContain("<IBAN>");
    expect(xml).not.toContain("<BIC>");
    expect(xml).not.toContain("<Ownr>");
    expect(xml).not.toContain("<Ntry>");
  });

  it("uses otherId when IBAN not present", () => {
    const stmtOther: CamtStatement = {
      ...stmt,
      account: { ...stmt.account, iban: undefined, otherId: "ACC-12345", bic: undefined },
      entries: [],
    };
    const xml = statementToXml(stmtOther);
    expect(xml).toContain("<Othr>");
    expect(xml).toContain("<Id>ACC-12345</Id>");
    expect(xml).toContain("</Othr>");
    // The account Id section should use Othr, not IBAN
    const acctSection = xml.slice(xml.indexOf("<Acct>"), xml.indexOf("</Acct>") + 7);
    expect(acctSection).not.toContain("<IBAN>");
  });

  it("produces well-formed XML (matching open/close tags)", () => {
    const xml = statementToXml(stmt);
    // Check Document wraps everything
    expect(xml.indexOf("<Document")).toBeLessThan(xml.indexOf("</Document>"));
    expect(xml.indexOf("<BkToCstmrStmt>")).toBeLessThan(
      xml.indexOf("</BkToCstmrStmt>")
    );
    expect(xml.indexOf("<Stmt>")).toBeLessThan(xml.indexOf("</Stmt>"));
    expect(xml.indexOf("<Ntry>")).toBeLessThan(xml.indexOf("</Ntry>"));
    expect(xml.indexOf("<NtryDtls>")).toBeLessThan(xml.indexOf("</NtryDtls>"));
    expect(xml.indexOf("<TxDtls>")).toBeLessThan(xml.indexOf("</TxDtls>"));
  });

  it("includes entryRef when present", () => {
    const stmtWithRef: CamtStatement = {
      ...stmt,
      entries: [{ ...stmt.entries[0], entryRef: "REF-001" }],
    };
    const xml = statementToXml(stmtWithRef);
    expect(xml).toContain("<NtryRef>REF-001</NtryRef>");
  });

  it("handles multiple entries", () => {
    const stmtMulti: CamtStatement = {
      ...stmt,
      entries: [
        stmt.entries[0],
        { ...stmt.entries[0], amount: 250, entryRef: "ENTRY-2" },
      ],
    };
    const xml = statementToXml(stmtMulti);
    const ntryCount = (xml.match(/<Ntry>/g) ?? []).length;
    expect(ntryCount).toBe(2);
    expect(xml).toContain('<Amt Ccy="EUR">250.00</Amt>');
  });
});
