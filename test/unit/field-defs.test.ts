// test/unit/field-defs.test.ts
import { describe, it, expect } from "vitest";
import type { FieldDef, CodaField, CodaLine, AnnotatedCodaOutput } from "../../src/core/field-defs/types.js";
import { extractFields } from "../../src/core/field-defs/extract.js";

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
