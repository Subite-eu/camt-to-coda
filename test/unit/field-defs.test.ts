// test/unit/field-defs.test.ts
import { describe, it, expect } from "vitest";
import type { FieldDef, CodaField, CodaLine, AnnotatedCodaOutput } from "../../src/core/field-defs/types.js";
import { extractFields } from "../../src/core/field-defs/extract.js";
import {
  RECORD0_FIELDS, RECORD1_FIELDS, RECORD21_FIELDS, RECORD22_FIELDS,
  RECORD23_FIELDS, RECORD31_FIELDS, RECORD32_FIELDS, RECORD33_FIELDS,
  RECORD4_FIELDS, RECORD8_FIELDS, RECORD9_FIELDS,
} from "../../src/core/field-defs/index.js";

const ALL_FIELD_DEFS = [
  { name: "Record 0", fields: RECORD0_FIELDS },
  { name: "Record 1", fields: RECORD1_FIELDS },
  { name: "Record 2.1", fields: RECORD21_FIELDS },
  { name: "Record 2.2", fields: RECORD22_FIELDS },
  { name: "Record 2.3", fields: RECORD23_FIELDS },
  { name: "Record 3.1", fields: RECORD31_FIELDS },
  { name: "Record 3.2", fields: RECORD32_FIELDS },
  { name: "Record 3.3", fields: RECORD33_FIELDS },
  { name: "Record 4", fields: RECORD4_FIELDS },
  { name: "Record 8", fields: RECORD8_FIELDS },
  { name: "Record 9", fields: RECORD9_FIELDS },
];

describe("field-defs types", () => {
  it("CodaField satisfies FieldDef shape plus value", () => {
    const field: CodaField = {
      name: "test",
      start: 0,
      length: 5,
      value: "hello",
      description: "Test field",
    };
    expect(field.value).toBe("hello");
    expect(field.start + field.length).toBeLessThanOrEqual(128);
  });

  it("CodaLine has raw and fields", () => {
    const line: CodaLine = {
      recordType: "2.1",
      raw: "x".repeat(128),
      fields: [],
    };
    expect(line.raw).toHaveLength(128);
  });
});

describe("extractFields", () => {
  const defs: FieldDef[] = [
    { name: "recordType", start: 0, length: 1, description: "Record type" },
    { name: "data", start: 1, length: 4, description: "Data" },
    { name: "rest", start: 5, length: 123, description: "Rest" },
  ];

  it("extracts field values from a line by position", () => {
    const line = "2" + "ABCD" + " ".repeat(123);
    const fields = extractFields(line, defs);
    expect(fields).toHaveLength(3);
    expect(fields[0].value).toBe("2");
    expect(fields[0].name).toBe("recordType");
    expect(fields[1].value).toBe("ABCD");
    expect(fields[2].value).toHaveLength(123);
  });

  it("preserves sourceXPath from FieldDef", () => {
    const defsWithXPath: FieldDef[] = [
      { name: "amount", start: 0, length: 15, description: "Amount", sourceXPath: "Ntry/Amt" },
      { name: "rest", start: 15, length: 113, description: "Rest" },
    ];
    const line = "000000001000000" + " ".repeat(113);
    const fields = extractFields(line, defsWithXPath);
    expect(fields[0].sourceXPath).toBe("Ntry/Amt");
    expect(fields[1].sourceXPath).toBeUndefined();
  });
});

describe("FieldDef completeness", () => {
  it.each(ALL_FIELD_DEFS)("$name covers all 128 positions", ({ fields }) => {
    const totalLength = fields.reduce((sum, f) => sum + f.length, 0);
    expect(totalLength).toBe(128);
    expect(fields[0].start).toBe(0);
    for (let i = 1; i < fields.length; i++) {
      const prev = fields[i - 1];
      expect(fields[i].start).toBe(prev.start + prev.length);
    }
    const last = fields[fields.length - 1];
    expect(last.start + last.length).toBe(128);
  });

  it.each(ALL_FIELD_DEFS)("$name has unique field names", ({ fields }) => {
    const names = fields.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it.each(ALL_FIELD_DEFS)("$name has non-empty descriptions", ({ fields }) => {
    for (const f of fields) {
      expect(f.description.length).toBeGreaterThan(0);
    }
  });
});
