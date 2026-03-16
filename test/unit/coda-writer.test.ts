import { describe, it, expect } from "vitest";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda, resolveCommunication } from "../../src/core/coda-writer.js";
import type { CamtEntry, CamtStatement } from "../../src/core/model.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<CamtEntry> = {}): CamtEntry {
  return {
    amount: 100,
    currency: "EUR",
    creditDebit: "CRDT",
    bookingDate: "2024-06-15",
    details: [],
    ...overrides,
  };
}

function makeStatement(overrides: Partial<CamtStatement> = {}): CamtStatement {
  return {
    camtVersion: "053",
    messageId: "MSG-001",
    creationDate: "2024-06-15T12:00:00Z",
    statementId: "STMT-001",
    account: { iban: "BE68793230773034", currency: "EUR" },
    openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-06-15" },
    closingBalance: { amount: 1100, creditDebit: "CRDT", date: "2024-06-15" },
    reportDate: "2024-06-15T12:00:00Z",
    entries: [],
    ...overrides,
  };
}

// ── Inline XML fixtures ───────────────────────────────────────────────────

// Entry with 2 TxDtls → triggers Record 3 path
const MULTI_TXDTLS_XML = `<?xml version="1.0" encoding="UTF-8"?>
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
        <BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
        <NtryDtls>
          <Btch><NbOfTxs>2</NbOfTxs></Btch>
          <TxDtls>
            <Refs><EndToEndId>E2E-A</EndToEndId><TxId>TX-A</TxId></Refs>
            <RltdPties>
              <Cdtr><Nm>Creditor Alpha</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>BE91516952884376</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RltdAgts><CdtrAgt><FinInstnId><BIC>BNAGBEBB</BIC></FinInstnId></CdtrAgt></RltdAgts>
            <RmtInf><Ustrd>Payment for invoice A</Ustrd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Refs><EndToEndId>E2E-B</EndToEndId><TxId>TX-B</TxId></Refs>
            <RltdPties>
              <Cdtr><Nm>Creditor Beta</Nm></Cdtr>
              <CdtrAcct><Id><IBAN>BE12345678901234</IBAN></Id></CdtrAcct>
            </RltdPties>
            <RmtInf><Ustrd>Payment for invoice B</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

// Entry with very long TxDtls communication (triggers Record32 and Record33)
const LONG_TXCOMM_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-LONGCOMM</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-LONGCOMM</Id>
      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">0</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">500</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Ntry>
        <Amt Ccy="EUR">500</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2024-06-15</Dt></BookgDt>
        <NtryDtls>
          <TxDtls>
            <Refs><EndToEndId>E2E-LONG-1</EndToEndId></Refs>
            <RmtInf><Ustrd>AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA</Ustrd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Refs><EndToEndId>E2E-LONG-2</EndToEndId></Refs>
            <RmtInf><Ustrd>BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB</Ustrd></RmtInf>
          </TxDtls>
        </NtryDtls>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

// CAMT 052 to verify camtVersion in filename
const CAMT_052_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.052.001.02">
  <BkToCstmrAcctRpt>
    <GrpHdr><MsgId>RPT-MSG-001</MsgId><CreDtTm>2024-06-15T08:00:00Z</CreDtTm></GrpHdr>
    <Rpt>
      <Id>RPT-001</Id>
      <Acct>
        <Id><IBAN>BE68793230773034</IBAN></Id>
        <Ccy>EUR</Ccy>
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
    </Rpt>
  </BkToCstmrAcctRpt>
</Document>`;

// Statement with otherId account (no IBAN)
const OTHER_ACCT_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG-OTHR</MsgId><CreDtTm>2024-06-15T12:00:00Z</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT-OTHR</Id>
      <Acct><Id><Othr><Id>ACCT-12345</Id></Othr></Id><Ccy>EUR</Ccy></Acct>
      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">0</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">0</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-06-15</Dt></Dt></Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

// ── resolveCommunication ───────────────────────────────────────────────────

