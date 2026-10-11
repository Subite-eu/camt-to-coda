import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import channelDefinitions from '../examples/bank-catalog/channel-definitions.json' with { type: 'json' };

const root = fileURLToPath(new URL('../', import.meta.url));
const base = 'examples/bank-catalog';
export function slug(value) { return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
export function validateCatalog(banks, references, inventory) {
  const kinds = new Set(['sample-file', 'inline-example', 'pdf-example', 'specification', 'portal', 'availability', 'standard', 'payment-guideline']);
  const access = new Set(['public-page', 'public-file', 'registration', 'linked-unverified', 'unavailable']);
  for (const entries of [banks, references]) {
    const ids = new Set();
    for (const e of entries) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(e.id) || ids.has(e.id)) throw new Error('Invalid or duplicate catalog identifier');
      ids.add(e.id);
      if (!(e.bank || e.authority) || !e.notes || !e.formats.length || !e.markets.length || !e.resources.length || !/^\d{4}-\d{2}-\d{2}$/.test(e.verifiedOn)) throw new Error(`Incomplete evidence: ${e.id}`);
      for (const m of e.markets) if (!m.country || !m.region) throw new Error(`Missing market: ${e.id}`);
      if (e.authority && (!e.reportingCoverage || !e.role)) throw new Error(`Missing authority scope: ${e.id}`);
      validateChannels(e);
      for (const r of e.resources) {
        const url = new URL(r.url);
        if (url.protocol !== 'https:' || url.username || url.password || !r.label || !kinds.has(r.kind) || !access.has(r.access)) throw new Error(`Invalid resource: ${e.id}`);
      }
    }
  }
  const bankIds = new Set(banks.map(b => b.id));
  const sourceIds = new Set();
  for (const s of inventory) {
    if (!bankIds.has(s.bankId) || sourceIds.has(s.id)) throw new Error(`Unlinked or duplicate original: ${s.id}`);
    sourceIds.add(s.id);
    if (![s.sourceSha256, s.downloadSha256].every(h => /^[a-f0-9]{64}$/.test(h)) || s.sourceBytes <= 0 || s.downloadBytes <= 0) throw new Error(`Unpinned source: ${s.id}`);
    if (s.payloadRange) {
      const { offset, length } = s.payloadRange;
      if (!s.zipMember || !/^[a-f0-9]{64}$/.test(s.zipMemberSha256 ?? '') || !Number.isSafeInteger(s.zipMemberBytes) || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || offset + length > s.zipMemberBytes || length !== s.sourceBytes) throw new Error(`Unpinned or invalid payload: ${s.id}`);
    }
    if (s.inlineRange) {
      const { offset, length } = s.inlineRange;
      if (s.zipMember || s.tarMember || s.payloadRange || !Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length <= 0 || offset + length > s.downloadBytes || length !== s.sourceBytes) throw new Error(`Invalid inline XML range: ${s.id}`);
    }
    for (const origin of s.allowedRedirectOrigins ?? []) {
      const url = new URL(origin);
      if (url.protocol !== 'https:' || url.origin !== origin) throw new Error(`Invalid redirect origin: ${s.id}`);
    }
  }
}
function validateChannels(entry) {
  if (entry.communicationChannels === undefined) return;
  if (!Array.isArray(entry.communicationChannels)) throw new Error(`Invalid channels: ${entry.id}`);
  const seen = new Set();
  for (const c of entry.communicationChannels) {
    const fail = () => { throw new Error(`Incomplete, unsupported or unscoped channel: ${entry.id}`); };
    if (!c || !Object.hasOwn(channelDefinitions.kinds, c.kind) || !Object.hasOwn(channelDefinitions.automation, c.automation)
      || !Object.hasOwn(channelDefinitions.availability, c.availability) || !Object.hasOwn(channelDefinitions.payload, c.payload)) fail();
    for (const value of [c.label, c.scope, c.setup]) if (typeof value !== 'string' || !value.trim()) fail();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(c.verifiedOn ?? '') || !Array.isArray(c.formats) || !c.formats.length || !c.formats.every(f => typeof f === 'string' && f.trim())) fail();
    if (!Array.isArray(c.markets) || !c.markets.length || !c.markets.every(m => entry.markets.some(p => p.region === m.region && p.country === m.country))) fail();
    if (!Array.isArray(c.sources) || !c.sources.length) fail();
    for (const source of c.sources) {
      let url;
      try { url = new URL(source.url); } catch { fail(); }
      if (url.protocol !== 'https:' || url.username || url.password || typeof source.label !== 'string' || !source.label.trim()) fail();
    }
    const key = JSON.stringify([c.kind, c.label, c.markets]);
    if (seen.has(key)) fail();
    seen.add(key);
  }
}
function channelSections(entry) {
  if (!entry.communicationChannels?.length) return [];
  const text = ['', '## Customer delivery and automation', ''];
  for (const c of entry.communicationChannels) text.push(`### ${c.label} — ${channelDefinitions.kinds[c.kind]}`, '',
    `**${channelDefinitions.automation[c.automation]} · ${channelDefinitions.availability[c.availability]} · ${channelDefinitions.payload[c.payload]}**`, '',
    `**Formats:** ${c.formats.join('; ')}. **Scope:** ${c.markets.map(m => `${m.region} / ${m.country}`).join('; ')}.`, '', c.scope, '', `**Setup / access:** ${c.setup}`, '',
    ...(c.timing ? [`**Schedule:** ${c.timing}`, ''] : []),
    ...c.sources.map(s => `- [${s.label}](${s.url})`), '', `Channel evidence checked ${c.verifiedOn}.`, '');
  return text;
}
function channelOverview(entries, verifiedOn) {
  const regions = [...new Set(entries.flatMap(e => e.markets.map(m => m.region)))].sort();
  const rows = entries.flatMap(e => (e.communicationChannels ?? []).map(c => ({ e, c })));
  const key = ({ e }) => `${e.authority ? 'reference' : 'bank'}:${e.id}`;
  const text = ['<!-- Generated by scripts/build-bank-catalog.mjs; edit the JSON evidence. -->', '', '# Reporting communication channels by region', '',
    `Evidence checked ${verifiedOn}. Optional customer delivery information is stored in each bank/reference record’s communicationChannels array.`, '',
    'Counts describe verified catalog coverage, not market share, entitlement or universal availability. A missing record means not established. Geography follows each channel’s documented scope. Other account-data APIs and operator/interbank infrastructure are distinguished from CAMT/CODA customer file reporting.', '',
    'Institutions are counted once per region. Automated file reporting includes documented file channels with automated or optional automation; it excludes JSON-only APIs, operator-only infrastructure, historical evidence and announcements. Multiple regions is unspecified global scope, not proof for each country.', '',
    'Open the [interactive channel overview](https://camt2coda.subite.io/#bank-catalog?section=channels) to filter by geography, transport, automation and delivered content.', '',
    '| Region | Institutions with evidence | Automated file reporting | Channels documented |', '| --- | ---: | ---: | --- |'];
  for (const region of regions) {
    const scoped = rows.filter(({ c }) => c.markets.some(m => m.region === region));
    const automated = scoped.filter(({ c }) => c.payload === 'reporting-files' && c.availability === 'documented' && ['automated', 'optional'].includes(c.automation));
    text.push(`| ${region} | ${new Set(scoped.map(key)).size} | ${new Set(automated.map(key)).size} | ${[...new Set(scoped.map(({ c }) => channelDefinitions.kinds[c.kind]))].sort().join('; ') || 'Not established'} |`);
  }
  for (const region of regions) {
    text.push('', `## ${region}`, '');
    for (const e of entries) {
      const channels = (e.communicationChannels ?? []).filter(c => c.markets.some(m => m.region === region));
      if (channels.length) text.push(`### ${e.bank ?? e.authority}`, ...channelSections({ communicationChannels: channels }).slice(3).map(line => line.startsWith('### ') ? '#'+line : line));
    }
    if (!rows.some(({ c }) => c.markets.some(m => m.region === region))) text.push('No channel evidence recorded yet.');
  }
  return text.join('\n').trimEnd()+'\n';
}
function resources(e) { return e.resources.map(r => `- [${r.label}](${r.url}) — ${r.kind}; ${r.access}`).join('\n'); }
export function renderCatalog(banks, references, inventory, verifiedOn) {
  validateCatalog(banks, references, inventory);
  const statusCount = status => inventory.filter(s => s.xsdStatus === status).length;
  const committedCount = inventory.filter(s => s.repositoryPath).length;
  const externalCount = inventory.length - committedCount;
  const files = new Map();
  const groups = new Map();
  for (const e of [...banks, ...references]) for (const m of e.markets) {
    const key = `${m.region}/${m.country}`;
    if (!groups.has(key)) groups.set(key, { ...m, banks: [], references: [] });
    groups.get(key)[e.authority ? 'references' : 'banks'].push(e);
  }
  const header = `<!-- Generated by scripts/build-bank-catalog.mjs; edit the JSON evidence, then regenerate. -->\n`;
  const index = [header, '# Worldwide bank and country reference catalog', '', `Verified ${verifiedOn}: **${banks.length} bank/brand entries**, **${references.length} authority references**, **${groups.size} country, regional or global groupings**, and **${inventory.length} byte-verified CAMT052/053 originals**.`, '',
    'This curated catalog records primary-source evidence, not universal availability or bank certification. A country may share regional guidance, publish only payment/clearing rules, or leave CAMT reporting to individual banks. An absent country is **not yet inventoried**, not evidence that ISO 20022 or CAMT is unavailable.', '',
    'Use the browser’s **Bank catalog** to search by bank/authority, region, country and resource type. [Bank evidence](catalog.json), [country/reference evidence](country-references.json) and [original-source inventory](source-inventory.json) are the canonical machine-readable records. Each geography folder below groups banks and national/regional references together.', '',
    'Open **Example files** (`/#examples`) to find and download all inventoried CAMT originals alongside third-party CODA and synthetic files. Country/scope, bank/publisher and provenance filters distinguish verified publication from uncertain sample geography. Bank entries with verified originals link to their filtered example lists. See the [download guide](../../docs/user-guide.md#find-and-download-example-files) for extraction, integrity checks and publisher-link fallback.', '',
    'See the [regional communication-channel overview](communication-channels.md) for customer file delivery, API/M2M options, setup requirements and source evidence. These optional records distinguish CAMT/CODA files from adjacent account-data APIs and operator-only reporting.', '', '## Original samples and validation', '',
    `**104 independently authored synthetic originals** remain in the separate [example library](../README.md). This catalog inventories **${inventory.length} different bank-published XML originals/payloads**: ${statusCount('valid')} validate against the bundled ISO XSD, ${statusCount('missing-element-namespace')} have missing element namespaces, ${statusCount('invalid-as-published')} are invalid as published, and ${statusCount('wrapped-reference')} are wrapped SWIFT references without a bundled envelope schema.`, '',
    `**${committedCount} Bundesbank originals are committed unchanged** under [Germany / Deutsche Bundesbank](europe/germany/deutsche-bundesbank/ATTRIBUTION.md), with its required attribution and usage conditions. ${externalCount} original XML files remain in an ignored/ephemeral cache; public downloads do not establish redistribution rights. Their exact URL, archive/member hashes and byte lengths are committed. CAMT054 examples linked by banks are reference-only and excluded from this count.`, '',
    'Run `npm run catalog:check` for metadata/index consistency. `npm run test:bank:catalog` retrieves all external originals and checks unchanged bytes, independently counted reports/entries/details and documented XSD outcomes. The separate [12-file ING/ABN/Nordea compatibility corpus](../bank-published/README.md) additionally checks literal monetary/account/detail facts, CODA output, twelve reverse versions and real browser downloads. The two [Huntington inline illustrations](north-america/united-states/huntington/VALIDATION.md) also have literal source-fact, conversion and browser-download checks, including rejection of the published 052 defects. Inventory membership alone does not certify converter compatibility.', '',
    'The converter supports standalone CAMT052/053 and CODA 2.6. CAMT054, SWIFT wrappers, payment-clearing messages and namespace-less originals are reference material. No complete bank-published CODA original with established reuse rights has yet been acquired; that gap remains explicit.', '',
    'See the separate [Belgian CODA publisher research and fixture corpus](../coda-published/README.md) for developer examples, source limitations and documented bank availability. These are not bank-issued originals.', '',
    'The [North America bank-by-bank review](north-america-review.md) records Canada, United States and Mexico findings, including historical offerings, client-gated specifications, announced migrations and banks whose CAMT reporting could not be publicly verified. Global-only evidence remains separate from confirmed local account scope.', '',
    '## Geography index', '', '| Region | Country / scope | Banks / brands | Authority references |', '| --- | --- | ---: | ---: |'];
  for (const [key, group] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const dir = `${slug(group.region)}/${slug(group.country)}`;
    index.push(`| ${group.region} | [${group.country}](${dir}/README.md) | ${group.banks.length} | ${group.references.length} |`);
    const body = [header, `# ${group.country}`, '', `Region: ${group.region}. Sources verified ${verifiedOn}. Scope follows source documentation, not assumed nationwide CAMT availability.`, '', '## Country / regional references', ''];
    for (const e of group.references) body.push(`### ${e.authority}`, '', `**Role:** ${e.role}`, '', `**Reporting coverage:** ${e.reportingCoverage}`, '', `**Messages / versions:** ${e.formats.join('; ')}`, '', resources(e), '', e.notes, ...channelSections(e), '');
    if (!group.references.length) body.push('No country-level reference verified in this catalog yet. Consult bank-specific documentation below; do not infer a missing national standard.', '');
    if (group.country === 'Belgium') body.push('See also the [Belgian CODA source investigation](../../../coda-published/README.md): original third-party fixtures and bank availability evidence, kept separate from bank-published XML.', '');
    body.push('## Banks and published resources', '');
    for (const b of group.banks) {
      body.push(`- [${b.bank}](${b.id}/README.md) — ${b.formats.join('; ')}`);
      const originals = inventory.filter(s => s.bankId === b.id);
      const page = [header, `# ${b.bank} — ${group.country}`, '', `Verified ${b.verifiedOn}. Publisher: ${b.publisherType}.`, '', `**Documented market:** ${b.marketBasis}`, '', `**Formats / versions:** ${b.formats.join('; ')}`, '', '## Official resources', '', resources(b), '', '## Scope and source notes', '', b.notes, '', b.termsUrl ? `[Publisher usage terms](${b.termsUrl}).` : 'No open redistribution licence established. Consult the publisher before republishing originals.', '', '## Original-source inventory', ''];
      if (!originals.length) page.push('No byte-verified original XML acquired for this entry. PDF excerpts, schemas and service descriptions are not represented as original statement files.');
      else {
        page.push('Exact byte lengths, archive/member hashes and source structure facts are in [the canonical source inventory]('+ '../'.repeat(3)+'source-inventory.json). Market-specific sample names do not establish service entitlement for every account.', '', '| Inventory ID | Original filename / ZIP member | Source XSD status |', '| --- | --- | --- |');
        for (const s of originals) page.push(`| ${s.id} | ${s.filename.replaceAll('|', '\\|')} | ${s.xsdStatus} |`);
      }
      page.push(...channelSections(b));
      files.set(`${base}/${dir}/${b.id}/README.md`, page.join('\n').trimEnd()+'\n');
    }
    if (!group.banks.length) body.push('No bank-specific sources verified for this jurisdiction yet.');
    files.set(`${base}/${dir}/README.md`, body.join('\n').trimEnd()+'\n');
  }
  files.set(`${base}/communication-channels.md`, channelOverview([...banks, ...references], verifiedOn));
  files.set(`${base}/README.md`, index.join('\n')+'\n');
  return files;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const banks = JSON.parse(await readFile(resolve(root, base, 'catalog.json'), 'utf8'));
  const refs = JSON.parse(await readFile(resolve(root, base, 'country-references.json'), 'utf8'));
  const inventory = JSON.parse(await readFile(resolve(root, base, 'source-inventory.json'), 'utf8'));
  for (const [path, text] of renderCatalog(banks.banks, refs.references, inventory.cases, banks.verifiedOn)) {
    if (process.argv.includes('--check')) {
      if (await readFile(resolve(root, path), 'utf8').catch(() => null) !== text) throw new Error(`Catalog index is stale: ${path}`);
    } else { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); }
  }
  console.log(`Catalog evidence and geography indexes ${process.argv.includes('--check') ? 'verified' : 'generated'}.`);
}
