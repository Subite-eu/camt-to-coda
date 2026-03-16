import type { FieldDef } from "./types.js";

export const RECORD32_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (2 = batch continuation)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "communication",   start: 10,  length: 105, description: "Communication zone (105 chars)" },
  { name: "blanks",          start: 115, length: 10, description: "Blanks" },
  { name: "nextCode",        start: 125, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank",           start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code" },
];
