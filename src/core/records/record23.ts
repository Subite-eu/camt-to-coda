import { padRight } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD23_FIELDS } from "../field-defs/record23-fields.js";

export interface Record23Params {
  seqNum: string;
  comm: string;
  counterpartIban: string;
  currency: string;
  counterpartName: string;
  needRecord3: boolean;
}

export function record23(p: Record23Params): CodaLine {
  const { seqNum, comm, counterpartIban, currency, counterpartName, needRecord3 } = p;

  const values: Record<string, string> = {
    recordType: "2",
    articleNumber: "3",
    sequenceNumber: seqNum,
    detailNumber: "0000",
    counterpartAccount: padRight(counterpartIban, 34),
    currency: padRight(currency, 3),
    counterpartName: padRight(counterpartName, 35),
    communication: padRight(comm, 43),
    nextCode: "0",
    blank: " ",
    linkCode: needRecord3 ? "1" : "0",
  };

  const fields = RECORD23_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "2.3",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
