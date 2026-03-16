import { padRight, padLeft, formatBalance } from "../formatting.js";
import type { CodaLine } from "../field-defs/types.js";
import { RECORD9_FIELDS } from "../field-defs/record9-fields.js";

export interface Record9Params {
  recordCount: number;
  sumDebits: number;
  sumCredits: number;
}

export function record9(p: Record9Params): CodaLine {
  const { recordCount, sumDebits, sumCredits } = p;

  const values: Record<string, string> = {
    recordType: "9",
    blanks1: padRight("", 15),
    recordCount: padLeft(String(recordCount), 6, "0"),
    sumDebits: formatBalance(sumDebits),
    sumCredits: formatBalance(sumCredits),
    blanks2: padRight("", 75),
    lastFile: "2",
  };

  const fields = RECORD9_FIELDS.map((def) => ({
    name: def.name,
    start: def.start,
    length: def.length,
    value: values[def.name] ?? " ".repeat(def.length),
    sourceXPath: def.sourceXPath,
    description: def.description,
  }));

  return {
    recordType: "9",
    raw: fields.map((f) => f.value).join(""),
    fields,
  };
}
