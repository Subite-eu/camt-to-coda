import { convertForward, convertReverse } from "@src/web/browser-entry";
import { anonymizeCodaLines } from "@src/anonymize/anonymizer";
import { anonymizeStatement } from "@src/anonymize/statement";
import { parseCamt, detectVersion } from "@src/core/camt-parser";
import { parseCoda } from "@src/core/coda-parser";
import { statementsToXml } from "@src/core/camt-writer";
import type { CodaLine } from "@src/core/field-defs/types";
import type { CamtStatement } from "@src/core/model";
import { inputError } from "./input";
import { buildFieldIndex, type FieldEntry } from "./fields";
export type Direction = "camt-to-coda" | "coda-to-camt";
export interface Artifact {
  fileName: string;
  outputText: string;
  codaLines: CodaLine[];
  validation: { valid: boolean; errors: string[]; warnings: string[] };
}
export interface ConvertResult extends Artifact {
  direction: Direction;
  sourceText: string;
  version: string | null;
  files: Artifact[];
  statements: CamtStatement[];
  anonymized: boolean;
  fieldIndexes: FieldEntry[][];
  error?: string;
}
export function convert(input: string, direction: Direction, anonymize: boolean): ConvertResult {
  try {
    const issue = inputError(input);
    if (issue) throw new Error(issue);
    if (direction === "camt-to-coda") {
      const result = convertForward(input);
      const files: Artifact[] = result.files.map((file, i) => {
        const raw = anonymize ? anonymizeCodaLines(file.lines) : file.lines.map(l => l.raw);
        return { fileName: anonymize ? `anonymized-statement-${i+1}.cod` : file.fileName, outputText: raw.join("\n"), codaLines: anonymize ? parseCoda(raw.join("\n")) : file.lines, validation: file.validation };
      });
      if (!files.length) throw new Error("No statements found. Load a CAMT 052 or 053 statement.");
      return { ...files[0], direction, sourceText: input, version: result.version, files, statements: parseCamt(input), anonymized: anonymize, fieldIndexes: files.map((f,i)=>buildFieldIndex(f.codaLines,input,i)) };
    }
    const r = convertReverse(input);
    if (!r.validation.valid || !r.statements.length || !r.xml) throw new Error(r.validation.errors.join("; ") || "No valid CODA statements found.");
    const statements = r.statements;
    const outputText = anonymize ? statementsToXml(statements.map(anonymizeStatement)) : r.xml;
    const file: Artifact = { outputText, codaLines: r.lines, fileName: anonymize ? "anonymized-statements.xml" : "statements.xml", validation: { valid: r.validation.valid, errors: r.validation.errors, warnings: r.warnings } };
    return { ...file, files: [file], statements: anonymize ? statements.map(anonymizeStatement) : statements, direction, sourceText: input, version: detectVersion(outputText), anonymized: anonymize, fieldIndexes: statements.map((_,i)=>{ let logical=-1; return buildFieldIndex(r.lines.filter(l=>{if(l.recordType==="0")logical++;return logical===i;}),outputText,i); }) };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { direction, sourceText: input, outputText: "", codaLines: [], fileName: "", files: [], statements: [], version: null, anonymized: anonymize, fieldIndexes: [], validation: { valid: false, errors: [error], warnings: [] }, error };
  }
}
