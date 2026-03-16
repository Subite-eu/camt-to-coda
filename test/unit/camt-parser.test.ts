import { describe, it, expect } from "vitest";
import { detectVersion, parseCamt } from "../../src/core/camt-parser.js";

// ── Minimal XML fixtures ──────────────────────────────────────────────────

const CAMT_052_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02">
  <BkToCstmrAcctRpt>
    <GrpHdr><MsgId>RPT-MSG-001</MsgId><CreDtTm>2024-06-15T08:00:00Z</CreDtTm></GrpHdr>
    <Rpt>
      <Id>RPT-001</Id>
      <Acct>
        <Id><IBAN>BE68793230773034</IBAN></Id>
        <Ccy>EUR</Ccy>
        <Ownr><Nm>Test Corp</Nm></Ownr>
        <Svcr><FinInstnId><BIC>TESTBE20</BIC></FinInstnId></Svcr>
      </Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPAV</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">1000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>INFO</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">1200.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>FWAV</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">200.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
    </Rpt>
  </BkToCstmrAcctRpt>
</Document>`;

const CAMT_053_PRCD_BAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-PRCD</MsgId><CreDtTm>2024-06-20T10:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-PRCD</Id>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>PRCD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">3000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-20</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">3500.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-20</Dt></Dt>
      </Bal>
      <Ntry>
        <Amt Ccy="EUR">500</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-06-20</Dt></BookgDt>
        <BkTxCd><Prtry><Cd>NTRF</Cd></Prtry></BkTxCd>
        <NtryDtls><TxDtls>
          <Refs><EndToEndId>E2E-001</EndToEndId></Refs>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT_053_FRTODTM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-FRTODTM</MsgId><CreDtTm>2024-07-01T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-FRD</Id>
      <FrToDt><FrDtTm>2024-07-01T00:00:00Z</FrDtTm><ToDtTm>2024-07-01T23:59:59Z</ToDtTm></FrToDt>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">0</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-07-01</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">0</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-07-01</Dt></Dt>
      </Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT_053_NO_BAL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-NOBAL</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-NOBAL</Id>
      <CreDtTm>2024-06-15T12:00:00Z</CreDtTm>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT_053_MULTI_TXDTLS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-MULTI</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-MULTI</Id>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1200</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Ntry>
        <Amt Ccy="EUR">200</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-06-15</Dt></BookgDt>
        <NtryDtls>
          <Btch><NbOfTxs>2</NbOfTxs></Btch>
          <TxDtls>
            <Refs><EndToEndId>E2E-A</EndToEndId><TxId>TX-A</TxId></Refs>
            <RltdPties>
              <Cdtr><Nm>Creditor Alpha</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>BE91516952884376</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RltdAgts><CdtrAgt><FinInstnId><BICFI>BNAGBEBB</BICFI></FinInstnId></CdtrAgt></RltdAgts>
            <RmtInf><Ustrd>Payment for invoice A</Ustrd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Refs><EndToEndId>E2E-B</EndToEndId><TxId>TX-B</TxId></Refs>
            <RltdPties>
              <Cdtr><Nm>Creditor Beta</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>BE12345678901234</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RmtInf><Strd><CdtrRefInf><Ref>REF-BETA-001</Ref></CdtrRefInf></Strd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT_053_PRTRY_CODE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-PRTRY</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-PRTRY</Id>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">0</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">500</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Ntry>
        <Amt Ccy="EUR">500</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-06-15</Dt></BookgDt>
        <ValDt><DtTm>2024-06-15T00:00:00Z</DtTm></ValDt>
        <NtryRef>NTRYREF-001</NtryRef>
        <AcctSvcrRef>SVCR-001</AcctSvcrRef>
        <BkTxCd><Prtry><Cd>NTRF-PROPRIETARY</Cd></Prtry></BkTxCd>
        <NtryDtls><TxDtls>
          <Refs><InstrId>INSTR-001</InstrId></Refs>
        </TxDtls></NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT_053_OTHER_ACCT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-OTHR</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-OTHR</Id>
      <Acct>
        <Id><Othr><Id>ACCT-12345</Id></Othr></Id>
        <Ccy>USD</Ccy>
        <Ownr>
          <Nm>Other Corp</Nm>
          <Id><OrgId><AnyBIC>TESTBEBB</AnyBIC></OrgId></Id>
        </Ownr>
      </Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="USD">100</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="USD">100</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const CAMT_053_BAL_OBJECT_AMT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-BALOBJ</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-BALOBJ</Id>
      <LglSeqNb>42</LglSeqNb>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">7500.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="EUR">8000.75</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Dt><Dt>2024-06-15</Dt></Dt>
      </Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

// ── detectVersion() ───────────────────────────────────────────────────────

describe("detectVersion", () => {
  it("detects camt.053.001.02", () => {
    const xml = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">`;
    expect(detectVersion(xml)).toBe("camt.053.001.02");
  });

  it("detects camt.053.001.08", () => {
    const xml = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">`;
    expect(detectVersion(xml)).toBe("camt.053.001.08");
  });

  it("detects camt.052.001.02", () => {
    const xml = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02">`;
    expect(detectVersion(xml)).toBe("camt.052.001.02");
  });

  it("returns null when no matching namespace", () => {
    expect(detectVersion(`<Document xmlns="urn:example:other">`)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(detectVersion("")).toBeNull();
  });

  it("returns null when xmlns has no camt prefix", () => {
    expect(detectVersion(`<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">`)).toBeNull();
  });
});

