import type { CamtStatement } from '../core/model.js';
import type { ValidationResult } from './result.js';
export function validDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(value ?? ''))
        return false;
    const date = value.slice(0, 10), parsed = new Date(date + 'T00:00:00Z');
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date && (!value.includes('T') || Number.isFinite(Date.parse(value)));
}
export function validateCamt(stmt: CamtStatement): ValidationResult {
    const errors: string[] = [], warnings: string[] = [];
    if (!stmt.account.iban && !stmt.account.otherId)
        errors.push('No account identifier');
    if (stmt.account.iban && !/^[A-Z]{2}[0-9]{2}[a-zA-Z0-9]{1,30}$/.test(stmt.account.iban))
        errors.push('Invalid IBAN syntax');
    if (stmt.account.bic && !/^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(stmt.account.bic))
        errors.push('Invalid BIC syntax');
    if (!stmt.account.currency)
        errors.push('No currency');
    else if (!/^[A-Z]{3}$/.test(stmt.account.currency))
        errors.push('Invalid account currency');
    for (const [key, value] of [['messageId', stmt.messageId], ['statementId', stmt.statementId]] as const)
        if (!value || value.length > 35)
            errors.push(`Invalid ${key}: requires 1–35 characters`);
    if (!validDate(stmt.creationDate))
        errors.push('Invalid creation date');
    if (!validDate(stmt.reportDate))
        errors.push('Invalid report date');
    if (!stmt.account.bic && stmt.camtVersion === '053')
        warnings.push('No BIC found');
    const values = [['opening balance', stmt.openingBalance], ['closing balance', stmt.closingBalance], ...stmt.entries.map((e, i) => [`entry ${i + 1}`, e] as const)] as const;
    for (const [name, value] of values) {
        if (!Number.isFinite(value.amount) || value.amount < 0 || value.amount >= 1e12)
            errors.push(`Invalid ${name} amount: requires a finite unsigned CODA amount below 10^12`);
        else if (Math.abs(value.amount * 1000 - Math.round(value.amount * 1000)) > 0.001)
            errors.push(`Invalid ${name} amount: CODA supports at most three decimals`);
        if (!['CRDT', 'DBIT'].includes(value.creditDebit))
            errors.push(`Invalid ${name} credit/debit indicator`);
    }
    for (const [name, b] of [['opening', stmt.openingBalance], ['closing', stmt.closingBalance]] as const) {
        if (!b.date)
            warnings.push(`No ${name} balance date`);
        if (b.currency !== undefined && b.currency !== stmt.account.currency)
            errors.push(`Invalid ${name} balance currency: differs from account`);
        if (!validDate(b.date))
            errors.push(`Invalid ${name} balance date`);
    }
    stmt.entries.forEach((e, i) => {
        if (!/^[A-Z]{3}$/.test(e.currency))
            errors.push(`Entry ${i + 1}: invalid currency`);
        if (e.currency !== stmt.account.currency)
            errors.push(`Entry ${i + 1}: currency differs from account; CODA cannot represent a movement in another currency`);
        e.details.forEach((d, j) => {
            if (d.amount !== undefined && (!Number.isFinite(d.amount) || d.amount < 0 || d.amount >= 1e12))
                errors.push(`Entry ${i + 1} detail ${j + 1}: invalid amount`);
            else if (d.amount !== undefined && Math.abs(d.amount * 1000 - Math.round(d.amount * 1000)) > 0.001)
                errors.push(`Entry ${i + 1} detail ${j + 1}: CODA supports at most three decimals`);
            if (d.creditDebit !== undefined && !['CRDT', 'DBIT'].includes(d.creditDebit))
                errors.push(`Entry ${i + 1} detail ${j + 1}: invalid direction`);
            if (d.currency !== undefined && d.currency !== e.currency)
                errors.push(`Entry ${i + 1} detail ${j + 1}: currency differs from aggregate movement`);
        });
        for (const d of [e.bookingDate, e.valueDate])
            if (d && !validDate(d))
                errors.push(`Entry ${i + 1}: invalid date`);
    });
    return { valid: errors.length === 0, errors, warnings, checks: ['structure', 'business'], xsdValidated: false };
}
