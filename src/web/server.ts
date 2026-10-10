import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join, extname, resolve, sep } from "path";
import { parseCamt, detectVersion } from "../core/camt-parser.js";
import { statementToCoda } from "../core/coda-writer.js";
import { validateCoda } from "../validation/coda-validator.js";
import { validateCamt } from "../validation/camt-validator.js";
import { anonymizeCodaLines } from "../anonymize/anonymizer.js";
import { safeFileName } from "../storage/storage.js";
import { parseCoda } from "../core/coda-parser.js";
import { codaToCamt } from "../core/reverse.js";
import { anonymizeStatement } from "../anonymize/statement.js";
import { statementsToXml } from "../core/camt-writer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Multipart parser ─────────────────────────────────────────────────────────

interface ParsedFile {
  name: string;
  filename: string;
  content: string;
}

function parseMultipart(body: Buffer, boundary: string): ParsedFile[] {
  const sep = Buffer.from("--" + boundary);
  const parts: ParsedFile[] = [];
  let offset = 0;

  while (offset < body.length) {
    const sepIdx = body.indexOf(sep, offset);
    if (sepIdx === -1) break;
    offset = sepIdx + sep.length;

    // Skip CRLF after boundary
    if (body[offset] === 0x0d && body[offset + 1] === 0x0a) offset += 2;
    else if (body[offset] === 0x0a) offset += 1;

    // End boundary
    if (body[offset] === 0x2d && body[offset + 1] === 0x2d) break;

    // Parse headers
    let headersEnd = body.indexOf("\r\n\r\n", offset);
    if (headersEnd === -1) headersEnd = body.indexOf("\n\n", offset);
    if (headersEnd === -1) break;

    const headerStr = body.slice(offset, headersEnd).toString("utf-8");
    const skipLen = body[headersEnd] === 0x0d ? 4 : 2;
    offset = headersEnd + skipLen;

    // Find end of this part
    const nextSepIdx = body.indexOf(sep, offset);
    const partEnd = nextSepIdx === -1 ? body.length : nextSepIdx;
    // Strip trailing CRLF before next boundary
    let contentEnd = partEnd;
    while (contentEnd > offset && (body[contentEnd - 1] === 0x0a || body[contentEnd - 1] === 0x0d)) {
      contentEnd--;
    }

    const content = body.slice(offset, contentEnd).toString("utf-8");
    offset = nextSepIdx === -1 ? body.length : nextSepIdx;

    // Parse Content-Disposition
    const dispMatch = headerStr.match(/Content-Disposition:\s*form-data;([^\r\n]*)/i);
    if (!dispMatch) continue;

    const nameMatch = dispMatch[1].match(/\bname="([^"]*)"/);
    const filenameMatch = dispMatch[1].match(/\bfilename="([^"]*)"/);

    parts.push({
      name: nameMatch ? nameMatch[1] : "",
      filename: filenameMatch ? filenameMatch[1] : "",
      content,
    });
  }

  return parts;
}

// ── Body reader ───────────────────────────────────────────────────────────────

