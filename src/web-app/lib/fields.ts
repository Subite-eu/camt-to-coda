import type { CodaLine } from "@src/core/field-defs/types";

export interface FieldEntry {
  /** Stable id: `${recordType}:${name}:${lineIndex}` */
  id: string;
  recordType: string;
  name: string;
  value: string;
  /** 1-indexed "start-end" position within the 128-char CODA line. */
  codaPos: string;
  sourceXPath?: string;
  description?: string;
  lineIndex: number;
}

/** Flatten parsed CODA lines into selectable, non-blank field entries. */
export function buildFieldIndex(lines: CodaLine[]): FieldEntry[] {
  const out: FieldEntry[] = [];
  lines.forEach((line, lineIndex) => {
    for (const f of line.fields) {
      if (!f.value.trim()) continue;
      out.push({
        id: `${line.recordType}:${f.name}:${lineIndex}`,
        recordType: line.recordType,
        name: f.name,
        value: f.value.trim(),
        codaPos: `${f.start + 1}-${f.start + f.length}`,
        sourceXPath: f.sourceXPath,
        description: f.description,
        lineIndex,
      });
    }
  });
  return out;
}
