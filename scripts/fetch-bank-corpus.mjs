import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { gunzipSync } from 'node:zlib';

export const corpusDirectory = resolve(process.env.BANK_CORPUS_DIR ?? 'private-examples/bank-published');
const maximumOriginalBytes = 2_000_000;
const maximumDownloadBytes = 8_000_000;

function extractTarMember(download, member) {
  const archive = gunzipSync(download, { maxOutputLength: maximumDownloadBytes });
  const text = (header, start, size) => header.subarray(start, start + size).toString('utf8').split('\0')[0];
  for (let offset = 0; offset + 512 <= archive.length;) {
    const header = archive.subarray(offset, offset + 512);
    const name = text(header, 0, 100);
    if (!name) break;
    const prefix = text(header, 345, 155);
    const rawSize = text(header, 124, 12).trim();
    if (!/^[0-7]+$/.test(rawSize)) throw new Error('Invalid TAR member size');
    const size = parseInt(rawSize, 8);
    const start = offset + 512;
    if (start + size > archive.length) throw new Error('Truncated TAR member');
    if ((prefix ? `${prefix}/${name}` : name) === member && [0, 48].includes(header[156])) {
      if (size > maximumOriginalBytes) throw new Error('TAR member exceeds maximum size');
      return archive.subarray(start, start + size);
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error('Pinned regular TAR member is missing');
}

export function verifyBytes(bytes, sha256, size) {
  if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== sha256) {
    throw new Error('Publisher source integrity mismatch; review the source and provenance before changing any pin.');
  }
}

export async function fetchSource(source, directory, request = fetch) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id)) throw new Error('Unsafe source identifier');
  if (source.format !== undefined && !['camt', 'CAMT', 'CAMT052', 'CAMT053', 'CODA'].includes(source.format)) throw new Error('Unsupported source format');
  if (source.inlineRange) {
    if (source.zipMember || source.tarMember || source.payloadRange) throw new Error('Ambiguous inline publisher source');
    const { offset, length } = source.inlineRange;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || length !== source.sourceBytes || offset + length > source.downloadBytes) throw new Error('Invalid inline XML range');
  }
  if (source.zipMember && source.tarMember) throw new Error('Ambiguous source archive member');
  if (new URL(source.url).protocol !== 'https:') throw new Error('Bank sources require HTTPS');
  const path = resolve(directory, source.id + (source.format === 'CODA' ? '.cod' : '.xml'));
  let cached;
  try { cached = await readFile(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (cached) {
    verifyBytes(cached, source.sourceSha256, source.sourceBytes);
    return 'cached';
  }
  const options = {
    redirect: 'manual', signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (camt2coda compatibility tests)' },
  };
  let url = source.url;
  let response;
  for (let redirects = 0; ; redirects++) {
    response = await request(url, options);
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location || redirects >= 3) throw new Error('Unreviewed or excessive publisher redirect');
    const target = new URL(location, url);
    if (target.protocol !== 'https:' || target.username || target.password || !source.allowedRedirectOrigins?.includes(target.origin)) throw new Error('Unreviewed publisher redirect');
    url = target.href;
  }
  if (!response.ok) throw new Error(`Bank download failed: HTTP ${response.status}`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Bank download returned an empty body');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > Math.min(maximumDownloadBytes, source.downloadBytes)) throw new Error('Bank download exceeds maximum size');
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const download = Buffer.concat(chunks);
  verifyBytes(download, source.downloadSha256, source.downloadBytes);
  // Verify the archive before decompression. Never extract arbitrary archive
  // paths to disk or normalise the publisher's source text/line endings.
  let original = source.zipMember
    ? unzipSync(download, { filter: file => file.name === source.zipMember && file.originalSize <= maximumOriginalBytes })[source.zipMember]
    : source.tarMember ? extractTarMember(download, source.tarMember) : download;
  if (!original) throw new Error('Pinned bank ZIP member is missing or exceeds maximum size');
  if (source.inlineRange) {
    const { offset, length } = source.inlineRange;
    original = download.subarray(offset, offset + length);
  }
  if (source.payloadRange) {
    // Some banks attach XML inside an OLE package in an XLSX ZIP. A reviewed
    // contiguous range is sufficient: pin the container/member/payload, rather
    // than interpreting or rewriting its XML. Changed layouts fail closed.
    if (!source.zipMember || !source.zipMemberSha256 || !source.zipMemberBytes) throw new Error('Embedded payload requires a pinned ZIP member');
    verifyBytes(original, source.zipMemberSha256, source.zipMemberBytes);
    const { offset, length } = source.payloadRange;
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || length > maximumOriginalBytes || offset + length > original.length) throw new Error('Invalid embedded payload range');
    original = original.subarray(offset, offset + length);
  }
  if (original.length > maximumOriginalBytes) throw new Error('Original publisher source exceeds maximum size');
  verifyBytes(original, source.sourceSha256, source.sourceBytes);
  await mkdir(directory, { recursive: true });
  await writeFile(path, original, { flag: 'wx' });
  return 'downloaded';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../examples/bank-published/manifest.json', import.meta.url), 'utf8'));
  for (const source of manifest.cases) {
    try { console.log(`${source.id}: ${await fetchSource(source, corpusDirectory)}`); }
    catch (error) { throw new Error(`${source.id}: ${error.message}`, { cause: error }); }
  }
  console.log(`${manifest.cases.length} verified bank-published originals; ${manifest.codaStatus.completeBankPublishedOriginals} complete bank-published CODA originals.`);
}
