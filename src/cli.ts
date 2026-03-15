#!/usr/bin/env node
import { parseCamtFile, detectVersion } from "./core/camt-parser.js";
import { statementToCoda } from "./core/coda-writer.js";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";

function usage() {
  console.log(`
camt2coda - CAMT to CODA converter (TypeScript)

Usage:
  npx tsx src/cli.ts convert <input> <output-dir>
  npx tsx src/cli.ts info <input>
  npx tsx src/cli.ts validate <input>

Examples:
  npx tsx src/cli.ts convert statement.xml ./output/
  npx tsx src/cli.ts convert ./camt-files/ ./output/
  npx tsx src/cli.ts info statement.xml
`);
}

function convertFile(inputPath: string, outputDir: string): boolean {
  const xml = readFileSync(inputPath, "utf-8");
  const version = detectVersion(xml);
  console.log(`  ${basename(inputPath)} [${version}]`);

  const statements = parseCamtFile(inputPath);
  let allValid = true;

  for (const stmt of statements) {
    const result = statementToCoda(stmt);

    if (!result.validation.valid) {
      console.error(`    ERROR in ${result.fileName}:`);
      result.validation.errors.forEach((e) => console.error(`      ${e}`));
      allValid = false;
    }

    const outputPath = join(outputDir, result.fileName);
    writeFileSync(outputPath, result.lines.join("\n") + "\n");
    console.log(`    → ${result.fileName} (${result.lines.length} records)`);
  }

  return allValid;
}

function infoFile(inputPath: string) {
  const xml = readFileSync(inputPath, "utf-8");
  const version = detectVersion(xml);
  console.log(`CAMT Version: ${version}`);

  const statements = parseCamtFile(inputPath);
  for (const stmt of statements) {
    console.log(`\nStatement: ${stmt.statementId}`);
    console.log(`  Account: ${stmt.account.iban || stmt.account.otherId}`);
    console.log(`  Currency: ${stmt.account.currency}`);
    console.log(`  BIC: ${stmt.account.bic || "N/A"}`);
    console.log(`  Owner: ${stmt.account.ownerName || "N/A"}`);
    console.log(`  Report Date: ${stmt.reportDate}`);
    console.log(`  Opening: ${stmt.openingBalance.amount} ${stmt.openingBalance.creditDebit}`);
    console.log(`  Closing: ${stmt.closingBalance.amount} ${stmt.closingBalance.creditDebit}`);
    console.log(`  Entries: ${stmt.entries.length}`);
  }
}

function validateFile(inputPath: string) {
  const xml = readFileSync(inputPath, "utf-8");
  const version = detectVersion(xml);
  console.log(`Validating: ${basename(inputPath)} [${version}]`);

  const statements = parseCamtFile(inputPath);
  let allValid = true;

  for (const stmt of statements) {
    const result = statementToCoda(stmt);
    if (result.validation.valid) {
      console.log(`  ${result.fileName}: OK (${result.recordCount} records)`);
    } else {
      console.error(`  ${result.fileName}: FAILED`);
      result.validation.errors.forEach((e) => console.error(`    ${e}`));
      allValid = false;
    }

    // Balance check
    const openSigned =
      stmt.openingBalance.creditDebit === "CRDT"
        ? stmt.openingBalance.amount
        : -stmt.openingBalance.amount;
    const closeSigned =
      stmt.closingBalance.creditDebit === "CRDT"
        ? stmt.closingBalance.amount
        : -stmt.closingBalance.amount;
    const mvt = stmt.entries.reduce(
      (sum, e) => sum + (e.creditDebit === "CRDT" ? e.amount : -e.amount),
      0
    );
    const diff = Math.abs(openSigned + mvt - closeSigned);
    if (diff > 0.01) {
      console.error(
        `  Balance mismatch: open(${openSigned}) + mvt(${mvt.toFixed(2)}) ≠ close(${closeSigned}), diff=${diff.toFixed(2)}`
      );
    } else {
      console.log(`  Balance check: OK`);
    }
  }

  return allValid;
}

// ── Main ────────────────────────────────────────────────────────────────

const [command, ...args] = process.argv.slice(2);

if (!command) {
  usage();
  process.exit(0);
}

switch (command) {
  case "convert": {
    const [input, outputDir] = args;
    if (!input || !outputDir) {
      console.error("Usage: convert <input> <output-dir>");
      process.exit(1);
    }
    mkdirSync(outputDir, { recursive: true });

    const start = performance.now();

    if (existsSync(input) && !input.endsWith(".xml")) {
      // Directory mode
      const files = readdirSync(input).filter((f) => f.endsWith(".xml"));
      console.log(`Converting ${files.length} files from ${input}`);
      let ok = true;
      for (const f of files) {
        ok = convertFile(join(input, f), outputDir) && ok;
      }
      const elapsed = (performance.now() - start).toFixed(0);
      console.log(`\nDone in ${elapsed}ms. ${ok ? "All valid." : "Some errors."}`);
      process.exit(ok ? 0 : 1);
    } else {
      // Single file
      const ok = convertFile(input, outputDir);
      const elapsed = (performance.now() - start).toFixed(0);
      console.log(`Done in ${elapsed}ms. ${ok ? "Valid." : "Errors found."}`);
      process.exit(ok ? 0 : 1);
    }
    break;
  }

  case "info":
    if (!args[0]) {
      console.error("Usage: info <input>");
      process.exit(1);
    }
    infoFile(args[0]);
    break;

  case "validate":
    if (!args[0]) {
      console.error("Usage: validate <input>");
      process.exit(1);
    }
    process.exit(validateFile(args[0]) ? 0 : 1);
    break;

  default:
    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
}
