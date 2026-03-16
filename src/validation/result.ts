export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function success(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

export function merge(a: ValidationResult, b: ValidationResult): ValidationResult {
  return {
    valid: a.valid && b.valid,
    errors: [...a.errors, ...b.errors],
    warnings: [...a.warnings, ...b.warnings],
  };
}
