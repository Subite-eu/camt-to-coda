import { describe, it, expect } from "vitest";
import { record21 } from "../../../src/core/records/record21.js";
import type { CamtEntry } from "../../../src/core/model.js";

const baseEntry: CamtEntry = {
  amount: 1000,
  currency: "EUR",
  creditDebit: "CRDT",
  bookingDate: "2024-06-15",
  valueDate: "2024-06-15",
  entryRef: "ENTREF001",
  details: [
    {
      refs: { endToEndId: "E2E-001", txId: "TX001" },
      counterparty: { name: "Sender Corp", iban: "BE91516952884376", bic: "SNDRBEBB" },
      remittanceInfo: { unstructured: "Invoice payment" },
    },
  ],
};

const baseParams = {
  entry: baseEntry,
  seqNum: "0001",
  comm: "Invoice payment",
  commType: "0",
  txCode: "04500001",
  entryDate: "150624",
  hasMore: false,
  needRecord3: false,
};

describe("record21", () => {
  it("returns exactly 128 characters", () => {
    expect(record21(baseParams).raw).toHaveLength(128);
  });

  it("starts with '21'", () => {
    const r = record21(baseParams).raw;
    expect(r.slice(0, 2)).toBe("21");
  });

  it("places sequence number at positions 2-5", () => {
    const r = record21(baseParams).raw;
    expect(r.slice(2, 6)).toBe("0001");
  });

  it("places detail number '0000' at positions 6-9", () => {
    const r = record21(baseParams).raw;
    expect(r.slice(6, 10)).toBe("0000");
  });

  it("places transaction code at positions 53-60", () => {
    const r = record21(baseParams).raw;
    expect(r.slice(53, 61)).toBe("04500001");
  });

  it("places movement sign at position 31 (0=credit)", () => {
    const r = record21(baseParams).raw;
    expect(r[31]).toBe("0");
  });

  it("places movement sign at position 31 (1=debit)", () => {
    const entry = { ...baseEntry, creditDebit: "DBIT" as const };
    const r = record21({ ...baseParams, entry }).raw;
    expect(r[31]).toBe("1");
  });

  it("places comm type at position 61", () => {
    const r = record21(baseParams).raw;
    expect(r[61]).toBe("0");
  });

  it("places comm at positions 62-114 (53 chars)", () => {
    const r = record21(baseParams).raw;
    const commField = r.slice(62, 115);
    expect(commField).toHaveLength(53);
    expect(commField.trim()).toBe("Invoice payment");
  });

  it("places entry date at positions 115-120", () => {
    const r = record21(baseParams).raw;
    expect(r.slice(115, 121)).toBe("150624");
  });

  it("sets next code to '1' when hasMore=true", () => {
    const r = record21({ ...baseParams, hasMore: true }).raw;
    expect(r[125]).toBe("1");
  });

  it("sets next code to '0' when hasMore=false", () => {
    const r = record21(baseParams).raw;
    expect(r[125]).toBe("0");
  });

  it("sets globalisation code based on needRecord3", () => {
    const rNo = record21({ ...baseParams, needRecord3: false }).raw;
    const rYes = record21({ ...baseParams, needRecord3: true }).raw;
    expect(rNo[124]).toBe("0");
    expect(rYes[124]).toBe("1");
  });

  it("link code at position 127 matches needRecord3", () => {
    const rNo = record21({ ...baseParams, needRecord3: false }).raw;
    const rYes = record21({ ...baseParams, needRecord3: true }).raw;
    expect(rNo[127]).toBe("0");
    expect(rYes[127]).toBe("1");
  });

  it("uses valueDate when available", () => {
    const entry = { ...baseEntry, valueDate: "2024-03-07", bookingDate: "2024-06-15" };
    const r = record21({ ...baseParams, entry }).raw;
    // valueDate 2024-03-07 → 070324
    expect(r.slice(47, 53)).toBe("070324");
  });

  it("falls back to bookingDate if no valueDate", () => {
    const entry = { ...baseEntry, valueDate: undefined, bookingDate: "2024-06-15" };
    const r = record21({ ...baseParams, entry }).raw;
    expect(r.slice(47, 53)).toBe("150624");
  });

  it("uses '000000' if no dates", () => {
    const entry = { ...baseEntry, valueDate: undefined, bookingDate: undefined };
    const r = record21({ ...baseParams, entry }).raw;
    expect(r.slice(47, 53)).toBe("000000");
  });

  it("returns CodaLine with fields array", () => {
    const result = record21(baseParams);
    expect(result.recordType).toBe("2.1");
    expect(result.fields.length).toBeGreaterThan(0);
    expect(result.fields.reduce((sum, f) => sum + f.value.length, 0)).toBe(128);
  });
});
