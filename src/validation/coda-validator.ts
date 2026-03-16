import type { ValidationResult } from "./result.js";

export function validateCoda(lines: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 128)
      errors.push(`Line ${i + 1}: ${lines[i].length} chars (expected 128)`);
  }

  if (lines.length > 0 && lines[0][0] !== "0") errors.push("Must start with Record 0");
  if (lines.length > 0 && lines[lines.length - 1][0] !== "9") errors.push("Must end with Record 9");

  return { valid: errors.length === 0, errors, warnings };
}
