import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { request, Server } from "http";
import { execFileSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { resolve } from "node:path";
import { startServer } from "../../src/web/server.js";

// ── Test helpers ────────────────────────────────────────────────────────────

let server: Server;
const port = 39100 + Math.floor(Math.random() * 900);
const baseUrl = `http://localhost:${port}`;

function httpFetch(
  path: string,
  opts: { method?: string; body?: string | Buffer; headers?: Record<string, string> } = {},
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request(
      `${baseUrl}${path}`,
      { method: opts.method ?? "GET", headers: opts.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers as Record<string, string>,
            body: Buffer.concat(chunks).toString("utf-8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

function multipartBody(filename: string, content: string): { body: Buffer; boundary: string } {
  const boundary = "----TestBoundary" + Date.now();
  const parts = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    "Content-Type: application/xml",
    "",
    content,
    `--${boundary}--`,
  ];
  return { body: Buffer.from(parts.join("\r\n")), boundary };
}

// ── Test data ───────────────────────────────────────────────────────────────

const minimalCamtXml = `<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><GrpHdr><MsgId>M1</MsgId><CreDtTm>2024-03-15T00:00:00</CreDtTm></GrpHdr>
  <Stmt><Id>S1</Id>
    <Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy>
      <Svcr><FinInstnId><BIC>BBRUBEBB</BIC></FinInstnId></Svcr></Acct>
    <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
    <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
  </Stmt></BkToCstmrStmt></Document>`;

const minimalCoda = [
  "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "BBRUBEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2",
  "1" + "3" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(26) + " ".repeat(35) + "001",
  "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000001000000" + "150324" + " ".repeat(64) + "0",
  "9" + " ".repeat(15) + "000002" + "000000000000000" + "000000000000000" + " ".repeat(75) + "2",
].join("\n");

// ── Lifecycle ───────────────────────────────────────────────────────────────

beforeAll(() => {
  // The server serves the built Vite app; ensure it exists for the static-serving test.
  if (!existsSync("dist-web/index.html")) execFileSync("npm", ["run", "build:app"], { stdio: "ignore" });
  return new Promise<void>((resolve) => {
    server = startServer(port);
    server.on("listening", resolve);
  });
}, 120000);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => resolve());
    }),
);

// ── Tests ───────────────────────────────────────────────────────────────────

