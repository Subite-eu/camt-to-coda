import type { FieldDef } from "./types.js";

// CODA 2.6 Annexe I — Data record 3.1 ("information record").
// Positions are 1-indexed in the spec; `start` here is 0-indexed (pos - 1).
export const RECORD31_FIELDS: FieldDef[] = [
  { name: "recordType",        start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",     start: 1,   length: 1,  description: "Article number (1 = information detail)" },
  { name: "sequenceNumber",    start: 2,   length: 4,  description: "Continuous sequence number (of the movement)" },
  { name: "detailNumber",      start: 6,   length: 4,  description: "Detail number" },
  { name: "bankReference",     start: 10,  length: 21, description: "Bank reference (= movement's reference)" },
  { name: "transactionCode",   start: 31,  length: 8,  description: "Transaction code (pos 32-39)", sourceXPath: "Ntry/BkTxCd" },
  { name: "communicationType", start: 39,  length: 1,  description: "0=unstructured, 1=structured (pos 40)" },
  { name: "communication",     start: 40,  length: 73, description: "Communication zone (pos 41-113)", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "blanks",            start: 113, length: 12, description: "Blank (pos 114-125)" },
  { name: "nextCode",          start: 125, length: 1,  description: "Next code (pos 126): 1=record 3.2 follows" },
  { name: "blank",             start: 126, length: 1,  description: "Blank (pos 127)" },
  { name: "linkCode",          start: 127, length: 1,  description: "Link code with next data record (pos 128)" },
];
