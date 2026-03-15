import { describe, it, expect } from "vitest";
import { success, merge } from "../../src/validation/result.js";
import { validateCamt } from "../../src/validation/camt-validator.js";
import { validateCoda } from "../../src/validation/coda-validator.js";
import type { CamtStatement } from "../../src/core/model.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function line(ch: string, len = 128): string {
  return ch + " ".repeat(len - 1);
}

function makeStmt(overrides: Partial<CamtStatement> = {}): CamtStatement {
  return {
    camtVersion: "053",
    messageId: "MSG001",
    creationDate: "2024-01-15",
    statementId: "STMT001",
    account: { iban: "BE68539007547034", currency: "EUR", bic: "GEBABEBB" },
    openingBalance: { amount: 1000, creditDebit: "CRDT", date: "2024-01-15" },
    closingBalance: { amount: 1500, creditDebit: "CRDT", date: "2024-01-15" },
    entries: [],
    reportDate: "2024-01-15",
    ...overrides,
  };
}

// ── ValidationResult helpers ─────────────────────────────────────────────────

describe("success()", () => {
  it("returns valid with empty errors and warnings", () => {
    const r = success();
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });
});

describe("merge()", () => {
  it("merges two valid results into a valid result", () => {
    const r = merge(success(), success());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("is invalid when the first result has errors", () => {
    const a = { valid: false, errors: ["error A"], warnings: [] };
    const b = success();
    const r = merge(a, b);
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(["error A"]);
  });

  it("is invalid when the second result has errors", () => {
    const a = success();
    const b = { valid: false, errors: ["error B"], warnings: [] };
    const r = merge(a, b);
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(["error B"]);
  });

  it("combines errors from both results", () => {
    const a = { valid: false, errors: ["err A"], warnings: ["warn A"] };
    const b = { valid: false, errors: ["err B"], warnings: ["warn B"] };
    const r = merge(a, b);
    expect(r.valid).toBe(false);
    expect(r.errors).toEqual(["err A", "err B"]);
    expect(r.warnings).toEqual(["warn A", "warn B"]);
  });

  it("merges warnings even when both results are valid", () => {
    const a = { valid: true, errors: [], warnings: ["warn A"] };
    const b = { valid: true, errors: [], warnings: ["warn B"] };
    const r = merge(a, b);
    expect(r.valid).toBe(true);
    expect(r.warnings).toEqual(["warn A", "warn B"]);
  });
});

// ── CAMT validator ────────────────────────────────────────────────────────────

describe("validateCamt()", () => {
  it("returns valid for a fully-populated statement", () => {
    const r = validateCamt(makeStmt());
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it("errors when both iban and otherId are absent", () => {
    const r = validateCamt(
      makeStmt({ account: { currency: "EUR", bic: "GEBABEBB" } })
    );
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("No account identifier");
  });

  it("is valid when otherId is provided instead of iban", () => {
    const r = validateCamt(
      makeStmt({ account: { otherId: "ACC123", currency: "EUR", bic: "GEBABEBB" } })
    );
    expect(r.valid).toBe(true);
    expect(r.errors).not.toContain("No account identifier");
  });

  it("errors when currency is missing", () => {
    // Force missing currency via cast to test runtime guard
    const stmt = makeStmt();
    (stmt.account as Record<string, unknown>).currency = undefined;
    const r = validateCamt(stmt);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("No currency");
  });

  it("warns when opening balance date is absent", () => {
    const stmt = makeStmt();
    (stmt.openingBalance as Record<string, unknown>).date = undefined;
    const r = validateCamt(stmt);
    expect(r.warnings).toContain("No opening balance date");
  });

  it("warns when closing balance date is absent", () => {
    const stmt = makeStmt();
    (stmt.closingBalance as Record<string, unknown>).date = undefined;
    const r = validateCamt(stmt);
    expect(r.warnings).toContain("No closing balance date");
  });

  it("warns about missing BIC on camt.053", () => {
    const r = validateCamt(
      makeStmt({ account: { iban: "BE68539007547034", currency: "EUR" } })
    );
    expect(r.warnings).toContain("No BIC found");
  });

  it("does NOT warn about missing BIC on camt.052", () => {
    const r = validateCamt(
      makeStmt({
        camtVersion: "052",
        account: { iban: "BE68539007547034", currency: "EUR" },
      })
    );
    expect(r.warnings).not.toContain("No BIC found");
  });

  it("accumulates multiple errors and warnings simultaneously", () => {
    const stmt: CamtStatement = {
      camtVersion: "053",
      messageId: "MSG001",
      creationDate: "2024-01-15",
      statementId: "STMT001",
      account: { currency: "" as string } as CamtStatement["account"],
      openingBalance: { amount: 0, creditDebit: "CRDT", date: "" },
      closingBalance: { amount: 0, creditDebit: "CRDT", date: "" },
      entries: [],
      reportDate: "2024-01-15",
    };
    const r = validateCamt(stmt);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("No account identifier");
    expect(r.errors).toContain("No currency");
  });
});

// ── CODA validator ────────────────────────────────────────────────────────────

describe("validateCoda()", () => {
  it("returns valid for correct CODA lines", () => {
    const lines = [line("0"), line("1"), line("9")];
    const r = validateCoda(lines);
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("returns valid for an empty line array", () => {
    const r = validateCoda([]);
    expect(r.valid).toBe(true);
  });

  it("errors when a line is shorter than 128 chars", () => {
    const lines = [line("0"), "short", line("9")];
    const r = validateCoda(lines);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Line 2: 5 chars (expected 128)");
  });

  it("errors when a line is longer than 128 chars", () => {
    const lines = [line("0"), line("1", 130), line("9")];
    const r = validateCoda(lines);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Line 2: 130 chars (expected 128)");
  });

  it("reports the correct 1-based line number in the error", () => {
    const lines = [line("0"), line("1"), "bad", line("9")];
    const r = validateCoda(lines);
    expect(r.errors.some((e) => e.startsWith("Line 3:"))).toBe(true);
  });

  it("errors when the first line does not start with '0'", () => {
    const lines = [line("1"), line("9")];
    const r = validateCoda(lines);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Must start with Record 0");
  });

  it("errors when the last line does not start with '9'", () => {
    const lines = [line("0"), line("1")];
    const r = validateCoda(lines);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain("Must end with Record 9");
  });

  it("accumulates multiple line-length errors", () => {
    const lines = [line("0"), "bad1", "bad22", line("9")];
    const r = validateCoda(lines);
    expect(r.errors.filter((e) => e.includes("chars (expected 128)")).length).toBe(2);
  });

  it("detects both structural and line-length errors together", () => {
    const lines = ["bad_start", line("9")]; // wrong first char AND wrong length
    const r = validateCoda(lines);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("chars (expected 128)"))).toBe(true);
    expect(r.errors).toContain("Must start with Record 0");
  });
});
