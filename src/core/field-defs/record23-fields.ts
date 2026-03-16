import type { FieldDef } from "./types.js";

export const RECORD23_FIELDS: FieldDef[] = [
  { name: "recordType",       start: 0,   length: 1,  description: "Record type (2)" },
  { name: "articleNumber",    start: 1,   length: 1,  description: "Article number (3 = counterparty)" },
  { name: "sequenceNumber",   start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",     start: 6,   length: 4,  description: "Detail number" },
  { name: "counterpartAccount", start: 10, length: 34, description: "Counterparty account (IBAN)", sourceXPath: "Ntry/NtryDtls/TxDtls/RltdPties/CdtrAcct/Id/IBAN" },
  { name: "currency",         start: 44,  length: 3,  description: "Currency code" },
  { name: "counterpartName",  start: 47,  length: 35, description: "Counterparty name", sourceXPath: "Ntry/NtryDtls/TxDtls/RltdPties/Cdtr/Nm" },
  { name: "communication",    start: 82,  length: 43, description: "Communication zone 3", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "nextCode",         start: 125, length: 1,  description: "Next code (always 0)" },
  { name: "blank",            start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",         start: 127, length: 1,  description: "0=simple, 1=linked to Record 3" },
];
