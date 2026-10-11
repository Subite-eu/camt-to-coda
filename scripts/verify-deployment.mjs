import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const origins = process.argv.slice(2);
if (!origins.length) throw new Error('Usage: node scripts/verify-deployment.mjs https://your-deployment.example');
const files = readdirSync('dist-web/assets').filter(file => /\.(js|css)$/.test(file));
const localHtml = readFileSync('dist-web/index.html', 'utf8');
const entryFiles = files.filter(file => localHtml.includes(`/assets/${file}`));
if (!files.some(file => file.endsWith('.js')) || !files.some(file => file.endsWith('.css')))
  throw new Error('Run npm run build:web before verifying a deployment.');

for (const value of origins) {
  const origin = new URL(value).origin;
  const response = await fetch(origin, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${origin}: HTTP ${response.status}`);
  const html = await response.text();
  // Entry assets must be referenced by live HTML. Workers and lazy originals
  // are referenced by JavaScript instead; verify their bytes below as well.
  for (const file of entryFiles) {
    if (!html.includes(`/assets/${file}`))
      throw new Error(`${origin}: HTML does not reference current asset ${file}`);
  }
  const assets = [];
  for (const file of files) {
    const response = await fetch(`${origin}/assets/${file}`, { signal: AbortSignal.timeout(30_000) });
    const actual = Buffer.from(await response.arrayBuffer());
    if (!response.ok || !actual.equals(readFileSync(`dist-web/assets/${file}`)))
      throw new Error(`${origin}: asset differs from local production build: ${file}`);
    assets.push({ file, sha256: createHash('sha256').update(actual).digest('hex') });
  }
  console.log(JSON.stringify({ origin, assets }, null, 2));
}
