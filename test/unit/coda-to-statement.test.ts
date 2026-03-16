// test/unit/coda-to-statement.test.ts
import { describe, it, expect } from "vitest";
import { parseCoda } from "../../src/core/coda-parser.js";
import { codaToStatement } from "../../src/core/coda-to-statement.js";

// ── Helpers to build 128-char CODA lines ─────────────────────────────────

function buildRec0(opts: { creationDate?: string; bic?: string } = {}): string {
  const creationDate = opts.creationDate ?? "150324";
  const bic = (opts.bic ?? "BBRUBEBB").padEnd(11);
  return (
    "0" +                         // [0]     recordType
    "0000" +                      // [1-4]   zeros
    creationDate +                // [5-10]  creationDate DDMMYY
    "000" +                       // [11-13] bankId
    "05" +                        // [14-15] applicationCode
    " " +                         // [16]    duplicate
    " ".repeat(7) +               // [17-23] blanks
    "REF0000001" +                // [24-33] fileReference
    " ".repeat(26) +              // [34-59] addressee
    bic +                         // [60-70] BIC
    " ".repeat(11) +              // [71-81] companyNumber
    " " +                         // [82]    blank
    "00000" +                     // [83-87] separateApp
    " ".repeat(16) +              // [88-103]  transactionRef
    " ".repeat(16) +              // [104-119] relatedRef
    " ".repeat(7) +               // [120-126] blanks
    "2"                           // [127]   versionCode
  );
}

function buildRec1(opts: {
  iban?: string;
  currency?: string;
  balanceSign?: string;
  balanceAmount?: string;
  balanceDate?: string;
  holderName?: string;
} = {}): string {
  const iban = (opts.iban ?? "BE68539007547034").padEnd(34);
  const currency = opts.currency ?? "EUR";
  const balanceSign = opts.balanceSign ?? "0";
  const balanceAmount = (opts.balanceAmount ?? "000000001000000").padStart(15, "0");
  const balanceDate = opts.balanceDate ?? "150324";
  const holderName = (opts.holderName ?? "ACME CORP").padEnd(26);
  return (
    "1" +                         // [0]     recordType
    "3" +                         // [1]     accountStructure
    "001" +                       // [2-4]   sequence
    iban +                        // [5-38]  accountNumber
    currency +                    // [39-41] currency
    balanceSign +                 // [42]    balanceSign
    balanceAmount +               // [43-57] balanceAmount
    balanceDate +                 // [58-63] balanceDate
    holderName +                  // [64-89] holderName
    " ".repeat(35) +              // [90-124]  description
    "001"                         // [125-127] sequenceEnd
  );
}

function buildRec21(opts: {
  amountSign?: string;
  amount?: string;
  valueDate?: string;
  transactionCode?: string;
  communicationType?: string;
  communication?: string;
  entryDate?: string;
  bankReference?: string;
} = {}): string {
  const bankReference = (opts.bankReference ?? "").padEnd(21);
  const amountSign = opts.amountSign ?? "0";
  const amount = (opts.amount ?? "000000000500000").padStart(15, "0");
  const valueDate = opts.valueDate ?? "150324";
  const transactionCode = (opts.transactionCode ?? "04500001").padEnd(8);
  const communicationType = opts.communicationType ?? "0";
  const communication = (opts.communication ?? "").padEnd(53);
  const entryDate = opts.entryDate ?? "150324";
  return (
    "2" +                         // [0]     recordType
    "1" +                         // [1]     articleNumber
    "0001" +                      // [2-5]   sequenceNumber
    "0000" +                      // [6-9]   detailNumber
    bankReference +               // [10-30] bankReference
    amountSign +                  // [31]    amountSign
    amount +                      // [32-46] amount
    valueDate +                   // [47-52] valueDate
    transactionCode +             // [53-60] transactionCode
    communicationType +           // [61]    communicationType
    communication +               // [62-114] communication (53 chars)
    entryDate +                   // [115-120] entryDate
    "000" +                       // [121-123] statementSequence
    "0" +                         // [124]    globalisationCode
    "0" +                         // [125]    nextCode
    " " +                         // [126]    blank
    "0"                           // [127]    linkCode
  );
}

