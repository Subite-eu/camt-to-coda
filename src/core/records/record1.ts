import { accountFields } from "../field-defs/account-fields.js";
import type { CamtStatement } from "../model.js";
import { padRight, formatBalance, formatDate, movementSign, accountStructure, signedAmount } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD1_FIELDS } from "../field-defs/record1-fields.js";

export function record1(stmt: CamtStatement, sequence: string): CodaLine {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const structure = stmt.account.iban ? accountStructure(acctNum) : /^\d{12}$/.test(acctNum) ? "0" : "1";
  const bal = stmt.openingBalance;

  const values: Record<string, string> = {
    recordType: "1",
    accountStructure: structure,
    sequence,
    accountNumber: padRight(acctNum, structure === "0" ? 12 : 34),
    currency: padRight(stmt.account.currency, 3),
    balanceSign: movementSign(bal.creditDebit),
    balanceAmount: formatBalance(bal.amount),
    balanceDate: formatDate(bal.date),
    holderName: padRight(stmt.account.ownerName || "", 26),
    description: padRight("", 35),
    sequenceEnd: sequence,
  };

  const fields = accountFields(RECORD1_FIELDS, structure).map((def) => ({
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
