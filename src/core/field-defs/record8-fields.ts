import type { FieldDef } from "./types.js";

export const RECORD8_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (8 = new balance)" },
  { name: "sequence",        start: 1,   length: 3,  description: "Serial number of sequence" },
  { name: "accountNumber",   start: 4,   length: 34, description: "Account number (IBAN)", sourceXPath: "Acct/Id/IBAN" },
  { name: "currency",        start: 38,  length: 3,  description: "Currency code", sourceXPath: "Acct/Ccy" },
  { name: "balanceSign",     start: 41,  length: 1,  description: "Balance sign (0=credit, 1=debit)", sourceXPath: "Bal/CdtDbtInd" },
  { name: "balanceAmount",   start: 42,  length: 15, description: "New balance (3 decimals)", sourceXPath: "Bal/Amt" },
  { name: "balanceDate",     start: 57,  length: 6,  description: "Balance date DDMMYY", sourceXPath: "Bal/Dt" },
  { name: "blanks",          start: 63,  length: 64, description: "Blanks" },
  { name: "linkCode",        start: 127, length: 1,  description: "Link code (always 0)" },
];
