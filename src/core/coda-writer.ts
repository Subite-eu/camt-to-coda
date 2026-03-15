import type { CamtStatement, CamtEntry, CamtTransactionDetail } from "./camt-parser.js";
import { mapTransactionCode } from "./transaction-codes.js";

// ── Formatting helpers ──────────────────────────────────────────────────

export function padRight(s: string, len: number, char = " "): string {
  return s.slice(0, len).padEnd(len, char);
}

export function padLeft(s: string, len: number, char = " "): string {
  return s.slice(0, len).padStart(len, char);
}

export function formatBalance(amount: number): string {
  const abs = Math.abs(amount);
  const [integer, decimals = "0"] = abs.toFixed(3).split(".");
  return padLeft(integer, 12, "0") + padRight(decimals, 3, "0");
}

export function formatDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 10) return "000000";
  const d = dateStr.slice(8, 10);
  const m = dateStr.slice(5, 7);
  const y = dateStr.slice(2, 4);
  return d + m + y;
}

function signCode(amount: number): string {
  return amount >= 0 ? "1" : "0";
}

function movementSign(creditDebit: "CRDT" | "DBIT"): string {
  return creditDebit === "CRDT" ? "0" : "1";
}

function accountStructure(account: string): string {
  if (account.startsWith("BE")) return "2";
  if (/^[A-Z]{2}/.test(account)) return "3";
  return "0";
}

function signedAmount(amount: number, creditDebit: "CRDT" | "DBIT"): number {
  return creditDebit === "CRDT" ? amount : -amount;
}

// ── Record builders (each returns exactly 128 chars) ────────────────────

function record0(stmt: CamtStatement): string {
  const date = formatDate(stmt.reportDate);
  const bic = stmt.account.bic || "";
  return [
    "0",                      // 1     record id
    "0000",                   // 2-5   zeros
    date,                     // 6-11  creation date
    "000",                    // 12-14 bank id
    "05",                     // 15-16 application code
    " ",                      // 17    duplicate indicator
    padRight("", 7),          // 18-24 blanks
    padRight("", 10),         // 25-34 file reference
    padRight("", 26),         // 35-60 addressee name
    padRight(bic, 11),        // 61-71 BIC
    padRight("", 11),         // 72-82 company number
    " ",                      // 83    blank
    padLeft("", 5, "0"),      // 84-88 separate application
    padRight("", 16),         // 89-104 transaction ref
    padRight("", 16),         // 105-120 related ref
    padRight("", 7),          // 121-127 blanks
    "2",                      // 128   version code
  ].join("");
}

function record1(stmt: CamtStatement, sequence: string): string {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const bal = stmt.openingBalance;
  return [
    "1",                                          // 1     record id
    accountStructure(acctNum),                    // 2     account structure
    sequence,                                     // 3-5   sequence
    padRight(acctNum, 34),                        // 6-39  account number
    padRight(stmt.account.currency, 3),           // 40-42 currency
    signCode(signedAmount(bal.amount, bal.creditDebit)), // 43 sign
    formatBalance(bal.amount),                    // 44-58 balance
    formatDate(bal.date),                         // 59-64 balance date
    padRight(stmt.account.ownerName || "", 26),   // 65-90 holder name
    padRight("", 35),                             // 91-125 description
    sequence,                                     // 126-128 sequence
  ].join("");
}

