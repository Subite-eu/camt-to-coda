import type { CamtStatement } from "../core/model.js";
import type { ValidationResult } from "./result.js";

export function validateCamt(stmt: CamtStatement): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!stmt.account.iban && !stmt.account.otherId) errors.push("No account identifier");
  if (!stmt.account.currency) errors.push("No currency");
  if (!stmt.openingBalance.date) warnings.push("No opening balance date");
  if (!stmt.closingBalance.date) warnings.push("No closing balance date");
  if (!stmt.account.bic && stmt.camtVersion === "053") warnings.push("No BIC found");

  return { valid: errors.length === 0, errors, warnings };
}
