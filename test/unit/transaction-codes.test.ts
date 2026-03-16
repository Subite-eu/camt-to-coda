import { describe, it, expect } from "vitest";
import { mapTransactionCode } from "../../src/core/transaction-codes.js";

describe("mapTransactionCode", () => {
  it("PMNT/RCDT/ESCT → 04500001 (incoming SEPA CT)", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ESCT")).toBe("04500001"));
  it("PMNT/ICDT/ESCT → 13010001 (outgoing SEPA CT)", () =>
    expect(mapTransactionCode("PMNT", "ICDT", "ESCT")).toBe("13010001"));
  it("PMNT/ICDT/ISCT → 41010000 (outgoing international)", () =>
    expect(mapTransactionCode("PMNT", "ICDT", "ISCT")).toBe("41010000"));
  it("PMNT/RCDT/ISCT → 41500000 (incoming international)", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ISCT")).toBe("41500000"));
  it("PMNT/IDDT/ESDD → 05010000 (SEPA DD out)", () =>
    expect(mapTransactionCode("PMNT", "IDDT", "ESDD")).toBe("05010000"));
  it("PMNT/RDDT/ESDD → 05500000 (SEPA DD in)", () =>
    expect(mapTransactionCode("PMNT", "RDDT", "ESDD")).toBe("05500000"));
  it("PMNT/RCDT/INST → 02500001 (instant in)", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "INST")).toBe("02500001"));
  it("PMNT/ICDT/INST → 02010001 (instant out)", () =>
    expect(mapTransactionCode("PMNT", "ICDT", "INST")).toBe("02010001"));
  it("PMNT/CCRD/anything → 04370000 (card wildcard)", () =>
    expect(mapTransactionCode("PMNT", "CCRD", "VISA")).toBe("04370000"));
  it("CAMT/ACCB/INTR → 35010000 (interest)", () =>
    expect(mapTransactionCode("CAMT", "ACCB", "INTR")).toBe("35010000"));
  it("CAMT/ACCB/CHRG → 80370000 (charges)", () =>
    expect(mapTransactionCode("CAMT", "ACCB", "CHRG")).toBe("80370000"));
  it("unknown → 8 spaces", () =>
    expect(mapTransactionCode("XXXX", "YYYY", "ZZZZ")).toBe("        "));
  it("missing domain → 8 spaces", () =>
    expect(mapTransactionCode(undefined, undefined, undefined)).toBe("        "));
  it("missing family → 8 spaces", () =>
    expect(mapTransactionCode("PMNT", undefined, undefined)).toBe("        "));
});