function buildRec22(opts: {
  communication?: string;
  counterpartBic?: string;
} = {}): string {
  const communication = (opts.communication ?? "").padEnd(53);
  const customerRef = " ".repeat(35);
  const counterpartBic = (opts.counterpartBic ?? "").padEnd(11);
  return (
    "2" +                         // [0]     recordType
    "2" +                         // [1]     articleNumber
    "0001" +                      // [2-5]   sequenceNumber
    "0000" +                      // [6-9]   detailNumber
    communication +               // [10-62] communication (53 chars)
    customerRef +                 // [63-97] customerRef
    counterpartBic +              // [98-108] counterpartBic
    " ".repeat(3) +               // [109-111] blanks
    " " +                         // [112]   rTransactionType
    " ".repeat(4) +               // [113-116] isoReason
    " ".repeat(4) +               // [117-120] categoryPurpose
    " ".repeat(4) +               // [121-124] purpose
    "0" +                         // [125]   nextCode
    " " +                         // [126]   blank
    "0"                           // [127]   linkCode
  );
}

function buildRec23(opts: {
  counterpartAccount?: string;
  counterpartName?: string;
  communication?: string;
} = {}): string {
  const counterpartAccount = (opts.counterpartAccount ?? "").padEnd(34);
  const currency = "EUR";
  const counterpartName = (opts.counterpartName ?? "").padEnd(35);
  const communication = (opts.communication ?? "").padEnd(43);
  return (
    "2" +                         // [0]     recordType
    "3" +                         // [1]     articleNumber
    "0001" +                      // [2-5]   sequenceNumber
    "0000" +                      // [6-9]   detailNumber
    counterpartAccount +          // [10-43] counterpartAccount (34 chars)
    currency +                    // [44-46] currency
    counterpartName +             // [47-81] counterpartName (35 chars)
    communication +               // [82-124] communication (43 chars)
    "0" +                         // [125]   nextCode
    " " +                         // [126]   blank
    "0"                           // [127]   linkCode
  );
}

function buildRec8(opts: {
  balanceSign?: string;
  balanceAmount?: string;
  balanceDate?: string;
} = {}): string {
  const balanceSign = opts.balanceSign ?? "0";
  const balanceAmount = (opts.balanceAmount ?? "000000001500000").padStart(15, "0");
  const balanceDate = opts.balanceDate ?? "150324";
  return (
    "8" +                         // [0]     recordType
    "001" +                       // [1-3]   sequence
    "BE68539007547034".padEnd(34) + // [4-37] accountNumber
    "EUR" +                       // [38-40] currency
    balanceSign +                 // [41]    balanceSign
    balanceAmount +               // [42-56] balanceAmount
    balanceDate +                 // [57-62] balanceDate
    " ".repeat(64) +              // [63-126] blanks
    "0"                           // [127]   linkCode
  );
}

