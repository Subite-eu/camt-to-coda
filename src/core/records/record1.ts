import type { CamtStatement } from "../model.js";
import { padRight, formatBalance, formatDate, signCode, accountStructure, signedAmount } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD1_FIELDS } from "../field-defs/record1-fields.js";

export function record1(stmt: CamtStatement, sequence: string): CodaLine {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const bal = stmt.openingBalance;

  const values: Record<string, string> = {
    recordType: "1",
    accountStructure: accountStructure(acctNum),
    sequence,
    accountNumber: padRight(acctNum, 34),
    currency: padRight(stmt.account.currency, 3),
    balanceSign: signCode(signedAmount(bal.amount, bal.creditDebit)),
    balanceAmount: formatBalance(bal.amount),
    balanceDate: formatDate(bal.date),
    holderName: padRight(stmt.account.ownerName || "", 26),
    description: padRight("", 35),
    sequenceEnd: sequence,
  };

  const fields = RECORD1_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "1",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
