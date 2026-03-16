import type { FieldDef } from "./types.js";

export const RECORD22_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (2)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (2 = continuation)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "communication",   start: 10,  length: 53, description: "Communication zone 2", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "customerRef",     start: 63,  length: 35, description: "Customer reference" },
  { name: "counterpartBic",  start: 98,  length: 11, description: "Counterpart BIC", sourceXPath: "Ntry/NtryDtls/TxDtls/RltdAgts" },
  { name: "blanks",          start: 109, length: 3,  description: "Blanks" },
  { name: "rTransactionType",start: 112, length: 1,  description: "R-transaction type" },
  { name: "isoReason",       start: 113, length: 4,  description: "ISO reason code" },
  { name: "categoryPurpose", start: 117, length: 4,  description: "Category purpose" },
  { name: "purpose",         start: 121, length: 4,  description: "Purpose" },
  { name: "nextCode",        start: 125, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank",           start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code" },
];
