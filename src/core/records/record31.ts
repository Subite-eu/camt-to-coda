import { padRight, padLeft } from "../formatting.js";

export interface Record31Params {
  seqNum: string;
  detailNum: number;
  bankRef: string;
  txCode: string;
  commType: string;
  comm: string;
  entryDate: string;
  hasRecord32: boolean;
}

export function record31(p: Record31Params): string {
  const { seqNum, detailNum, bankRef, txCode, commType, comm, entryDate, hasRecord32 } = p;
  return [
    "3",                                          // 1     record id
    "1",                                          // 2     article code
    seqNum,                                       // 3-6   continuous sequence number
    padLeft(String(detailNum), 4, "0"),           // 7-10  detail number
    padRight(bankRef, 21),                        // 11-31 bank reference
    "1",                                          // 32    txCodeType: 1=detail of globalisation
    padRight(txCode, 8),                          // 33-40 transaction code
    commType,                                     // 41    comm type (0=unstructured, 1=structured)
    padRight(comm.slice(0, 73), 73),              // 42-114 communication (73 chars)
    entryDate,                                    // 115-120 entry date (DDMMYY)
    "000",                                        // 121-123 sequence
    "0",                                          // 124   globalisation code: 0=detail of globalised movement
    hasRecord32 ? "1" : "0",                     // 125   next code
    " ",                                          // 126   blank
    "0",                                          // 127   link code (always 0 for record 3)
    " ",                                          // 128   padding to reach 128 chars
  ].join("");
}
