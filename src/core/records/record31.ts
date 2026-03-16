import { padRight, padLeft } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD31_FIELDS } from "../field-defs/record31-fields.js";

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

export function record31(p: Record31Params): CodaLine {
  const { seqNum, detailNum, bankRef, txCode, commType, comm, entryDate, hasRecord32 } = p;

  const values: Record<string, string> = {
    recordType: "3",
    articleNumber: "1",
    sequenceNumber: seqNum,
    detailNumber: padLeft(String(detailNum), 4, "0"),
    bankReference: padRight(bankRef, 21),
    txCodeType: "1",
    transactionCode: padRight(txCode, 8),
    communicationType: commType,
    communication: padRight(comm.slice(0, 73), 73),
    entryDate,
    sequence: "000",
    globalisationCode: "0",
    nextCode: hasRecord32 ? "1" : "0",
    blank1: " ",
    linkCode: "0",
    padding: " ",
  };

  const fields = RECORD31_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "3.1",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
