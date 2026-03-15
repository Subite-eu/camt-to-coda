import { padRight } from "../formatting.js";

export interface Record22Params {
  seqNum: string;
  comm: string;
  counterpartBic: string;
  hasMore: boolean;
}

export function record22(p: Record22Params): string {
  const { seqNum, comm, counterpartBic, hasMore } = p;
  return [
    "2",                                  // 1     record id
    "2",                                  // 2     article code
    seqNum,                               // 3-6   sequence
    "0000",                               // 7-10  detail number
    padRight(comm, 53),                   // 11-63 communication ctd
    padRight("", 35),                     // 64-98 customer ref
    padRight(counterpartBic, 11),         // 99-109 BIC
    padRight("", 3),                      // 110-112 blanks
    " ",                                  // 113   R-transaction type
    padRight("", 4),                      // 114-117 ISO reason
    padRight("", 4),                      // 118-121 category purpose
    padRight("", 4),                      // 122-125 purpose
    hasMore ? "1" : "0",                 // 126   next code
    " ",                                  // 127   blank
    "0",                                  // 128   link code
  ].join("");
}
