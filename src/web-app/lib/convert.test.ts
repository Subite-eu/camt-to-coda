import { describe, it, expect } from "vitest";
import { convert, type ConvertResult } from "./convert";

const SAMPLE_CAMT = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
<GrpHdr><MsgId>M</MsgId><CreDtTm>2024-03-15</CreDtTm></GrpHdr>
<Stmt><Id>S</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy>
<Svcr><FinInstnId><BIC>GEBABEBB</BIC></FinInstnId></Svcr></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
</Stmt></BkToCstmrStmt></Document>`;

describe("convert", () => {
  it("forward CAMT->CODA returns output lines + validation, all 128 chars", () => {
    const r: ConvertResult = convert(SAMPLE_CAMT, "camt-to-coda", false);
    expect(r.direction).toBe("camt-to-coda");
    expect(r.error).toBeUndefined();
    expect(r.outputText.split("\n").every((l) => l.length === 128)).toBe(true);
    expect(r.validation.valid).toBe(true);
    expect(r.codaLines.length).toBeGreaterThan(0);
  });

  it("anonymize=true scrubs the IBAN from the output", () => {
    const plain = convert(SAMPLE_CAMT, "camt-to-coda", false);
    expect(plain.outputText).toContain("BE68539007547034");
    const anon = convert(SAMPLE_CAMT, "camt-to-coda", true);
    expect(anon.outputText).not.toContain("BE68539007547034");
  });

  it("invalid input yields an error result, not a throw", () => {
    const r = convert("not xml at all", "camt-to-coda", false);
    expect(r.error).toBeTruthy();
    expect(r.validation.valid).toBe(false);
  });
});
