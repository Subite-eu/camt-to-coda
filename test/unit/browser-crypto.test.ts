import { describe, expect, it } from 'vitest';
import { createHash as nodeHash } from 'node:crypto';
import { createHash } from '../../src/web/crypto-shim.js';

describe('browser SHA-256 compatibility used by privacy exports', () => {
  it.each(['', 'abc', 'Example Company', 'Héllo € 𐍈', 'long'.repeat(100)])('matches Node SHA-256 for %j', value => {
    expect(createHash().update(value).digest('hex')).toBe(nodeHash('sha256').update(value).digest('hex'));
  });
  it('preserves incremental update semantics', () => {
    expect(createHash().update('Example ').update('Company').digest('hex')).toBe(nodeHash('sha256').update('Example Company').digest('hex'));
  });
  it('rejects unsupported algorithms and encodings', () => {
    expect(() => createHash('md5')).toThrow(/SHA-256/);
    expect(() => createHash().digest('base64')).toThrow(/hex/);
  });
});
