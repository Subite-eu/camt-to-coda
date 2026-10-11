import { it, expect } from "vitest";
import { SAMPLES } from "./samples";
import { convert } from "./convert";
import originals from "../../../examples/manifest.json";
const sources = import.meta.glob<string>("../../../examples/{camt,coda,invalid}/*.{xml,cod}", { query: "?raw", import: "default", eager: true });
it("loads every catalog choice from its independently authored source, including expected failures", async () => {
  expect(SAMPLES).toHaveLength(originals.cases.length);
  for (const original of originals.cases) {
    const sample = SAMPLES.find(s => s.id === original.id);
    expect(sample, original.id).toBeDefined();
    expect(await sample!.load()).toBe(sources[`../../../examples/${original.path}`]);
    expect(sample!.valid).toBe(original.valid);
  }
});
it.each([
  ["camt-salary-payments", "camt-to-coda", 3, 1050],
  ["coda-salary-payments", "coda-to-camt", 3, 1050],
  ["camt-card-purchases", "camt-to-coda", 3, 816.35],
  ["coda-card-purchases", "coda-to-camt", 3, 816.35],
  ["camt-usd-international", "camt-to-coda", 1, 8750],
  ["coda-usd-international", "coda-to-camt", 1, 8750],
] as const)("%s demonstrates distinct real payment data", async (id, direction, count, closing) => {
  const sample = SAMPLES.find(s => s.id === id);
  expect(sample, id).toBeDefined();
  const result = convert(await sample!.load(), direction, false);
  expect(result.error).toBeUndefined();
  expect(result.validation.valid).toBe(true);
  expect(result.statements[0].entries).toHaveLength(count);
  expect(result.statements[0].closingBalance.amount).toBe(closing);
});
