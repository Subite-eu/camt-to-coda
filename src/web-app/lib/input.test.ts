import {it,expect} from "vitest";
import {detectDirection,inputError,MAX_INPUT_BYTES} from "./input";
it("detects XML and fixed-width sources irrespective of filename or selected direction",()=> {
  expect(detectDirection(" \n<?xml version='1.0'?><Document/>" )).toBe("camt-to-coda");
  expect(detectDirection("0".padEnd(128))).toBe("coda-to-camt");expect(detectDirection("hello")).toBeNull();
});
it("enforces the actual UTF-8 byte limit and rejects empty input",()=> {
  expect(inputError("")).toMatch(/empty/);expect(inputError("a".repeat(MAX_INPUT_BYTES))).toBeNull();
  expect(inputError("é".repeat(MAX_INPUT_BYTES/2+1))).toMatch(/5 MiB/);
});
