import { padRight } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD22_FIELDS } from "../field-defs/record22-fields.js";

export interface Record22Params {
  seqNum: string;
  comm: string;
  counterpartBic: string;
  hasMore: boolean;
}

export function record22(p: Record22Params): CodaLine {
  const { seqNum, comm, counterpartBic, hasMore } = p;

  const values: Record<string, string> = {
    recordType: "2",
    articleNumber: "2",
    sequenceNumber: seqNum,
    detailNumber: "0000",
    communication: padRight(comm, 53),
    customerRef: padRight("", 35),
    counterpartBic: padRight(counterpartBic, 11),
    blanks: padRight("", 3),
    rTransactionType: " ",
    isoReason: padRight("", 4),
    categoryPurpose: padRight("", 4),
    purpose: padRight("", 4),
    nextCode: hasMore ? "1" : "0",
    blank: " ",
    linkCode: "0",
  };

  const fields = RECORD22_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "2.2",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
