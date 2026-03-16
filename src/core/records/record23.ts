import { padRight } from "../formatting.js";

export interface Record23Params {
  seqNum: string;
  comm: string;
  counterpartIban: string;
  currency: string;
  counterpartName: string;
  needRecord3: boolean;
}

export function record23(p: Record23Params): string {
  const { seqNum, comm, counterpartIban, currency, counterpartName, needRecord3 } = p;
  return [
    "2",                                  // 1     record id
    "3",                                  // 2     article code
    seqNum,                               // 3-6   sequence
    "0000",                               // 7-10  detail number
    padRight(counterpartIban, 34),        // 11-44 counterparty account
    padRight(currency, 3),                // 45-47 currency
    padRight(counterpartName, 35),        // 48-82 counterparty name
    padRight(comm, 43),                   // 83-125 communication ctd
    "0",                                  // 126   next code (always 0)
    " ",                                  // 127   blank
    needRecord3 ? "1" : "0",             // 128   link code
  ].join("");
}
