import { padRight, padLeft, formatBalance } from "../formatting.js";

export interface Record9Params {
  recordCount: number;
  sumDebits: number;
  sumCredits: number;
}

export function record9(p: Record9Params): string {
  const { recordCount, sumDebits, sumCredits } = p;
  return [
    "9",                                          // 1     record id
    padRight("", 15),                             // 2-16  blanks
    padLeft(String(recordCount), 6, "0"),         // 17-22 record count
    formatBalance(sumDebits),                     // 23-37 sum debits
    formatBalance(sumCredits),                    // 38-52 sum credits
    padRight("", 75),                             // 53-127 blanks
    "2",                                          // 128   last file
  ].join("");
}
