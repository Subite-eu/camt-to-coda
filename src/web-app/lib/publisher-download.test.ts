import { createHash, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync, zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extractExampleOriginal, fetchExampleOriginal, type PublisherSource } from "./publisher-download";

const bytes = (text: string) => new TextEncoder().encode(text);
const original = bytes("<?xml version=\"1.0\"?>\r\n<bank/>\r\n");
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
function source(download: Uint8Array = original, overrides: Partial<PublisherSource> = {}): PublisherSource {
  return {
    url: "https://publisher.example/original.xml",
    downloadSha256: hash(download), downloadBytes: download.length,
    sourceSha256: hash(original), sourceBytes: original.length,
    ...overrides,
  };
}
function requestFor(download: Uint8Array, url = "https://publisher.example/original.xml", status = 200): typeof fetch {
  return async () => {
    const response = new Response(new Uint8Array(download), { status });
    Object.defineProperty(response, "url", { value: url });
    return response;
  };
}
function tar(member: string, payload: Uint8Array, type = "0"): Uint8Array {
  const archive = new Uint8Array(512 + Math.ceil(payload.length / 512) * 512 + 1024);
  archive.set(bytes(member), 0);
  archive.set(bytes(payload.length.toString(8).padStart(11, "0") + "\0"), 124);
  archive[156] = type.charCodeAt(0);
  archive.set(payload, 512);
  return gzipSync(archive);
}

beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("fetchExampleOriginal", () => {
  it("extracts unchanged inline XML bytes from a pinned Markdown container", async () => {
    const prefix = bytes("# Bank example\n```xml\n");
    const markdown = new Uint8Array([...prefix, ...original, ...bytes("```\nOther documentation\n")]);
    const pins = source(markdown, { inlineRange: { offset: prefix.length, length: original.length } } as Partial<PublisherSource>);
    expect([...await fetchExampleOriginal(pins, undefined, requestFor(markdown))]).toEqual([...original]);
    expect([...await extractExampleOriginal(pins, markdown)]).toEqual([...original]);
    await expect(extractExampleOriginal(pins, bytes("changed locally saved page"))).rejects.toThrow(/integrity/i);
    const tampered = markdown.slice();
    tampered[0] ^= 1;
    await expect(extractExampleOriginal(pins, tampered)).rejects.toThrow(/integrity/i);
    for (const inlineRange of [{ offset: -1, length: original.length }, { offset: 0.5, length: original.length }, { offset: markdown.length, length: original.length }, { offset: prefix.length, length: original.length - 1 }]) {
      await expect(fetchExampleOriginal({ ...pins, inlineRange } as PublisherSource, undefined, requestFor(markdown))).rejects.toThrow(/range/i);
    }
    await expect(fetchExampleOriginal({ ...pins, zipMember: "example.xml" }, undefined, requestFor(markdown))).rejects.toThrow(/ambiguous/i);
  });
  it("returns byte-identical verified direct publisher XML including its original line endings", async () => {
    const result = await fetchExampleOriginal(source(), undefined, requestFor(original));
    expect([...result]).toEqual([...original]);
    expect(result.buffer).toBeInstanceOf(ArrayBuffer);
  });

  it("extracts only the exact ZIP member without inflating unrelated large members", async () => {
    const archive = zipSync({ "examples/original.xml": original, "original.xml": bytes("wrong"), "large": new Uint8Array(2_000_001) });
    expect([...await fetchExampleOriginal(source(archive, { zipMember: "examples/original.xml" }), undefined, requestFor(archive))]).toEqual([...original]);
  });

  it("extracts the reviewed byte range after verifying its complete ZIP member", async () => {
    const member = new Uint8Array([...bytes("OLE-prefix"), ...original, ...bytes("tail")]);
    const archive = zipSync({ "xl/embeddings/oleObject1.bin": member });
    const pins = source(archive, { zipMember: "xl/embeddings/oleObject1.bin", zipMemberSha256: hash(member), zipMemberBytes: member.length, payloadRange: { offset: 10, length: original.length } });
    expect([...await fetchExampleOriginal(pins, undefined, requestFor(archive))]).toEqual([...original]);
  });

  it("extracts the exact regular member from the checked-in gzip TAR fixture", async () => {
    const archive = new Uint8Array(readFileSync("test/fixtures/publisher-archive.tar.gz"));
    const payload = bytes("<original>unchanged\r\n</original>");
    const pins = source(archive, { tarMember: "package/original.txt", sourceSha256: hash(payload), sourceBytes: payload.length });
    expect([...await fetchExampleOriginal(pins, undefined, requestFor(archive))]).toEqual([...payload]);
  });

  it.each(["downloadSha256", "sourceSha256"] as const)("rejects a changed %s pin", async key => {
    await expect(fetchExampleOriginal(source(original, { [key]: "0".repeat(64) }), undefined, requestFor(original))).rejects.toThrow(/integrity/i);
  });

  it("rejects truncated downloads even when the downloaded bytes have a matching hash", async () => {
    await expect(fetchExampleOriginal(source(original, { downloadBytes: original.length + 1 }), undefined, requestFor(original))).rejects.toThrow(/integrity/i);
  });

  it("verifies archive integrity before attempting decompression", async () => {
    const archive = bytes("not a ZIP");
    await expect(fetchExampleOriginal(source(archive, { zipMember: "a", downloadSha256: "0".repeat(64) }), undefined, requestFor(archive))).rejects.toThrow(/integrity/i);
  });

  it("rejects a missing exact ZIP member", async () => {
    const archive = zipSync({ "other.xml": original });
    await expect(fetchExampleOriginal(source(archive, { zipMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/member.*missing/i);
  });

  it("rejects a ZIP member exceeding the original size cap", async () => {
    const archive = zipSync({ "original.xml": new Uint8Array(2_000_001) });
    await expect(fetchExampleOriginal(source(archive, { zipMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/size/i);
  });

  it("bounds actual ZIP expansion even when its member size header understates the output", async () => {
    const archive = zipSync({ "original.xml": new Uint8Array(2_000_001) });
    new DataView(archive.buffer).setUint32(22, 1, true);
    await expect(fetchExampleOriginal(source(archive, { zipMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/size/i);
  });

  it("rejects direct originals exceeding 2 MB after verifying the complete download", async () => {
    const download = new Uint8Array(2_000_001);
    await expect(fetchExampleOriginal(source(download), undefined, requestFor(download))).rejects.toThrow(/size/i);
  });

  it("rejects changed complete member pins before extracting an embedded range", async () => {
    const archive = zipSync({ "original.xml": original });
    const pins = source(archive, { zipMember: "original.xml", zipMemberSha256: "0".repeat(64), zipMemberBytes: original.length, payloadRange: { offset: 0, length: original.length } });
    await expect(fetchExampleOriginal(pins, undefined, requestFor(archive))).rejects.toThrow(/integrity/i);
  });

  it.each([{ offset: -1, length: 1 }, { offset: 0.5, length: 1 }, { offset: 0, length: 0 }, { offset: 1, length: original.length }, { offset: 0, length: 2_000_001 }])("rejects invalid embedded range %j", async payloadRange => {
    const archive = zipSync({ "original.xml": original });
    const pins = source(archive, { zipMember: "original.xml", zipMemberSha256: hash(original), zipMemberBytes: original.length, payloadRange });
    await expect(fetchExampleOriginal(pins, undefined, requestFor(archive))).rejects.toThrow(/range/i);
  });

  it("rejects embedded payloads without complete ZIP member pins", async () => {
    await expect(fetchExampleOriginal(source(original, { payloadRange: { offset: 0, length: 1 } }), undefined, requestFor(original))).rejects.toThrow(/pinned ZIP/i);
  });

  it("rejects symlinks in place of the pinned regular TAR member", async () => {
    const archive = tar("original.xml", original, "2");
    await expect(fetchExampleOriginal(source(archive, { tarMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/regular TAR member.*missing/i);
  });

  it("rejects a regular TAR member exceeding the original size cap", async () => {
    const archive = tar("original.xml", new Uint8Array(2_000_001));
    await expect(fetchExampleOriginal(source(archive, { tarMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/size/i);
  });

  it.each(["not-octal", "00000002000"])("rejects an invalid or truncated TAR member size %s", async rawSize => {
    const header = new Uint8Array(512);
    header.set(bytes("original.xml"));
    header.set(bytes(rawSize), 124);
    header[156] = 48;
    const archive = gzipSync(header);
    await expect(fetchExampleOriginal(source(archive, { tarMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/TAR member/);
  });

  it("stops gzip TAR expansion at the archive size cap", async () => {
    const archive = tar("large", new Uint8Array(8_000_001));
    await expect(fetchExampleOriginal(source(archive, { tarMember: "original.xml" }), undefined, requestFor(archive))).rejects.toThrow(/size/i);
  });

  it("allows same-origin redirects and explicitly reviewed HTTPS redirect origins", async () => {
    expect([...await fetchExampleOriginal(source(), undefined, requestFor(original, "https://publisher.example/new.xml"))]).toEqual([...original]);
    expect([...await fetchExampleOriginal(source(original, { allowedRedirectOrigins: ["https://cdn.example"] }), undefined, requestFor(original, "https://cdn.example/new.xml"))]).toEqual([...original]);
  });

  it.each(["https://unreviewed.example/original.xml", "http://publisher.example/original.xml", "https://user:secret@publisher.example/original.xml"])("rejects an unreviewed final URL %s", async url => {
    await expect(fetchExampleOriginal(source(), undefined, requestFor(original, url))).rejects.toThrow(/redirect/i);
  });

  it("rejects insecure publisher URLs before fetching", async () => {
    await expect(fetchExampleOriginal(source(original, { url: "http://publisher.example/a" }), undefined, requestFor(original))).rejects.toThrow(/HTTPS/i);
  });

  it("rejects downloads exceeding the pinned size and cancels the response stream", async () => {
    let cancelled = false;
    const request: typeof fetch = async () => {
      const response = new Response(new ReadableStream({ start(controller) { controller.enqueue(original); }, cancel() { cancelled = true; } }));
      Object.defineProperty(response, "url", { value: source().url });
      return response;
    };
    await expect(fetchExampleOriginal(source(original, { downloadBytes: 1 }), undefined, request)).rejects.toThrow(/size/i);
    expect(cancelled).toBe(true);
  });

  it("rejects pins above the 8 MB download cap", async () => {
    await expect(fetchExampleOriginal(source(original, { downloadBytes: 8_000_001 }), undefined, requestFor(original))).rejects.toThrow(/size/i);
  });

  it("propagates network failures and rejects unsuccessful HTTP responses", async () => {
    await expect(fetchExampleOriginal(source(), undefined, async () => { throw new TypeError("CORS blocked"); })).rejects.toThrow("CORS blocked");
    await expect(fetchExampleOriginal(source(), undefined, requestFor(original, source().url, 403))).rejects.toThrow(/403/);
  });

  it("rejects an empty response body", async () => {
    const request: typeof fetch = async () => {
      const response = new Response(null);
      Object.defineProperty(response, "url", { value: source().url });
      return response;
    };
    await expect(fetchExampleOriginal(source(), undefined, request)).rejects.toThrow(/empty body/i);
  });

  it("rejects an ambiguous archive selection", async () => {
    await expect(fetchExampleOriginal(source(original, { zipMember: "a", tarMember: "b" }), undefined, requestFor(original))).rejects.toThrow(/ambiguous/i);
  });

  it("cancels a failing response stream without masking the network read error", async () => {
    const request: typeof fetch = async () => {
      const response = new Response(new ReadableStream({ start(controller) { controller.error(new Error("Network stream interrupted")); } }));
      Object.defineProperty(response, "url", { value: source().url });
      return response;
    };
    await expect(fetchExampleOriginal(source(), undefined, request)).rejects.toThrow("Network stream interrupted");
  });

  it("does not fetch when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let requested = false;
    await expect(fetchExampleOriginal(source(), controller.signal, async () => { requested = true; return new Response(original); })).rejects.toMatchObject({ name: "AbortError" });
    expect(requested).toBe(false);
  });

  it("cancels a stalled body read when the caller aborts", async () => {
    const controller = new AbortController();
    let cancelled = false;
    const request: typeof fetch = async () => {
      const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
      Object.defineProperty(response, "url", { value: source().url });
      return response;
    };
    const pending = fetchExampleOriginal(source(), controller.signal, request);
    const rejection = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await new Promise(resolve => setTimeout(resolve, 0));
    controller.abort();
    await rejection;
    expect(cancelled).toBe(true);
  });

  it("times out a stalled download after 30 seconds and cancels its body", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const request: typeof fetch = async () => {
      const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
      Object.defineProperty(response, "url", { value: source().url });
      return response;
    };
    const pending = fetchExampleOriginal(source(), undefined, request);
    const rejection = expect(pending).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(30_000);
    await rejection;
    expect(cancelled).toBe(true);
  });
});
