// src/core/field-defs/extract.ts
import type { FieldDef, CodaField } from "./types.js";

export function extractFields(line: string, defs: FieldDef[]): CodaField[] {
  return defs.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: line.slice(def.start, def.start + def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));
}
