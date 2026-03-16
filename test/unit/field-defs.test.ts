// test/unit/field-defs.test.ts
import { describe, it, expect } from "vitest";
import type { FieldDef, CodaField, CodaLine, AnnotatedCodaOutput } from "../../src/core/field-defs/types.js";

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
