import type { Direction } from "./convert";
export const MAX_INPUT_BYTES = 5 * 1024 * 1024;
export function detectDirection(text: string): Direction | null {
  const start = text.trimStart().replace(/^\uFEFF/, "");
  if (start.startsWith("<")) return "camt-to-coda";
  if (/^[0123489]/.test(start)) return "coda-to-camt";
  return null;
}
export function inputError(text: string): string | null {
  const bytes = new Blob([text]).size;
  if (bytes > MAX_INPUT_BYTES) return "This file exceeds the 5 MiB browser limit. Use the CLI for larger files.";
  if (!text.trim()) return "The file is empty. Load a CAMT XML or CODA file.";
  return null;
}
