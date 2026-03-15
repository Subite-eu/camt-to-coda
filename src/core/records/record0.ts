import type { CamtStatement } from "../model.js";
import { padRight, padLeft, formatDate } from "../formatting.js";

export function record0(stmt: CamtStatement): string {
  const date = formatDate(stmt.reportDate);
  const bic = stmt.account.bic || "";
  return [
    "0",                      // 1     record id
    "0000",                   // 2-5   zeros
    date,                     // 6-11  creation date (DDMMYY)
    "000",                    // 12-14 bank id
    "05",                     // 15-16 application code
    " ",                      // 17    duplicate indicator
    padRight("", 7),          // 18-24 blanks
    padRight("", 10),         // 25-34 file reference
    padRight("", 26),         // 35-60 addressee name
    padRight(bic, 11),        // 61-71 BIC
    padRight("", 11),         // 72-82 company number
    " ",                      // 83    blank
    padLeft("", 5, "0"),      // 84-88 separate application
    padRight("", 16),         // 89-104 transaction ref
    padRight("", 16),         // 105-120 related ref
    padRight("", 7),          // 121-127 blanks
    "2",                      // 128   version code
  ].join("");
}
