// src/core/field-defs/types.ts

/** Static definition of a field within a 128-char CODA record */
export interface FieldDef {
  name: string;
  start: number;       // 0-based position
  length: number;
  description: string;
  sourceXPath?: string; // CAMT XPath this field maps to/from
}

/** Runtime field instance with actual value */
export interface CodaField {
  name: string;
  start: number;
  length: number;
  value: string;
  sourceXPath?: string;
  description: string;
}

/** A single CODA line with metadata */
export interface CodaLine {
  recordType: string;  // "0", "1", "2.1", "2.2", "2.3", "3.1", "3.2", "3.3", "8", "9"
  raw: string;         // 128-char string
  fields: CodaField[];
  sequenceNumber?: number;
}

/** Full conversion output with metadata */
export interface AnnotatedCodaOutput {
  fileName: string;
  lines: CodaLine[];
  recordCount: number;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
}
