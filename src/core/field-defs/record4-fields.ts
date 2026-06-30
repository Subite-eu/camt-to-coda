import type { FieldDef } from "./types.js";

// CODA 2.6 Annexe I — Data record 4 ("free communication").
// Positions are 1-indexed in the spec; `start` here is 0-indexed (pos - 1).
export const RECORD4_FIELDS: FieldDef[] = [
  { name: "recordType",     start: 0,   length: 1,  description: "Record type (4 = free communication)" },
  { name: "blank1",         start: 1,   length: 1,  description: "Blank (pos 2)" },
  { name: "sequenceNumber", start: 2,   length: 4,  description: "Continuous sequence number (pos 3-6)" },
  { name: "detailNumber",   start: 6,   length: 4,  description: "Detail number (pos 7-10)" },
  { name: "blanks1",        start: 10,  length: 22, description: "Blank (pos 11-32)" },
  { name: "communication",  start: 32,  length: 80, description: "Free communication text (pos 33-112)" },
  { name: "blanks2",        start: 112, length: 15, description: "Blank (pos 113-127)" },
  { name: "linkCode",       start: 127, length: 1,  description: "Link code with next data record (pos 128)" },
];
