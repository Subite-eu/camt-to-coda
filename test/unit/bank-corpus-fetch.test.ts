import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync, strToU8 } from "fflate";
// @ts-expect-error Standalone tooling is JavaScript, outside the shipped TS API.
import { fetchSource, verifyBytes } from "../../scripts/fetch-bank-corpus.mjs";

const bytes = strToU8("<original>unchanged\r\n</original>");
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
const fixture = { id: "test-source", url: "https://bank.example/source.xml", sourceSha256: hash(bytes), sourceBytes: bytes.length, downloadSha256: hash(bytes), downloadBytes: bytes.length };

describe("bank original acquisition fails closed", () => {
  it("rejects altered or truncated publisher bytes", () => {
    expect(() => verifyBytes(strToU8("changed"), fixture.sourceSha256, fixture.sourceBytes)).toThrow(/integrity/);
  });
  it("reuses only a verified cache and never silently refreshes altered bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await writeFile(join(dir, fixture.id + ".xml"), bytes);
      expect(await fetchSource(fixture, dir, async () => { throw new Error("Unexpected network"); })).toBe("cached");
      await writeFile(join(dir, fixture.id + ".xml"), "changed");
      await expect(fetchSource(fixture, dir, async () => { throw new Error("Unexpected network"); })).rejects.toThrow(/integrity/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("preserves exact source bytes, including line endings, when downloading", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      expect(await fetchSource(fixture, dir, async () => new Response(bytes))).toBe("downloaded");
      expect(new Uint8Array(await readFile(join(dir, fixture.id + ".xml")))).toEqual(bytes);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("pins both archive bytes and the exact original ZIP member", async () => {
    const zipMember = "Original bank sample.txt";
    const archive = zipSync({ [zipMember]: bytes, "unrelated.xml": strToU8("wrong") });
    const zipped = { ...fixture, zipMember, downloadSha256: hash(archive), downloadBytes: archive.length };
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await fetchSource(zipped, dir, async () => new Response(archive));
      expect(new Uint8Array(await readFile(join(dir, fixture.id + ".xml")))).toEqual(bytes);
      await rm(join(dir, fixture.id + ".xml"));
      await expect(fetchSource({ ...zipped, zipMember: "missing.xml" }, dir, async () => new Response(archive))).rejects.toThrow(/member/);
      await expect(fetchSource({ ...zipped, sourceSha256: "0".repeat(64) }, dir, async () => new Response(archive))).rejects.toThrow(/integrity/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("accepts a reviewed multi-megabyte archive while extracting only the pinned small original", async () => {
    const zipMember = "original.xml";
    const archive = zipSync({ [zipMember]: bytes, "documentation.bin": new Uint8Array(3_000_000) }, { level: 0 });
    const source = { ...fixture, zipMember, downloadSha256: hash(archive), downloadBytes: archive.length };
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await fetchSource(source, dir, async () => new Response(archive));
      expect(new Uint8Array(await readFile(join(dir, fixture.id + ".xml")))).toEqual(bytes);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("rejects server errors, HTTP URLs, oversized responses and unsafe cache identifiers", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await expect(fetchSource(fixture, dir, async () => new Response("unavailable", { status: 503 }))).rejects.toThrow(/503/);
      await expect(fetchSource({ ...fixture, url: "http://bank.example/file" }, dir)).rejects.toThrow(/HTTPS/);
      await expect(fetchSource({ ...fixture, id: "../escape" }, dir)).rejects.toThrow(/identifier/);
      await expect(fetchSource(fixture, dir, async () => new Response(new Uint8Array(2_000_001)))).rejects.toThrow(/size/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});
