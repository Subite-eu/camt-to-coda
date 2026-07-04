import { describe, it, expect } from "vitest";
import { convert } from "./convert";
import { buildFieldIndex } from "./fields";

const CAMT = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
<GrpHdr><MsgId>M</MsgId><CreDtTm>2024-03-15</CreDtTm></GrpHdr>
<Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
</Stmt></BkToCstmrStmt></Document>`;

describe("buildFieldIndex", () => {
  it("creates an entry per non-blank CODA field with positions and xpath", () => {
    const r = convert(CAMT, "camt-to-coda", false);
    const idx = buildFieldIndex(r.codaLines);
    const acct = idx.find((f) => f.name === "accountNumber");
    expect(acct).toBeDefined();
    expect(acct!.codaPos).toBe("6-39"); // 1-indexed: start 5 (0-idx) → pos 6, len 34 → 39
    expect(acct!.value).toContain("BE68539007547034");
    expect(acct!.id).toMatch(/^1:accountNumber/);
  });

  it("skips blank fields", () => {
    const r = convert(CAMT, "camt-to-coda", false);
    const idx = buildFieldIndex(r.codaLines);
    expect(idx.every((f) => f.value.trim().length > 0)).toBe(true);
  });
});
