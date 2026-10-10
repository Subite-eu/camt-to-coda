import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { statementToXml } from '../../src/core/camt-writer.js';
import { parseCamt } from '../../src/core/camt-parser.js';
import { statementToCoda } from '../../src/core/coda-writer.js';
import { codaToCamt } from '../../src/core/reverse.js';
import { validateCoda } from '../../src/validation/coda-validator.js';
import { validateCamt } from '../../src/validation/camt-validator.js';
import { convertForward, convertReverse } from '../../src/web/browser-entry.js';
import type { CamtStatement } from '../../src/core/model.js';
export function specimen(): CamtStatement {
    return {
        camtVersion: '053', messageId: 'SYNTHETIC', creationDate: '2026-10-10', statementId: 'S-1', reportDate: '2026-10-10', sequence: 1,
        account: { iban: 'BE68539007547034', currency: 'KWD', ownerName: 'Synthetic', bic: 'BBRUBEBB' },
        openingBalance: { amount: 10.001, creditDebit: 'CRDT', date: '2026-10-09' }, closingBalance: { amount: 11.002, creditDebit: 'CRDT', date: '2026-10-10' },
        entries: [{ amount: 1.001, currency: 'KWD', creditDebit: 'CRDT', entryRef: 'ENTRY', bookingDate: '2026-10-10', valueDate: '2026-10-10',
                transactionCode: { domain: 'PMNT', family: 'RCDT', subFamily: 'ESCT' }, returnInfo: { reasonCode: 'AC01', isReversal: true },
                details: [{ refs: { instrId: 'INSTR', endToEndId: 'E2E', txId: 'TX' }, counterparty: { name: 'Synthetic Payer', iban: 'BE91516952884376', bic: 'GEBABEBB' }, purpose: 'SALA', remittanceInfo: { unstructured: 'Invoice' } }] }]
    };
}
describe('audit core regressions', () => {
    for (let v = 2; v <= 13; v++)
        it(`generates XSD-valid 053 v${v} retaining precision and currency`, () => {
            const xml = statementToXml(specimen(), `camt.053.001.${String(v).padStart(2, '0')}`);
            const check = spawnSync('xmllint', ['--noout', '--schema', `specifications/CAMT/camt.053.001.${String(v).padStart(2, '0')}.xsd`, '-'], { input: xml, encoding: 'utf8' });
            expect(check.stderr).not.toMatch(/error/);
            expect(check.status).toBe(0);
            expect(parseCamt(xml)[0].closingBalance.amount).toBe(11.002);
            expect(xml.match(/Ccy="KWD"/g)?.length).toBeGreaterThanOrEqual(3);
        });
    it('rejects unsupported output versions', () => expect(() => statementToXml(specimen(), 'camt.054.001.08')).toThrow(/Unsupported/));
    it('rejects malformed XML and bad decimal amounts', () => {
        const xml = statementToXml(specimen());
        expect(() => parseCamt(xml.replace('</Document>', ''))).toThrow();
        expect(() => parseCamt(xml.replace('1.001', 'not-a-number'))).toThrow(/amount/i);
    });
    it('accepts namespace aliases and single quotes', () => {
        const xml = statementToXml(specimen());
        expect(parseCamt(xml.replace(/xmlns="([^"]+)"/, 'xmlns=\'$1\''))).toHaveLength(1);
        expect(parseCamt(xml.replace('<Document xmlns=', '<ns:Document xmlns:ns=').replace('</Document>', '</ns:Document>'))).toHaveLength(1);
    });
    it('reads actual 052 entries and modern repeated details/date choices', () => {
        const xml = statementToXml(specimen()).replaceAll('camt.053', 'camt.052').replaceAll('BkToCstmrStmt', 'BkToCstmrAcctRpt').replaceAll('<Stmt>', '<Rpt>').replaceAll('</Stmt>', '</Rpt>');
        const parsed = parseCamt(xml)[0];
        expect(parsed.entries).toHaveLength(1);
        expect(parsed.entries[0].amount).toBe(1.001);
        const modern = statementToXml(specimen()).replace('</NtryDtls>', '</NtryDtls><NtryDtls><TxDtls><RltdPties><Dbtr><Pty><Nm>Second</Nm></Pty></Dbtr></RltdPties></TxDtls></NtryDtls>').replace('<BookgDt><Dt>2026-10-10</Dt></BookgDt>', '<BookgDt><DtTm>2026-10-10T12:00:00Z</DtTm></BookgDt>');
        expect(parseCamt(modern)[0].entries[0].details.map(d => d.counterparty?.name)).toEqual(['Synthetic Payer', 'Second']);
        expect(parseCamt(modern)[0].entries[0].bookingDate).toBe('2026-10-10T12:00:00Z');
    });
    it('preserves every logical file and exposes real validation', () => {
        const first = statementToCoda(specimen()).lines.map(l => l.raw);
        first[first.length - 1] = first.at(-1)!.slice(0, 127) + '1';
        const second = statementToCoda({ ...specimen(), statementId: 'S-2', account: { otherId: 'OTHER', currency: 'KWD' } }).lines.map(l => l.raw);
        const result = codaToCamt([...first, ...second].join('\n'));
        expect(result.statements).toHaveLength(2);
        expect(result.statement).toBe(result.statements[0]);
        expect(parseCamt(result.xml)).toHaveLength(2);
        expect(convertReverse([...first, ...second].join('\n')).statements).toHaveLength(2);
    });
    it('retains remittance 3.3 and significant continuation spaces', () => {
        const s = specimen();
        const text = 'A'.repeat(72) + ' ' + 'B'.repeat(104) + ' ' + 'C'.repeat(42);
        s.entries[0].details = [{ remittanceInfo: { unstructured: text } }];
        expect(codaToCamt(statementToCoda(s).lines.map(l => l.raw).join('\n')).statement.entries[0].details[0].remittanceInfo?.unstructured).toBe(text);
    });
    it('preserves OGM semantics, name-only counterparties and standalone E2E refs', () => {
        const s = specimen();
        s.entries[0].details = [{ refs: { endToEndId: 'ONLY-E2E' }, counterparty: { name: 'NAME ONLY' }, remittanceInfo: { structured: { creditorRef: '010806817183' } } }];
        const result = codaToCamt(statementToCoda(s).lines.map(l => l.raw).join('\n')).statement.entries[0].details[0];
        expect(result.remittanceInfo?.structured?.creditorRef).toBe('010806817183');
        expect(result.counterparty?.name).toBe('NAME ONLY');
        expect(result.refs?.endToEndId).toBe('ONLY-E2E');
    });
    it('does not label an invalid numeric creditor reference as OGM', () => {
        const s = specimen();
        s.entries[0].details = [{ remittanceInfo: { structured: { creditorRef: '123' } } }];
        expect(statementToCoda(s).lines.find(l => l.recordType === '2.1')?.fields.find(f => f.name === 'communicationType')?.value).toBe('0');
    });
    it('rejects empty, out-of-order, corrupt amounts and inconsistent trailers', () => {
        expect(validateCoda([]).valid).toBe(false);
        expect(() => codaToCamt('')).toThrow();
        const lines = statementToCoda(specimen()).lines.map(l => l.raw);
        expect(validateCoda([...lines.slice(1)]).valid).toBe(false);
        const index = lines.findIndex(l => l.startsWith('21'));
        lines[index] = lines[index].slice(0, 32) + 'a'.repeat(15) + lines[index].slice(47);
        expect(validateCoda(lines).valid).toBe(false);
        expect(convertReverse(lines.join('\n')).validation.valid).toBe(false);
    });
    it('validates business amounts and propagates reconciliation warnings', () => {
        const s = specimen();
        s.entries[0].amount = NaN;
        expect(validateCamt(s).valid).toBe(false);
        const t = specimen();
        t.closingBalance.amount = 100;
        expect(convertForward(statementToXml(t)).files[0].validation.warnings.some(w => w.includes('Balance mismatch'))).toBe(true);
    });
    it('sets link flags from the complete sequence', () => {
        const s = specimen();
        s.entries[0].details.push({ remittanceInfo: { unstructured: 'Second' } });
        const lines = statementToCoda(s).lines;
        for (let i = 0; i < lines.length - 1; i++)
            if (['2.1', '2.2', '2.3', '3.1', '3.2', '3.3'].includes(lines[i].recordType)) {
                const next = lines[i + 1];
                const expected = next.recordType === '3.1' ? '1' : '0';
                expect(lines[i].raw[127]).toBe(expected);
            }
    });
});
describe('strict source semantics', () => {
    it('rejects invalid twelve-digit OGM checksums and non-BBA structured metadata', () => {
        const s = specimen();
        s.entries[0].details = [{ remittanceInfo: { structured: { creditorRef: '010806817184' } } }];
        expect(statementToCoda(s).lines.find(l => l.recordType === '2.1')?.raw[61]).toBe('0');
        const xml = statementToXml(specimen()).replace('<Ustrd>Invoice</Ustrd>', '<Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry><Issr>OTHER</Issr></Tp><Ref>010806817183</Ref></CdtrRefInf></Strd>');
        expect(statementToCoda(parseCamt(xml)[0]).lines.find(l => l.recordType === '2.1')?.raw[61]).toBe('0');
    });
    it('rejects exponent and missing amount lexemes', () => {
        const xml = statementToXml(specimen());
        expect(() => parseCamt(xml.replace('1.001', '1e3'))).toThrow(/amount/i);
        expect(() => parseCamt(xml.replace('<Amt Ccy="KWD">1.001</Amt>', ''))).toThrow(/amount/i);
    });
    it('requires the CAMT namespace on the Document root', () => {
        const xml = statementToXml(specimen()).replace('xmlns="urn:', 'xmlns:unused="urn:');
        expect(() => parseCamt(xml)).toThrow(/namespace/i);
    });
});
describe('schema boundaries and account identity', () => {
    it('preserves long remittance using bounded repeated Ustrd elements', () => {
        const s = specimen();
        const text = 'a'.repeat(139) + ' ' + 'b'.repeat(100);
        s.entries[0].details[0].remittanceInfo = { unstructured: text };
        const xml = statementToXml(s);
        const check = spawnSync('xmllint', ['--noout', '--schema', 'specifications/CAMT/camt.053.001.08.xsd', '-'], { input: xml, encoding: 'utf8' });
        expect(check.status, check.stderr).toBe(0);
        expect(parseCamt(xml)[0].entries[0].details[0].remittanceInfo?.unstructured).toBe(text);
    });
    it('preserves a non-IBAN account that begins with letters', () => {
        const s = specimen();
        s.account = { otherId: 'EXAMPLE-LOCAL-001', currency: 'KWD' };
        const r = codaToCamt(statementToCoda(s).lines.map(l => l.raw).join('\n'));
        expect(r.statement.account.otherId).toBe('EXAMPLE-LOCAL-001');
        expect(r.statement.account.iban).toBeUndefined();
    });
});
describe('signs and free communication', () => {
    it('preserves debit zero on balances', () => {
        const s = specimen();
        s.entries = [];
        s.openingBalance = { amount: 0, creditDebit: 'DBIT', date: '2026-10-10' };
        s.closingBalance = { ...s.openingBalance };
        const r = codaToCamt(statementToCoda(s).lines.map(l => l.raw).join('\n')).statement;
        expect(r.openingBalance.creditDebit).toBe('DBIT');
        expect(r.closingBalance.creditDebit).toBe('DBIT');
    });
    it('does not claim globalisation for information-only detail records', () => {
        const s = specimen();
        s.entries[0].details.push({ remittanceInfo: { unstructured: 'second' } });
        expect(statementToCoda(s).lines.find(l => l.recordType === '2.1')?.raw[124]).toBe('0');
    });
    it('retains record4 free communication through CAMT', () => {
        const s = specimen();
        const raw = statementToCoda(s).lines.map(l => l.raw);
        const index = raw.findIndex(l => l[0] === '8');
        raw[index] = raw[index].slice(0, 127) + '1';
        const record = '4 ' + '0001' + '0000' + ' '.repeat(22) + 'Synthetic free message'.padEnd(80) + ' '.repeat(15) + '0';
        raw.splice(index + 1, 0, record);
        const r = codaToCamt(raw.join('\n'));
        expect(r.statement.freeCommunications).toEqual(['Synthetic free message']);
        expect(parseCamt(r.xml)[0].freeCommunications).toEqual(['Synthetic free message']);
        expect(statementToCoda(parseCamt(r.xml)[0]).lines.some(l => l.recordType === '4' && l.raw.includes('Synthetic free message'))).toBe(true);
    });
});
describe('Belgian BBAN layout', () => {
    it('uses CODA §7.5 packed account/currency offsets for structure0', () => {
        const s = specimen();
        s.account = { otherId: '539007547034', currency: 'EUR' };
        s.entries[0].currency = 'EUR';
        const f = statementToCoda(s);
        const old = f.lines.find(l => l.recordType === '1')!.raw;
        expect(old[1]).toBe('0');
        expect(old.slice(5, 17)).toBe('539007547034');
        expect(old.slice(18, 21)).toBe('EUR');
        const r = codaToCamt(f.lines.map(l => l.raw).join('\n')).statement;
        expect(r.account.otherId).toBe('539007547034');
        expect(r.account.currency).toBe('EUR');
    });
});
describe('currency and mandatory lexical fields', () => {
    it('derives optional account currency from mandatory balance currency', () => {
        const xml = statementToXml(specimen()).replace('<Ccy>KWD</Ccy>', '');
        expect(parseCamt(xml)[0].account.currency).toBe('KWD');
    });
    it('rejects mixed balance/account currencies', () => {
        const xml = statementToXml(specimen()).replace('<Amt Ccy="KWD">10.001', '<Amt Ccy="EUR">10.001');
        expect(validateCamt(parseCamt(xml)[0]).valid).toBe(false);
    });
    it('rejects invalid account and bank identifier syntax', () => {
        const s = specimen();
        s.account.iban = 'not-an-iban';
        s.account.bic = 'bad';
        expect(validateCamt(s).errors.some(e => e.includes('IBAN'))).toBe(true);
        expect(validateCamt(s).errors.some(e => e.includes('BIC'))).toBe(true);
    });
});
describe('representable detail bounds', () => {
    it('preserves leading spaces and independently valued details', () => {
        const s = specimen();
        s.entries[0].details[0].remittanceInfo = { unstructured: '  Leading spaces' };
        const f = statementToCoda(s), r = codaToCamt(f.lines.map(l => l.raw).join('\n'));
        expect(r.statement.entries[0].details[0].remittanceInfo?.unstructured).toBe('  Leading spaces');
        s.entries[0].details.push({ amount: 0.123, currency: 'KWD', refs: { txId: 'SECOND' }, remittanceInfo: { structured: { creditorRef: '010806817183' } } });
        expect(codaToCamt(statementToCoda(s).lines.map(l => l.raw).join('\n')).statement.entries[0].details.some(d => d.amount === 0.123)).toBe(true);
    });
    it('retains an Other counterparty identifier', () => {
        const s = specimen();
        s.entries[0].details[0].counterparty = { name: 'Other party', otherId: 'LOCAL-CP-001' };
        const parsed = parseCamt(statementToXml(s))[0];
        expect(parsed.entries[0].details[0].counterparty?.otherId).toBe('LOCAL-CP-001');
    });
});
describe('CODA monetary detail records', () => {
    it('groups nonzero detail-number movements under their aggregate without double-counting', () => {
        const s = specimen();
        const raw = statementToCoda(s).lines.map(l => l.raw);
        const idx = raw.findIndex(l => l[0] === '8');
        let detail = raw.find(l => l.startsWith('21'))!;
        detail = detail.slice(0, 6) + '0001' + detail.slice(10, 32) + '000000000000600' + detail.slice(47, 125) + '0 0';
        raw.splice(idx, 0, detail);
        const trailer = raw.at(-1)!;
        raw[raw.length - 1] = trailer.slice(0, 16) + String(Number(trailer.slice(16, 22)) + 1).padStart(6, '0') + trailer.slice(22);
        expect(validateCoda(raw).errors).toEqual([]);
        const result = codaToCamt(raw.join('\n'));
        expect(result.statement.entries).toHaveLength(1);
        expect(result.statement.entries[0].amount).toBe(1.001);
        expect(result.statement.entries[0].details.some(d => d.amount === 0.6)).toBe(true);
        const emitted = statementToCoda(result.statement);
        expect(validateCoda(emitted.lines).errors).toEqual([]);
        const restored = codaToCamt(emitted.lines.map(l => l.raw).join('\n')).statement;
        expect(restored.entries).toHaveLength(1);
        expect(restored.entries[0].details.some(d => d.amount === 0.6)).toBe(true);
    });
    it('preserves two independently valued CAMT transaction details through CODA', () => {
        const s = specimen();
        s.entries[0].details = [{ amount: 0.4, currency: 'KWD', creditDebit: 'CRDT', remittanceInfo: { unstructured: 'First' } }, { amount: 0.601, currency: 'KWD', creditDebit: 'CRDT', remittanceInfo: { unstructured: 'Second' } }];
        const f = statementToCoda(s);
        expect(validateCoda(f.lines).errors).toEqual([]);
        const r = codaToCamt(f.lines.map(l => l.raw).join('\n')).statement;
        expect(r.entries).toHaveLength(1);
        expect(r.entries[0].details.map(d => d.amount)).toEqual([0.4, 0.601]);
        expect(r.entries[0].details.map(d => d.remittanceInfo?.unstructured)).toEqual(['First', 'Second']);
    });
});
describe('detail integrity', () => {
    it('rejects an orphan monetary detail before conversion', () => {
        const s = specimen();
        s.entries[0].details = [];
        s.entries[0].returnInfo = undefined;
        const raw = statementToCoda(s).lines.map(l => l.raw);
        const idx = raw.findIndex(l => l.startsWith('21'));
        raw[idx] = raw[idx].slice(0, 6) + '0001' + raw[idx].slice(10);
        raw[raw.length - 1] = raw.at(-1)!.slice(0, 37) + '0'.repeat(15) + raw.at(-1)!.slice(52);
        expect(validateCoda(raw).valid).toBe(false);
    });
    it('validates the amount and direction of transaction details', () => {
        const s = specimen();
        s.entries[0].details[0].amount = NaN;
        expect(validateCamt(s).valid).toBe(false);
    });
});
describe('CODA sequence capacity', () => {
    it('explicitly rejects more than9999 movements instead of truncating sequence digits', () => {
        const s = specimen();
        s.entries = Array.from({ length: 10000 }, () => s.entries[0]);
        expect(() => statementToCoda(s)).toThrow(/9999|sequence capacity/);
    });
    it('explicitly rejects detail numbers beyond9999', () => {
        const s = specimen();
        s.entries[0].details = Array.from({ length: 10000 }, () => ({ remittanceInfo: { unstructured: 'detail' } }));
        expect(() => statementToCoda(s)).toThrow(/9999|sequence capacity/);
    });
});
describe('monetary detail XML fields', () => {
    it('retains detail bank reference, transaction code and return reason through XML', () => {
        const s = specimen();
        s.entries[0].returnInfo = undefined;
        s.entries[0].details = [{ amount: 1.001, currency: 'KWD', creditDebit: 'CRDT', refs: { accountServicerRef: 'DETAIL-BANK' }, transactionCode: { proprietary: '00101000', proprietaryIssuer: 'BBA' }, returnInfo: { reasonCode: 'AC04' }, remittanceInfo: { unstructured: 'Detail' } }];
        const first = codaToCamt(statementToCoda(s).lines.map(l => l.raw).join('\n'));
        expect(first.xml).toContain('<AcctSvcrRef>DETAIL-BANK</AcctSvcrRef>');
        const parsed = parseCamt(first.xml)[0].entries[0].details[0];
        expect(parsed.refs?.accountServicerRef).toBe('DETAIL-BANK');
        expect(parsed.returnInfo?.reasonCode).toBe('AC04');
        expect(parsed.transactionCode).toBeDefined();
    });
});
describe('valued detail decimal precision', () => {
    it('rejects a model detail with more than three decimals before reporting a valid CODA conversion', () => {
        const statement = specimen();
        statement.entries[0].details[0].amount = 1.0001;
        expect(validateCamt(statement).errors).toContain('Entry 1 detail 1: CODA supports at most three decimals');
        expect(statementToCoda(statement).validation.valid).toBe(false);
    });
    it('parses an original four-decimal detail accurately and rejects its CODA precision loss', () => {
        const xml = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
          <GrpHdr><MsgId>SYNTHETIC-PRECISION</MsgId><CreDtTm>2026-10-10T00:00:00Z</CreDtTm></GrpHdr>
          <Stmt><Id>DETAIL-PRECISION</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>KWD</Ccy></Acct>
          <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="KWD">0</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-10</Dt></Dt></Bal>
          <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="KWD">1</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-10</Dt></Dt></Bal>
          <Ntry><Amt Ccy="KWD">1</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BkTxCd/>
          <NtryDtls><TxDtls><Amt Ccy="KWD">1.0001</Amt><CdtDbtInd>CRDT</CdtDbtInd></TxDtls></NtryDtls></Ntry>
          </Stmt></BkToCstmrStmt></Document>`;
        const parsed = parseCamt(xml)[0];
        expect(parsed.entries[0].details[0].amount).toBe(1.0001);
        expect(validateCamt(parsed).valid).toBe(false);
        expect(convertForward(xml).files[0].validation.valid).toBe(false);
    });
});
describe('CAMT v02 valued transaction details', () => {
    it('uses the v02 AmtDtls/TxAmt/Amt choice and preserves valued details', () => {
        const s = specimen();
        s.entries[0].returnInfo = undefined;
        s.entries[0].details = [{amount: 1.001, currency: 'KWD', creditDebit: 'CRDT', refs: {accountServicerRef: 'V02-DETAIL'}}];
        const xml = statementToXml(s, 'camt.053.001.02');
        const checked = spawnSync('xmllint', ['--noout', '--schema', 'specifications/CAMT/camt.053.001.02.xsd', '-'], {input: xml, encoding: 'utf8'});
        expect(checked.status, checked.stderr).toBe(0);
        expect(xml).toContain('<AmtDtls><TxAmt><Amt Ccy="KWD">1.001</Amt></TxAmt></AmtDtls>');
        const detail = parseCamt(xml)[0].entries[0].details[0];
        expect(detail.amount).toBe(1.001);
        expect(detail.currency).toBe('KWD');
        expect(detail.creditDebit).toBe('CRDT');
        expect(detail.refs?.accountServicerRef).toBe('V02-DETAIL');
    });
    it('explicitly rejects a valued detail whose direction v02 cannot represent', () => {
        const s = specimen();
        s.entries[0].details = [{amount: 1.001, currency: 'KWD', creditDebit: 'DBIT'}];
        expect(() => statementToXml(s, 'camt.053.001.02')).toThrow(/v02.*direction/i);
    });
});
describe('mixed-direction detail counterparties', () => {
    it('writes a debit detail creditor within a credit aggregate', () => {
        const s = specimen();
        s.entries[0].returnInfo = undefined;
        s.entries[0].details = [{amount: 1.001, currency: 'KWD', creditDebit: 'DBIT', counterparty: {name:'Paid Supplier', iban:'BE91516952884376', bic:'GEBABEBB'}}];
        const xml = statementToXml(s);
        expect(xml).toContain('<Cdtr><Pty><Nm>Paid Supplier</Nm></Pty></Cdtr>');
        expect(xml).toContain('<CdtrAcct><Id><IBAN>BE91516952884376</IBAN></Id></CdtrAcct>');
        expect(xml).toContain('<CdtrAgt><FinInstnId><BICFI>GEBABEBB</BICFI></FinInstnId></CdtrAgt>');
        const parsed = parseCamt(xml)[0].entries[0].details[0];
        expect(parsed.creditDebit).toBe('DBIT');
        expect(parsed.counterparty?.name).toBe('Paid Supplier');
    });
    it('uses the detail direction when both our party and the counterparty occur in source XML', () => {
        const source = `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
          <GrpHdr><MsgId>MIXED-SIGNS</MsgId><CreDtTm>2026-10-10T00:00:00Z</CreDtTm></GrpHdr>
          <Stmt><Id>MIXED</Id><Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy></Acct>
          <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">0</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-10</Dt></Dt></Bal>
          <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2026-10-10</Dt></Dt></Bal>
          <Ntry><Amt Ccy="EUR">1</Amt><CdtDbtInd>CRDT</CdtDbtInd><Sts><Cd>BOOK</Cd></Sts><BkTxCd/>
          <NtryDtls><TxDtls><Amt Ccy="EUR">0.25</Amt><CdtDbtInd>DBIT</CdtDbtInd>
          <RltdPties><Dbtr><Pty><Nm>Our Own Party</Nm></Pty></Dbtr><DbtrAcct><Id><IBAN>BE68539007547034</IBAN></Id></DbtrAcct>
          <Cdtr><Pty><Nm>Paid Supplier</Nm></Pty></Cdtr><CdtrAcct><Id><IBAN>BE91516952884376</IBAN></Id></CdtrAcct></RltdPties>
          </TxDtls></NtryDtls></Ntry></Stmt></BkToCstmrStmt></Document>`;
        const parsed = parseCamt(source)[0].entries[0].details[0];
        expect(parsed.counterparty?.name).toBe('Paid Supplier');
        expect(parsed.counterparty?.iban).toBe('BE91516952884376');
    });
});
describe('independent monetary detail return reasons', () => {
    it('does not promote the first detail reason or copy it onto sibling details', () => {
        const s = specimen();
        s.entries[0].returnInfo = undefined;
        s.entries[0].details = [
            {amount: 0.4, currency:'KWD', creditDebit:'CRDT', returnInfo:{reasonCode:'AC01'}, remittanceInfo:{unstructured:'Returned first'}},
            {amount: 0.601, currency:'KWD', creditDebit:'CRDT', remittanceInfo:{unstructured:'Unaffected second'}},
        ];
        const parsed = parseCamt(statementToXml(s))[0];
        expect(parsed.entries[0].returnInfo).toBeUndefined();
        const output = statementToCoda(parsed);
        const reasons = output.lines.filter(l=>l.recordType==='2.2').map(l=>({detail:l.fields.find(f=>f.name==='detailNumber')?.value,reason:l.fields.find(f=>f.name==='isoReason')?.value.trim()})).filter(r=>r.reason);
        expect(reasons).toEqual([{detail:'0001',reason:'AC01'}]);
        const restored = codaToCamt(output.lines.map(l=>l.raw).join('\n')).statement.entries[0];
        expect(restored.returnInfo).toBeUndefined();
        expect(restored.details.map(d=>d.returnInfo?.reasonCode)).toEqual(['AC01',undefined]);
    });
    it('keeps a parent return reason separate from valued detail reasons', () => {
        const s = specimen();
        s.entries[0].details = [{amount:1.001,currency:'KWD',creditDebit:'CRDT',remittanceInfo:{unstructured:'Detail without its own reason'}}];
        const reasons = statementToCoda(s).lines.filter(l=>l.recordType==='2.2').map(l=>({detail:l.fields.find(f=>f.name==='detailNumber')?.value,reason:l.fields.find(f=>f.name==='isoReason')?.value.trim()})).filter(r=>r.reason);
        expect(reasons).toEqual([{detail:'0000',reason:'AC01'}]);
    });
});
describe('aggregate return XML representation', () => {
    it('retains an aggregate reason separately from valued transaction reasons', () => {
        const s = specimen();
        s.entries[0].details = [{amount:0.4,currency:'KWD',creditDebit:'CRDT',returnInfo:{reasonCode:'AC04'}},{amount:0.601,currency:'KWD',creditDebit:'CRDT'}];
        const parsed = parseCamt(statementToXml(s))[0].entries[0];
        expect(parsed.returnInfo?.reasonCode).toBe('AC01');
        expect(parsed.details.filter(d=>d.amount!==undefined).map(d=>d.returnInfo?.reasonCode)).toEqual(['AC04',undefined]);
    });
});
describe('reverse OGM business validation', () => {
    it('rejects an invalid type101 checksum in original CODA communications', () => {
        const s = specimen();s.entries[0].details=[{remittanceInfo:{structured:{creditorRef:'010806817183'}}}];
        const raw=statementToCoda(s).lines.map(l=>l.raw.replace('101010806817183','101010806817184'));
        expect(validateCoda(raw).valid).toBe(false);
        expect(()=>codaToCamt(raw.join('\n'))).toThrow(/OGM|checksum/);
    });
});
