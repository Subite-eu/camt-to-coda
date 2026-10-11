import { Gunzip, Unzip, UnzipInflate } from "fflate";

export type PublisherSource = {
  url: string;
  downloadSha256: string;
  downloadBytes: number;
  sourceSha256: string;
  sourceBytes: number;
  zipMember?: string | null;
  tarMember?: string | null;
  zipMemberSha256?: string;
  zipMemberBytes?: number;
  payloadRange?: { offset: number; length: number };
  allowedRedirectOrigins?: string[];
};

const maximumDownloadBytes = 8_000_000;
const maximumOriginalBytes = 2_000_000;

function concatenate(chunks: Uint8Array[], size: number): Uint8Array<ArrayBuffer> {
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}

async function verifyBytes(value: Uint8Array<ArrayBuffer>, sha256: string, size: number): Promise<void> {
  if (value.length !== size) throw new Error("Publisher source integrity mismatch");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", value));
  if (Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("") !== sha256) {
    throw new Error("Publisher source integrity mismatch");
  }
}

function extractZipMember(download: Uint8Array, member: string, signal: AbortSignal): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  let found = false;
  let complete = false;
  const archive = new Unzip(file => {
    if (file.name !== member) return;
    if (found) throw new Error("Duplicate pinned ZIP member");
    found = true;
    if (file.originalSize !== undefined && file.originalSize > maximumOriginalBytes) {
      throw new Error("Pinned ZIP member exceeds maximum size");
    }
    file.ondata = (error, chunk, final) => {
      if (error) throw error;
      size += chunk.length;
      if (size > maximumOriginalBytes) throw new Error("Pinned ZIP member exceeds maximum size");
      chunks.push(chunk);
      complete = final;
    };
    file.start();
  });
  archive.register(UnzipInflate);
  // Small compressed chunks bound transient inflate buffers even if the ZIP
  // metadata lies about the expanded size. Unrelated members are never started.
  for (let offset = 0; offset < download.length; offset += 512) {
    signal.throwIfAborted();
    archive.push(download.subarray(offset, offset + 512), offset + 512 >= download.length);
  }
  if (!found || !complete) throw new Error("Pinned ZIP member is missing or incomplete");
  return concatenate(chunks, size);
}

function extractTarMember(download: Uint8Array, member: string, signal: AbortSignal): Uint8Array<ArrayBuffer> {
  const chunks: Uint8Array[] = [];
  let size = 0;
  const gzip = new Gunzip(chunk => {
    size += chunk.length;
    if (size > maximumDownloadBytes) throw new Error("Expanded TAR archive exceeds maximum size");
    chunks.push(chunk);
  });
  for (let offset = 0; offset < download.length; offset += 512) {
    signal.throwIfAborted();
    gzip.push(download.subarray(offset, offset + 512), offset + 512 >= download.length);
  }
  const archive = concatenate(chunks, size);
  const text = (header: Uint8Array, start: number, length: number) => new TextDecoder().decode(header.subarray(start, start + length)).split("\0")[0];
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    const name = text(header, 0, 100);
    if (!name) break;
    const prefix = text(header, 345, 155);
    const rawSize = text(header, 124, 12).trim();
    if (!/^[0-7]+$/.test(rawSize)) throw new Error("Invalid TAR member size");
    const memberSize = parseInt(rawSize, 8);
    const start = offset + 512;
    if (start + memberSize > archive.length) throw new Error("Truncated TAR member");
    if ((prefix ? `${prefix}/${name}` : name) === member && [0, 48].includes(header[156])) {
      if (memberSize > maximumOriginalBytes) throw new Error("TAR member exceeds maximum size");
      return archive.slice(start, start + memberSize);
    }
    offset = start + Math.ceil(memberSize / 512) * 512;
  }
  throw new Error("Pinned regular TAR member is missing");
}

/** Fetch directly from the publisher only when explicitly requested by the UI.
 * CORS failures propagate so the caller can offer the publisher's original link.
 */
