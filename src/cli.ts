#!/usr/bin/env node
import { Command } from "commander";
import { parseCamt, detectVersion } from "./core/camt-parser.js";
import { statementToCoda } from "./core/coda-writer.js";
import { validateCamt } from "./validation/camt-validator.js";
import { validateCoda } from "./validation/coda-validator.js";
import { FsStorage } from "./storage/fs-storage.js";
import { S3Storage } from "./storage/s3-storage.js";
import { isS3Path, safeFileName } from "./storage/storage.js";
import { anonymizeCodaLines } from "./anonymize/anonymizer.js";
import type { Storage } from "./storage/storage.js";
import { basename, join } from "path";

// ── Storage factory ──────────────────────────────────────────────────────────

interface StorageOptions {
  endpoint?: string;
}

function makeStorage(path: string, opts: StorageOptions = {}): Storage {
  if (isS3Path(path)) {
    return new S3Storage({
      endpoint: opts.endpoint,
    });
  }
  return new FsStorage();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function outputPath(outputDir: string, fileName: string): string {
  fileName = safeFileName(fileName);
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
  .action(async (opts) => {
    // S3 credentials use the standard SDK provider chain (AWS_ACCESS_KEY_ID /
    // AWS_SECRET_ACCESS_KEY) — never CLI flags, which leak via ps/shell history.
    const storageOpts: StorageOptions = { endpoint: opts.endpoint };

    const inputStorage = makeStorage(opts.input, storageOpts);
    const outputStorage = makeStorage(opts.output, storageOpts);

    // Reject unsupported archive/error destinations before any reads or writes.
    for (const destination of [opts.archive, opts.error]) {
      if (destination && isS3Path(destination) !== isS3Path(opts.input)) {
        console.error("Cross-backend archive/error moves are unsupported");
        process.exit(1);
      }
    }
    let inputFiles: string[];
    try {
      inputFiles = (isS3Path(opts.input) && await inputStorage.exists(opts.input)
        ? [opts.input] : await inputStorage.list(opts.input)).filter((path) => /\.xml$/i.test(path));
    } catch (err) {
      console.error(`Could not discover input: ${(err as Error).message}`);
      process.exit(1);
    }

    if (inputFiles.length === 0) {
      console.error("No XML files found at input path");
      process.exit(1);
    }

    console.log(`Converting ${inputFiles.length} file(s)...`);
    const start = performance.now();
    const usedOutputPaths = new Set<string>();
    let allOk = true;

    for (const inputFile of inputFiles) {
      const name = isS3Path(inputFile) ? inputFile.split("/").pop()! : basename(inputFile);
      let success = false;

      try {
        const xml = await inputStorage.read(inputFile);
        const version = detectVersion(xml);
        console.log(`  ${name} [${version ?? "unknown"}]`);

        const statements = parseCamt(xml);

        if (statements.length === 0) throw new Error("No statements found");
        // Prepare the complete input first: an invalid later statement cannot leave earlier outputs.
        const prepared = statements.map((stmt, index) => {
          const camtValidation = validateCamt(stmt);
          if (!camtValidation.valid) throw new Error(camtValidation.errors.join("; "));
          const result = statementToCoda(stmt);
          const codaValidation = validateCoda(result.lines);
          const errors = [...camtValidation.errors, ...result.validation.errors, ...codaValidation.errors];
          const warnings = [...camtValidation.warnings, ...result.validation.warnings, ...codaValidation.warnings];
          warnings.forEach((warning) => console.warn(`    WARN: ${warning}`));
          if (errors.length > 0 || !result.validation.valid || !codaValidation.valid) {
            throw new Error(`${result.fileName}: ${errors.join("; ")}`);
          }
          const lines = opts.anonymize ? anonymizeCodaLines(result.lines) : result.lines.map((line) => line.raw);
          const privateName = opts.anonymize ? `input-${inputFiles.indexOf(inputFile) + 1}-statement-${index + 1}.cod` : result.fileName;
          return { lines, fileName: safeFileName(privateName), outPath: outputPath(opts.output, privateName) };
        });
        if (new Set(prepared.map((file) => file.outPath)).size !== prepared.length || prepared.some((file) => usedOutputPaths.has(file.outPath))) {
          throw new Error("Statements produce duplicate output filenames");
        }
        for (const { lines, fileName, outPath } of prepared) {
          usedOutputPaths.add(outPath);
          if (opts.dryRun) {
            console.log(`    [dry-run] would write → ${outPath} (${lines.length} records)`);
          } else {
            await outputStorage.write(outPath, lines.join("\n") + "\n");
            console.log(`    → ${fileName} (${lines.length} records)`);
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
          await inputStorage.move(inputFile, dest).catch((e: Error) => {
            console.error(`    Could not archive ${name}: ${e.message}`);
            allOk = false;
          });
        } else if (!success && opts.error) {
          const dest = archivePath(inputFile, opts.error);
          await inputStorage.move(inputFile, dest).catch((e: Error) => {
            console.error(`    Could not move to error dir ${name}: ${e.message}`);
            allOk = false;
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
        const warnings = [...camtResult.warnings, ...codaResult.validation.warnings, ...codaValidation.warnings];

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
        if (Math.round(diff * 1000) > 0) {
          console.error(
            `  Balance mismatch: open(${openSigned}) + mvt(${mvt.toFixed(3)}) ≠ close(${closeSigned}), diff=${diff.toFixed(3)}`
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
  .option("--host <host>", "Interface to bind (default 127.0.0.1; use 0.0.0.0 to expose externally)")
  .option("--cors-origin <origin>", "Allow cross-origin requests from this exact origin (no wildcard)")
  .option("--max-body-mb <n>", "Maximum upload size in MB", "10")
  .action(async (opts) => {
    const port = parseInt(opts.port, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      console.error(`Invalid port: ${opts.port}`);
      process.exit(1);
    }
    const maxMb = parseFloat(opts.maxBodyMb);
    const { startServer } = await import("./web/server.js");
    startServer(port, {
      host: opts.host,
      corsOrigin: opts.corsOrigin,
      maxBodyBytes: Number.isFinite(maxMb) && maxMb > 0 ? Math.round(maxMb * 1024 * 1024) : undefined,
    });
  });

// ── reverse ──────────────────────────────────────────────────────────────────

program
  .command("reverse")
  .description("Convert CODA file(s) to CAMT XML format")
  .requiredOption("-i, --input <path>", "Input CODA file or directory (local or s3://)")
  .requiredOption("-o, --output <path>", "Output directory (local or s3://)")
  .option("--camt-version <version>", "CAMT version to generate", "camt.053.001.08")
  .option("--dry-run", "Validate and preview without writing files")
  .option("--endpoint <url>", "S3 endpoint URL")
  .action(async (opts) => {
    const { codaToCamt } = await import("./core/reverse.js");
    // S3 credentials use the standard SDK provider chain — see note in `convert`.
    const storageOpts: StorageOptions = { endpoint: opts.endpoint };
    const inputStorage = makeStorage(opts.input, storageOpts);
    const outputStorage = makeStorage(opts.output, storageOpts);

    let inputFiles: string[];
    try {
      inputFiles = (isS3Path(opts.input) && await inputStorage.exists(opts.input)
        ? [opts.input] : await inputStorage.list(opts.input)).filter((path) => /\.(cod|coda)$/i.test(path));
    } catch (err) {
      console.error(`Could not discover input: ${(err as Error).message}`);
      process.exit(1);
    }

    if (inputFiles.length === 0) {
      console.error("No CODA files found at input path");
      process.exit(1);
    }

    // Preflight all names before the first write: .cod and .coda share .xml destinations.
    const destinations = inputFiles.map(path => outputPath(opts.output, (isS3Path(path) ? path.split("/").pop()! : basename(path)).replace(/\.(cod|coda)$/i, ".xml")));
    if (new Set(destinations).size !== destinations.length) {
      console.error("Duplicate output filenames from CODA input paths");
      process.exit(1);
    }

    console.log(`Reverse-converting ${inputFiles.length} file(s)...`);
    let allOk = true;

    for (const inputFile of inputFiles) {
      const name = isS3Path(inputFile) ? inputFile.split("/").pop()! : basename(inputFile);
      try {
        const content = await inputStorage.read(inputFile);
        const result = codaToCamt(content, opts.camtVersion);
        const validation = validateCoda(result.lines);
        const statements = result.statements;
        const camtChecks = statements.map(validateCamt);
        const errors = [...validation.errors, ...camtChecks.flatMap((check) => check.errors)];
        if (!validation.valid || camtChecks.some((check) => !check.valid)) throw new Error(errors.join("; "));
        const warnings = [...result.warnings, ...validation.warnings, ...camtChecks.flatMap((check) => check.warnings)];

        if (warnings.length > 0) {
          warnings.forEach((w) => console.warn(`  WARN: ${w}`));
        }

        const outName = name.replace(/\.(cod|coda)$/i, ".xml");
        const outPath = outputPath(opts.output, outName);

        if (opts.dryRun) {
          console.log(`  [dry-run] ${name} → ${outName} (${statements.length} statements, ${statements.reduce((total, statement) => total + statement.entries.length, 0)} entries)`);
        } else {
          await outputStorage.write(outPath, result.xml);
          console.log(`  ${name} → ${outName} (${statements.length} statements, ${statements.reduce((total, statement) => total + statement.entries.length, 0)} entries)`);
        }
      } catch (err) {
        console.error(`  ERROR processing ${name}: ${(err as Error).message}`);
        allOk = false;
      }
    }

    process.exit(allOk ? 0 : 1);
  });

program.parse(process.argv);
