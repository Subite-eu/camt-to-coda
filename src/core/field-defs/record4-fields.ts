import type { FieldDef } from "./types.js";

export const RECORD4_FIELDS: FieldDef[] = [
  { name: "recordType",    start: 0,   length: 1,   description: "Record type (4 = free communication)" },
  { name: "detailNumber",  start: 1,   length: 4,   description: "Detail number" },
  { name: "sequenceNumber",start: 5,   length: 4,   description: "Sequence number" },
  { name: "blanks1",       start: 9,   length: 23,  description: "Blanks" },
  { name: "communication", start: 32,  length: 80,  description: "Free communication text" },
  { name: "blanks2",       start: 112, length: 15,  description: "Blanks" },
  { name: "linkCode",      start: 127, length: 1,   description: "Link code" },
];