export async function fetchExampleOriginal(
  source: PublisherSource,
  signal?: AbortSignal,
  request: typeof fetch = fetch,
): Promise<Uint8Array<ArrayBuffer>> {
  signal?.throwIfAborted();
  const publisher = new URL(source.url);
  if (publisher.protocol !== "https:" || publisher.username || publisher.password) throw new Error("Publisher sources require HTTPS without credentials");
  if (source.zipMember && source.tarMember) throw new Error("Ambiguous publisher archive member");
  if (!Number.isSafeInteger(source.downloadBytes) || source.downloadBytes <= 0 || source.downloadBytes > maximumDownloadBytes
    || !Number.isSafeInteger(source.sourceBytes) || source.sourceBytes <= 0 || source.sourceBytes > maximumOriginalBytes) {
    throw new Error("Publisher source exceeds maximum size or has an invalid size pin");
  }
  if (source.payloadRange && (!source.zipMember || !source.zipMemberSha256 || !source.zipMemberBytes)) {
    throw new Error("Embedded payload requires a pinned ZIP member");
  }
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", forwardAbort, { once: true });
  const timeout = setTimeout(() => controller.abort(new DOMException("Publisher download timed out", "TimeoutError")), 30_000);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let response: Response | undefined;
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const onAbort = () => {
    rejectAbort(controller.signal.reason);
    void reader?.cancel(controller.signal.reason).catch(() => {});
  };
  controller.signal.addEventListener("abort", onAbort, { once: true });
  // All awaited work races this promise, including hashing after the body ends.
  // Keep a rejection handler while synchronous extraction is running as well.
  void aborted.catch(() => {});
  try {
    response = await Promise.race([
      request(source.url, { redirect: "follow", credentials: "omit", signal: controller.signal }).then(result => {
        if (controller.signal.aborted) {
          void result.body?.cancel().catch(() => {});
          controller.signal.throwIfAborted();
        }
        return result;
      }),
      aborted,
    ]);
    const finalUrl = new URL(response.url);
    if (finalUrl.protocol !== "https:" || finalUrl.username || finalUrl.password
      || (finalUrl.origin !== publisher.origin && !source.allowedRedirectOrigins?.includes(finalUrl.origin))) {
      throw new Error("Unreviewed publisher redirect");
    }
    if (!response.ok) throw new Error(`Publisher download failed: HTTP ${response.status}`);
    reader = response.body?.getReader();
    if (!reader) throw new Error("Publisher download returned an empty body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await Promise.race([reader.read(), aborted]);
      controller.signal.throwIfAborted();
      if (done) break;
      size += value.length;
      if (size > source.downloadBytes) throw new Error("Publisher download exceeds maximum size");
      chunks.push(value);
    }
    const download = concatenate(chunks, size);
    // Verify the container before touching any archive data or payload range.
    await Promise.race([verifyBytes(download, source.downloadSha256, source.downloadBytes), aborted]);
    let original = source.zipMember ? extractZipMember(download, source.zipMember, controller.signal)
      : source.tarMember ? extractTarMember(download, source.tarMember, controller.signal) : download;
    if (source.payloadRange) {
      await Promise.race([verifyBytes(original, source.zipMemberSha256!, source.zipMemberBytes!), aborted]);
      const { offset, length } = source.payloadRange;
      if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0
        || length > maximumOriginalBytes || offset + length > original.length) throw new Error("Invalid embedded payload range");
      original = original.slice(offset, offset + length);
    }
    if (original.length > maximumOriginalBytes) throw new Error("Original publisher source exceeds maximum size");
    await Promise.race([verifyBytes(original, source.sourceSha256, source.sourceBytes), aborted]);
    controller.signal.throwIfAborted();
    return original;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", forwardAbort);
    controller.signal.removeEventListener("abort", onAbort);
    if (reader) {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    } else {
      await response?.body?.cancel().catch(() => {});
    }
  }
}