function record21(
  entry: CamtEntry,
  seqNum: string,
  comm: string,
  commType: string,
  txCode: string,
  entryDate: string,
  hasMore: boolean
): string {
  const valueDate = entry.valueDate
    ? formatDate(entry.valueDate)
    : entry.bookingDate
    ? formatDate(entry.bookingDate)
    : "000000";

  const refs = entry.details
    .flatMap((d) =>
      [d.refs?.endToEndId, d.refs?.txId, d.refs?.instrId].filter(
        (r) => r && r !== "NOTPROVIDED"
      )
    )
    .join("/");

  return [
    "2",                                  // 1     record id
    "1",                                  // 2     article code
    seqNum,                               // 3-6   sequence number
    "0000",                               // 7-10  detail number
    padRight(refs || entry.entryRef || "", 21), // 11-31 bank ref
    movementSign(entry.creditDebit),      // 32    movement sign
    formatBalance(entry.amount),          // 33-47 amount
    valueDate,                            // 48-53 value date
    padRight(txCode, 8),                  // 54-61 transaction code
    commType,                             // 62    comm type
    padRight(comm.slice(0, 53), 53),      // 63-115 communication
    entryDate,                            // 116-121 entry date
    "000",                                // 122-124 sequence
    "1",                                  // 125   globalisation code
    hasMore ? "1" : "0",                  // 126   next code
    " ",                                  // 127   blank
    "0",                                  // 128   link code
  ].join("");
}

function record22(
  seqNum: string,
  comm: string,
  counterpartBic: string,
  hasMore: boolean
): string {
  return [
    "2",                                  // 1     record id
    "2",                                  // 2     article code
    seqNum,                               // 3-6   sequence
    "0000",                               // 7-10  detail number
    padRight(comm, 53),                   // 11-63 communication ctd
    padRight("", 35),                     // 64-98 customer ref
    padRight(counterpartBic, 11),         // 99-109 BIC
    padRight("", 3),                      // 110-112 blanks
    " ",                                  // 113   R-transaction type
    padRight("", 4),                      // 114-117 ISO reason
    padRight("", 4),                      // 118-121 category purpose
    padRight("", 4),                      // 122-125 purpose
    hasMore ? "1" : "0",                  // 126   next code
    " ",                                  // 127   blank
    "0",                                  // 128   link code
  ].join("");
}

function record23(
  seqNum: string,
  comm: string,
  counterpartIban: string,
  currency: string,
  counterpartName: string
): string {
  return [
    "2",                                  // 1     record id
    "3",                                  // 2     article code
    seqNum,                               // 3-6   sequence
    "0000",                               // 7-10  detail number
    padRight(counterpartIban, 34),        // 11-44 counterparty account
    padRight(currency, 3),                // 45-47 currency
    padRight(counterpartName, 35),        // 48-82 counterparty name
    padRight(comm, 43),                   // 83-125 communication ctd
    "0",                                  // 126   next code
    " ",                                  // 127   blank
    "0",                                  // 128   link code
  ].join("");
}

function record8(stmt: CamtStatement, sequence: string): string {
  const acctNum = stmt.account.iban || stmt.account.otherId || "";
  const bal = stmt.closingBalance;
  return [
    "8",                                          // 1     record id
    sequence,                                     // 2-4   sequence
    padRight(acctNum, 34),                        // 5-38  account number
    padRight(stmt.account.currency, 3),           // 39-41 currency
    signCode(signedAmount(bal.amount, bal.creditDebit)), // 42 sign
    formatBalance(bal.amount),                    // 43-57 balance
    formatDate(bal.date),                         // 58-63 balance date
    padRight("", 64),                             // 64-127 blanks
    "0",                                          // 128   link code
  ].join("");
}

function record9(
  recordCount: number,
  sumDebits: number,
  sumCredits: number
): string {
  return [
    "9",                                  // 1     record id
    padRight("", 15),                     // 2-16  blanks
    padLeft(String(recordCount), 6, "0"), // 17-22 record count
    formatBalance(sumDebits),             // 23-37 sum debits
    formatBalance(sumCredits),            // 38-52 sum credits
    padRight("", 75),                     // 53-127 blanks
    "2",                                  // 128   last file
  ].join("");
}

// ── Main conversion ─────────────────────────────────────────────────────

export interface ConversionResult {
  fileName: string;
  lines: string[];
  recordCount: number;
  validation: { valid: boolean; errors: string[] };
}