describe("web server integration", () => {
  it("GET / returns index.html with 200", async () => {
    const res = await httpFetch("/");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.body.toLowerCase()).toContain("<!doctype html>");
    expect(res.body).toContain("camt2coda");
  });

  it("GET /api/health returns ok", async () => {
    const res = await httpFetch("/api/health");
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.status).toBe("ok");
  });

  it("POST /api/convert with CAMT XML multipart returns CODA with direction", async () => {
    const { body, boundary } = multipartBody("test.xml", minimalCamtXml);
    const res = await httpFetch("/api/convert", {
      method: "POST",
      body,
      headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.direction).toBe("camt-to-coda");
    expect(data.files).toHaveLength(1);
    expect(data.validation.xsdValidated).toBe(false);
    expect(data.validation.checks).toEqual(expect.arrayContaining(["syntax", "structure", "business", "reconciliation"]));
    // Each line is a CodaLine object with fields
    const line = data.files[0].lines[0];
    expect(line.recordType).toBeDefined();
    expect(line.raw).toHaveLength(128);
    expect(line.fields.length).toBeGreaterThan(0);
  });

  it("POST /api/convert with CODA text returns CAMT XML", async () => {
    const res = await httpFetch("/api/convert?direction=coda-to-camt", {
      method: "POST",
      body: minimalCoda,
      headers: { "content-type": "text/plain" },
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.direction).toBe("coda-to-camt");
    expect(data.xml).toContain("<?xml");
    expect(data.xml).toContain("BE68539007547034");
    expect(data.lines).toHaveLength(4);
    expect(data.warnings).toBeDefined();
  });

  it("POST /api/convert auto-detects CODA direction from content", async () => {
    const res = await httpFetch("/api/convert", {
      method: "POST",
      body: minimalCoda,
      headers: { "content-type": "application/octet-stream" },
    });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.direction).toBe("coda-to-camt");
  });

  it("POST /api/convert with invalid CODA returns 400", async () => {
    const res = await httpFetch("/api/convert?direction=coda-to-camt", {
      method: "POST",
      body: "this is not valid CODA content at all",
      headers: { "content-type": "text/plain" },
    });
    expect(res.status).toBe(400);
    const data = JSON.parse(res.body);
    expect(data.error).toBeDefined();
  });

  it("accepts raw CAMT XML without requiring multipart", async () => {
    const res = await httpFetch("/api/convert", { method: "POST", body: minimalCamtXml, headers: { "content-type": "application/xml" } });
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body).files).toHaveLength(1);
  });

  it("detects uploaded CODA from multipart content and accepts quoted boundaries", async () => {
    const { body, boundary } = multipartBody("test.COD", minimalCoda);
    const res = await httpFetch("/api/convert", { method: "POST", body, headers: { "content-type": `multipart/form-data; boundary="${boundary}"` } });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.direction).toBe("coda-to-camt");
    expect(data.statements).toHaveLength(1);
    expect(data.validation.valid).toBe(true);
    expect(data.validation.xsdValidated).toBe(false);
    expect(data.validation.checks).toContain("reconciliation");
  });

  it("returns 422 without downloadable artifacts for invalid CAMT business fields", async () => {
    const { body, boundary } = multipartBody("invalid.xml", minimalCamtXml.replace("<IBAN>BE68539007547034</IBAN>", "<IBAN></IBAN>"));
    const res = await httpFetch("/api/convert", { method: "POST", body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } });
    expect(res.status).toBe(422);
    const data = JSON.parse(res.body);
    expect(data.validation.valid).toBe(false);
    expect(data.validation.errors.join(" ")).toMatch(/account identifier/i);
    expect(data.files).toBeUndefined();
  });

  it("reports malformed XML as a client error", async () => {
    const { body, boundary } = multipartBody("invalid.xml", "<Document><broken></Document>");
    const res = await httpFetch("/api/convert", { method: "POST", body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } });
    expect(res.status).toBe(400);
  });

  it("includes writer warnings in the forward API response", async () => {
    const { body, boundary } = multipartBody("warning.xml", minimalCamtXml.replace(/>1000<\/Amt>/, ">999.999</Amt>"));
    const res = await httpFetch("/api/convert", { method: "POST", body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } });
    const data = JSON.parse(res.body);
    // Reconciliation can invalidate the result, but its diagnosis must always remain visible.
    const warnings = data.validation?.warnings ?? data.files?.flatMap((file: any) => file.validation.warnings);
    expect(warnings.join(" ")).toMatch(/Balance mismatch/);
  });

  it("preserves all logical CODA files in reverse API output", async () => {
    const res = await httpFetch("/api/convert", { method: "POST", body: minimalCoda.slice(0, -1) + "1\n" + minimalCoda, headers: { "content-type": "text/plain" } });
    expect(res.status).toBe(200);
    const data = JSON.parse(res.body);
    expect(data.statements).toHaveLength(2);
    expect(data.xml.match(/<Stmt>/g)).toHaveLength(2);
  });

  it("anonymizes reverse API artifacts and metadata for both query and multipart requests", async () => {
    const original = readFileSync(resolve("examples/coda/coda-multiple-statements.cod"), "utf8");
    const secrets = ["BE68539007547034", "BE71096123456769", "Example Company", "E2E-EXAMPLE", "BANK-EXAMPLE", "Example invoice"];
    for (const multipart of [false, true]) {
      const upload = multipartBody("original.cod", original);
      const body = multipart ? upload.body.toString("utf8").replace(`--${upload.boundary}--`, `--${upload.boundary}\r\nContent-Disposition: form-data; name="anonymize"\r\n\r\ntrue\r\n--${upload.boundary}--`) : original;
      const res = await httpFetch(multipart ? "/api/convert" : "/api/convert?anonymize=true", { method: "POST", body, headers: { "content-type": multipart ? `multipart/form-data; boundary=${upload.boundary}` : "text/plain" } });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.statements).toHaveLength(2);
      expect(data.xml.match(/<Stmt>/g)).toHaveLength(2);
      expect(data.xml).toContain("ANON-");
      expect(data.fileName).toMatch(/anonymized/);
      expect(data.validation.valid).toBe(true);
      for (const secret of secrets) expect(res.body).not.toContain(secret);
    }
  });

  it("rejects invalid direction and unsupported request media types", async () => {
    const direction = await httpFetch("/api/convert?direction=typo", { method: "POST", body: minimalCoda, headers: { "content-type": "text/plain" } });
    expect(direction.status).toBe(400);
    const media = await httpFetch("/api/convert", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
    expect(media.status).toBe(415);
  });

  it("rejects encoded traversal and malformed static URLs", async () => {
    expect((await httpFetch("/%2e%2e%2fpackage.json")).status).toBe(403);
    expect((await httpFetch("/%zz")).status).toBe(400);
    expect((await httpFetch("/missing.js")).status).toBe(404);
  });

  it("serves the SPA (index.html) for unknown GET routes", async () => {
    const res = await httpFetch("/nonexistent");
    expect(res.status).toBe(200);
    expect(res.body.toLowerCase()).toContain("<!doctype html>");
  });

  it("sends NO Access-Control-Allow-Origin header by default (no wildcard)", async () => {
    const res = await httpFetch("/api/health");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });
});

// ── Hardening (dedicated server instances with explicit options) ──────────────

function fetchOn(p: number, path: string, opts: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
  return new Promise<{ status: number; headers: Record<string, string> }>((resolve, reject) => {
    const req = request(`http://localhost:${p}${path}`, { method: opts.method ?? "GET", headers: opts.headers }, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers as Record<string, string> }));
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

describe("web server hardening", () => {
  it("echoes only the configured CORS origin, never a wildcard", async () => {
    const p = 39200 + Math.floor(Math.random() * 300);
    const srv = startServer(p, { corsOrigin: "https://app.example.com" });
    await new Promise<void>((r) => srv.on("listening", () => r()));
    try {
      const res = await fetchOn(p, "/api/health");
      expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
      expect(res.headers["access-control-allow-origin"]).not.toBe("*");
    } finally {
      await new Promise<void>((r) => srv.close(() => r()));
    }
  });

  it("rejects an over-limit request body with 413", async () => {
    const p = 39600 + Math.floor(Math.random() * 300);
    const srv = startServer(p, { maxBodyBytes: 100 }); // 100-byte cap
    await new Promise<void>((r) => srv.on("listening", () => r()));
    try {
      const res = await fetchOn(p, "/api/convert?direction=coda-to-camt", {
        method: "POST",
        body: "X".repeat(5000),
        headers: { "content-type": "text/plain" },
      });
      expect(res.status).toBe(413);
    } finally {
      await new Promise<void>((r) => srv.close(() => r()));
    }
  });
});