function tooLarge(): Error & { statusCode: number } {
  const err = new Error("Request body too large") as Error & { statusCode: number };
  err.statusCode = 413;
  return err;
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    // Reject early when the declared size already exceeds the cap.
    const declared = Number(req.headers["content-length"]);
    if (Number.isFinite(declared) && declared > maxBytes) {
      fail(tooLarge());
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      if (settled) return; // already over the limit — stop buffering (bounds memory)
      size += chunk.length;
      if (size > maxBytes) {
        fail(tooLarge());
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!settled) {
        settled = true;
        resolve(Buffer.concat(chunks));
      }
    });
    req.on("error", fail);
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleHealth(res: ServerResponse): Promise<void> {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleConvert(req: IncomingMessage, res: ServerResponse, maxBodyBytes: number): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  const mediaType = contentType.split(";")[0].trim().toLowerCase();
  const url = new URL(req.url ?? "/", "http://localhost");
  const directionOverride = url.searchParams.get("direction");
  if (directionOverride && directionOverride !== "camt-to-coda" && directionOverride !== "coda-to-camt") {
    json(res, 400, { error: "Invalid conversion direction" });
    return;
  }
  if (!["", "multipart/form-data", "application/xml", "text/xml", "text/plain", "application/octet-stream"].includes(mediaType)) {
    json(res, 415, { error: "Unsupported request content type" });
    return;
  }
  const body = await readBody(req, maxBodyBytes);
  let content = body.toString("utf-8");
  let doAnonymize = url.searchParams.get("anonymize") === "true";
  if (mediaType === "multipart/form-data") {
    const boundary = contentType.match(/boundary=(?:"([^"\r\n]+)"|([^\s;]+))/i);
    if (!boundary) { json(res, 400, { error: "Missing multipart boundary" }); return; }
    const parts = parseMultipart(body, boundary[1] ?? boundary[2]);
    const file = parts.find((part) => part.name === "file" || !!part.filename);
    if (!file?.content) { json(res, 400, { error: "No file found in request" }); return; }
    content = file.content;
    const anonymize = parts.find((part) => part.name === "anonymize")?.content.trim();
    doAnonymize ||= anonymize === "true" || anonymize === "1";
  }
  if (!content.trim()) { json(res, 400, { error: "Empty conversion input" }); return; }
  const direction = directionOverride ?? (content.trimStart().startsWith("<") ? "camt-to-coda" : "coda-to-camt");
  if (direction === "camt-to-coda") {
    handleForwardConvert(res, content, doAnonymize);
  } else {
    handleReverseConvert(res, content, url.searchParams.get("camt-version") ?? undefined, doAnonymize);
  }
}

function handleForwardConvert(res: ServerResponse, xml: string, doAnonymize: boolean): void {
  try {
    const version = detectVersion(xml);
    const statements = parseCamt(xml);
    if (statements.length === 0) throw new Error("No statements found");
    const preflight = statements.map(validateCamt);
    if (preflight.some((check) => !check.valid)) {
      json(res, 422, { error: "CAMT validation failed", validation: {
        valid: false, errors: preflight.flatMap((check) => check.errors), warnings: preflight.flatMap((check) => check.warnings),
        checks: ["syntax", "structure", "business"], xsdValidated: false,
      }});
      return;
    }
    const files = statements.map((stmt, index) => {
      const result = statementToCoda(stmt);
      const codaValidation = validateCoda(result.lines);
      const camtValidation = preflight[index];
      const rawLines = doAnonymize ? anonymizeCodaLines(result.lines) : result.lines.map((line) => line.raw);
      return {
        fileName: doAnonymize ? `statement-${index + 1}.cod` : safeFileName(result.fileName),
        lines: doAnonymize ? rawLines : result.lines,
        recordCount: result.recordCount,
        validation: {
          valid: camtValidation.valid && result.validation.valid && codaValidation.valid,
          errors: [...camtValidation.errors, ...result.validation.errors, ...codaValidation.errors],
          warnings: [...new Set([...camtValidation.warnings, ...result.validation.warnings, ...codaValidation.warnings])],
          checks: ["syntax", "structure", "business", "reconciliation"], xsdValidated: false,
        },
      };
    });
    const validation = {
      valid: files.every((file) => file.validation.valid),
      errors: files.flatMap((file) => file.validation.errors),
      warnings: files.flatMap((file) => file.validation.warnings),
      checks: ["syntax", "structure", "business", "reconciliation"], xsdValidated: false,
    };
    if (!validation.valid) {
      json(res, 422, { error: "Conversion validation failed", validation });
      return;
    }
    json(res, 200, { direction: "camt-to-coda", files, version, validation });
  } catch (err) {
    json(res, 400, { error: (err as Error).message });
  }
}

