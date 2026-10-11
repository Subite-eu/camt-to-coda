import { it, expect } from "vitest";
import { createServer } from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const script = resolve("scripts/verify-deployment.mjs");
const html = '<script type="module" src="/assets/index-current.js"></script><link rel="stylesheet" href="/assets/index-current.css">';
async function deployment(overrides: Record<string, string>, verify: (origin: string, cwd: string) => Promise<void>) {
  const cwd = await mkdtemp(join(tmpdir(), "camt-deployment-"));
  const assets = { "index-current.js": 'import("./salary-sample.js")', "index-current.css": "body{}", "salary-sample.js": 'export default "synthetic original"', "conversion.worker-current.js": "self.onmessage=()=>{}" };
  const files = { "/": html, ...Object.fromEntries(Object.entries(assets).map(([name, text]) => [`/assets/${name}`, text])), ...overrides };
  const server = createServer((request, response) => {
    const content = files[request.url!];
    response.writeHead(content === undefined ? 404 : 200); response.end(content);
  });
  try {
    await mkdir(join(cwd, "dist-web/assets"), { recursive: true });
    await writeFile(join(cwd, "dist-web/index.html"), html);
    for (const [name, content] of Object.entries(assets)) await writeFile(join(cwd, "dist-web/assets", name), content);
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test server address");
    await verify(`http://127.0.0.1:${address.port}`, cwd);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await rm(cwd, { recursive: true, force: true });
  }
}

it("verifies lazy sample and worker chunks without requiring them in entry HTML", async () => {
  await deployment({}, async (origin, cwd) => {
    const { stdout } = await run(process.execPath, [script, origin], { cwd });
    expect(stdout).toContain("salary-sample.js");
    expect(stdout).toContain("conversion.worker-current.js");
  });
});
it("rejects stale entry HTML even when current assets remain accessible", async () => {
  await deployment({ "/": html.replace("index-current.js", "index-stale.js") }, async (origin, cwd) => {
    await expect(run(process.execPath, [script, origin], { cwd })).rejects.toThrow("HTML does not reference current asset index-current.js");
  });
});
it("rejects mismatched lazy original-source bytes", async () => {
  await deployment({ "/assets/salary-sample.js": "stale sample" }, async (origin, cwd) => {
    await expect(run(process.execPath, [script, origin], { cwd })).rejects.toThrow("asset differs from local production build: salary-sample.js");
  });
});
