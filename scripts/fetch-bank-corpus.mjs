import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

export const corpusDirectory = resolve(process.env.BANK_CORPUS_DIR ?? 'private-examples/bank-published');
const maximumOriginalBytes = 2_000_000;
const maximumDownloadBytes = 8_000_000;

export function verifyBytes(bytes, sha256, size) {
  if (bytes.length !== size || createHash('sha256').update(bytes).digest('hex') !== sha256) {
    throw new Error('Publisher source integrity mismatch; review the source and provenance before changing any pin.');
  }
}

export async function fetchSource(source, directory, request = fetch) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.id)) throw new Error('Unsafe source identifier');
  if (new URL(source.url).protocol !== 'https:') throw new Error('Bank sources require HTTPS');
  const path = resolve(directory, source.id + '.xml');
  let cached;
  try { cached = await readFile(path); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (cached) {
    verifyBytes(cached, source.sourceSha256, source.sourceBytes);
    return 'cached';
  }
  const response = await request(source.url, {
    redirect: 'error', signal: AbortSignal.timeout(30_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (camt2coda compatibility tests)' },
  });
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
  const original = source.zipMember
    ? unzipSync(download, { filter: file => file.name === source.zipMember && file.originalSize <= maximumOriginalBytes })[source.zipMember]
    : download;
  if (!original) throw new Error('Pinned bank ZIP member is missing or exceeds maximum size');
  if (original.length > maximumOriginalBytes) throw new Error('Original bank XML exceeds maximum size');
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
