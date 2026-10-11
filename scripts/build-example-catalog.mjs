import { readFile, writeFile } from 'node:fs/promises';

const read = async path => JSON.parse(await readFile(new URL(`../examples/${path}`, import.meta.url), 'utf8'));
const [banks, inventory, coda, synthetic] = await Promise.all([
  read('bank-catalog/catalog.json'), read('bank-catalog/source-inventory.json'), read('coda-published/manifest.json'), read('catalog.json'),
]);
const repository = 'https://github.com/Subite-eu/camt-to-coda/blob/main/examples/';
const basename = name => name.split(/[\\/]/).at(-1);
const sourceFields = ['url', 'downloadSha256', 'downloadBytes', 'sourceSha256', 'sourceBytes', 'zipMember', 'tarMember', 'zipMemberSha256', 'zipMemberBytes', 'payloadRange', 'inlineRange', 'allowedRedirectOrigins'];
const source = original => Object.fromEntries(sourceFields.filter(key => original[key] != null).map(key => [key, original[key]]));
const countryNames = {
  Denmark: ['dk', 'denmark'], Finland: ['fi', 'finland'], Norway: ['no', 'norway'], Sweden: ['se', 'sweden', 'swedish'],
  'United Kingdom': ['uk'], Ireland: ['ie'], Poland: ['pl', 'poland'], 'United States': ['usa'], Singapore: ['singapore'], 'Baltic states': ['baltics'],
};
function geography(original, bank) {
  // Only recognise explicit country tokens in reviewed publisher filenames;
  // never infer authorship or market availability from an account/BIC.
  const named = bank.markets.filter(m => (countryNames[m.country] ?? []).some(token => new RegExp(`(?:^|[^a-z])${token}(?:$|[^a-z])`, 'i').test(original.filename)));
  return {
    countries: (named.length ? named : bank.markets).map(m => m.country),
    countryBasis: named.length ? 'Country named in publisher filename.' : bank.markets.length === 1 ? 'Country scope documented by publisher.' : 'Publisher service scope; this individual sample’s country is unspecified.',
  };
}
const examples = inventory.cases.map(original => {
  const bank = banks.banks.find(b => b.id === original.bankId);
  if (!bank) throw new Error(`Unknown publisher: ${original.id}`);
  const archive = original.zipMember ? /\.xlsx$/i.test(new URL(original.url).pathname) ? 'XLSX' : 'ZIP' : null;
  const valid = original.xsdStatus === 'valid';
  return {
    id: `bank:${original.id}`, sourceId: original.id, filename: basename(original.filename), format: 'CAMT', version: original.intendedSchema,
    provenance: 'bank', publisher: bank.bank, publisherId: `bank:${bank.id}`, bank: bank.bank,
    ...geography(original, bank), status: valid ? 'XSD valid' : original.xsdStatus === 'wrapped-reference' ? 'Wrapped reference' : 'Published schema issue',
    caution: !valid, description: original.schemaNotes ?? (valid ? 'Source schema verified. Converter compatibility is not certified for every example.' : original.xsdStatus === 'missing-element-namespace' ? 'Original elements lack the required XML namespace. Preserved unchanged.' : original.xsdStatus === 'wrapped-reference' ? 'SWIFT envelope reference; the converter accepts standalone CAMT052/053.' : 'Original fails its stated ISO schema. Preserved unchanged.'),
    source: source(original), archive, member: original.zipMember ?? null, extractedPayload: !!original.payloadRange,
    ...(original.inlineRange ? { sourceKind: 'Extracted inline XML', filenameBasis: 'Filename assigned by this library; XML code-block text is unchanged.' } : {}),
    documentationUrl: original.landingPage, termsUrl: bank.termsUrl,
    license: original.repositoryPath ? 'Bundesbank attribution and usage conditions apply.' : 'Publisher terms apply; no open redistribution licence established.',
    verifiedOn: original.retrievedOn,
  };
});
for (const original of coda.cases) examples.push({
  id: `third-party:${original.id}`, sourceId: original.id, filename: original.filename, format: 'CODA', version: 'CODA fixture',
  provenance: 'third-party', publisher: original.publisher, publisherId: `publisher:${original.publisher}`, bank: 'Bank not verified', countries: ['Belgium'],
  countryBasis: 'Belgian CODA format; bank authorship and production origin are unverified.',
  status: original.expected.conversionValid ? 'Conversion tested' : 'Expected rejection', caution: !original.expected.conversionValid,
  description: original.expected.conversionValid ? 'Literal statement facts and all 12 output targets tested; some targets may have representation limits.' : original.expected.rejection,
  source: source(original), archive: original.tarMember ? 'TAR.GZ' : null, member: original.tarMember ?? null, extractedPayload: false,
  documentationUrl: original.landingPage, termsUrl: original.licenseUrl, license: original.license,
  encoding: original.encoding, classification: original.classification, verifiedOn: original.retrievedOn,
});
for (const original of synthetic.cases) examples.push({
  id: `synthetic:${original.id}`, sampleId: original.id, filename: basename(original.path), format: original.format.toUpperCase(), version: original.schema ?? 'CODA 2.6',
  provenance: 'synthetic', publisher: 'camt2coda project', publisherId: 'project', bank: 'No bank affiliation', countries: ['Not country-specific'],
  countryBasis: 'Invented test data; no real country or bank provenance.',
  status: original.valid ? 'Conversion tested' : 'Expected rejection', caution: !original.valid,
  description: original.description ?? original.features.map(f => f.replaceAll('-', ' ')).join(', '),
  documentationUrl: `${repository}README.md`, termsUrl: 'https://github.com/Subite-eu/camt-to-coda/blob/main/LICENSE', license: 'MIT · independently authored fictional data',
});
if (new Set(examples.map(s => s.id)).size !== examples.length) throw new Error('Duplicate example identifier');
const order = ['bank', 'third-party', 'synthetic'];
examples.sort((a, b) => order.indexOf(a.provenance) - order.indexOf(b.provenance) || a.publisher.localeCompare(b.publisher) || a.filename.localeCompare(b.filename) || a.id.localeCompare(b.id));
const output = JSON.stringify({ version: 1, verifiedOn: inventory.cases[0].retrievedOn, examples }, null, 2) + '\n';
const destination = new URL('../examples/download-catalog.json', import.meta.url);
if (process.argv.includes('--check')) {
  if (await readFile(destination, 'utf8').catch(() => '') !== output) throw new Error('Example download catalog is stale; run npm run catalog:build.');
} else await writeFile(destination, output);
console.log(`${examples.length} example download records ${process.argv.includes('--check') ? 'verified' : 'generated'}; source contents excluded.`);
