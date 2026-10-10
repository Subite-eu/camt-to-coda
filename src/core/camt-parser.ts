import { XMLParser, XMLValidator } from "fast-xml-parser";
import { readFileSync } from "fs";
import type { CamtStatement, CamtEntry, TransactionDetail } from "./model.js";

export type { CamtStatement };

// ── Parser ──────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: false,
  removeNSPrefix: true, // strips namespace prefixes — key simplification
  isArray: (name) => ["Stmt", "Rpt", "Ntry", "Bal", "TxDtls", "NtryDtls", "Strd", "Ustrd"].includes(name),
  parseTagValue: false,
  numberParseOptions: { leadingZeros: false, hex: false },
});

/** Safely navigate nested objects */
function get(obj: any, path: string): any {
  return path.split(".").reduce((o, k) => o?.[k], obj);
}

/** Force value to string */
function str(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

/** Force value to number */
function num(v: any): number {
  if (v === undefined || v === null) return 0;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid amount/number: ${v}`);
  return n;
}

/** ISO decimal lexical form; no scientific notation or silent zero defaults. */
function amount(v: any): number {
  const raw = typeof v === "object" ? v?.["#text"] : v;
  if (!/^\d+(?:\.\d+)?$/.test(String(raw ?? ""))) throw new Error(`Invalid amount: ${raw}`);
  return num(raw);
}

/** Detect CAMT version from namespace in raw XML */
export function detectVersion(xml: string): string | null {
  const root = xml.match(/<(?:([\w.-]+):)?Document\b([^>]*)>/);
  if (!root) return null;
  const attribute = root[1] ? `xmlns:${root[1]}` : "xmlns";
  const namespace = root[2].match(new RegExp(`(?:^|\\s)${attribute}\\s*=\\s*['"]urn:iso:std:iso:20022:tech:xsd:(camt\\.\\d+\\.\\d+\\.\\d+)['"]`));
  return namespace?.[1] ?? null;
}

/** Parse a CAMT XML file into normalized statements */
export function parseCamtFile(filePath: string): CamtStatement[] {
  const xml = readFileSync(filePath, "utf-8");
  return parseCamt(xml);
}

export function parseCamt(xml: string): CamtStatement[] {
  const syntax = XMLValidator.validate(xml);
  if (syntax !== true) throw new Error(`Invalid XML syntax: ${syntax.err.msg}`);
  const version = detectVersion(xml);
  if (!version) throw new Error("Could not detect CAMT version from namespace");

  if (!/^camt\.05[23]\.001\.(0[2-9]|1[0-3])$/.test(version)) throw new Error(`Unsupported CAMT version: ${version}`);
  const doc = xmlParser.parse(xml);
  const root = doc.Document;
  if (!root) throw new Error("Missing CAMT Document");

  if (version.startsWith("camt.053")) {
    return parseCamt053(root.BkToCstmrStmt, version);
  } else if (version.startsWith("camt.052")) {
    return parseCamt052(root.BkToCstmrAcctRpt, version);
  } else {
    throw new Error(`Unsupported CAMT version: ${version}`);
  }
}

// ── CAMT 053 (End-of-day statement) ─────────────────────────────────────

function parseCamt053(bkToCstmr: any, version: string): CamtStatement[] {
  if (!bkToCstmr) throw new Error("Missing CAMT message body");
  const grpHdr = bkToCstmr.GrpHdr || {};
  const stmts = bkToCstmr.Stmt || [];

  if (!stmts.length) throw new Error("CAMT contains no statements");
  return stmts.map((stmt: any) => parseStatement(stmt, grpHdr));
}

function parseCamt052(bkToCstmr: any, version: string): CamtStatement[] {
  if (!bkToCstmr) throw new Error("Missing CAMT message body");
  const grpHdr = bkToCstmr.GrpHdr || {};
  const rpts = bkToCstmr.Rpt || [];

  if (!rpts.length) throw new Error("CAMT contains no reports");
  return rpts.map((rpt: any) => parseReport(rpt, grpHdr));
}

function parseStatement(stmt: any, grpHdr: any): CamtStatement {
  const acct = stmt.Acct || {};
  const bals = stmt.Bal || [];

  const openBal = bals.find(
    (b: any) => get(b, "Tp.CdOrPrtry.Cd") === "OPBD"
  ) || bals.find(
    (b: any) => get(b, "Tp.CdOrPrtry.Cd") === "PRCD"
  );

  const closeBal = bals.find(
    (b: any) => get(b, "Tp.CdOrPrtry.Cd") === "CLBD"
  );

  const reportDate =
    str(get(stmt, "FrToDt.ToDtTm")) ||
    str(stmt.CreDtTm) ||
    str(grpHdr.CreDtTm);

  return {
    camtVersion: "053",
    messageId: str(grpHdr.MsgId),
    creationDate: str(grpHdr.CreDtTm),
    statementId: str(stmt.Id),
    account: parseAccount(acct, bals),
    openingBalance: parseBalance(openBal),
    closingBalance: parseBalance(closeBal),
    entries: (stmt.Ntry || []).map(parseEntry),
    reportDate,
    freeCommunications: stmt.AddtlStmtInf ? [str(stmt.AddtlStmtInf)] : undefined,
    sequence: num(get(stmt, "ElctrncSeqNb")) || num(get(stmt, "LglSeqNb")) || undefined,
  };
}

function parseReport(rpt: any, grpHdr: any): CamtStatement {
  const acct = rpt.Acct || {};
  const bals = rpt.Bal || [];

  const openBal = bals.find(
    (b: any) => ["OPAV", "OPBD", "PRCD"].includes(get(b, "Tp.CdOrPrtry.Cd"))
  );
  const closeBal = bals.find(
    (b: any) => ["CLAV", "CLBD", "ITAV", "INFO"].includes(get(b, "Tp.CdOrPrtry.Cd"))
  );

  const reportDate = str(grpHdr.CreDtTm);

  const entries: CamtEntry[] = (rpt.Ntry || []).map(parseEntry);

  return {
    camtVersion: "052",
    messageId: str(grpHdr.MsgId),
    creationDate: str(grpHdr.CreDtTm),
    statementId: str(rpt.Id),
    account: parseAccount(acct, bals),
    openingBalance: parseBalance(openBal),
    closingBalance: parseBalance(closeBal),
    entries,
    reportDate,
  };
}

function parseAccount(acct: any, balances: any[] = []) {
  return {
    iban: str(get(acct, "Id.IBAN")) || undefined,
    otherId: str(get(acct, "Id.Othr.Id")) || undefined,
    currency:
      str(acct.Ccy) || str(get(balances[0], "Amt.@_Ccy")),
    ownerName: str(get(acct, "Ownr.Nm")) || undefined,
    bic:
      str(get(acct, "Ownr.Id.OrgId.AnyBIC")) ||
      str(get(acct, "Svcr.FinInstnId.BIC")) ||
      str(get(acct, "Svcr.FinInstnId.BICFI")) ||
      undefined,
  };
}

function parseBalance(bal: any) {
  if (!bal) return { amount: 0, creditDebit: "CRDT" as const, date: "" };
  const amtRaw = bal.Amt;
  const parsedAmount = amount(amtRaw);
  return {
    amount: parsedAmount,
    currency: str(get(bal, "Amt.@_Ccy")),
    creditDebit: str(bal.CdtDbtInd) as "CRDT" | "DBIT",
    date: str(get(bal, "Dt.Dt") || get(bal, "Dt.DtTm")),
  };
}

function parseEntry(ntry: any): CamtEntry {
  const amtRaw = ntry.Amt;
  const parsedAmount = amount(amtRaw);
  const currency = typeof amtRaw === "object" ? str(amtRaw["@_Ccy"]) : "";

  const txCode = ntry.BkTxCd;
  const blocks = ntry.NtryDtls || [];
  const detailsArr = blocks.flatMap((block: any) => block.TxDtls || []);

  // SDD R-transaction info (EPC173-14): reversal flag + ISO reason code.
  const rvsl = str(ntry.RvslInd);
  const isReversal = rvsl === "true" || rvsl === "1" ? true : undefined;
  const firstDetail = detailsArr[0];
  const firstAmount = firstDetail?.Amt ?? get(firstDetail, "AmtDtls.TxAmt.Amt");
  const firstReasonAppliesToEntry = firstDetail && (firstAmount === undefined ||
    (detailsArr.length === 1 && amount(firstAmount) === parsedAmount &&
      (!firstDetail.CdtDbtInd || firstDetail.CdtDbtInd === ntry.CdtDbtInd)));
  const reasonCode =
    str(get(ntry, "RtrInf.Rsn.Cd")) ||
    (firstReasonAppliesToEntry ? str(get(firstDetail, "RtrInf.Rsn.Cd")) : "") ||
    undefined;
  const returnInfo =
    reasonCode || isReversal ? { reasonCode, isReversal } : undefined;

  return {
    amount: parsedAmount,
    currency,
    creditDebit: str(ntry.CdtDbtInd) as "CRDT" | "DBIT",
    bookingDate: str(get(ntry, "BookgDt.Dt") || get(ntry, "BookgDt.DtTm")),
    valueDate:
      str(get(ntry, "ValDt.Dt")) || str(get(ntry, "ValDt.DtTm")) || undefined,
    entryRef: str(ntry.NtryRef) || undefined,
    accountServicerRef: str(ntry.AcctSvcrRef) || undefined,
    transactionCode: txCode
      ? {
          domain: str(get(txCode, "Domn.Cd")) || undefined,
          family: str(get(txCode, "Domn.Fmly.Cd")) || undefined,
          subFamily: str(get(txCode, "Domn.Fmly.SubFmlyCd")) || undefined,
          proprietary: str(get(txCode, "Prtry.Cd")) || undefined,
          proprietaryIssuer: str(get(txCode, "Prtry.Issr")) || undefined,
        }
      : undefined,
    details: detailsArr.map((d: any) => parseTxDetail(d, str(ntry.CdtDbtInd) as "CRDT" | "DBIT")),
    batchCount: num(blocks.reduce((n: number, block: any) => n + num(get(block, "Btch.NbOfTxs")), 0)) || undefined,
    returnInfo,
  };
}

function parseTxDetail(tx: any, direction: "CRDT" | "DBIT"): TransactionDetail {
  direction = tx.CdtDbtInd || direction;
  const refs = tx.Refs;
  const detailAmount = tx.Amt ?? get(tx, "AmtDtls.TxAmt.Amt");
  const cdtr = tx.RltdPties?.Cdtr?.Pty || tx.RltdPties?.Cdtr;
  const dbtr = tx.RltdPties?.Dbtr?.Pty || tx.RltdPties?.Dbtr;
  const cdtrAcct = get(tx, "RltdPties.CdtrAcct.Id.IBAN");
  const dbtrAcct = get(tx, "RltdPties.DbtrAcct.Id.IBAN");
  const otherAcct = direction === "DBIT"
    ? get(tx, "RltdPties.CdtrAcct.Id.Othr.Id") || get(tx, "RltdPties.DbtrAcct.Id.Othr.Id")
    : get(tx, "RltdPties.DbtrAcct.Id.Othr.Id") || get(tx, "RltdPties.CdtrAcct.Id.Othr.Id");
  const cdtrBic = get(tx, "RltdAgts.CdtrAgt.FinInstnId.BIC") || get(tx, "RltdAgts.CdtrAgt.FinInstnId.BICFI");
  const dbtrBic = get(tx, "RltdAgts.DbtrAgt.FinInstnId.BIC") || get(tx, "RltdAgts.DbtrAgt.FinInstnId.BICFI");

  // Counterparty depends on direction:
  // DBIT (money left our account) → counterparty is Creditor (receiver)
  // CRDT (money came in) → counterparty is Debtor (sender)
  const counterpartyName = direction === "DBIT"
    ? str(cdtr?.Nm || dbtr?.Nm)
    : str(dbtr?.Nm || cdtr?.Nm);
  const counterpartyIban = direction === "DBIT"
    ? str(cdtrAcct || dbtrAcct)
    : str(dbtrAcct || cdtrAcct);
  const counterpartyBic = direction === "DBIT"
    ? str(cdtrBic || dbtrBic)
    : str(dbtrBic || cdtrBic);

  return {
    transactionCode: tx.BkTxCd ? {
      domain: str(get(tx, "BkTxCd.Domn.Cd")) || undefined,
      family: str(get(tx, "BkTxCd.Domn.Fmly.Cd")) || undefined,
      subFamily: str(get(tx, "BkTxCd.Domn.Fmly.SubFmlyCd")) || undefined,
      proprietary: str(get(tx, "BkTxCd.Prtry.Cd")) || undefined,
      proprietaryIssuer: str(get(tx, "BkTxCd.Prtry.Issr")) || undefined,
    } : undefined,
    returnInfo: get(tx, "RtrInf.Rsn.Cd") ? { reasonCode: str(get(tx, "RtrInf.Rsn.Cd")) } : undefined,
    amount: detailAmount === undefined ? undefined : amount(detailAmount),
    currency: get(tx, "Amt.@_Ccy") || get(tx, "AmtDtls.TxAmt.Amt.@_Ccy") || undefined,
    creditDebit: tx.CdtDbtInd || (get(tx, "AmtDtls.TxAmt.Amt") !== undefined ? direction : undefined),
    refs: refs
      ? {
          accountServicerRef: str(refs.AcctSvcrRef) || undefined,
          endToEndId: str(refs.EndToEndId) || undefined,
          txId: str(refs.TxId) || undefined,
          instrId: str(refs.InstrId) || undefined,
        }
      : undefined,
    counterparty: {
      name: counterpartyName || undefined,
      iban: counterpartyIban || undefined,
      otherId: str(otherAcct) || undefined,
      bic: counterpartyBic || undefined,
    },
    remittanceInfo: {
      unstructured: (() => {
        const ustrd = get(tx, "RmtInf.Ustrd");
        if (Array.isArray(ustrd)) return ustrd.map(String).join("") || undefined;
        return str(ustrd) || undefined;
      })(),
      structured: get(tx, "RmtInf.Strd.0.CdtrRefInf.Ref")
        ? { creditorRef: str(get(tx, "RmtInf.Strd.0.CdtrRefInf.Ref")), type: str(get(tx, "RmtInf.Strd.0.CdtrRefInf.Tp.CdOrPrtry.Cd")) || undefined, issuer: str(get(tx, "RmtInf.Strd.0.CdtrRefInf.Tp.Issr")) || undefined }
        : undefined,
    },
    purpose: str(get(tx, "Purp.Cd")) || undefined,
    categoryPurpose:
      str(get(tx, "PmtTpInf.CtgyPurp.Cd")) || str(get(tx, "CtgyPurp.Cd")) || undefined,
  };
}
