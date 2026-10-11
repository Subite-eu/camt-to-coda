import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchSource } from './fetch-bank-corpus.mjs';

const inventory = JSON.parse(await readFile(new URL('../examples/bank-catalog/source-inventory.json', import.meta.url), 'utf8'));
const directory = resolve(process.env.BANK_CATALOG_DIR ?? 'private-examples/bank-catalog');
// A publisher ZIP may contain many pinned members. Download it once per run;
// fetchSource still verifies its hash and each original member independently.
const responses = new Map();
async function request(url, options) {
  if (!responses.has(url)) {
    const response = await fetch(url, options);
    // A cloned redirect body's cancellation waits for both tee branches.
    // Return redirects directly and request fresh signed CDN URLs per source.
    if ([301, 302, 303, 307, 308].includes(response.status)) return response;
    responses.set(url, response);
  }
  return responses.get(url).clone();
}
for (const source of inventory.cases.filter(s => s.storage === 'external-only')) {
  try { console.log(`${source.id}: ${await fetchSource(source, directory, request)}`); }
  catch (error) { throw new Error(`${source.id}: ${error.message}`, { cause: error }); }
}
console.log(`${inventory.cases.length} original XML sources inventoried; ${inventory.cases.filter(s => s.repositoryPath).length} unchanged originals are committed with Bundesbank attribution.`);
