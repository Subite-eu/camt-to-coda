import { afterEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCamt } from '../../src/core/camt-parser.js';
import { statementToCoda } from '../../src/core/coda-writer.js';

// Synthetic source, authored here independently of the production XML writer.
export const camt = (id = 'SAFE', account = 'BE68539007547034') => `<?xml version="1.0"?><Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt><GrpHdr><MsgId>M1</MsgId><CreDtTm>2024-03-15T00:00:00Z</CreDtTm></GrpHdr><Stmt><Id>${id}</Id><CreDtTm>2024-03-15T00:00:00Z</CreDtTm><Acct><Id><IBAN>${account}</IBAN></Id><Ccy>EUR</Ccy></Acct><Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal><Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal></Stmt></BkToCstmrStmt></Document>`;
const dirs: string[] = [];
function workspace() { const dir = mkdtempSync(join(tmpdir(), 'operations-')); dirs.push(dir); return dir; }
function cli(args: string[]) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'src/cli.ts', ...args], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

describe('operations audit regressions', () => {
  it('rejects invalid CAMT before output or success archive', () => {
    const dir = workspace(), input = join(dir, 'bad.xml'), output = join(dir, 'output'), archive = join(dir, 'archive');
    writeFileSync(input, camt('BAD', ''));
    const result = cli(['convert', '-i', input, '-o', output, '--archive', archive]);
    expect(result.status).toBe(1);
    expect(result.output).toMatch(/account identifier/i);
    expect(existsSync(input)).toBe(true);
    expect(existsSync(output)).toBe(false);
    expect(existsSync(archive)).toBe(false);
  });
  it('validates every statement before writing the first output', () => {
    const dir = workspace(), input = join(dir, 'mixed.xml'), output = join(dir, 'output');
    writeFileSync(input, camt().replace('</BkToCstmrStmt>', camt('BAD', '').match(/<Stmt>.*<\/Stmt>/)![0] + '</BkToCstmrStmt>'));
    expect(cli(['convert', '-i', input, '-o', output]).status).toBe(1);
    expect(existsSync(output)).toBe(false);
  });
  it('reports writer reconciliation warnings in convert and validate', () => {
    const dir = workspace(), input = join(dir, 'warning.xml');
    writeFileSync(input, camt().replace(/>1000<\/Amt>/, '>999.999</Amt>'));
    for (const command of ['convert', 'validate']) {
      const result = cli(command === 'convert' ? [command, '-i', input, '-o', join(dir, 'out'), '--dry-run'] : [command, input]);
      expect(result.output).toMatch(/WARN:.*Balance mismatch/);
    }
  });
  it('reverse discovers CODA case-insensitively and ignores XML and directories', () => {
    const dir = workspace(), input = join(dir, 'in'), output = join(dir, 'out'); mkdirSync(input);
    const coda = statementToCoda(parseCamt(camt())[0]).lines.map(l => l.raw).join('\n');
    writeFileSync(join(input, 'one.COD'), coda); writeFileSync(join(input, 'two.CoDa'), coda);
    writeFileSync(join(input, 'skip.xml'), camt()); mkdirSync(join(input, 'sub.cod'));
    const result = cli(['reverse', '-i', input, '-o', output]);
    expect(result.status).toBe(0); expect(readdirSync(output).sort()).toEqual(['one.xml', 'two.xml']);
  });
  it('rejects a cross-backend archive configuration before writing output', () => {
    const dir = workspace(), input = join(dir, 'safe.xml'), output = join(dir, 'out'); writeFileSync(input, camt());
    const result = cli(['convert', '-i', input, '-o', output, '--archive', 's3://bucket/archive']);
    expect(result.status).toBe(1); expect(result.output).toMatch(/cross.backend/i);
    expect(existsSync(input)).toBe(true); expect(existsSync(output)).toBe(false);
  });
  it('confines source-derived names to the selected output directory', () => {
    const dir = workspace(), input = join(dir, 'safe.XML'), output = join(dir, 'out');
    writeFileSync(input, camt('unsafe/../../escape'));
    const result = cli(['convert', '-i', input, '-o', output]);
    expect(result.status).toBe(0);
    const files = readdirSync(output, { withFileTypes: true });
    expect(files).toHaveLength(1); expect(files[0].isFile()).toBe(true);
    expect(readFileSync(join(output, files[0].name), 'utf8').split('\n')[0]).toHaveLength(128);
  });
  it('does not overwrite an earlier input when source-derived output names collide', () => {
    const dir = workspace(), input = join(dir, 'in'), output = join(dir, 'out'), archive = join(dir, 'archive'); mkdirSync(input);
    writeFileSync(join(input, 'one.xml'), camt()); writeFileSync(join(input, 'two.xml'), camt());
    const result = cli(['convert', '-i', input, '-o', output, '--archive', archive]);
    expect(result.status).toBe(1); expect(result.output).toMatch(/duplicate output/i);
    expect(existsSync(join(input, 'two.xml'))).toBe(true);
    expect(readdirSync(output)).toHaveLength(1);
  });
  it('rejects reverse destination collisions before writing any output', () => {
    const dir = workspace(), input = join(dir, 'in'), output = join(dir, 'out'); mkdirSync(input);
    const source = readFileSync('examples/coda/coda-basic-eur.cod', 'utf8');
    writeFileSync(join(input, 'sample.cod'), source); writeFileSync(join(input, 'sample.coda'), source);
    const result = cli(['reverse', '-i', input, '-o', output]);
    expect(result.status).toBe(1); expect(result.output).toMatch(/duplicate output/i);
    expect(existsSync(output)).toBe(false);
  });
  it('writes unique anonymous names across a batch of inputs', () => {
    const dir = workspace(), input = join(dir, 'in'), output = join(dir, 'out'); mkdirSync(input);
    writeFileSync(join(input, 'one.xml'), camt('ONE')); writeFileSync(join(input, 'two.xml'), camt('TWO'));
    const result = cli(['convert', '-i', input, '-o', output, '--anonymize']);
    expect(result.status).toBe(0); expect(readdirSync(output)).toHaveLength(2);
    expect(readdirSync(output).join(' ')).not.toMatch(/ONE|TWO|BE68539007547034/);
  });

  it('preserves every logical statement during CLI reverse conversion', () => {
    const dir = workspace(), output = join(dir, 'out');
    const result = cli(['reverse', '-i', 'examples/coda/coda-multiple-statements.cod', '-o', output]);
    expect(result.status).toBe(0); expect(result.output).toMatch(/2 statements/);
    expect(readFileSync(join(output, 'coda-multiple-statements.xml'), 'utf8').match(/<Stmt>/g)).toHaveLength(2);
  });
  it('keeps the source out of the success archive after an output write failure', () => {
    const dir = workspace(), input = join(dir, 'safe.xml'), output = join(dir, 'out'), archive = join(dir, 'archive');
    writeFileSync(input, camt()); writeFileSync(output, 'a file blocks this directory');
    const result = cli(['convert', '-i', input, '-o', output, '--archive', archive]);
    expect(result.status).toBe(1); expect(existsSync(input)).toBe(true); expect(existsSync(archive)).toBe(false);
  });

});
