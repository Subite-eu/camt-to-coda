import type { FieldDef } from "./types.js";

export const RECORD33_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (3 = batch counterparty)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "communication",   start: 10,  length: 90, description: "Communication zone (90 chars)" },
  { name: "blanks",          start: 100, length: 25, description: "Blanks" },
  { name: "nextCode",        start: 125, length: 1,  description: "Next code (always 0)" },
  { name: "blank",           start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code" },
];