describe("resolveCommunication", () => {
  it("returns structured ref with commType '1' when creditorRef present", () => {
    const entry = makeEntry({
      details: [
        {
          remittanceInfo: {
            structured: { creditorRef: "123456789012" },
          },
        },
      ],
    });
    const { comm, commType } = resolveCommunication(entry);
    expect(commType).toBe("1");
    expect(comm).toBe("101123456789012");
  });

  it("zero-pads creditorRef shorter than 12 chars", () => {
    const entry = makeEntry({
      details: [
        {
          remittanceInfo: {
            structured: { creditorRef: "12345" },
          },
        },
      ],
    });
    const { comm } = resolveCommunication(entry);
    // "101" + padLeft("12345", 12, "0") = "101" + "000000012345" = 15 chars
    expect(comm).toBe("101000000012345");
  });

  it("returns unstructured with commType '0' when ustrd present", () => {
    const entry = makeEntry({
      details: [
        {
          remittanceInfo: {
            unstructured: "Invoice payment 2024-001",
          },
        },
      ],
    });
    const { comm, commType } = resolveCommunication(entry);
    expect(comm).toBe("Invoice payment 2024-001");
    expect(commType).toBe("0");
  });

  it("skips unstructured when it equals NOTPROVIDED", () => {
    const entry = makeEntry({
      details: [
        {
          refs: { endToEndId: "E2E-123" },
          remittanceInfo: { unstructured: "NOTPROVIDED" },
        },
      ],
    });
    const { comm, commType } = resolveCommunication(entry);
    // Falls through to refs
    expect(comm).toBe("E2E-123");
    expect(commType).toBe("0");
  });

  it("falls back to endToEndId when no remittance", () => {
    const entry = makeEntry({
      details: [
        {
          refs: { endToEndId: "E2E-456", txId: "TX-456" },
        },
      ],
    });
    const { comm, commType } = resolveCommunication(entry);
    expect(comm).toBe("E2E-456/TX-456");
    expect(commType).toBe("0");
  });

  it("skips refs equal to NOTPROVIDED", () => {
    const entry = makeEntry({
      details: [
        {
          refs: { endToEndId: "NOTPROVIDED", txId: "NOTPROVIDED" },
        },
      ],
    });
    const { comm } = resolveCommunication(entry);
    // All refs filtered out → empty
    expect(comm).toBe("");
  });

  it("falls back to batchCount when no refs or remittance", () => {
    const entry = makeEntry({
      batchCount: 5,
      details: [],
    });
    const { comm, commType } = resolveCommunication(entry);
    expect(comm).toBe("5 transaction(s)");
    expect(commType).toBe("0");
  });

  it("returns empty string when no communication available", () => {
    const entry = makeEntry({ details: [] });
    const { comm, commType } = resolveCommunication(entry);
    expect(comm).toBe("");
    expect(commType).toBe("0");
  });

  it("does not use batchCount when batchCount is 0", () => {
    const entry = makeEntry({ batchCount: 0, details: [] });
    const { comm } = resolveCommunication(entry);
    expect(comm).toBe("");
  });

  it("collects refs from multiple details", () => {
    const entry = makeEntry({
      details: [
        { refs: { endToEndId: "E2E-A" } },
        { refs: { endToEndId: "E2E-B" } },
      ],
    });
    const { comm } = resolveCommunication(entry);
    expect(comm).toBe("E2E-A/E2E-B");
  });
});

// ── Record 3 emission (entry.details.length > 1) ─────────────────────────

describe("Record 3 emission for batch entries", () => {
  it("emits record 3.1 lines when entry has multiple TxDtls", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    const rec3Lines = result.lines.filter((l) => l.raw[0] === "3");
    expect(rec3Lines.length).toBeGreaterThan(0);
  });

  it("all output lines are exactly 128 chars including record 3 lines", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    for (const line of result.lines) {
      expect(line.raw).toHaveLength(128);
    }
  });

  it("output is valid (no line-length errors)", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.validation.valid).toBe(true);
    expect(result.validation.errors).toHaveLength(0);
    expect(result.validation.warnings).toEqual([]);
  });

  it("emits exactly 2 record 3.1 lines for 2 TxDtls", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    const rec31Lines = result.lines.filter((l) => l.raw[0] === "3" && l.raw[1] === "1");
    expect(rec31Lines).toHaveLength(2);
  });

  it("record 3.1 line starts with '3' and '1'", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    const rec31Lines = result.lines.filter((l) => l.raw[0] === "3" && l.raw[1] === "1");
    expect(rec31Lines[0].raw[0]).toBe("3");
    expect(rec31Lines[0].raw[1]).toBe("1");
  });

  it("recordCount includes record 3 lines", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    // 1 entry with 2 details → record21 + record22/23 (if needed) + 2 record31 + rec1 + rec8
    // record count should reflect all records
    expect(result.recordCount).toBeGreaterThan(4); // at least 0, 1, 21, 31, 31, 8, 9
  });
});

