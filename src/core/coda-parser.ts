// src/core/coda-parser.ts
import type { CodaLine } from "./field-defs/types.js";
import { extractFields } from "./field-defs/extract.js";
import { RECORD0_FIELDS } from "./field-defs/record0-fields.js";
import { RECORD1_FIELDS } from "./field-defs/record1-fields.js";
import { RECORD21_FIELDS } from "./field-defs/record21-fields.js";
import { RECORD22_FIELDS } from "./field-defs/record22-fields.js";
import { RECORD23_FIELDS } from "./field-defs/record23-fields.js";
import { RECORD31_FIELDS } from "./field-defs/record31-fields.js";
import { RECORD32_FIELDS } from "./field-defs/record32-fields.js";
import { RECORD33_FIELDS } from "./field-defs/record33-fields.js";
import { RECORD4_FIELDS } from "./field-defs/record4-fields.js";
import { RECORD8_FIELDS } from "./field-defs/record8-fields.js";
import { RECORD9_FIELDS } from "./field-defs/record9-fields.js";
import type { FieldDef } from "./field-defs/types.js";

function classifyLine(line: string): { recordType: string; fields: FieldDef[] } {
  const rec = line[0];
  const art = line[1];

  switch (rec) {
    case "0": return { recordType: "0", fields: RECORD0_FIELDS };
    case "1": return { recordType: "1", fields: RECORD1_FIELDS };
    case "2":
      switch (art) {
        case "1": return { recordType: "2.1", fields: RECORD21_FIELDS };
        case "2": return { recordType: "2.2", fields: RECORD22_FIELDS };
        case "3": return { recordType: "2.3", fields: RECORD23_FIELDS };
        default: throw new Error(`Unknown Record 2 article: ${art}`);
      }
    case "3":
      switch (art) {
        case "1": return { recordType: "3.1", fields: RECORD31_FIELDS };
        case "2": return { recordType: "3.2", fields: RECORD32_FIELDS };
        case "3": return { recordType: "3.3", fields: RECORD33_FIELDS };
        default: throw new Error(`Unknown Record 3 article: ${art}`);
      }
    case "4": return { recordType: "4", fields: RECORD4_FIELDS };
    case "8": return { recordType: "8", fields: RECORD8_FIELDS };
    case "9": return { recordType: "9", fields: RECORD9_FIELDS };
    default: throw new Error(`Unknown record type: ${rec}`);
  }
}

export function parseCoda(content: string): CodaLine[] {
  // Normalize line endings
  const rawLines = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");

  // Filter empty trailing lines
  const lines = rawLines.filter((l) => l.length > 0);

  // Strict validation: all lines must be exactly 128 chars
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 128) {
      throw new Error(
        `Line ${i + 1}: ${lines[i].length} chars (expected 128)`
      );
    }
  }

  return lines.map((line) => {
    const { recordType, fields: fieldDefs } = classifyLine(line);
    return {
      recordType,
      raw: line,
      fields: extractFields(line, fieldDefs),
    };
  });
}
