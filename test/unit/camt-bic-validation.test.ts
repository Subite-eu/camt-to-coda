import { describe, expect, it } from 'vitest';
import { statementToXml, statementsToXml } from '../../src/core/camt-writer.js';
import type { CamtStatement } from '../../src/core/model.js';

const versions = Array.from({ length: 12 }, (_, i) => `camt.053.001.${String(i + 2).padStart(2, '0')}`);
type BicLocation = 'account' | 'counterparty';

function withBic(bic: string | undefined, location: BicLocation): CamtStatement {
  return {
    camtVersion: '053', messageId: 'BIC-TEST', statementId: 'BIC-TEST',
    creationDate: '2024-03-15', reportDate: '2024-03-15',
    account: { iban: 'BE68539007547034', currency: 'EUR', bic: location === 'account' ? bic : undefined },
    openingBalance: { amount: 0, creditDebit: 'CRDT', date: '2024-03-15' },
    closingBalance: { amount: 1, creditDebit: 'CRDT', date: '2024-03-15' },
    entries: [{ amount: 1, currency: 'EUR', creditDebit: 'CRDT',
      details: [{ counterparty: { bic: location === 'counterparty' ? bic : undefined } }] }],
  };
}

describe.each<BicLocation>(['account', 'counterparty'])('%s BIC validation', location => {
  it.each(versions)('rejects the CODA placeholder 000000000 for %s', version => {
    expect(() => statementToXml(withBic('000000000', location), version))
      .toThrow(new RegExp(`Invalid CAMT ${location} BIC.*000000000`));
  });

  it.each(['', 'bbrubebb', ' BBRUBEBB', 'BBRUBEBB ', 'BBRUBEBB\n', 'BBRUBEB', 'BBRUBEBBXX', 'ABCD01BB'])
  ('rejects malformed or unnormalized supplied BIC %j', bic => {
    expect(() => statementToXml(withBic(bic, location))).toThrow(/Invalid CAMT .* BIC/);
  });

  it.each(versions)('preserves valid 8- and 11-character BICs for %s', version => {
    const element = version.endsWith('.02') ? 'BIC' : 'BICFI';
    for (const bic of ['BBRUBEBB', 'BBRUBEBB123']) {
      expect(statementToXml(withBic(bic, location), version)).toContain(`<${element}>${bic}</${element}>`);
    }
  });

  // camt.053.001.02–07 BICIdentifier/BICFIIdentifier use the pre-2014
  // restrictions; .08–13 BICFIDec2014Identifier permit bank digits and 0/1/O locations.
  it.each(versions.slice(0, 6))('rejects bank digits and restricted location characters for %s', version => {
    for (const bic of ['1234BEBB', 'ABCDBE0A', 'ABCDBE1A', 'ABCDBEAO']) {
      expect(() => statementToXml(withBic(bic, location), version)).toThrow(/Invalid CAMT .* BIC/);
    }
  });

  it.each(versions.slice(6))('preserves Dec2014 bank digits and location characters for %s', version => {
    for (const bic of ['1234BEBB', 'ABCDBE0A', 'ABCDBE1A', 'ABCDBEAO']) {
      expect(statementToXml(withBic(bic, location), version)).toContain(`<BICFI>${bic}</BICFI>`);
    }
  });

  it('allows an absent BIC', () => {
    expect(statementToXml(withBic(undefined, location))).not.toContain('<BICFI>');
  });
});

it('rejects invalid BICs in later statements instead of returning partial XML', () => {
  expect(() => statementsToXml([withBic('BBRUBEBB', 'account'), withBic('000000000', 'counterparty')]))
    .toThrow(/Invalid CAMT counterparty BIC.*000000000/);
});
