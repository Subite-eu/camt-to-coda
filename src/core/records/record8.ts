import type { CamtStatement } from "../model.js";
import { padRight, formatBalance, formatDate, signCode, signedAmount } from "../formatting.js";

export function record8(stmt: CamtStatement, sequence: string): string {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const bal = stmt.closingBalance;
  return [
    "8",                                          // 1     record id
    sequence,                                     // 2-4   sequence
    padRight(acctNum, 34),                        // 5-38  account number
    padRight(stmt.account.currency, 3),           // 39-41 currency
    signCode(signedAmount(bal.amount, bal.creditDebit)), // 42 sign
    formatBalance(bal.amount),                    // 43-57 balance
    formatDate(bal.date),                         // 58-63 balance date
    padRight("", 64),                             // 64-127 blanks
    "0",                                          // 128   link code
  ].join("");
}
