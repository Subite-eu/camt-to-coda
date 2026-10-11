import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchSource } from './fetch-bank-corpus.mjs';

export const corpusDirectory = resolve(process.env.CODA_CORPUS_DIR ?? 'private-examples/coda-published');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(await readFile(new URL('../examples/coda-published/manifest.json', import.meta.url), 'utf8'));
  for (const source of manifest.cases) {
    try { console.log(`${source.id}: ${await fetchSource(source, corpusDirectory)}`); }
    catch (error) { throw new Error(`${source.id}: ${error.message}`, { cause: error }); }
  }
  console.log(`${manifest.cases.length} verified third-party CODA originals; ${manifest.bankPublishedCompleteOriginals} complete bank-published CODA originals.`);
}
