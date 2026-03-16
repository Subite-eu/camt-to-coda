import type { CamtStatement } from "../model.js";
import { padRight, formatBalance, formatDate, signCode, accountStructure, signedAmount } from "../formatting.js";

export function record1(stmt: CamtStatement, sequence: string): string {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const bal = stmt.openingBalance;
  return [
    "1",                                          // 1     record id
    accountStructure(acctNum),                    // 2     account structure
    sequence,                                     // 3-5   sequence
    padRight(acctNum, 34),                        // 6-39  account number
    padRight(stmt.account.currency, 3),           // 40-42 currency
    signCode(signedAmount(bal.amount, bal.creditDebit)), // 43 sign
    formatBalance(bal.amount),                    // 44-58 balance
    formatDate(bal.date),                         // 59-64 balance date
    padRight(stmt.account.ownerName || "", 26),   // 65-90 holder name
    padRight("", 35),                             // 91-125 description
    sequence,                                     // 126-128 sequence
  ].join("");
}
