import { padRight, padLeft } from "../formatting.js";

export interface Record32Params {
  seqNum: string;
  detailNum: number;
  comm: string;
  hasRecord33: boolean;
}

export function record32(p: Record32Params): string {
  const { seqNum, detailNum, comm, hasRecord33 } = p;
  return [
    "3",                                          // 1     record id
    "2",                                          // 2     article code
    seqNum,                                       // 3-6   continuous sequence number
    padLeft(String(detailNum), 4, "0"),           // 7-10  detail number
    padRight(comm.slice(0, 105), 105),            // 11-115 communication (105 chars)
    padRight("", 10),                             // 116-125 blanks (10 chars)
    hasRecord33 ? "1" : "0",                     // 126   next code
    " ",                                          // 127   blank
    "0",                                          // 128   link code (always 0 for record 3)
  ].join("");
}
