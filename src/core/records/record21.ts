import type { CamtEntry } from "../model.js";
import { padRight, padLeft, formatBalance, formatDate, movementSign } from "../formatting.js";

export interface Record21Params {
  entry: CamtEntry;
  seqNum: string;
  comm: string;
  commType: string;
  txCode: string;
  entryDate: string;
  hasMore: boolean;      // next code: 1 if record 2.2 or 2.3 follows
  needRecord3: boolean;  // globalisation code + link code
}

export function record21(p: Record21Params): string {
  const { entry, seqNum, comm, commType, txCode, entryDate, hasMore, needRecord3 } = p;

  const valueDate = entry.valueDate
    ? formatDate(entry.valueDate)
    : entry.bookingDate
    ? formatDate(entry.bookingDate)
    : "000000";

  const refs = entry.details
    .flatMap((d) =>
      [d.refs?.endToEndId, d.refs?.txId, d.refs?.instrId].filter(
        (r) => r && r !== "NOTPROVIDED"
      )
    )
    .join("/");

  return [
    "2",                                  // 1     record id
    "1",                                  // 2     article code
    seqNum,                               // 3-6   sequence number
    "0000",                               // 7-10  detail number
    padRight(refs || entry.entryRef || "", 21), // 11-31 bank ref
    movementSign(entry.creditDebit),      // 32    movement sign
    formatBalance(entry.amount),          // 33-47 amount
    valueDate,                            // 48-53 value date
    padRight(txCode, 8),                  // 54-61 transaction code
    commType,                             // 62    comm type
    padRight(comm.slice(0, 53), 53),      // 63-115 communication
    entryDate,                            // 116-121 entry date
    "000",                                // 122-124 sequence
    needRecord3 ? "1" : "0",             // 125   globalisation code
    hasMore ? "1" : "0",                 // 126   next code
    " ",                                  // 127   blank
    needRecord3 ? "1" : "0",             // 128   link code
  ].join("");
}
