import type { ValidationResult } from "./result.js";
import type { CodaLine } from "../core/field-defs/types.js";

export function validateCoda(lines: (CodaLine | string)[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = typeof lines[i] === "string" ? lines[i] as string : (lines[i] as CodaLine).raw;
    if (raw.length !== 128)
      errors.push(`Line ${i + 1}: ${raw.length} chars (expected 128)`);
  }

  const first = lines.length > 0 ? (typeof lines[0] === "string" ? lines[0] as string : (lines[0] as CodaLine).raw) : null;
  const last = lines.length > 0 ? (typeof lines[lines.length - 1] === "string" ? lines[lines.length - 1] as string : (lines[lines.length - 1] as CodaLine).raw) : null;

  if (first !== null && first[0] !== "0") errors.push("Must start with Record 0");
  if (last !== null && last[0] !== "9") errors.push("Must end with Record 9");

  return { valid: errors.length === 0, errors, warnings };
}
