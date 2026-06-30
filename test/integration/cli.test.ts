import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "child_process";
import { mkdtempSync, rmSync, readdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

// Exercises the CLI entrypoint end-to-end as a subprocess (it calls
// process.exit and parses argv at load, so it cannot be imported in-process).
const EXAMPLE = "example-files/CAMT/LT625883379695428516/CAMT_053/2024-03-07.xml";
const haveExample = existsSync(EXAMPLE);

function cli(args: string[]): { status: number; out: string } {
  try {
    const out = execFileSync("npx", ["tsx", "src/cli.ts", ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, out };
  } catch (e: any) {
    return { status: e.status ?? 1, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
}

describe.skipIf(!haveExample)("CLI integration", () => {
  let outDir: string;
  beforeAll(() => {
    outDir = mkdtempSync(join(tmpdir(), "camt2coda-"));
  });
  afterAll(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it("info prints the CAMT version and statement", { timeout: 30000 }, () => {
    const { status, out } = cli(["info", EXAMPLE]);
    expect(status).toBe(0);
    expect(out).toMatch(/CAMT Version: camt\.05/);
    expect(out).toMatch(/Statement:/);
  });

  it("convert writes a .cod file", { timeout: 30000 }, () => {
    const { status } = cli(["convert", "-i", EXAMPLE, "-o", outDir]);
    expect(status).toBe(0);
    expect(readdirSync(outDir).some((f) => f.endsWith(".cod"))).toBe(true);
  });

  it("reverse converts the generated .cod back to .xml", { timeout: 30000 }, () => {
    const cod = readdirSync(outDir).find((f) => f.endsWith(".cod"));
    expect(cod).toBeDefined();
    const { status } = cli(["reverse", "-i", join(outDir, cod!), "-o", outDir]);
    expect(status).toBe(0);
    expect(readdirSync(outDir).some((f) => f.endsWith(".xml"))).toBe(true);
  });

  it("validate runs and reports on the file", { timeout: 30000 }, () => {
    const { out } = cli(["validate", EXAMPLE]);
    expect(out).toMatch(/Validating|Balance|OK|FAILED/);
  });
});
