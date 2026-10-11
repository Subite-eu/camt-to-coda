// Version adapters follow the bundled camt.053.001.02–13 XSD sequences.
import type { CamtStatement, CamtEntry, Balance, TransactionDetail } from './model.js';
import { isValidOgmVcs } from './ogm-vcs.js';
import { toMillis } from './money.js';
const DEFAULT_VERSION = 'camt.053.001.08';
function esc(s: string): string { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function tag(n: string, v: string): string { return `<${n}>${esc(v)}</${n}>`; }
function bicTag(bic: string, v: number, location: 'account' | 'counterparty'): string {
    // specifications/CAMT/camt.053.001.02–07.xsd: BICIdentifier/BICFIIdentifier;
    // .08–13.xsd: BICFIDec2014Identifier permits bank digits and 0/1/O locations.
    const pattern = v < 8 ? /^[A-Z]{6}[A-Z2-9][A-NP-Z0-9](?:[A-Z0-9]{3})?$/ : /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;
    if ((bic.length !== 8 && bic.length !== 11) || !pattern.test(bic))
        throw new Error(`Invalid CAMT ${location} BIC ${JSON.stringify(bic)} for camt.053.001.${String(v).padStart(2, '0')}`);
    return tag(v === 2 ? 'BIC' : 'BICFI', bic);
}
function amt(a: number, c: string): string {
    if (!Number.isFinite(a) || a < 0)
        throw new Error('Invalid CAMT amount');
    const m = toMillis(a);
    if (m / 1000 !== a) throw new Error("Invalid amount precision: CODA supports at most three decimals");
    return `<Amt Ccy="${esc(c)}">${Math.floor(m / 1000)}.${String(m % 1000).padStart(3, '0')}</Amt>`;
}
// CODA carries a calendar date only. Midnight is an explicit deterministic
// serialization policy, not a claim that a source timestamp was preserved.
function timestamp(s: string): string { return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00Z' : s; }
function dateChoice(n: string, d: string): string { return `<${n}>${tag(d.includes('T') ? 'DtTm' : 'Dt', d)}</${n}>`; }
function balance(b: Balance, t: string, c: string): string { return `<Bal><Tp><CdOrPrtry>${tag('Cd', t)}</CdOrPrtry></Tp>${amt(b.amount, b.currency ?? c)}${tag('CdtDbtInd', b.creditDebit)}${dateChoice('Dt', b.date)}</Bal>`; }
function tx(d: TransactionDetail, e: CamtEntry, v: number, reason?: string): string {
    let x = '<TxDtls>';
    if (d.refs && Object.values(d.refs).some(Boolean))
        x += '<Refs>' + (['accountServicerRef', 'instrId', 'endToEndId', 'txId'] as const).map((k, i) => d.refs?.[k] ? tag(['AcctSvcrRef', 'InstrId', 'EndToEndId', 'TxId'][i], d.refs[k]!) : '').join('') + '</Refs>';
    // v03–06 require detail amount and direction; for a sole detail the entry
    // amount is exact. Multiple details must supply their own amounts.
    if (v === 2 && d.amount !== undefined) {
        if (d.creditDebit && d.creditDebit !== e.creditDebit) throw new Error('CAMT v02 cannot represent an independent transaction detail direction');
        x += '<AmtDtls><TxAmt>' + amt(d.amount, d.currency ?? e.currency) + '</TxAmt></AmtDtls>';
    } else if (d.amount !== undefined || (v >= 3 && v <= 6)) {
        if (d.amount === undefined && e.details.length > 1)
            throw new Error('CAMT v03–06 requires an amount for each transaction detail');
        x += amt(d.amount ?? e.amount, d.currency ?? e.currency) + tag('CdtDbtInd', d.creditDebit ?? e.creditDebit);
    }
    if (d.transactionCode) {
        const c = d.transactionCode;
        x += '<BkTxCd>';
        if (c.domain && c.family && c.subFamily)
            x += '<Domn>' + tag('Cd', c.domain) + '<Fmly>' + tag('Cd', c.family) + tag('SubFmlyCd', c.subFamily) + '</Fmly></Domn>';
        if (c.proprietary)
            x += '<Prtry>' + tag('Cd', c.proprietary) + (c.proprietaryIssuer ? tag('Issr', c.proprietaryIssuer) : '') + '</Prtry>';
        x += '</BkTxCd>';
    }
    reason = d.returnInfo?.reasonCode ?? reason;
    const cp = d.counterparty, party = (d.creditDebit ?? e.creditDebit) === 'CRDT' ? 'Dbtr' : 'Cdtr';
    if (cp?.name || cp?.iban || cp?.otherId) {
        x += '<RltdPties>';
        if (cp.name)
            x += `<${party}>` + (v >= 7 ? '<Pty>' : '') + tag('Nm', cp.name) + (v >= 7 ? '</Pty>' : '') + `</${party}>`;
        if (cp.iban || cp.otherId)
            x += `<${party}Acct><Id>` + (cp.iban ? tag('IBAN', cp.iban) : '<Othr>' + tag('Id', cp.otherId!) + '</Othr>') + `</Id></${party}Acct>`;
        x += '</RltdPties>';
    }
    if (cp?.bic !== undefined)
        x += `<RltdAgts><${party}Agt><FinInstnId>${bicTag(cp.bic, v, 'counterparty')}</FinInstnId></${party}Agt></RltdAgts>`;
    if (d.categoryPurpose && v >= 10)
        x += '<PmtTpInf><CtgyPurp>' + tag('Cd', d.categoryPurpose) + '</CtgyPurp></PmtTpInf>';
    if (d.purpose)
        x += '<Purp>' + tag('Cd', d.purpose) + '</Purp>';
    const ri = d.remittanceInfo;
    if (ri?.unstructured || ri?.structured?.creditorRef) {
        x += '<RmtInf>';
        if (ri.unstructured)
            for (let i = 0; i < ri.unstructured.length; i += 140)
                x += tag('Ustrd', ri.unstructured.slice(i, i + 140));
        const ref = ri.structured?.creditorRef;
        if (ref)
            x += '<Strd><CdtrRefInf><Tp><CdOrPrtry>' + tag('Cd', ri.structured?.type ?? 'SCOR') + '</CdOrPrtry>' + (ri.structured?.issuer ? tag('Issr', ri.structured.issuer) : isValidOgmVcs(ref) ? tag('Issr', 'BBA') : '') + '</Tp>' + tag('Ref', ref) + '</CdtrRefInf></Strd>';
        x += '</RmtInf>';
    }
    if (reason)
        x += '<RtrInf><Rsn>' + tag('Cd', reason) + '</Rsn></RtrInf>';
    return x + '</TxDtls>';
}
function entry(e: CamtEntry, v: number): string {
    let x = '<Ntry>' + (e.entryRef ? tag('NtryRef', e.entryRef) : '') + amt(e.amount, e.currency) + tag('CdtDbtInd', e.creditDebit);
    if (e.returnInfo?.isReversal)
        x += tag('RvslInd', 'true');
    // CODA represents booked movements. Sts is mandatory in every supported XSD.
    x += v >= 7 ? '<Sts><Cd>BOOK</Cd></Sts>' : tag('Sts', 'BOOK');
    if (e.bookingDate)
        x += dateChoice('BookgDt', e.bookingDate);
    if (e.valueDate)
        x += dateChoice('ValDt', e.valueDate);
    if (e.accountServicerRef)
        x += tag('AcctSvcrRef', e.accountServicerRef);
    const c = e.transactionCode;
    x += '<BkTxCd>';
    if (c?.domain && c.family && c.subFamily)
        x += '<Domn>' + tag('Cd', c.domain) + '<Fmly>' + tag('Cd', c.family) + tag('SubFmlyCd', c.subFamily) + '</Fmly></Domn>';
    if (c?.proprietary)
        x += '<Prtry>' + tag('Cd', c.proprietary) + (c.proprietaryIssuer ? tag('Issr', c.proprietaryIssuer) : '') + '</Prtry>';
    x += '</BkTxCd>';
    let ds: TransactionDetail[] = e.details.length ? e.details : e.returnInfo?.reasonCode ? [{}] : [];
    // An aggregate reason must not be assigned to an independently valued
    // transaction. Keep it in a separate amountless summary detail.
    if (e.returnInfo?.reasonCode && ds[0]?.amount !== undefined) ds = [{}, ...ds];
    if (ds.length)
        x += '<NtryDtls>' + ds.map((d, i) => tx(d, e, v, i === 0 ? e.returnInfo?.reasonCode : undefined)).join('') + '</NtryDtls>';
    return x + '</Ntry>';
}
function statement(s: CamtStatement, v: number): string {
    const a = s.account;
    if (!a.iban && !a.otherId)
        throw new Error('No account identifier');
    let x = '<Stmt>' + tag('Id', s.statementId) + (s.sequence !== undefined ? tag('ElctrncSeqNb', String(s.sequence)) : '') + tag('CreDtTm', timestamp(s.creationDate));
    x += '<Acct><Id>' + (a.iban ? tag('IBAN', a.iban) : '<Othr>' + tag('Id', a.otherId!) + '</Othr>') + '</Id>' + tag('Ccy', a.currency);
    if (a.ownerName)
        x += '<Ownr>' + tag('Nm', a.ownerName) + '</Ownr>';
    if (a.bic !== undefined)
        x += '<Svcr><FinInstnId>' + bicTag(a.bic, v, 'account') + '</FinInstnId></Svcr>';
    return x + '</Acct>' + balance(s.openingBalance, 'OPBD', a.currency) + balance(s.closingBalance, 'CLBD', a.currency) + s.entries.map(e => entry(e, v)).join('') + (s.freeCommunications?.length ? tag('AddtlStmtInf', s.freeCommunications.join('\n')) : '') + '</Stmt>';
}
export function statementsToXml(statements: CamtStatement[], version = DEFAULT_VERSION): string {
    if (!/^camt\.053\.001\.(0[2-9]|1[0-3])$/.test(version))
        throw new Error(`Unsupported CAMT output version: ${version}`);
    if (!statements.length)
        throw new Error('No statements to serialize');
    const v = Number(version.slice(-2)), s = statements[0];
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + `<Document xmlns="urn:iso:std:iso:20022:tech:xsd:${version}"><BkToCstmrStmt><GrpHdr>` + tag('MsgId', s.messageId) + tag('CreDtTm', timestamp(s.creationDate)) + '</GrpHdr>' + statements.map(s => statement(s, v)).join('') + '</BkToCstmrStmt></Document>';
}
export function statementToXml(stmt: CamtStatement, version?: string): string { return statementsToXml([stmt], version); }
