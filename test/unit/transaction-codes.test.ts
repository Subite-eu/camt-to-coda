import { describe, it, expect } from "vitest";
import { mapTransactionCode, reverseMapTransactionCode, describeCodaCode } from "../../src/core/transaction-codes.js";

// Codes per CODA 2.6 §3 + Annexe II: type(1)+family(2)+transaction(2)+category(3).
// Verified against a real Belgian .cod: incoming SEPA CT = 00150000, outgoing = 00101000.
describe("mapTransactionCode", () => {
  it("PMNT/ICDT/ESCT → 00101000 (outgoing SEPA CT, fam 01 tx 01)", () =>
    expect(mapTransactionCode("PMNT", "ICDT", "ESCT")).toBe("00101000"));
  it("PMNT/RCDT/ESCT → 00150000 (incoming SEPA CT, fam 01 tx 50)", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ESCT")).toBe("00150000"));
  it("PMNT/ICDT/INST → 00201000 (instant out, fam 02 tx 01)", () =>
    expect(mapTransactionCode("PMNT", "ICDT", "INST")).toBe("00201000"));
  it("PMNT/RCDT/INST → 00250000 (instant in, fam 02 tx 50)", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "INST")).toBe("00250000"));
  it("PMNT/IDDT/ESDD → 00501000 (SEPA DD paid, fam 05 tx 01)", () =>
    expect(mapTransactionCode("PMNT", "IDDT", "ESDD")).toBe("00501000"));
  it("PMNT/RDDT/ESDD → 00550000 (SEPA DD collected, fam 05 tx 50)", () =>
    expect(mapTransactionCode("PMNT", "RDDT", "ESDD")).toBe("00550000"));
  it("PMNT/ICDT/ISCT → 04101000 (international out, fam 41 tx 01)", () =>
    expect(mapTransactionCode("PMNT", "ICDT", "ISCT")).toBe("04101000"));
  it("PMNT/RCDT/ISCT → 04150000 (international in, fam 41 tx 50)", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ISCT")).toBe("04150000"));
  it("PMNT/CCRD/anything → 00402000 (card wildcard, fam 04 tx 02)", () =>
    expect(mapTransactionCode("PMNT", "CCRD", "VISA")).toBe("00402000"));
  it("CAMT/ACCB/INTR → 03550000 (interest, fam 35)", () =>
    expect(mapTransactionCode("CAMT", "ACCB", "INTR")).toBe("03550000"));
  it("CAMT/ACCB/CHRG → 03537000 (charges, fam 35 tx 37)", () =>
    expect(mapTransactionCode("CAMT", "ACCB", "CHRG")).toBe("03537000"));
  it("unknown → 8 spaces", () =>
    expect(mapTransactionCode("XXXX", "YYYY", "ZZZZ")).toBe("        "));
  it("missing domain → 8 spaces", () =>
    expect(mapTransactionCode(undefined, undefined, undefined)).toBe("        "));
  it("missing family → 8 spaces", () =>
    expect(mapTransactionCode("PMNT", undefined, undefined)).toBe("        "));

  // BBA proprietary code tests
  it("BBA proprietary 8-digit code used directly", () =>
    expect(mapTransactionCode(undefined, undefined, undefined, "00150000", "BBA")).toBe("00150000"));
  it("BBA proprietary wins over domain/family/subFamily mapping", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ESCT", "00101000", "BBA")).toBe("00101000"));
  it("raw 8-digit proprietary without issuer used when no domain", () =>
    expect(mapTransactionCode(undefined, undefined, undefined, "00150000", undefined)).toBe("00150000"));
  it("non-8-digit proprietary falls back to domain mapping", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ESCT", "ATSISK", "BBA")).toBe("00150000"));
  it("non-8-digit proprietary without domain → 8 spaces", () =>
    expect(mapTransactionCode(undefined, undefined, undefined, "ATSISK", undefined)).toBe("        "));
  it("raw 8-digit proprietary with domain still uses domain mapping", () =>
    expect(mapTransactionCode("PMNT", "RCDT", "ESCT", "00150000", undefined)).toBe("00150000"));
});

describe("reverseMapTransactionCode", () => {
  it("00150000 → PMNT/RCDT/ESCT", () =>
    expect(reverseMapTransactionCode("00150000")).toEqual({ domain: "PMNT", family: "RCDT", subFamily: "ESCT" }));
  it("00101000 → PMNT/ICDT/ESCT", () =>
    expect(reverseMapTransactionCode("00101000")).toEqual({ domain: "PMNT", family: "ICDT", subFamily: "ESCT" }));
  it("00402000 → PMNT/CCRD/OTHR (synthetic)", () =>
    expect(reverseMapTransactionCode("00402000")).toEqual({ domain: "PMNT", family: "CCRD", subFamily: "OTHR" }));
  it("unknown code → undefined", () =>
    expect(reverseMapTransactionCode("99999999")).toBeUndefined());
  it("8 spaces → undefined", () =>
    expect(reverseMapTransactionCode("        ")).toBeUndefined());
  it("all known codes round-trip", () => {
    const codes = ["00101000", "00150000", "00201000", "00250000", "00501000",
                   "00550000", "04101000", "04150000", "03550000", "03537000", "00402000"];
    for (const code of codes) expect(reverseMapTransactionCode(code)).toBeDefined();
  });
});

describe("describeCodaCode", () => {
  it("decodes a real incoming SEPA credit transfer code", () => {
    const d = describeCodaCode("00150000");
    expect(d).toMatchObject({
      type: "0", family: "01", transaction: "50", category: "000",
      familyName: "Domestic or local SEPA credit transfers",
      categoryDescription: "Net amount",
    });
    expect(d?.transactionDescription).toMatch(/transfer in your favour/i);
  });
  it("decodes an outgoing SEPA credit transfer code", () => {
    const d = describeCodaCode("00101000");
    expect(d?.family).toBe("01");
    expect(d?.transaction).toBe("01");
    expect(d?.transactionDescription).toMatch(/individual transfer order/i);
  });
  it("returns undefined for non-numeric codes", () => {
    expect(describeCodaCode("        ")).toBeUndefined();
    expect(describeCodaCode("ABCD1234")).toBeUndefined();
  });
});
