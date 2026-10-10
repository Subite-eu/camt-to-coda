// src/core/reverse.ts
import type { CodaLine } from "./field-defs/types.js";
import type { CamtStatement } from "./model.js";
import { parseCoda } from "./coda-parser.js";
import { codaToStatement } from "./coda-to-statement.js";
import { statementsToXml } from "./camt-writer.js";
import { validateCoda } from "../validation/coda-validator.js";
import { validateCamt } from "../validation/camt-validator.js";
import type { ValidationResult } from "../validation/result.js";
import { reverseMapTransactionCode, describeCodaCode } from "./transaction-codes.js";

export interface ReverseConversionResult {
  xml: string;
  lines: CodaLine[];
  statement: CamtStatement;
  statements: CamtStatement[];
  validation: ValidationResult;
  warnings: string[];
}

export function codaToCamt(content: string, camtVersion?: string): ReverseConversionResult {
  const lines = parseCoda(content);
  const validation = validateCoda(lines);
  if (!validation.valid) throw new Error(`Invalid CODA: ${validation.errors.join("; ")}`);
  const groups: CodaLine[][] = [];
  for (const line of lines) {
    if (line.recordType === "0") groups.push([]);
    groups[groups.length - 1].push(line);
  }
  const statements = groups.map(codaToStatement);
  const statement = statements[0];
  const warnings: string[] = [...validation.warnings];
  for (const stmt of statements) {
    const result = validateCamt(stmt);
    validation.errors.push(...result.errors);
    warnings.push(...result.warnings);
    for (const entry of stmt.entries) for (const detail of entry.details) {
      if (detail.amount !== undefined && ((detail.bookingDate && detail.bookingDate !== entry.bookingDate) || (detail.valueDate && detail.valueDate !== entry.valueDate))) warnings.push("CODA monetary detail booking/value dates are retained in the model; CAMT TxDtls has no direct equivalent, so XML uses the aggregate entry dates");
    }
  }
  validation.valid = validation.errors.length === 0;
  if (!validation.valid) throw new Error(`Invalid reconstructed CAMT: ${validation.errors.join("; ")}`);

  // Detect unknown transaction codes
  for (const line of lines) {
    if (line.recordType === "2.1") {
      const txField = line.fields.find((f) => f.name === "transactionCode");
      const code = (txField?.value ?? "").trim();
      if (code.length > 0 && !reverseMapTransactionCode(code)) {
        const desc = describeCodaCode(code);
        const fam = desc?.familyName ? ` (CODA family ${desc.family} "${desc.familyName}")` : "";
        warnings.push(`Unknown transaction code "${code}"${fam}; carried as BBA proprietary BkTxCd`);
      }
    }
  }

  const xml = statementsToXml(statements, camtVersion);

  return { xml, lines, statement, statements, warnings, validation };
}
