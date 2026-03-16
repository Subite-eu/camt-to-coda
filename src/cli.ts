#!/usr/bin/env node
import { Command } from "commander";
import { parseCamt, parseCamtFile, detectVersion } from "./core/camt-parser.js";
import { statementToCoda } from "./core/coda-writer.js";
import { validateCamt } from "./validation/camt-validator.js";
import { validateCoda } from "./validation/coda-validator.js";
import { FsStorage } from "./storage/fs-storage.js";
import { S3Storage } from "./storage/s3-storage.js";
import { isS3Path } from "./storage/storage.js";
import { anonymizeCodaLines } from "./anonymize/anonymizer.js";
import type { Storage } from "./storage/storage.js";
import { basename, join, dirname } from "path";

// ── Storage factory ──────────────────────────────────────────────────────────

interface StorageOptions {
  endpoint?: string;
  accessKey?: string;
  secretKey?: string;
}

function makeStorage(path: string, opts: StorageOptions = {}): Storage {
  if (isS3Path(path)) {
    return new S3Storage({
      endpoint: opts.endpoint,
      accessKeyId: opts.accessKey ?? process.env["AWS_ACCESS_KEY_ID"],
      secretAccessKey: opts.secretKey ?? process.env["AWS_SECRET_ACCESS_KEY"],
    });
  }
  return new FsStorage();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function outputPath(inputPath: string, outputDir: string, fileName: string): string {
  if (isS3Path(outputDir)) {
    // s3://bucket/prefix/ + fileName
    const prefix = outputDir.endsWith("/") ? outputDir : outputDir + "/";
    return prefix + fileName;
  }
  return join(outputDir, fileName);
}

function archivePath(inputPath: string, archiveDir: string): string {
  const name = isS3Path(inputPath) ? inputPath.split("/").pop()! : basename(inputPath);
  if (isS3Path(archiveDir)) {
    const prefix = archiveDir.endsWith("/") ? archiveDir : archiveDir + "/";
    return prefix + name;
  }
  return join(archiveDir, name);
}

// ── CLI setup ────────────────────────────────────────────────────────────────

const program = new Command();

program
  .name("camt2coda")
  .description("CAMT to CODA bank statement converter")
  .version("2.0.0");

// ── convert ──────────────────────────────────────────────────────────────────

program
  .command("convert")
  .description("Convert CAMT file(s) to CODA format")
  .requiredOption("-i, --input <path>", "Input file or directory (local or s3://)")
  .requiredOption("-o, --output <path>", "Output directory (local or s3://)")
  .option("--archive <dir>", "Directory to move source files after successful conversion")
  .option("--error <dir>", "Directory to move source files on conversion failure")
  .option("--dry-run", "Run pipeline but skip writing and moving files")
  .option("--anonymize", "Anonymize sensitive data in CODA output")
  .option("--endpoint <url>", "S3 endpoint URL (for MinIO etc.)")
  .option("--access-key <key>", "S3 access key (or use AWS_ACCESS_KEY_ID env var)")
  .option("--secret-key <key>", "S3 secret key (or use AWS_SECRET_ACCESS_KEY env var)")
  .action(async (opts) => {
    const storageOpts: StorageOptions = {
      endpoint: opts.endpoint,
      accessKey: opts.accessKey,
      secretKey: opts.secretKey,
    };

    const inputStorage = makeStorage(opts.input, storageOpts);
    const outputStorage = makeStorage(opts.output, storageOpts);

    // Collect input files
    let inputFiles: string[];
    try {
      // Check if input is a single file or directory
      if (opts.input.endsWith(".xml") || isS3Path(opts.input)) {
        const exists = await inputStorage.exists(opts.input);
        if (exists) {
          inputFiles = [opts.input];
        } else {
          // It's a directory path or prefix
          inputFiles = await inputStorage.list(opts.input);
        }
      } else {
        inputFiles = await inputStorage.list(opts.input);
      }
    } catch {
      inputFiles = [opts.input];
    }

    if (inputFiles.length === 0) {
      console.error("No XML files found at input path");
      process.exit(1);
    }

    console.log(`Converting ${inputFiles.length} file(s)...`);
    const start = performance.now();
    let allOk = true;

    for (const inputFile of inputFiles) {
      const name = isS3Path(inputFile) ? inputFile.split("/").pop()! : basename(inputFile);
      let success = false;

      try {
        const xml = await inputStorage.read(inputFile);
        const version = detectVersion(xml);
        console.log(`  ${name} [${version ?? "unknown"}]`);

        const statements = parseCamt(xml);

        for (const stmt of statements) {
          // Pre-flight CAMT validation
          const camtValidation = validateCamt(stmt);
          if (camtValidation.warnings.length > 0) {
            camtValidation.warnings.forEach((w) => console.warn(`    WARN: ${w}`));
          }

          // Convert to CODA
          const result = statementToCoda(stmt);

          // Post-conversion CODA validation
          const codaValidation = validateCoda(result.lines);
          const combined = {
            valid: result.validation.valid && codaValidation.valid,
            errors: [...result.validation.errors, ...codaValidation.errors],
          };

          if (!combined.valid) {
            console.error(`    ERROR in ${result.fileName}:`);
            combined.errors.forEach((e) => console.error(`      ${e}`));
            allOk = false;
          }

          // Optionally anonymize
          const lines = opts.anonymize
            ? anonymizeCodaLines(result.lines)
            : result.lines;

          const outPath = outputPath(inputFile, opts.output, result.fileName);

          if (opts.dryRun) {
            console.log(`    [dry-run] would write → ${outPath} (${lines.length} records)`);
          } else {
            await outputStorage.write(outPath, lines.join("\n") + "\n");
            console.log(`    → ${result.fileName} (${lines.length} records)`);
          }
        }

        success = true;
      } catch (err) {
        console.error(`  ERROR processing ${name}: ${(err as Error).message}`);
        allOk = false;
      }

      // Archive or error-move the source file
      if (!opts.dryRun) {
        if (success && opts.archive) {
          const dest = archivePath(inputFile, opts.archive);
          const archiveStorage = makeStorage(opts.archive, storageOpts);
          await inputStorage.move(inputFile, dest).catch((e: Error) => {
            console.warn(`    Could not archive ${name}: ${e.message}`);
          });
        } else if (!success && opts.error) {
          const dest = archivePath(inputFile, opts.error);
          await inputStorage.move(inputFile, dest).catch((e: Error) => {
            console.warn(`    Could not move to error dir ${name}: ${e.message}`);
          });
        }
      }
    }

    const elapsed = (performance.now() - start).toFixed(0);
    console.log(`\nDone in ${elapsed}ms. ${allOk ? "All valid." : "Some errors."}`);
    process.exit(allOk ? 0 : 1);
  });

// ── validate ─────────────────────────────────────────────────────────────────

program
  .command("validate")
  .description("Validate a CAMT file and report issues")
  .argument("<file>", "CAMT XML file to validate")
  .action(async (file: string) => {
    try {
      const storage = makeStorage(file);
      const xml = await storage.read(file);
      const version = detectVersion(xml);
      console.log(`Validating: ${basename(file)} [${version ?? "unknown"}]`);

      const statements = parseCamt(xml);
      let allValid = true;

      for (const stmt of statements) {
        const camtResult = validateCamt(stmt);
        const codaResult = statementToCoda(stmt);
        const codaValidation = validateCoda(codaResult.lines);

        const valid = camtResult.valid && codaResult.validation.valid && codaValidation.valid;
        const errors = [...camtResult.errors, ...codaResult.validation.errors, ...codaValidation.errors];
        const warnings = [...camtResult.warnings];

        if (valid) {
          console.log(`  ${codaResult.fileName}: OK (${codaResult.recordCount} records)`);
        } else {
          console.error(`  ${codaResult.fileName}: FAILED`);
          errors.forEach((e) => console.error(`    ${e}`));
          allValid = false;
        }

        if (warnings.length > 0) {
          warnings.forEach((w) => console.warn(`    WARN: ${w}`));
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
          allValid = false;
        } else {
          console.log(`  Balance check: OK`);
        }
      }

      process.exit(allValid ? 0 : 1);
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── info ─────────────────────────────────────────────────────────────────────

program
  .command("info")
  .description("Print metadata from a CAMT file")
  .argument("<file>", "CAMT XML file")
  .action(async (file: string) => {
    try {
      const storage = makeStorage(file);
      const xml = await storage.read(file);
      const version = detectVersion(xml);
      console.log(`CAMT Version: ${version ?? "unknown"}`);

      const statements = parseCamt(xml);
      for (const stmt of statements) {
        console.log(`\nStatement: ${stmt.statementId}`);
        console.log(`  Account: ${stmt.account.iban || stmt.account.otherId || "N/A"}`);
        console.log(`  Currency: ${stmt.account.currency}`);
        console.log(`  BIC: ${stmt.account.bic || "N/A"}`);
        console.log(`  Owner: ${stmt.account.ownerName || "N/A"}`);
        console.log(`  Report Date: ${stmt.reportDate}`);
        console.log(`  Opening: ${stmt.openingBalance.amount} ${stmt.openingBalance.creditDebit}`);
        console.log(`  Closing: ${stmt.closingBalance.amount} ${stmt.closingBalance.creditDebit}`);
        console.log(`  Entries: ${stmt.entries.length}`);

        const { lines } = statementToCoda(stmt);
        console.log(`  CODA Records: ${lines.length}`);
      }
    } catch (err) {
      console.error(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── serve ─────────────────────────────────────────────────────────────────────

program
  .command("serve")
  .description("Start the web UI server")
  .option("--port <n>", "Port to listen on", "3000")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    const { startServer } = await import("./web/server.js");
    startServer(port);
  });

program.parse(process.argv);
