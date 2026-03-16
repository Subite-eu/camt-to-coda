import { createServer, IncomingMessage, ServerResponse } from "http";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { parseCamt, detectVersion } from "../core/camt-parser.js";
import { statementToCoda } from "../core/coda-writer.js";
import { validateCoda } from "../validation/coda-validator.js";
import { validateCamt } from "../validation/camt-validator.js";
import { anonymizeCodaLines } from "../anonymize/anonymizer.js";
import { codaToCamt } from "../core/reverse.js";

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

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// ── Route handlers ────────────────────────────────────────────────────────────

async function handleHealth(res: ServerResponse): Promise<void> {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
}

async function handleConvert(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const contentType = req.headers["content-type"] ?? "";
  const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
  const directionOverride = url.searchParams.get("direction");
  const camtVersion = url.searchParams.get("camt-version") ?? undefined;

  const body = await readBody(req);

  let direction: "camt-to-coda" | "coda-to-camt";

  if (directionOverride === "camt-to-coda" || directionOverride === "coda-to-camt") {
    direction = directionOverride;
  } else if (contentType.includes("multipart/form-data")) {
    direction = "camt-to-coda";
  } else {
    const text = body.toString("utf-8").trim();
    if (text.startsWith("<?xml") || text.includes("xmlns")) {
      direction = "camt-to-coda";
    } else {
      direction = "coda-to-camt";
    }
  }

  if (direction === "camt-to-coda") {
    await handleForwardConvert(req, res, body, contentType);
  } else {
    await handleReverseConvert(res, body, camtVersion);
  }
}

async function handleForwardConvert(
  req: IncomingMessage, res: ServerResponse, body: Buffer, contentType: string
): Promise<void> {
  const boundaryMatch = contentType.match(/boundary=([^\s;]+)/);
  if (!boundaryMatch) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Expected multipart/form-data" }));
    return;
  }

  const boundary = boundaryMatch[1];
  const parts = parseMultipart(body, boundary);

  const xmlPart = parts.find(
    (p) => p.name === "file" || p.filename?.endsWith(".xml")
  );
  const anonymizePart = parts.find((p) => p.name === "anonymize");
  const doAnonymize = anonymizePart?.content?.trim() === "true" || anonymizePart?.content?.trim() === "1";

  if (!xmlPart || !xmlPart.content) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "No XML file found in request" }));
    return;
  }

  try {
    const xml = xmlPart.content;
    const version = detectVersion(xml);
    const statements = parseCamt(xml);

    const files = statements.map((stmt) => {
      const camtValidation = validateCamt(stmt);
      const result = statementToCoda(stmt);
      const codaValidation = validateCoda(result.lines);

      const rawLines: string[] = doAnonymize
        ? anonymizeCodaLines(result.lines)
        : result.lines.map((l) => l.raw);

      return {
        fileName: result.fileName,
        lines: doAnonymize ? rawLines : result.lines,
        recordCount: result.recordCount,
        validation: {
          valid: camtValidation.valid && result.validation.valid && codaValidation.valid,
          errors: [...camtValidation.errors, ...result.validation.errors, ...codaValidation.errors],
          warnings: camtValidation.warnings,
        },
      };
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ direction: "camt-to-coda", files, version }));
  } catch (err) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

async function handleReverseConvert(
  res: ServerResponse, body: Buffer, camtVersion?: string
): Promise<void> {
  try {
    const content = body.toString("utf-8");
    const result = codaToCamt(content, camtVersion);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      direction: "coda-to-camt",
      xml: result.xml,
      lines: result.lines,
      warnings: result.warnings,
      validation: { valid: true, errors: [] },
    }));
  } catch (err) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
}

async function handleIndex(res: ServerResponse): Promise<void> {
  try {
    const htmlPath = join(__dirname, "index.html");
    const html = await readFile(htmlPath, "utf-8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("index.html not found");
  }
}

// ── Server ────────────────────────────────────────────────────────────────────

export function startServer(port = 3000): void {
  const server = createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";

    // CORS headers for development
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      if (url === "/" && method === "GET") {
        await handleIndex(res);
      } else if (url === "/api/health" && method === "GET") {
        await handleHealth(res);
      } else if (url.startsWith("/api/convert") && method === "POST") {
        await handleConvert(req, res);
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
  });

  server.listen(port, () => {
    console.log(`camt2coda web UI running at http://localhost:${port}`);
  });
}
