import { padRight, padLeft } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD32_FIELDS } from "../field-defs/record32-fields.js";

export interface Record32Params {
  seqNum: string;
  detailNum: number;
  comm: string;
  hasRecord33: boolean;
}

export function record32(p: Record32Params): CodaLine {
  const { seqNum, detailNum, comm, hasRecord33 } = p;

  const values: Record<string, string> = {
    recordType: "3",
    articleNumber: "2",
    sequenceNumber: seqNum,
    detailNumber: padLeft(String(detailNum), 4, "0"),
    communication: padRight(comm.slice(0, 105), 105),
    blanks: padRight("", 10),
    nextCode: hasRecord33 ? "1" : "0",
    blank: " ",
    linkCode: "0",
  };

  const fields = RECORD32_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "3.2",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
