import { convertForward, convertReverse } from "@src/web/browser-entry";
import { anonymizeCodaLines } from "@src/anonymize/anonymizer";
import type { CodaLine } from "@src/core/field-defs/types";

export type Direction = "camt-to-coda" | "coda-to-camt";

export interface ConvertResult {
  direction: Direction;
  sourceText: string;
  outputText: string;
  /** The CODA side (output for forward, input for reverse) — always carries structured fields. */
  codaLines: CodaLine[];
  fileName: string;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  error?: string;
}

export function convert(input: string, direction: Direction, anonymize: boolean): ConvertResult {
  try {
    if (direction === "camt-to-coda") {
      const file = convertForward(input).files[0];
      const lines = anonymize ? anonymizeCodaLines(file.lines) : file.lines.map((l) => l.raw);
      return {
        direction,
        sourceText: input,
        outputText: lines.join("\n"),
        codaLines: file.lines,
        fileName: file.fileName,
        validation: file.validation,
      };
    }
    const r = convertReverse(input);
    return {
      direction,
      sourceText: input,
      outputText: r.xml,
      codaLines: r.lines,
      fileName: "statement.xml",
      validation: { valid: r.validation.valid, errors: r.validation.errors, warnings: r.warnings },
    };
  } catch (err) {
    return {
      direction,
      sourceText: input,
      outputText: "",
      codaLines: [],
      fileName: "",
      validation: { valid: false, errors: [(err as Error).message], warnings: [] },
      error: (err as Error).message,
    };
  }
}
