import type { CamtEntry } from "../model.js";
import { padRight, padLeft, formatBalance, formatDate, movementSign } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD21_FIELDS } from "../field-defs/record21-fields.js";

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

export function record21(p: Record21Params): CodaLine {
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

  const values: Record<string, string> = {
    recordType: "2",
    articleNumber: "1",
    sequenceNumber: seqNum,
    detailNumber: "0000",
    bankReference: padRight(refs || entry.entryRef || "", 21),
    amountSign: movementSign(entry.creditDebit),
    amount: formatBalance(entry.amount),
    valueDate,
    transactionCode: padRight(txCode, 8),
    communicationType: commType,
    communication: padRight(comm.slice(0, 53), 53),
    entryDate,
    statementSequence: "000",
    globalisationCode: needRecord3 ? "1" : "0",
    nextCode: hasMore ? "1" : "0",
    blank: " ",
    linkCode: needRecord3 ? "1" : "0",
  };

  const fields = RECORD21_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "2.1",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
