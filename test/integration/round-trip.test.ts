import { describe, it, expect } from "vitest";
import { statementToCoda } from "../../src/core/coda-writer.js";
import { codaToCamt } from "../../src/core/reverse.js";
import type { CamtStatement } from "../../src/core/model.js";

describe("round-trip: CAMT → CODA → CAMT", () => {
  it("preserves account IBAN through round-trip", () => {
    const stmt: CamtStatement = {
      camtVersion: "053",
      messageId: "MSG001",
      creationDate: "2024-03-15",
      statementId: "STMT001",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB", ownerName: "ACME" },
      openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-03-15" },
      closingBalance: { amount: 1500, creditDebit: "CRDT", date: "2024-03-15" },
      entries: [{
        amount: 500, currency: "EUR", creditDebit: "CRDT",
        bookingDate: "2024-03-15", valueDate: "2024-03-15",
        transactionCode: { domain: "PMNT", family: "RCDT", subFamily: "ESCT" },
        details: [{
          counterparty: { name: "SENDER CORP", iban: "BE91516952884376", bic: "SNDRBEBB" },
          remittanceInfo: { unstructured: "Invoice 12345" },
        }],
      }],
      reportDate: "2024-03-15",
    };

    const codaResult = statementToCoda(stmt);
    const codaContent = codaResult.lines.map(l => l.raw).join("\n");
    const reverseResult = codaToCamt(codaContent);
    const reconstructed = reverseResult.statement;

    expect(reconstructed.account.iban).toBe("BE68539007547034");
    expect(reconstructed.account.currency).toBe("EUR");
    expect(reconstructed.account.bic).toBe("BBRUBEBB");
    expect(reconstructed.openingBalance.amount).toBe(1000);
    expect(reconstructed.openingBalance.creditDebit).toBe("CRDT");
    expect(reconstructed.closingBalance.amount).toBe(1500);
    expect(reconstructed.entries).toHaveLength(1);
    expect(reconstructed.entries[0].amount).toBe(500);
    expect(reconstructed.entries[0].creditDebit).toBe("CRDT");
    expect(reconstructed.entries[0].transactionCode?.domain).toBe("PMNT");
    expect(reconstructed.entries[0].transactionCode?.family).toBe("RCDT");
    expect(reconstructed.entries[0].transactionCode?.subFamily).toBe("ESCT");
  });

  it("preserves counterparty info through round-trip", () => {
    const stmt: CamtStatement = {
      camtVersion: "053", messageId: "M", creationDate: "2024-01-01", statementId: "S",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB" },
      openingBalance: { amount: 0, creditDebit: "CRDT", date: "2024-01-01" },
      closingBalance: { amount: 100, creditDebit: "CRDT", date: "2024-01-01" },
      entries: [{
        amount: 100, currency: "EUR", creditDebit: "CRDT",
        bookingDate: "2024-01-01", valueDate: "2024-01-01",
        details: [{
          counterparty: { name: "JOHN DOE", iban: "NL91ABNA0417164300", bic: "ABNANL2A" },
          remittanceInfo: { unstructured: "Test payment" },
        }],
      }],
      reportDate: "2024-01-01",
    };

    const codaResult = statementToCoda(stmt);
    const codaContent = codaResult.lines.map(l => l.raw).join("\n");
    const reverseResult = codaToCamt(codaContent);
    const entry = reverseResult.statement.entries[0];

    expect(entry.details[0].counterparty?.iban).toBe("NL91ABNA0417164300");
    expect(entry.details[0].counterparty?.name).toBe("JOHN DOE");
    expect(entry.details[0].counterparty?.bic).toBe("ABNANL2A");
  });

  it("preserves multiple entries through round-trip", () => {
    const stmt: CamtStatement = {
      camtVersion: "053",
      messageId: "MULTI001",
      creationDate: "2024-06-01",
      statementId: "STMT-MULTI",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB" },
      openingBalance: { amount: 2000, creditDebit: "CRDT", date: "2024-06-01" },
      closingBalance: { amount: 2750, creditDebit: "CRDT", date: "2024-06-01" },
      entries: [
        {
          amount: 500, currency: "EUR", creditDebit: "CRDT",
          bookingDate: "2024-06-01", valueDate: "2024-06-01",
          details: [{
            counterparty: { name: "CORP A", iban: "BE91516952884376" },
            remittanceInfo: { unstructured: "Payment A" },
          }],
        },
        {
          amount: 300, currency: "EUR", creditDebit: "DBIT",
          bookingDate: "2024-06-01", valueDate: "2024-06-01",
          details: [{
            counterparty: { name: "CORP B", iban: "BE23456789012345" },
            remittanceInfo: { unstructured: "Payment B" },
          }],
        },
        {
          amount: 550, currency: "EUR", creditDebit: "CRDT",
          bookingDate: "2024-06-01", valueDate: "2024-06-01",
          details: [{
            counterparty: { name: "CORP C", iban: "BE56789012345678" },
            remittanceInfo: { unstructured: "Payment C" },
          }],
        },
      ],
      reportDate: "2024-06-01",
    };

    const codaResult = statementToCoda(stmt);
    const codaContent = codaResult.lines.map(l => l.raw).join("\n");
    const reverseResult = codaToCamt(codaContent);
    const reconstructed = reverseResult.statement;

    expect(reconstructed.entries).toHaveLength(3);
    expect(reconstructed.entries[0].amount).toBe(500);
    expect(reconstructed.entries[0].creditDebit).toBe("CRDT");
    expect(reconstructed.entries[1].amount).toBe(300);
    expect(reconstructed.entries[1].creditDebit).toBe("DBIT");
    expect(reconstructed.entries[2].amount).toBe(550);
    expect(reconstructed.entries[2].creditDebit).toBe("CRDT");
  });

  it("preserves debit entries through round-trip", () => {
    const stmt: CamtStatement = {
      camtVersion: "053",
      messageId: "DEBIT001",
      creationDate: "2024-05-10",
      statementId: "STMT-DEBIT",
      account: { iban: "BE68539007547034", currency: "EUR", bic: "BBRUBEBB" },
      openingBalance: { amount: 5000, creditDebit: "CRDT", date: "2024-05-10" },
      closingBalance: { amount: 4200, creditDebit: "CRDT", date: "2024-05-10" },
      entries: [
        {
          amount: 450, currency: "EUR", creditDebit: "DBIT",
          bookingDate: "2024-05-10", valueDate: "2024-05-10",
          transactionCode: { domain: "PMNT", family: "ICDT", subFamily: "ESCT" },
          details: [{
            counterparty: { name: "SUPPLIER LTD", iban: "BE23456789012345", bic: "SUPPBEBB" },
            remittanceInfo: { unstructured: "Invoice 99" },
          }],
        },
        {
          amount: 350, currency: "EUR", creditDebit: "DBIT",
          bookingDate: "2024-05-10", valueDate: "2024-05-10",
          details: [{
            counterparty: { name: "VENDOR INC", iban: "BE56789012345678" },
            remittanceInfo: { unstructured: "Services rendered" },
          }],
        },
      ],
      reportDate: "2024-05-10",
    };

    const codaResult = statementToCoda(stmt);
    const codaContent = codaResult.lines.map(l => l.raw).join("\n");
    const reverseResult = codaToCamt(codaContent);
    const reconstructed = reverseResult.statement;

    expect(reconstructed.entries).toHaveLength(2);

    const entry0 = reconstructed.entries[0];
    expect(entry0.amount).toBe(450);
    expect(entry0.creditDebit).toBe("DBIT");

    const entry1 = reconstructed.entries[1];
    expect(entry1.amount).toBe(350);
    expect(entry1.creditDebit).toBe("DBIT");

    // Closing balance is preserved
    expect(reconstructed.closingBalance.amount).toBe(4200);
    expect(reconstructed.closingBalance.creditDebit).toBe("CRDT");
  });
});
