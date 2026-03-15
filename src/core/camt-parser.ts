import { XMLParser } from "fast-xml-parser";
import { readFileSync } from "fs";
import type { CamtStatement, CamtEntry, TransactionDetail } from "./model.js";

export type { CamtStatement, CamtEntry, TransactionDetail };

// ── Parser ──────────────────────────────────────────────────────────────

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true, // strips namespace prefixes — key simplification
  isArray: (name) => ["Stmt", "Rpt", "Ntry", "Bal", "TxDtls"].includes(name),
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
  return isNaN(n) ? 0 : n;
}

/** Detect CAMT version from namespace in raw XML */
export function detectVersion(xml: string): string | null {
  const match = xml.match(
    /xmlns="urn:iso:std:iso:20022:tech:xsd:(camt\.\d+\.\d+\.\d+)"/
  );
  return match ? match[1] : null;
}

/** Parse a CAMT XML file into normalized statements */
export function parseCamtFile(filePath: string): CamtStatement[] {
  const xml = readFileSync(filePath, "utf-8");
  return parseCamt(xml);
}

export function parseCamt(xml: string): CamtStatement[] {
  const version = detectVersion(xml);
  if (!version) throw new Error("Could not detect CAMT version from namespace");

  const doc = xmlParser.parse(xml);
  const root = doc.Document;

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
  const grpHdr = bkToCstmr.GrpHdr || {};
  const stmts = bkToCstmr.Stmt || [];

  return stmts.map((stmt: any) => parseStatement(stmt, grpHdr));
}

function parseCamt052(bkToCstmr: any, version: string): CamtStatement[] {
  const grpHdr = bkToCstmr.GrpHdr || {};
  const rpts = bkToCstmr.Rpt || [];

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
    account: parseAccount(acct),
    openingBalance: parseBalance(openBal),
    closingBalance: parseBalance(closeBal),
    entries: (stmt.Ntry || []).map(parseEntry),
    reportDate,
    sequence: num(get(stmt, "LglSeqNb")) || num(get(stmt, "ElctrncSeqNb")) || undefined,
  };
}

function parseReport(rpt: any, grpHdr: any): CamtStatement {
  const acct = rpt.Acct || {};
  const bals = rpt.Bal || [];

  const openBal = bals.find(
    (b: any) => get(b, "Tp.CdOrPrtry.Cd") === "OPAV"
  );
  const closeBal = bals.find(
    (b: any) => get(b, "Tp.CdOrPrtry.Cd") === "INFO"
  );

  const reportDate = str(grpHdr.CreDtTm);

  // For CAMT 052, balance entries (excluding OPAV/INFO) are treated as movements
  const movementBals = bals.filter(
    (b: any) =>
      get(b, "Tp.CdOrPrtry.Cd") !== "OPAV" &&
      get(b, "Tp.CdOrPrtry.Cd") !== "INFO"
  );

  const entries: CamtEntry[] = movementBals.map((b: any) => ({
    amount: num(get(b, "Amt.#text") || b.Amt),
    currency: str(get(b, "Amt.@_Ccy")),
    creditDebit: str(b.CdtDbtInd) as "CRDT" | "DBIT",
    bookingDate: str(get(b, "Dt.Dt")),
    valueDate: str(get(b, "Dt.Dt")),
    transactionCode: undefined,
    details: [],
    batchCount: undefined,
  }));

  return {
    camtVersion: "052",
    messageId: str(grpHdr.MsgId),
    creationDate: str(grpHdr.CreDtTm),
    statementId: str(rpt.Id),
    account: parseAccount(acct),
    openingBalance: parseBalance(openBal),
    closingBalance: parseBalance(closeBal),
    entries,
    reportDate,
  };
}

function parseAccount(acct: any) {
  return {
    iban: str(get(acct, "Id.IBAN")) || undefined,
    otherId: str(get(acct, "Id.Othr.Id")) || undefined,
    currency:
      str(acct.Ccy) || str(get(acct, "Bal.Amt.@_Ccy")) || "EUR",
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
  const amount = typeof amtRaw === "object" ? num(amtRaw["#text"]) : num(amtRaw);
  return {
    amount,
    creditDebit: str(bal.CdtDbtInd) as "CRDT" | "DBIT",
    date: str(get(bal, "Dt.Dt")),
  };
}

function parseEntry(ntry: any): CamtEntry {
  const amtRaw = ntry.Amt;
  const amount = typeof amtRaw === "object" ? num(amtRaw["#text"]) : num(amtRaw);
  const currency = typeof amtRaw === "object" ? str(amtRaw["@_Ccy"]) : "EUR";

  const txCode = ntry.BkTxCd;
  const details = get(ntry, "NtryDtls.TxDtls");
  const detailsArr = Array.isArray(details) ? details : details ? [details] : [];

  return {
    amount,
    currency,
    creditDebit: str(ntry.CdtDbtInd) as "CRDT" | "DBIT",
    bookingDate: str(get(ntry, "BookgDt.Dt")),
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
        }
      : undefined,
    details: detailsArr.map(parseTxDetail),
    batchCount: num(get(ntry, "NtryDtls.Btch.NbOfTxs")) || undefined,
  };
}

function parseTxDetail(tx: any): TransactionDetail {
  const refs = tx.Refs;
  const cdtr = tx.RltdPties?.Cdtr;
  const dbtr = tx.RltdPties?.Dbtr;
  const cdtrAcct = get(tx, "RltdPties.CdtrAcct.Id.IBAN");
  const dbtrAcct = get(tx, "RltdPties.DbtrAcct.Id.IBAN");
  const cdtrBic = get(tx, "RltdAgts.CdtrAgt.FinInstnId.BIC") || get(tx, "RltdAgts.CdtrAgt.FinInstnId.BICFI");
  const dbtrBic = get(tx, "RltdAgts.DbtrAgt.FinInstnId.BIC") || get(tx, "RltdAgts.DbtrAgt.FinInstnId.BICFI");

  return {
    refs: refs
      ? {
          endToEndId: str(refs.EndToEndId) || undefined,
          txId: str(refs.TxId) || undefined,
          instrId: str(refs.InstrId) || undefined,
        }
      : undefined,
    counterparty: {
      name: str(cdtr?.Nm || dbtr?.Nm) || undefined,
      iban: str(cdtrAcct || dbtrAcct) || undefined,
      bic: str(cdtrBic || dbtrBic) || undefined,
    },
    remittanceInfo: {
      unstructured: str(get(tx, "RmtInf.Ustrd")) || undefined,
      structured: get(tx, "RmtInf.Strd.CdtrRefInf.Ref")
        ? { creditorRef: str(get(tx, "RmtInf.Strd.CdtrRefInf.Ref")) }
        : undefined,
    },
  };
}