function handleReverseConvert(res: ServerResponse, content: string, camtVersion?: string, doAnonymize = false): void {
  try {
    const lines = parseCoda(content);
    const codaValidation = validateCoda(lines);
    if (!codaValidation.valid) {
      json(res, 422, { error: "CODA validation failed", validation: codaValidation });
      return;
    }
    const result = codaToCamt(content, camtVersion);
    const checks = result.statements.map(validateCamt);
    const validation = {
      valid: codaValidation.valid && checks.every((check) => check.valid),
      errors: [...codaValidation.errors, ...checks.flatMap((check) => check.errors)],
      warnings: [...new Set([...result.warnings, ...codaValidation.warnings, ...checks.flatMap((check) => check.warnings)])],
      checks: ["syntax", "structure", "business", "reconciliation"], xsdValidated: false,
    };
    if (!validation.valid) {
      json(res, 422, { error: "CAMT validation failed", validation });
      return;
    }
    const statements = doAnonymize ? result.statements.map(anonymizeStatement) : result.statements;
    const xml = doAnonymize ? statementsToXml(statements, camtVersion) : result.xml;
    if (doAnonymize) validation.warnings = ["Privacy export: original names, accounts and references removed. Amounts and dates remain identifiable; synthetic identifiers are not for bank import.", ...(validation.warnings.length ? ["The source has conversion notes; review the original privately before relying on this export."] : [])];
    json(res, 200, {
      direction: "coda-to-camt", xml, lines: doAnonymize ? [] : result.lines,
      fileName: doAnonymize ? "anonymized-statements.xml" : "converted-statements.xml",
      statement: statements[0], statements, warnings: validation.warnings, validation,
    });
  } catch (err) {
    json(res, 400, { error: (err as Error).message });
  }
}

// Serve the built Vite app (dist-web/) — index.html + hashed assets, with an
// SPA fallback. dist-web sits two levels up from src/web/ (and dist/web/).
const DIST_DIR = join(__dirname, "..", "..", "dist-web");
const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".map": "application/json",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
};

async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  let rel: string;
  try { rel = decodeURIComponent(urlPath.split("?")[0]); }
  catch { res.writeHead(400); res.end("Malformed URL"); return; }
  if (rel === "/" || rel === "") rel = "/index.html";
  if (rel.split(/[/\\]/).includes("..") || rel.includes("\0")) {
    res.writeHead(403, { "Content-Type": "text/plain" }); res.end("Forbidden"); return;
  }
  const filePath = resolve(DIST_DIR, "." + rel);
  if (!filePath.startsWith(DIST_DIR + sep)) {
    res.writeHead(403, { "Content-Type": "text/plain" }); res.end("Forbidden"); return;
  }
  try {
    const data = await readFile(filePath);
    res.writeHead(200, { "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    if (extname(rel)) {
      res.writeHead(404, { "Content-Type": "text/plain" }); res.end("Not found"); return;
    }
    // SPA fallback: serve index.html for unknown (non-asset) routes.
    try {
      const html = await readFile(join(DIST_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Web app not built. Run: npm run build:app");
    }
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

export interface ServerOptions {
  /** Interface to bind. Defaults to 127.0.0.1 (loopback only). Use "0.0.0.0" to expose. */
  host?: string;
  /** Exact allowed CORS origin. When unset, no CORS header is sent (same-origin only). Never "*". */
  corsOrigin?: string;
  /** Max request body size in bytes. Defaults to 10 MiB. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 10 * 1024 * 1024;

export function startServer(port = 3000, opts: ServerOptions = {}): ReturnType<typeof createServer> {
  const host = opts.host ?? "127.0.0.1";
  const corsOrigin = opts.corsOrigin;
  const maxBodyBytes = opts.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // CORS: opt-in and origin-specific only (never a wildcard).
    if (corsOrigin) {
      res.setHeader("Access-Control-Allow-Origin", corsOrigin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    }

    if (method === "OPTIONS") {
      res.writeHead(corsOrigin ? 204 : 405);
      res.end();
      return;
    }

    try {
      if (url === "/api/health" && method === "GET") {
        await handleHealth(res);
      } else if (url.split("?")[0] === "/api/convert" && method === "POST") {
        await handleConvert(req, res, maxBodyBytes);
      } else if (method === "GET") {
        await serveStatic(res, url);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
      if (!res.headersSent) {
        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: (err as Error).message }));
      }
    }
  });

  server.listen(port, host, () => {
    console.log(`camt2coda web UI running at http://${host}:${port}`);
  });

  return server;
}