// ── parseCamt() error paths ───────────────────────────────────────────────

describe("parseCamt error paths", () => {
  it("throws when no xmlns namespace present", () => {
    const xml = `<?xml version="1.0"?><Document><BkToCstmrStmt/></Document>`;
    expect(() => parseCamt(xml)).toThrow("Could not detect CAMT version from namespace");
  });

  it("throws for unsupported version (camt.054)", () => {
    const xml = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.02">
  <BkToCstmrDbtCdtNtfctn/>
</Document>`;
    expect(() => parseCamt(xml)).toThrow("Unsupported CAMT version: camt.054.001.02");
  });
});

// ── CAMT 052 parsing ──────────────────────────────────────────────────────

describe("CAMT 052 parsing", () => {
  it("returns camtVersion '052'", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts).toHaveLength(1);
    expect(stmts[0].camtVersion).toBe("052");
  });

  it("parses messageId and creationDate from GrpHdr", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].messageId).toBe("RPT-MSG-001");
    expect(stmts[0].creationDate).toBe("2024-06-15T08:00:00Z");
  });

  it("parses statementId from Rpt.Id", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].statementId).toBe("RPT-001");
  });

  it("parses IBAN from account", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].account.iban).toBe("BE68793230773034");
  });

  it("parses OPAV balance as opening", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].openingBalance.amount).toBe(1000);
    expect(stmts[0].openingBalance.creditDebit).toBe("CRDT");
  });

  it("parses INFO balance as closing", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].closingBalance.amount).toBe(1200);
    expect(stmts[0].closingBalance.creditDebit).toBe("CRDT");
  });

  it("converts non-OPAV/INFO balance entries to CamtEntry movements", () => {
    const stmts = parseCamt(CAMT_052_XML);
    // FWAV balance becomes a movement entry
    expect(stmts[0].entries).toHaveLength(1);
    expect(stmts[0].entries[0].amount).toBe(200);
    expect(stmts[0].entries[0].creditDebit).toBe("CRDT");
    expect(stmts[0].entries[0].details).toEqual([]);
    expect(stmts[0].entries[0].batchCount).toBeUndefined();
  });

  it("uses GrpHdr.CreDtTm as reportDate", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].reportDate).toBe("2024-06-15T08:00:00Z");
  });

  it("has no sequence field", () => {
    const stmts = parseCamt(CAMT_052_XML);
    expect(stmts[0].sequence).toBeUndefined();
  });
});

// ── CAMT 053 parsing — balance fallback to PRCD ──────────────────────────

describe("CAMT 053 PRCD balance fallback", () => {
  it("uses PRCD as opening balance when OPBD is absent", () => {
    const stmts = parseCamt(CAMT_053_PRCD_BAL_XML);
    expect(stmts[0].openingBalance.amount).toBe(3000);
    expect(stmts[0].openingBalance.creditDebit).toBe("CRDT");
  });

  it("parses CLBD as closing balance", () => {
    const stmts = parseCamt(CAMT_053_PRCD_BAL_XML);
    expect(stmts[0].closingBalance.amount).toBe(3500);
  });
});

// ── parseBalance with missing/null node ──────────────────────────────────

describe("parseBalance edge cases", () => {
  it("returns default zero balance when balance node absent", () => {
    const stmts = parseCamt(CAMT_053_NO_BAL_XML);
    const stmt = stmts[0];
    // No OPBD or CLBD — should default to { amount: 0, creditDebit: 'CRDT', date: '' }
    expect(stmt.openingBalance.amount).toBe(0);
    expect(stmt.openingBalance.creditDebit).toBe("CRDT");
    expect(stmt.openingBalance.date).toBe("");
    expect(stmt.closingBalance.amount).toBe(0);
  });

  it("parses balance with object Amt (Ccy attribute + #text)", () => {
    const stmts = parseCamt(CAMT_053_BAL_OBJECT_AMT_XML);
    expect(stmts[0].openingBalance.amount).toBe(7500.5);
    expect(stmts[0].closingBalance.amount).toBe(8000.75);
    expect(stmts[0].closingBalance.creditDebit).toBe("DBIT");
  });

  it("parses date from Bal.Dt.Dt", () => {
    const stmts = parseCamt(CAMT_053_BAL_OBJECT_AMT_XML);
    expect(stmts[0].openingBalance.date).toBe("2024-06-15");
  });
});

// ── parseEntry variations ─────────────────────────────────────────────────

describe("parseEntry — transactionCode shapes", () => {
  it("parses Prtry-only transaction code (no domain)", () => {
    const stmts = parseCamt(CAMT_053_PRCD_BAL_XML);
    const entry = stmts[0].entries[0];
    // PRCD fixture uses Prtry code only (no Domn)
    expect(entry.transactionCode).toBeDefined();
    expect(entry.transactionCode?.proprietary).toBe("NTRF");
    // domain/family/subFamily are undefined when absent
    expect(entry.transactionCode?.domain).toBeUndefined();
    expect(entry.transactionCode?.family).toBeUndefined();
    expect(entry.transactionCode?.subFamily).toBeUndefined();
  });

  it("parses Prtry-based transaction code", () => {
    const stmts = parseCamt(CAMT_053_PRTRY_CODE_XML);
    const entry = stmts[0].entries[0];
    expect(entry.transactionCode?.proprietary).toBe("NTRF-PROPRIETARY");
  });

  it("parses entryRef and accountServicerRef", () => {
    const stmts = parseCamt(CAMT_053_PRTRY_CODE_XML);
    const entry = stmts[0].entries[0];
    expect(entry.entryRef).toBe("NTRYREF-001");
    expect(entry.accountServicerRef).toBe("SVCR-001");
  });

  it("parses valueDate from ValDt.DtTm when ValDt.Dt is absent", () => {
    const stmts = parseCamt(CAMT_053_PRTRY_CODE_XML);
    const entry = stmts[0].entries[0];
    expect(entry.valueDate).toBe("2024-06-15T00:00:00Z");
  });

  it("entry with no BkTxCd has undefined transactionCode", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const entry = stmts[0].entries[0];
    // MULTI fixture has no BkTxCd
    expect(entry.transactionCode).toBeUndefined();
  });

  it("parses batchCount from NtryDtls.Btch.NbOfTxs", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const entry = stmts[0].entries[0];
    expect(entry.batchCount).toBe(2);
  });
});

// ── parseTxDetail — counterparty and remittance variations ───────────────

describe("parseTxDetail edge cases", () => {
  it("parses multiple TxDtls in a single entry", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const entry = stmts[0].entries[0];
    expect(entry.details).toHaveLength(2);
  });

  it("detail[0] has creditor name, IBAN and BIC (BICFI)", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const d0 = stmts[0].entries[0].details[0];
    expect(d0.counterparty?.name).toBe("Creditor Alpha");
    expect(d0.counterparty?.iban).toBe("BE91516952884376");
    expect(d0.counterparty?.bic).toBe("BNAGBEBB");
  });

  it("detail[0] has unstructured remittance info", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const d0 = stmts[0].entries[0].details[0];
    expect(d0.remittanceInfo?.unstructured).toBe("Payment for invoice A");
    expect(d0.remittanceInfo?.structured).toBeUndefined();
  });

  it("detail[1] has structured remittance info", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const d1 = stmts[0].entries[0].details[1];
    expect(d1.remittanceInfo?.structured?.creditorRef).toBe("REF-BETA-001");
    expect(d1.remittanceInfo?.unstructured).toBeUndefined();
  });

  it("detail[1] refs include endToEndId and txId", () => {
    const stmts = parseCamt(CAMT_053_MULTI_TXDTLS_XML);
    const d1 = stmts[0].entries[0].details[1];
    expect(d1.refs?.endToEndId).toBe("E2E-B");
    expect(d1.refs?.txId).toBe("TX-B");
  });

  it("detail with only InstrId populates instrId field", () => {
    const stmts = parseCamt(CAMT_053_PRTRY_CODE_XML);
    const d0 = stmts[0].entries[0].details[0];
    expect(d0.refs?.instrId).toBe("INSTR-001");
    expect(d0.refs?.endToEndId).toBeUndefined();
    expect(d0.refs?.txId).toBeUndefined();
  });

  it("detail with no RltdPties has empty counterparty fields", () => {
    const stmts = parseCamt(CAMT_053_PRCD_BAL_XML);
    const d0 = stmts[0].entries[0].details[0];
    // Only has EndToEndId, no RltdPties
    expect(d0.counterparty?.name).toBeUndefined();
    expect(d0.counterparty?.iban).toBeUndefined();
    expect(d0.counterparty?.bic).toBeUndefined();
  });
});

// ── parseStatement — reportDate selection ────────────────────────────────

describe("parseStatement reportDate selection", () => {
  it("uses FrToDt.ToDtTm as reportDate when present", () => {
    const stmts = parseCamt(CAMT_053_FRTODTM_XML);
    expect(stmts[0].reportDate).toBe("2024-07-01T23:59:59Z");
  });

  it("falls back to CreDtTm from GrpHdr when no FrToDt", () => {
    // PRCD fixture has no FrToDt
    const stmts = parseCamt(CAMT_053_PRCD_BAL_XML);
    expect(stmts[0].reportDate).toBe("2024-06-20T10:00:00Z");
  });
});

// ── parseAccount — other account types ───────────────────────────────────

describe("parseAccount edge cases", () => {
  it("uses Othr.Id when no IBAN present", () => {
    const stmts = parseCamt(CAMT_053_OTHER_ACCT_XML);
    expect(stmts[0].account.iban).toBeUndefined();
    expect(stmts[0].account.otherId).toBe("ACCT-12345");
  });

  it("reads currency from Acct.Ccy", () => {
    const stmts = parseCamt(CAMT_053_OTHER_ACCT_XML);
    expect(stmts[0].account.currency).toBe("USD");
  });

  it("reads ownerName from Ownr.Nm", () => {
    const stmts = parseCamt(CAMT_053_OTHER_ACCT_XML);
    expect(stmts[0].account.ownerName).toBe("Other Corp");
  });

  it("reads BIC from Ownr.Id.OrgId.AnyBIC", () => {
    const stmts = parseCamt(CAMT_053_OTHER_ACCT_XML);
    expect(stmts[0].account.bic).toBe("TESTBEBB");
  });
});

// ── sequence field ────────────────────────────────────────────────────────

describe("sequence field parsing", () => {
  it("reads LglSeqNb as sequence", () => {
    const stmts = parseCamt(CAMT_053_BAL_OBJECT_AMT_XML);
    expect(stmts[0].sequence).toBe(42);
  });

  it("has no sequence when neither LglSeqNb nor ElctrncSeqNb present", () => {
    const stmts = parseCamt(CAMT_053_PRCD_BAL_XML);
    expect(stmts[0].sequence).toBeUndefined();
  });
});
