// test/unit/coda-parser-reverse.test.ts
import { describe, it, expect } from "vitest";
import { parseCoda } from "../../src/core/coda-parser.js";

// Build minimal valid CODA records (each exactly 128 chars)
const rec0 = "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2";
const rec1 = "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001";
const rec8 = "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001500000" + "150324" + " ".repeat(64) + "0";
const rec9 = "9" + " ".repeat(15) + "000004" + "000000000000000" + "000000000500000" + " ".repeat(75) + "2";

describe("parseCoda", () => {
  it("parses a minimal CODA file (0 + 1 + 8 + 9)", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    expect(lines).toHaveLength(4);
    expect(lines[0].recordType).toBe("0");
    expect(lines[1].recordType).toBe("1");
    expect(lines[2].recordType).toBe("8");
    expect(lines[3].recordType).toBe("9");
  });

  it("each parsed line has fields covering 128 positions", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    for (const line of lines) {
      const total = line.fields.reduce((s, f) => s + f.length, 0);
      expect(total).toBe(128);
    }
  });

  it("handles CRLF line endings", () => {
    const content = [rec0, rec1, rec8, rec9].join("\r\n");
    const lines = parseCoda(content);
    expect(lines).toHaveLength(4);
  });

  it("handles trailing newline", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n") + "\n";
    const lines = parseCoda(content);
    expect(lines).toHaveLength(4);
  });

  it("rejects lines not exactly 128 chars", () => {
    const badLine = rec0.slice(0, 100);
    const content = [badLine, rec1, rec8, rec9].join("\n");
    expect(() => parseCoda(content)).toThrow(/128/);
  });

  it("classifies Record 2.x subtypes correctly", () => {
    // Build a Record 2.1 line (128 chars)
    const rec21 = "2" + "1" + "0001" + "0000" + " ".repeat(21) + "0" + "000000001000000" + "150324" + "04500001" + "0" + " ".repeat(53) + "150324" + "000" + "0" + "0" + " " + "0";
    const content = [rec0, rec1, rec21, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    expect(lines[2].recordType).toBe("2.1");
  });

  it("extracts field values correctly from Record 1", () => {
    const content = [rec0, rec1, rec8, rec9].join("\n");
    const lines = parseCoda(content);
    const rec1Fields = lines[1].fields;
    const iban = rec1Fields.find(f => f.name === "accountNumber");
    expect(iban?.value.trim()).toBe("BE68539007547034");
    const currency = rec1Fields.find(f => f.name === "currency");
    expect(currency?.value).toBe("EUR");
  });
});