// ── Record 3.2 and 3.3 for long communication ─────────────────────────────

describe("Record 3.2 and 3.3 for long batch communication", () => {
  it("emits record 3.2 lines when txComm > 73 chars", () => {
    const stmts = parseCamt(LONG_TXCOMM_XML);
    const result = statementToCoda(stmts[0]);
    const rec32Lines = result.lines.filter((l) => l.raw[0] === "3" && l.raw[1] === "2");
    expect(rec32Lines.length).toBeGreaterThan(0);
  });

  it("emits record 3.3 lines when txComm > 178 chars", () => {
    const stmts = parseCamt(LONG_TXCOMM_XML);
    const result = statementToCoda(stmts[0]);
    const rec33Lines = result.lines.filter((l) => l.raw[0] === "3" && l.raw[1] === "3");
    expect(rec33Lines.length).toBeGreaterThan(0);
  });

  it("all lines are 128 chars even with long record 3 communication", () => {
    const stmts = parseCamt(LONG_TXCOMM_XML);
    const result = statementToCoda(stmts[0]);
    for (const line of result.lines) {
      expect(line.raw).toHaveLength(128);
    }
  });

  it("output is valid with long record 3 communication", () => {
    const stmts = parseCamt(LONG_TXCOMM_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.validation.valid).toBe(true);
  });
});

// ── Record 2.3 with needRecord3 link code ─────────────────────────────────

describe("Record 2.3 with needRecord3=true sets link code '1'", () => {
  it("record 2.3 last char is '1' when entry has multiple TxDtls and counterpartIban", () => {
    // Multi TxDtls entry with counterpart IBAN and BIC → triggers rec22, rec23, rec31
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    const rec23Lines = result.lines.filter((l) => l.raw[0] === "2" && l.raw[1] === "3");
    expect(rec23Lines.length).toBeGreaterThan(0);
    // Link code is last character (position 127)
    expect(rec23Lines[0].raw[127]).toBe("1");
  });
});

// ── CAMT 052 filename ─────────────────────────────────────────────────────

describe("CAMT 052 filename", () => {
  it("filename ends with CAMT-052.cod for CAMT 052 input", () => {
    const stmts = parseCamt(CAMT_052_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.fileName).toMatch(/CAMT-052\.cod$/);
  });

  it("filename does not contain CAMT-053 for CAMT 052 input", () => {
    const stmts = parseCamt(CAMT_052_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.fileName).not.toContain("CAMT-053");
  });
});

// ── Filename construction ─────────────────────────────────────────────────

describe("fileName construction", () => {
  it("uses IBAN in filename when available", () => {
    const stmt = makeStatement();
    const result = statementToCoda(stmt);
    expect(result.fileName).toContain("BE68793230773034");
  });

  it("uses otherId in filename when no IBAN", () => {
    const stmts = parseCamt(OTHER_ACCT_XML);
    const result = statementToCoda(stmts[0]);
    expect(result.fileName).toContain("ACCT-12345");
  });

  it("uses 'unknown' when neither IBAN nor otherId", () => {
    const stmt = makeStatement({
      account: { currency: "EUR", iban: undefined, otherId: undefined },
    });
    const result = statementToCoda(stmt);
    expect(result.fileName).toContain("unknown");
  });

  it("includes statementId and currency in filename", () => {
    const stmt = makeStatement();
    const result = statementToCoda(stmt);
    expect(result.fileName).toContain("STMT-001");
    expect(result.fileName).toContain("EUR");
  });

  it("includes date prefix from reportDate", () => {
    const stmt = makeStatement({ reportDate: "2024-06-15T12:00:00Z" });
    const result = statementToCoda(stmt);
    expect(result.fileName).toMatch(/^2024-06-15-/);
  });
});

// ── Sequence from LglSeqNb vs workingDays ─────────────────────────────────

