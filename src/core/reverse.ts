// src/core/reverse.ts
import type { CodaLine } from "./field-defs/types.js";
import type { CamtStatement } from "./model.js";
import { parseCoda } from "./coda-parser.js";
import { codaToStatement } from "./coda-to-statement.js";
import { statementToXml } from "./camt-writer.js";
import { reverseMapTransactionCode } from "./transaction-codes.js";

export interface ReverseConversionResult {
  xml: string;
  lines: CodaLine[];
  statement: CamtStatement;
  warnings: string[];
}

export function codaToCamt(content: string, camtVersion?: string): ReverseConversionResult {
  const lines = parseCoda(content);
  const statement = codaToStatement(lines);
  const warnings: string[] = [];

  // Detect unknown transaction codes
  for (const line of lines) {
    if (line.recordType === "2.1") {
      const txField = line.fields.find((f) => f.name === "transactionCode");
      const code = txField?.value ?? "";
      if (code.trim().length > 0 && !reverseMapTransactionCode(code)) {
        warnings.push(`Unknown transaction code "${code.trim()}", BkTxCd omitted`);
      }
    }
  }

  const xml = statementToXml(statement, camtVersion);

  return { xml, lines, statement, warnings };
}
