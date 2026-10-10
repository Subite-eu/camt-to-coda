import type { ValidationResult } from './result.js';
import type { CodaLine } from '../core/field-defs/types.js';
import { parseCoda } from '../core/coda-parser.js';
import { isValidOgmVcs } from '../core/ogm-vcs.js';
import { validDate } from './camt-validator.js';
export function validateCoda(input: (CodaLine | string)[]): ValidationResult {
    const errors: string[] = [], warnings: string[] = [];
    const raw = input.map(l => typeof l === 'string' ? l : l.raw);
    if (!raw.length)
        errors.push('Empty CODA input');
    raw.forEach((r, i) => {
        if (r.length !== 128)
            errors.push(`Line ${i + 1}: ${r.length} chars (expected 128)`);
    });
    if (raw.length && raw[0][0] !== '0')
        errors.push('Must start with Record 0');
    if (raw.length && raw.at(-1)![0] !== '9')
        errors.push('Must end with Record 9');
    let lines: CodaLine[] = [];
    if (!errors.some(e => e.includes('chars')))
        try {
            lines = parseCoda(raw.join('\n'));
        }
        catch (e) {
            errors.push((e as Error).message);
        }
    const f = (l: CodaLine, n: string) => l.fields.find(f => f.name === n)?.value.trim() ?? '';
    let state: 'header' | 'balance' | 'entries' | 'trailer' = 'header', start = 0, opening: CodaLine | undefined, closing: CodaLine | undefined, debits = 0, credits = 0;
    let currentAggregateSequence: string | undefined;
    let lastMonetaryDetail = 0;
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i], type = l.recordType, previous = lines[i - 1], next = lines[i + 1];
        const error = (message: string) => errors.push(`Line ${i + 1}: ${message}`);
        const digits = (name: string, length: number, optional = false) => {
            const v = f(l, name);
            if ((v || !optional) && !new RegExp(`^\\d{${length}}$`).test(v))
                error(`Invalid ${name}: expected ${length} digits`);
        };
        for (const field of l.fields) {
            if (['amount', 'balanceAmount', 'sumDebits', 'sumCredits'].includes(field.name))
                digits(field.name, 15);
            if (['balanceSign', 'amountSign', 'communicationType', 'nextCode', 'linkCode'].includes(field.name) && !/^[01]$/.test(field.value))
                error(`Invalid ${field.name}`);
            if (['sequenceNumber', 'detailNumber'].includes(field.name))
                digits(field.name, 4);
            if (['currency'].includes(field.name) && !(type === '2.3' && !field.value.trim()) && !/^[A-Z]{3}$/.test(field.value))
                error('Invalid currency');
            if (['creationDate', 'balanceDate', 'entryDate', 'valueDate'].includes(field.name)) {
                const d = field.value, year = Number(d.slice(4)) > 50 ? '19' : '20';
                if (!/^\d{6}$/.test(d) || (d !== '000000' && !validDate(`${year}${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}`)))
                    error(`Invalid ${field.name}`);
                if (d === '000000' && ['creationDate', 'balanceDate'].includes(field.name))
                    error(`Missing ${field.name}`);
            }
        }
        if ((type === '2.1' || type === '3.1') && f(l, 'communicationType') === '1') {
            const communication = f(l, 'communication');
            if (communication.startsWith('101') && (!isValidOgmVcs(communication.slice(3, 15)) || communication.slice(15).trim())) error('Invalid OGM type101 reference/checksum');
        }
        if (type === '0') {
            if (state !== 'header')
                error('Unexpected Record 0 before prior trailer');
            if (f(l, 'versionCode') !== '2')
                error('Unsupported CODA version');
            currentAggregateSequence = undefined;
            lastMonetaryDetail = 0;
            start = i;
            debits = 0;
            credits = 0;
            opening = undefined;
            closing = undefined;
            state = 'balance';
        }
        else if (type === '1') {
            if (state !== 'balance')
                error('Record 1 must follow Record 0');
            if (!f(l, 'accountNumber'))
                error('Missing account identifier');
            opening = l;
            state = 'entries';
        }
        else if (type === '8') {
            if (state !== 'entries')
                error('Unexpected Record 8');
            closing = l;
            state = 'trailer';
            if (opening)
                for (const name of ['accountNumber', 'currency', 'sequence'])
                    if (f(opening, name) !== f(l, name))
                        error(`Closing ${name} differs from opening`);
            if (f(l, 'linkCode') !== (next?.recordType === '4' ? '1' : '0'))
                error('Closing link code contradicts following free communication');
        }
        else if (type === '9') {
            if (state !== 'trailer')
                error('Record 9 requires Record 8');
            digits('recordCount', 6);
            digits('sumDebits', 15);
            digits('sumCredits', 15);
            const counted = lines.slice(start + 1, i).filter(l => l.recordType !== '4').length;
            if (Number(f(l, 'recordCount')) !== counted)
                error(`Trailer record count ${f(l, 'recordCount')} differs from ${counted}`);
            if (Number(f(l, 'sumDebits')) !== debits || Number(f(l, 'sumCredits')) !== credits)
                error('Trailer movement totals differ from movements');
            if (f(l, 'lastFile') !== (next ? '1' : '2'))
                error('Multiple-file flag contradicts following file');
            if (opening && closing) {
                const signed = (l: CodaLine) => (f(l, 'balanceSign') === '1' ? -1 : 1) * Number(f(l, 'balanceAmount'));
                if (signed(opening) + credits - debits !== signed(closing))
                    warnings.push(`Line ${i + 1}: Balance mismatch between opening, movements and closing`);
            }
            state = 'header';
        }
        else {
            if (state !== 'entries' && !(type === '4' && state === 'trailer'))
                error('Movement/information record outside statement');
            if (type === '2.1') {
                const detail = Number(f(l, 'detailNumber'));
                if (detail === 0) {
                    currentAggregateSequence = f(l, 'sequenceNumber');
                    lastMonetaryDetail = 0;
                }
                else {
                    if (f(l, 'sequenceNumber') !== currentAggregateSequence || detail <= lastMonetaryDetail)
                        error('Orphan or nonascending monetary detail');
                    lastMonetaryDetail = detail;
                }
                if (f(l, 'detailNumber') === '0000') {
                    if (f(l, 'amountSign') === '1')
                        debits += Number(f(l, 'amount'));
                    else
                        credits += Number(f(l, 'amount'));
                }
            }
            else if (type === '2.2' || type === '2.3') {
                if (!previous || !['2.1', '2.2'].includes(previous.recordType) || f(previous, 'sequenceNumber') !== f(l, 'sequenceNumber') || f(previous, 'detailNumber') !== f(l, 'detailNumber'))
                    error('Orphan or mismatched movement continuation');
            }
            else if (type === '3.1') {
                if (!previous || !/^[23]\./.test(previous.recordType) || f(previous, 'sequenceNumber') !== f(l, 'sequenceNumber'))
                    error('Orphan information record');
            }
            else if (type === '3.2' || type === '3.3') {
                const expected = type === '3.2' ? '3.1' : '3.2';
                if (!previous || previous.recordType !== expected || f(previous, 'sequenceNumber') !== f(l, 'sequenceNumber') || f(previous, 'detailNumber') !== f(l, 'detailNumber'))
                    error('Orphan or mismatched information continuation');
            }
            if (type === '4' && f(l, 'linkCode') !== (next?.recordType === '4' ? '1' : '0'))
                error('Free communication link code contradicts following record');
            if (/^[23]\./.test(type)) {
                const following = type === '2.1' ? ['2.2', '2.3'] : type === '2.2' ? ['2.3'] : type === '3.1' ? ['3.2'] : type === '3.2' ? ['3.3'] : [];
                if (f(l, 'nextCode') !== (next && following.includes(next.recordType) ? '1' : '0'))
                    error('Next code contradicts following record');
                if (f(l, 'linkCode') !== (next?.recordType === '3.1' ? '1' : '0'))
                    error('Link code contradicts following information record');
            }
        }
    }
    if (state !== 'header')
        errors.push('Incomplete logical CODA file');
    return { valid: errors.length === 0, errors, warnings, checks: ['structure', 'business', 'reconciliation'], xsdValidated: false };
}
