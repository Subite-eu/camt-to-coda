import type { FieldDef } from "./types.js";

export const RECORD21_FIELDS: FieldDef[] = [
  { name: "recordType",        start: 0,   length: 1,  description: "Record type (2)" },
  { name: "articleNumber",     start: 1,   length: 1,  description: "Article number (1 = movement)" },
  { name: "sequenceNumber",    start: 2,   length: 4,  description: "Continuous sequence number" },
  { name: "detailNumber",      start: 6,   length: 4,  description: "Detail number" },
  { name: "bankReference",     start: 10,  length: 21, description: "Bank reference", sourceXPath: "Ntry/NtryRef" },
  { name: "amountSign",        start: 31,  length: 1,  description: "0=credit, 1=debit", sourceXPath: "Ntry/CdtDbtInd" },
  { name: "amount",            start: 32,  length: 15, description: "Amount (3 decimals)", sourceXPath: "Ntry/Amt" },
  { name: "valueDate",         start: 47,  length: 6,  description: "Value date DDMMYY", sourceXPath: "Ntry/ValDt/Dt" },
  { name: "transactionCode",   start: 53,  length: 8,  description: "CODA transaction code", sourceXPath: "Ntry/BkTxCd/Domn" },
  { name: "communicationType", start: 61,  length: 1,  description: "0=unstructured, 1=structured" },
  { name: "communication",     start: 62,  length: 53, description: "Communication zone 1", sourceXPath: "Ntry/NtryDtls/TxDtls/RmtInf" },
  { name: "entryDate",         start: 115, length: 6,  description: "Entry/booking date DDMMYY", sourceXPath: "Ntry/BookgDt/Dt" },
  { name: "statementSequence", start: 121, length: 3,  description: "Statement sequence" },
  { name: "globalisationCode", start: 124, length: 1,  description: "0=simple, 1=batch with details" },
  { name: "nextCode",          start: 125, length: 1,  description: "0=last, 1=more follows" },
  { name: "blank",             start: 126, length: 1,  description: "Reserved" },
  { name: "linkCode",          start: 127, length: 1,  description: "0=simple, 1=linked to Record 3" },
];
