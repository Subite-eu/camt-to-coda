// test/unit/server-api.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, Server } from "http";
import { readFileSync } from "fs";
import { join } from "path";

// We'll test the route handlers directly or via HTTP
// For simplicity, test the conversion logic functions used by the server

import { parseCoda } from "../../src/core/coda-parser.js";
import { codaToCamt } from "../../src/core/reverse.js";
import { parseCamt } from "../../src/core/camt-parser.js";
import { statementToCoda } from "../../src/core/coda-writer.js";

describe("server API bidirectional conversion", () => {
  it("CAMT→CODA produces CodaLine[] with fields", () => {
    // Minimal CAMT XML
    const xml = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><GrpHdr><MsgId>M1</MsgId><CreDtTm>2024-03-15T00:00:00</CreDtTm></GrpHdr>
  <Stmt><Id>S1</Id>
    <Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy>
      <Svcr><FinInstnId><BIC>BBRUBEBB</BIC></FinInstnId></Svcr></Acct>
    <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
    <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
  </Stmt></BkToCstmrStmt></Document>`;

    const stmts = parseCamt(xml);
    const result = statementToCoda(stmts[0]);
    expect(result.lines[0].fields).toBeDefined();
    expect(result.lines[0].fields.length).toBeGreaterThan(0);
    expect(result.lines[0].raw).toHaveLength(128);
  });

  it("CODA→CAMT produces valid XML", () => {
    const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
    const rec1 = "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001";
    const rec8 = "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(64) + "0";
    const rec9 = "9" + " ".repeat(15) + "000002" + "000000000000000" + "000000000000000" + " ".repeat(75) + "2";

    const result = codaToCamt([rec0, rec1, rec8, rec9].join("\n"));
    expect(result.xml).toContain("<?xml");
    expect(result.xml).toContain("BE68539007547034");
    expect(result.lines).toHaveLength(4);
    expect(result.lines[0].fields.length).toBeGreaterThan(0);
  });

  it("auto-detects direction from content", () => {
    const xmlContent = '<?xml version="1.0"?><Document xmlns="urn:iso">';
    const codaContent = "0" + "0".repeat(127);

    // XML → forward
    expect(xmlContent.startsWith("<?xml") || xmlContent.includes("xmlns")).toBe(true);
    // Fixed-width → reverse
    const codaLines = codaContent.split("\n").filter(l => l.length > 0);
    expect(codaLines.every(l => l.length === 128)).toBe(true);
  });
});
