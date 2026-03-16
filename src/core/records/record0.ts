import type { CamtStatement } from "../model.js";
import { padRight, padLeft, formatDate } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD0_FIELDS } from "../field-defs/record0-fields.js";

export function record0(stmt: CamtStatement): CodaLine {
  const date = formatDate(stmt.reportDate);
  const bic = stmt.account.bic || "";

  const values: Record<string, string> = {
    recordType: "0",
    zeros: "0000",
    creationDate: date,
    bankId: "000",
    applicationCode: "05",
    duplicate: " ",
    blanks1: padRight("", 7),
    fileReference: padRight("", 10),
    addressee: padRight("", 26),
    bic: padRight(bic, 11),
    companyNumber: padRight("", 11),
    blank2: " ",
    separateApp: padLeft("", 5, "0"),
    transactionRef: padRight("", 16),
    relatedRef: padRight("", 16),
    blanks3: padRight("", 7),
    versionCode: "2",
  };

  const fields = RECORD0_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "0",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
