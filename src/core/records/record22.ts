import { padRight } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD22_FIELDS } from "../field-defs/record22-fields.js";

export interface Record22Params {
  seqNum: string;
  comm: string;
  counterpartBic: string;
  hasMore: boolean;
  customerRef?: string;
  /** R-transaction type, pos 113 (1=Reject 2=Return 3=Refund 4=Reversal 5=Cancellation) */
  rTransactionType?: string;
  /** ISO reason code, pos 114-117 (e.g. AC01, AM04) */
  isoReason?: string;
  /** SEPA category purpose, pos 118-121 */
  categoryPurpose?: string;
  /** SEPA purpose, pos 122-125 */
  purpose?: string;
}

export function record22(p: Record22Params): CodaLine {
  const { seqNum, comm, counterpartBic, hasMore, customerRef } = p;

  const values: Record<string, string> = {
    recordType: "2",
    articleNumber: "2",
    sequenceNumber: seqNum,
    detailNumber: "0000",
    communication: padRight(comm, 53),
    customerRef: padRight(customerRef || "", 35),
    counterpartBic: padRight(counterpartBic, 11),
    blanks: padRight("", 3),
    rTransactionType: (p.rTransactionType || " ").slice(0, 1),
    isoReason: padRight(p.isoReason || "", 4),
    categoryPurpose: padRight(p.categoryPurpose || "", 4),
    purpose: padRight(p.purpose || "", 4),
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
