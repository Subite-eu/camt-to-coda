// test/unit/reverse.test.ts
import { describe, it, expect } from "vitest";
import { codaToCamt } from "../../src/core/reverse.js";

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

describe("codaToCamt", () => {
  it("produces valid XML from minimal CODA", () => {
    const content = [buildRec0(), buildRec1(), buildRec8(), buildRec9()].join("\n");
    const result = codaToCamt(content);

    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.lines).toHaveLength(4);
    expect(result.statement).toBeDefined();
    expect(result.statement.account.iban).toBe("BE68539007547034");
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("returns lines from parseCoda", () => {
    const content = [buildRec0(), buildRec1(), buildRec21(), buildRec8(), buildRec9()].join("\n");
    const result = codaToCamt(content);

    expect(result.lines).toHaveLength(5);
    expect(result.lines[0].recordType).toBe("0");
    expect(result.lines[1].recordType).toBe("1");
    expect(result.lines[2].recordType).toBe("2.1");
    expect(result.lines[3].recordType).toBe("8");
    expect(result.lines[4].recordType).toBe("9");
  });

  it("returns a reconstructed statement with entries", () => {
    const content = [buildRec0(), buildRec1(), buildRec21(), buildRec8(), buildRec9()].join("\n");
    const result = codaToCamt(content);

    expect(result.statement.entries).toHaveLength(1);
    expect(result.statement.entries[0].amount).toBe(500);
    expect(result.statement.entries[0].creditDebit).toBe("CRDT");
  });

  it("reports warning for unknown transaction codes", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ transactionCode: "99887766" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToCamt(content);

    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("99887766");
    expect(result.warnings[0]).toContain("Unknown transaction code");
    expect(result.warnings[0]).toContain("BkTxCd omitted");
  });

  it("does not report warning for known transaction codes", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ transactionCode: "04500001" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToCamt(content);

    expect(result.warnings).toHaveLength(0);
  });

  it("does not report warning for blank transaction code", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ transactionCode: "        " }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToCamt(content);

    expect(result.warnings).toHaveLength(0);
  });

  it("respects custom CAMT version", () => {
    const content = [buildRec0(), buildRec1(), buildRec8(), buildRec9()].join("\n");
    const result = codaToCamt(content, "camt.053.001.02");

    expect(result.xml).toContain(
      'xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"'
    );
    expect(result.xml).not.toContain("camt.053.001.08");
  });

  it("uses default CAMT version when not specified", () => {
    const content = [buildRec0(), buildRec1(), buildRec8(), buildRec9()].join("\n");
    const result = codaToCamt(content);

    expect(result.xml).toContain(
      'xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"'
    );
  });

  it("XML contains the IBAN from CODA Record 1", () => {
    const content = [
      buildRec0(),
      buildRec1({ iban: "BE68539007547034" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToCamt(content);

    expect(result.xml).toContain("<IBAN>BE68539007547034</IBAN>");
  });

  it("accumulates multiple warnings for multiple unknown codes", () => {
    const content = [
      buildRec0(),
      buildRec1(),
      buildRec21({ transactionCode: "11111111" }),
      buildRec21({ transactionCode: "22222222" }),
      buildRec8(),
      buildRec9(),
    ].join("\n");
    const result = codaToCamt(content);

    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain("11111111");
    expect(result.warnings[1]).toContain("22222222");
  });
});
