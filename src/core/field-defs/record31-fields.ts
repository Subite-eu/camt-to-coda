import type { FieldDef } from "./types.js";

export const RECORD31_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (3)" },
  { name: "articleNumber",   start: 1,   length: 1,  description: "Article number (1 = batch detail)" },
  { name: "sequenceNumber",  start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",    start: 6,   length: 4,  description: "Detail number" },
  { name: "bankReference",   start: 10,  length: 21, description: "Bank reference" },
  { name: "txCodeType",      start: 31,  length: 1,  description: "1=detail of globalisation" },
  { name: "transactionCode", start: 32,  length: 8,  description: "Transaction code" },
  { name: "communicationType", start: 40, length: 1,  description: "0=unstructured, 1=structured" },
  { name: "communication",   start: 41,  length: 73, description: "Communication zone (73 chars)", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "entryDate",       start: 114, length: 6,  description: "Entry date DDMMYY" },
  { name: "sequence",        start: 120, length: 3,  description: "Sequence" },
  { name: "globalisationCode", start: 123, length: 1, description: "0=detail of globalised movement" },
  { name: "nextCode",        start: 124, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank1",          start: 125, length: 1,  description: "Blank" },
  { name: "linkCode",        start: 126, length: 1,  description: "Link code" },
  { name: "padding",         start: 127, length: 1,  description: "Padding" },
];