export function statementToCoda(stmt: CamtStatement): ConversionResult {
  const lines: string[] = [];
  const errors: string[] = [];

  // Compute sequence (simplified: use statement sequence or "001")
  const sequence = stmt.sequence
    ? padLeft(String(stmt.sequence % 1000), 3, "0")
    : "001";

  // Record 0
  lines.push(record0(stmt));

  // Record 1
  lines.push(record1(stmt, sequence));

  // Records 2.x per entry
  let recordCount = 2; // rec1 + rec8
  let sumDebits = 0;
  let sumCredits = 0;

  for (let i = 0; i < stmt.entries.length; i++) {
    const entry = stmt.entries[i];
    const seqNum = padLeft(String(i + 1), 4, "0");

    // Track sums
    if (entry.creditDebit === "DBIT") sumDebits += entry.amount;
    else sumCredits += entry.amount;

    // Resolve communication
    const { comm, commType } = resolveCommunication(entry);

    // Resolve transaction code
    const txCode = entry.transactionCode
      ? mapTransactionCode(
          entry.transactionCode.domain,
          entry.transactionCode.family,
          entry.transactionCode.subFamily
        )
      : "        ";

    const entryDate = entry.bookingDate
      ? formatDate(entry.bookingDate)
      : formatDate(stmt.reportDate);

    // Determine which records are needed
    const detail = entry.details[0];
    const counterpartBic =
      (entry.creditDebit === "DBIT"
        ? detail?.counterparty?.bic
        : detail?.counterparty?.bic) || "";
    const counterpartIban = detail?.counterparty?.iban || "";
    const counterpartName = detail?.counterparty?.name || "";

    const needRec22 = comm.length > 53 || counterpartBic.length > 0;
    const needRec23 =
      comm.length > 106 || counterpartIban.length > 0;

    // Record 2.1
    lines.push(
      record21(entry, seqNum, comm, commType, txCode, entryDate, needRec22 || needRec23)
    );
    recordCount++;

    // Record 2.2
    if (needRec22) {
      lines.push(
        record22(seqNum, comm.slice(53, 106), counterpartBic, needRec23)
      );
      recordCount++;
    }

    // Record 2.3
    if (needRec23) {
      lines.push(
        record23(
          seqNum,
          comm.slice(106, 149),
          counterpartIban,
          entry.currency,
          counterpartName
        )
      );
      recordCount++;
    }
  }

  // Record 8
  lines.push(record8(stmt, sequence));

  // Record 9
  lines.push(record9(recordCount, sumDebits, sumCredits));

  // Validate all lines are 128 chars
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].length !== 128) {
      errors.push(
        `Line ${i + 1} (record ${lines[i][0]}): ${lines[i].length} chars (expected 128)`
      );
    }
  }

  // Build filename
  const dateStr = stmt.reportDate.slice(0, 10);
  const acct = stmt.account.iban || stmt.account.otherId || "unknown";
  const fileName = `${dateStr}-${acct}-${stmt.account.currency}-${stmt.statementId}-CAMT-053.cod`;

  return {
    fileName,
    lines,
    recordCount,
    validation: { valid: errors.length === 0, errors },
  };
}

function resolveCommunication(entry: CamtEntry): {
  comm: string;
  commType: string;
} {
  const detail = entry.details[0];

  // Structured communication takes priority
  if (detail?.remittanceInfo?.structured?.creditorRef) {
    const ref = detail.remittanceInfo.structured.creditorRef;
    return {
      comm: "101" + padRight(ref, 12, "0"),
      commType: "1",
    };
  }

  // Unstructured remittance
  const ustrd = detail?.remittanceInfo?.unstructured;
  if (ustrd && ustrd !== "NOTPROVIDED") {
    return { comm: ustrd, commType: "0" };
  }

  // Fall back to refs
  const refs = entry.details
    .flatMap((d) =>
      [d.refs?.endToEndId, d.refs?.txId].filter(
        (r) => r && r !== "NOTPROVIDED"
      )
    )
    .join("/");
  if (refs) return { comm: refs, commType: "0" };

  // Fall back to batch count
  if (entry.batchCount && entry.batchCount > 0) {
    return { comm: `${entry.batchCount} transaction(s)`, commType: "0" };
  }

  return { comm: "", commType: "0" };
}
