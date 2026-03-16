import { padRight, padLeft } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD33_FIELDS } from "../field-defs/record33-fields.js";

export interface Record33Params {
  seqNum: string;
  detailNum: number;
  comm: string;
}

export function record33(p: Record33Params): CodaLine {
  const { seqNum, detailNum, comm } = p;

  const values: Record<string, string> = {
    recordType: "3",
    articleNumber: "3",
    sequenceNumber: seqNum,
    detailNumber: padLeft(String(detailNum), 4, "0"),
    communication: padRight(comm.slice(0, 90), 90),
    blanks: padRight("", 25),
    nextCode: "0",
    blank: " ",
    linkCode: "0",
  };

  const fields = RECORD33_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "3.3",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
