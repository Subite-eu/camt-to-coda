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
  it("extracts an unchanged embedded payload only from a verified member and bounded range", async () => {
    const zipMember = "xl/embeddings/oleObject1.bin";
    const prefix = strToU8("OLE package header");
    const member = new Uint8Array([...prefix, ...bytes, ...strToU8("trailer")]);
    const archive = zipSync({ [zipMember]: member });
    const source = { ...fixture, zipMember, downloadSha256: hash(archive), downloadBytes: archive.length,
      zipMemberSha256: hash(member), zipMemberBytes: member.length, payloadRange: { offset: prefix.length, length: bytes.length } };
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await fetchSource(source, dir, async () => new Response(archive));
      expect(new Uint8Array(await readFile(join(dir, fixture.id + ".xml")))).toEqual(bytes);
      await rm(join(dir, fixture.id + ".xml"));
      await expect(fetchSource({ ...source, zipMemberSha256: "0".repeat(64) }, dir, async () => new Response(archive))).rejects.toThrow(/integrity/);
      for (const offset of [-1, 0.5, member.length]) {
        await expect(fetchSource({ ...source, payloadRange: { offset, length: bytes.length } }, dir, async () => new Response(archive))).rejects.toThrow(/range/);
      }
      await expect(fetchSource({ ...source, zipMember: undefined }, dir, async () => new Response(archive))).rejects.toThrow(/member/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("stores pinned CODA originals under a fixed CODA extension without rewriting bytes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    const source = { ...fixture, format: "CODA" };
    try {
      await fetchSource(source, dir, async () => new Response(bytes));
      expect(new Uint8Array(await readFile(join(dir, fixture.id + ".cod")))).toEqual(bytes);
      expect(await fetchSource(source, dir, async () => { throw new Error("Unexpected network"); })).toBe("cached");
      await expect(fetchSource({ ...source, format: "../escape" }, dir)).rejects.toThrow(/format/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("extracts only the pinned regular TAR member from a verified gzip archive", async () => {
    // Independently authored with Python's USTAR writer, not the extractor.
    const archive = await readFile("test/fixtures/publisher-archive.tar.gz");
    const source = { ...fixture, tarMember: "package/original.txt", downloadSha256: hash(archive), downloadBytes: archive.length };
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await fetchSource(source, dir, async () => new Response(archive));
      expect(new Uint8Array(await readFile(join(dir, fixture.id + ".xml")))).toEqual(bytes);
      await rm(join(dir, fixture.id + ".xml"));
      await expect(fetchSource({ ...source, tarMember: "missing" }, dir, async () => new Response(archive))).rejects.toThrow(/TAR member/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it("follows only explicitly reviewed HTTPS redirect origins with a bounded chain", async () => {
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    const source = { ...fixture, allowedRedirectOrigins: ["https://cdn.bank.example"] };
    const redirect = (url: string) => new Response(null, { status: 302, headers: { Location: url } });
    try {
      const seen: string[] = [];
      await fetchSource(source, dir, async (url: string, options: RequestInit) => {
        seen.push(url);
        expect(options.redirect).toBe("manual");
        return seen.length === 1 ? redirect("https://cdn.bank.example/file?token=temporary") : new Response(bytes);
      });
      expect(seen).toHaveLength(2);
      await rm(join(dir, source.id + ".xml"));
      for (const target of ["http://cdn.bank.example/file", "https://unreviewed.example/file", "https://user:secret@cdn.bank.example/file"]) {
        await expect(fetchSource(source, dir, async () => redirect(target))).rejects.toThrow(/redirect/i);
      }
      await expect(fetchSource(fixture, dir, async () => redirect("https://cdn.bank.example/file"))).rejects.toThrow(/redirect/i);
      await expect(fetchSource(source, dir, async () => redirect("https://cdn.bank.example/loop"))).rejects.toThrow(/redirect/i);
      await expect(fetchSource(source, dir, async (url: string) => url === source.url ? redirect("https://cdn.bank.example/file") : new Response(strToU8("altered")))).rejects.toThrow(/integrity/);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it.each(["camt", "CAMT", "CAMT052", "CAMT053"])("retains existing %s manifest format compatibility", async format => {
    const dir = await mkdtemp(join(tmpdir(), "bank-corpus-test-"));
    try {
      await expect(fetchSource({ ...fixture, format }, dir, async () => new Response(bytes))).resolves.toBe("downloaded");
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