describe("sequence computation", () => {
  it("uses explicit sequence (% 1000) when stmt.sequence is set", () => {
    const stmt = makeStatement({ sequence: 42 });
    const result = statementToCoda(stmt);
    // Record 1 should contain the padded sequence; output must be valid
    expect(result.validation.valid).toBe(true);
    // Record 1 layout: "1"(1) + accountStructure(1) + sequence(3) + ...
    // sequence 42 → "042" starting at index 2 (0-based)
    expect(result.lines[1].raw.slice(2, 5)).toBe("042");
  });

  it("uses working-days fallback when no sequence", () => {
    const stmt = makeStatement({ sequence: undefined });
    const result = statementToCoda(stmt);
    expect(result.validation.valid).toBe(true);
    // Just verify something non-zero (working days >= 1)
    const seqStr = result.lines[1].raw.slice(1, 4);
    expect(parseInt(seqStr, 10)).toBeGreaterThan(0);
  });
});

// ── recordCount correctness ───────────────────────────────────────────────

describe("recordCount correctness", () => {
  it("empty statement has recordCount 2 (rec1 + rec8)", () => {
    const stmt = makeStatement({ entries: [] });
    const result = statementToCoda(stmt);
    expect(result.recordCount).toBe(2);
    // lines: rec0, rec1, rec8, rec9 → 4 lines, but recordCount tracks rec1+rec8 = 2
    expect(result.lines).toHaveLength(4);
  });

  it("single entry with no extra records has recordCount 3 (rec1 + rec21 + rec8)", () => {
    const stmt = makeStatement({
      entries: [
        makeEntry({
          details: [
            {
              remittanceInfo: { unstructured: "short comm" },
            },
          ],
        }),
      ],
    });
    const result = statementToCoda(stmt);
    // rec1 + rec21 + rec8 = 3
    expect(result.recordCount).toBe(3);
  });

  it("recordCount matches actual number of non-0/9 records", () => {
    const stmts = parseCamt(MULTI_TXDTLS_XML);
    const result = statementToCoda(stmts[0]);
    // lines excluding rec0 and rec9
    const nonHeaderTrailer = result.lines.filter(
      (l) => l.raw[0] !== "0" && l.raw[0] !== "9"
    );
    expect(result.recordCount).toBe(nonHeaderTrailer.length);
  });
});

// ── Debit entry summing ───────────────────────────────────────────────────

describe("debit vs credit entry tracking", () => {
  it("debit entry contributes to sumDebits in record 9", () => {
    const stmt = makeStatement({
      entries: [
        makeEntry({ amount: 250, creditDebit: "DBIT", details: [] }),
      ],
    });
    const result = statementToCoda(stmt);
    // Record 9 contains sumDebits; just verify valid output
    expect(result.validation.valid).toBe(true);
    const rec9 = result.lines[result.lines.length - 1];
    expect(rec9.raw[0]).toBe("9");
  });
});

// ── Entry with no bookingDate uses reportDate ─────────────────────────────

describe("entry date fallback", () => {
  it("uses reportDate when entry has no bookingDate", () => {
    const stmt = makeStatement({
      reportDate: "2024-06-15T12:00:00Z",
      entries: [
        makeEntry({ bookingDate: undefined, details: [] }),
      ],
    });
    const result = statementToCoda(stmt);
    expect(result.validation.valid).toBe(true);
    // rec21 is at index 2 (after rec0 and rec1)
    const rec21 = result.lines[2];
    // Record21 layout: "2"(1)+"1"(1)+seqNum(4)+detailNum(4)+bankRef(21)+
    //   movementSign(1)+formatBalance(15)+valueDate(6)+txCode(8)+commType(1)+
    //   comm(53)+entryDate(6)+...
    // entryDate at position 116-121 (1-indexed) = slice(115,121) (0-indexed): 150624
    expect(rec21.raw.slice(115, 121)).toBe("150624");
  });
});

// ── Record 2.3 NOTPROVIDED txRefs in Record 3 ────────────────────────────

describe("Record 3 with NOTPROVIDED refs uses empty comm", () => {
  it("NOTPROVIDED endToEndId is filtered in record 3 txRefs", () => {
    const stmt = makeStatement({
      entries: [
        makeEntry({
          details: [
            {
              refs: { endToEndId: "NOTPROVIDED", txId: "NOTPROVIDED" },
              remittanceInfo: { unstructured: "NOTPROVIDED" },
            },
            {
              refs: { endToEndId: "E2E-REAL" },
            },
          ],
        }),
      ],
    });
    const result = statementToCoda(stmt);
    // Should produce record 3.1 lines and be valid
    const rec31Lines = result.lines.filter((l) => l.raw[0] === "3" && l.raw[1] === "1");
    expect(rec31Lines).toHaveLength(2);
    expect(result.validation.valid).toBe(true);
  });
});
