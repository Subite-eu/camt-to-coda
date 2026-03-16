import type { FieldDef } from "./types.js";

export const RECORD1_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (1 = old balance)" },
  { name: "accountStructure",start: 1,   length: 1,  description: "Account structure (0/2/3)", sourceXPath: "Acct/Id/IBAN" },
  { name: "sequence",        start: 2,   length: 3,  description: "Serial number of continuous sequence" },
  { name: "accountNumber",   start: 5,   length: 34, description: "Account number (IBAN)", sourceXPath: "Acct/Id/IBAN" },
  { name: "currency",        start: 39,  length: 3,  description: "Currency code (ISO 4217)", sourceXPath: "Acct/Ccy" },
  { name: "balanceSign",     start: 42,  length: 1,  description: "Balance sign (0=credit, 1=debit)", sourceXPath: "Bal/CdtDbtInd" },
  { name: "balanceAmount",   start: 43,  length: 15, description: "Old balance (3 decimals)", sourceXPath: "Bal/Amt" },
  { name: "balanceDate",     start: 58,  length: 6,  description: "Balance date DDMMYY", sourceXPath: "Bal/Dt" },
  { name: "holderName",      start: 64,  length: 26, description: "Account holder name", sourceXPath: "Acct/Ownr/Nm" },
  { name: "description",     start: 90,  length: 35, description: "Statement description" },
  { name: "sequenceEnd",     start: 125, length: 3,  description: "Sequence number (repeat)" },
];
