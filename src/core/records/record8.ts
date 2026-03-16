import type { CamtStatement } from "../model.js";
import { padRight, formatBalance, formatDate, signCode, signedAmount } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD8_FIELDS } from "../field-defs/record8-fields.js";

export function record8(stmt: CamtStatement, sequence: string): CodaLine {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const bal = stmt.closingBalance;

  const values: Record<string, string> = {
    recordType: "8",
    sequence,
    accountNumber: padRight(acctNum, 34),
    currency: padRight(stmt.account.currency, 3),
    balanceSign: signCode(signedAmount(bal.amount, bal.creditDebit)),
    balanceAmount: formatBalance(bal.amount),
    balanceDate: formatDate(bal.date),
    blanks: padRight("", 64),
    linkCode: "0",
  };

  const fields = RECORD8_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "8",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