function buildRec9(): string {
  return (
    "9" +                         // [0]     recordType
    " ".repeat(15) +              // [1-15]  blanks
    "000006" +                    // [16-21] recordCount
    "000000000000000" +           // [22-36] sumDebits
    "000000000500000" +           // [37-51] sumCredits
    " ".repeat(75) +              // [52-126] blanks
    "2"                           // [127]   lastFile
  );
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("codaToStatement", () => {
  it("sets camtVersion to '053'", () => {
    const content = [buildRec0(), buildRec1(), buildRec8(), buildRec9()].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.camtVersion).toBe("053");
  });

  it("reconstructs IBAN from Record 1", () => {
    const content = [
      buildRec0(),
      buildRec1({ iban: "BE68539007547034" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.account.iban).toBe("BE68539007547034");
  });

  it("reconstructs currency from Record 1", () => {
    const content = [
      buildRec0(),
      buildRec1({ currency: "USD" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.account.currency).toBe("USD");
  });

  it("reconstructs owner name from Record 1", () => {
    const content = [
      buildRec0(),
      buildRec1({ holderName: "ACME CORP" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.account.ownerName).toBe("ACME CORP");
  });

  it("reconstructs BIC from Record 0", () => {
    const content = [
      buildRec0({ bic: "BBRUBEBB" }),
      buildRec1(),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.account.bic).toBe("BBRUBEBB");
  });

  it("reconstructs opening balance (credit) from Record 1", () => {
    const content = [
      buildRec0(),
      buildRec1({ balanceSign: "0", balanceAmount: "000000001000000", balanceDate: "150324" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.openingBalance.amount).toBe(1000);
    expect(result.openingBalance.creditDebit).toBe("CRDT");
    expect(result.openingBalance.date).toBe("2024-03-15");
  });

  it("reconstructs opening balance (debit) from Record 1", () => {
    const content = [
      buildRec0(),
      buildRec1({ balanceSign: "1", balanceAmount: "000000002500000" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.openingBalance.amount).toBe(2500);
    expect(result.openingBalance.creditDebit).toBe("DBIT");
  });

  it("reconstructs closing balance from Record 8", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec8({ balanceSign: "0", balanceAmount: "000000001500000", balanceDate: "150324" }),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.closingBalance.amount).toBe(1500);
    expect(result.closingBalance.creditDebit).toBe("CRDT");
    expect(result.closingBalance.date).toBe("2024-03-15");
  });

  it("reconstructs closing balance (debit) from Record 8", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec8({ balanceSign: "1", balanceAmount: "000000000750000" }),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.closingBalance.amount).toBe(750);
    expect(result.closingBalance.creditDebit).toBe("DBIT");
  });

  it("reconstructs an entry from Record 2.1 (amount, sign, transaction code)", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({
        amountSign: "0",
        amount: "000000000500000",
        transactionCode: "04500001",
        valueDate: "150324",
        entryDate: "150324",
      }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(1);

    const entry = result.entries[0];
    expect(entry.amount).toBe(500);
    expect(entry.creditDebit).toBe("CRDT");
    expect(entry.valueDate).toBe("2024-03-15");
    expect(entry.bookingDate).toBe("2024-03-15");
    expect(entry.transactionCode).toEqual({
      domain: "PMNT",
      family: "RCDT",
      subFamily: "ESCT",
    });
  });

  it("reconstructs a debit entry from Record 2.1", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({
        amountSign: "1",
        amount: "000000000250000",
        transactionCode: "13010001",
      }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].amount).toBe(250);
    expect(result.entries[0].creditDebit).toBe("DBIT");
    expect(result.entries[0].transactionCode).toEqual({
      domain: "PMNT",
      family: "ICDT",
      subFamily: "ESCT",
    });
  });

  it("reconstructs unstructured communication from Record 2.1", () => {
    const commText = "Payment for invoice 12345";
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({
        communicationType: "0",
        communication: commText,
      }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].details).toHaveLength(1);
    expect(result.entries[0].details[0].remittanceInfo?.unstructured).toBe(commText);
  });

  it("concatenates communication across zones (2.1 + 2.2 + 2.3)", () => {
    const zone1 = "Part one of the communication message that spans";
    const zone2 = " across multiple zones and records in the CODA f";
    const zone3 = "ile format for this particular transaction";
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ communicationType: "0", communication: zone1 }),
      buildRec22({ communication: zone2 }),
      buildRec23({ communication: zone3 }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(1);

    const fullComm = result.entries[0].details[0].remittanceInfo?.unstructured;
    expect(fullComm).toContain("Part one");
    expect(fullComm).toContain("across multiple zones");
    expect(fullComm).toContain("ile format");
  });

  it("reconstructs structured communication (creditor reference)", () => {
    // Communication type 1, starts with "101" → structured creditor ref
    const structuredComm = "101123456789012";
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({
        communicationType: "1",
        communication: structuredComm,
      }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].details[0].remittanceInfo?.structured?.creditorRef).toBe("123456789012");
  });

  it("reconstructs counterparty info from Record 2.2 (BIC) and 2.3 (IBAN, name)", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21(),
      buildRec22({ counterpartBic: "GKCCBEBB" }),
      buildRec23({
        counterpartAccount: "BE71096123456769",
        counterpartName: "John Doe",
      }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(1);

    const detail = result.entries[0].details[0];
    expect(detail.counterparty?.bic).toBe("GKCCBEBB");
    expect(detail.counterparty?.iban).toBe("BE71096123456769");
    expect(detail.counterparty?.name).toBe("John Doe");
  });

  it("handles multiple entries (multiple 2.1 records)", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ amount: "000000000100000", amountSign: "0" }),
      buildRec21({ amount: "000000000200000", amountSign: "1" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].amount).toBe(100);
    expect(result.entries[0].creditDebit).toBe("CRDT");
    expect(result.entries[1].amount).toBe(200);
    expect(result.entries[1].creditDebit).toBe("DBIT");
  });

  it("skips Record 4 (free communication) without error", () => {
    const rec4 = ("4" + "0001" + "0001" + " ".repeat(23) + "Free text message".padEnd(80) + " ".repeat(15) + "0").padEnd(128);
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21(),
      rec4,
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    // Should succeed without errors; the entry from 2.1 is still present
    expect(result.entries).toHaveLength(1);
  });

  it("sets creation date from Record 0", () => {
    const content = [
      buildRec0({ creationDate: "250116" }),
      buildRec1(),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.creationDate).toBe("2016-01-25");
  });

  it("handles entry with bank reference from Record 2.1", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ bankReference: "BANKREF123456789012" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries[0].entryRef).toBe("BANKREF123456789012");
  });

  it("uses entry currency from account", () => {
    const content = [
      buildRec0(),
      buildRec1({ currency: "GBP" }),
      buildRec21(),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToStatement(parseCoda(content));
    expect(result.entries[0].currency).toBe("GBP");
  });
});
