// ── Browser Entry Point ──────────────────────────────────────────────────────
// Bundles core conversion logic for in-browser use (no Node.js APIs).
// Exposes functions on window.camt2coda for use by index.html.

import { parseCamt, detectVersion } from "../core/camt-parser.js";
import { statementToCoda } from "../core/coda-writer.js";
import { validateCoda } from "../validation/coda-validator.js";
import { validateCamt } from "../validation/camt-validator.js";
import { codaToCamt } from "../core/reverse.js";
import type { AnnotatedCodaOutput, CodaLine } from "../core/field-defs/types.js";
import type { CamtStatement } from "../core/model.js";

export interface ForwardResult {
  direction: "camt-to-coda";
  version: string | null;
  files: Array<{
    fileName: string;
    lines: CodaLine[];
    recordCount: number;
    validation: { valid: boolean; errors: string[]; warnings: string[] };
  }>;
}

export interface ReverseResult {
  direction: "coda-to-camt";
  xml: string;
  lines: CodaLine[];
  warnings: string[];
  validation: { valid: boolean; errors: string[] };
}

/** Convert CAMT XML → CODA (forward direction) */
export function convertForward(xml: string): ForwardResult {
  const version = detectVersion(xml);
  const statements = parseCamt(xml);

  const files = statements.map((stmt: CamtStatement) => {
    const camtValidation = validateCamt(stmt);
    const result: AnnotatedCodaOutput = statementToCoda(stmt);
    const codaValidation = validateCoda(result.lines);

    return {
      fileName: result.fileName,
      lines: result.lines,
      recordCount: result.recordCount,
      validation: {
        valid: camtValidation.valid && result.validation.valid && codaValidation.valid,
        errors: [...camtValidation.errors, ...result.validation.errors, ...codaValidation.errors],
        warnings: camtValidation.warnings,
      },
    };
  });

  return { direction: "camt-to-coda", files, version };
}

/** Convert CODA → CAMT XML (reverse direction) */
export function convertReverse(content: string, camtVersion?: string): ReverseResult {
  const result = codaToCamt(content, camtVersion);
  return {
    direction: "coda-to-camt",
    xml: result.xml,
    lines: result.lines,
    warnings: result.warnings,
    validation: { valid: true, errors: [] },
  };
}

// Expose on window for use by inline script in index.html
(window as any).camt2coda = { convertForward, convertReverse };
