import { padRight, padLeft } from "../formatting.js";

export interface Record33Params {
  seqNum: string;
  detailNum: number;
  comm: string;
}

export function record33(p: Record33Params): string {
  const { seqNum, detailNum, comm } = p;
  return [
    "3",                                          // 1     record id
    "3",                                          // 2     article code
    seqNum,                                       // 3-6   continuous sequence number
    padLeft(String(detailNum), 4, "0"),           // 7-10  detail number
    padRight(comm.slice(0, 90), 90),              // 11-100 communication (90 chars)
    padRight("", 25),                             // 101-125 blanks (25 chars)
    "0",                                          // 126   next code (always 0)
    " ",                                          // 127   blank
    "0",                                          // 128   link code (always 0 for record 3)
  ].join("");
}
