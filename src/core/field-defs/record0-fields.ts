import type { FieldDef } from "./types.js";

export const RECORD0_FIELDS: FieldDef[] = [
  { name: "recordType",      start: 0,   length: 1,  description: "Record type (0 = header)" },
  { name: "zeros",           start: 1,   length: 4,  description: "Zeros" },
  { name: "creationDate",    start: 5,   length: 6,  description: "Creation date DDMMYY", sourceXPath: "GrpHdr/CreDtTm" },
  { name: "bankId",          start: 11,  length: 3,  description: "Bank identification" },
  { name: "applicationCode", start: 14,  length: 2,  description: "Application code (05)" },
  { name: "duplicate",       start: 16,  length: 1,  description: "Duplicate indicator" },
  { name: "blanks1",         start: 17,  length: 7,  description: "Blanks" },
  { name: "fileReference",   start: 24,  length: 10, description: "File reference" },
  { name: "addressee",       start: 34,  length: 26, description: "Addressee name" },
  { name: "bic",             start: 60,  length: 11, description: "BIC of the bank", sourceXPath: "Acct/Svcr/FinInstnId/BIC" },
  { name: "companyNumber",   start: 71,  length: 11, description: "Company identification number" },
  { name: "blank2",          start: 82,  length: 1,  description: "Blank" },
  { name: "separateApp",     start: 83,  length: 5,  description: "Separate application" },
  { name: "transactionRef",  start: 88,  length: 16, description: "Transaction reference" },
  { name: "relatedRef",      start: 104, length: 16, description: "Related reference" },
  { name: "blanks3",         start: 120, length: 7,  description: "Blanks" },
  { name: "versionCode",     start: 127, length: 1,  description: "Version code (2)" },
];
