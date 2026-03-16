import type { FieldDef } from "./types.js";

export const RECORD9_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (9 = trailer)" },
  { name: "blanks1",         start: 1,   length: 15, description: "Blanks" },
  { name: "recordCount",     start: 16,  length: 6,  description: "Number of records" },
  { name: "sumDebits",       start: 22,  length: 15, description: "Sum of debit amounts (3 decimals)" },
  { name: "sumCredits",      start: 37,  length: 15, description: "Sum of credit amounts (3 decimals)" },
  { name: "blanks2",         start: 52,  length: 75, description: "Blanks" },
  { name: "lastFile",        start: 127, length: 1,  description: "Last file indicator (2)" },
];
