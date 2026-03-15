import type { CamtStatement, CamtEntry } from "./model.js";
import { mapTransactionCode } from "./transaction-codes.js";
import { padLeft, formatDate } from "./formatting.js";
import { workingDaysFromJan1 } from "../holidays/holidays.js";
import { record0 } from "./records/record0.js";
import { record1 } from "./records/record1.js";
import { record21 } from "./records/record21.js";
import { record22 } from "./records/record22.js";
import { record23 } from "./records/record23.js";
import { record31 } from "./records/record31.js";
import { record32 } from "./records/record32.js";
import { record33 } from "./records/record33.js";
import { record8 } from "./records/record8.js";
import { record9 } from "./records/record9.js";

// Re-export individual record builders for external consumers
export { record0, record1, record21, record22, record23, record31, record32, record33, record8, record9 };

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

  // Compute sequence: use explicit sequence or fall back to working-day count
  const sequence = stmt.sequence
    ? padLeft(String(stmt.sequence % 1000), 3, "0")
    : padLeft(
        String(
          workingDaysFromJan1(
            (stmt.account.iban || stmt.account.otherId || "").slice(0, 2),
            stmt.reportDate
          )
        ),
        3,
        "0"
      );

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
    const needRec23 = comm.length > 106 || counterpartIban.length > 0;
    const needRecord3 = entry.details.length > 1;

    // Record 2.1
    lines.push(
      record21({
        entry,
        seqNum,
        comm,
        commType,
        txCode,
        entryDate,
        hasMore: needRec22 || needRec23,
        needRecord3,
      })
    );
    recordCount++;

    // Record 2.2
    if (needRec22) {
      lines.push(
        record22({
          seqNum,
          comm: comm.slice(53, 106),
          counterpartBic,
          hasMore: needRec23,
        })
      );
      recordCount++;
    }

    // Record 2.3
    if (needRec23) {
      lines.push(
        record23({
          seqNum,
          comm: comm.slice(106, 149),
          counterpartIban,
          currency: entry.currency,
          counterpartName,
          needRecord3,
        })
      );
      recordCount++;
    }

    // Records 3.x: batch detail entries (when entry has multiple TxDtls)
    if (needRecord3) {
      for (let d = 0; d < entry.details.length; d++) {
        const detailEntry = entry.details[d];
        const txRefs = [detailEntry.refs?.endToEndId, detailEntry.refs?.txId]
          .filter((r) => r && r !== "NOTPROVIDED")
          .join("/");
        const txComm =
          detailEntry.remittanceInfo?.unstructured &&
          detailEntry.remittanceInfo.unstructured !== "NOTPROVIDED"
            ? detailEntry.remittanceInfo.unstructured
            : txRefs || "";

        const hasRecord32 = txComm.length > 73;
        const hasRecord33 = txComm.length > 178;

        lines.push(
          record31({
            seqNum,
            detailNum: d + 1,
            bankRef: txRefs,
            txCode,
            commType: "0",
            comm: txComm.slice(0, 73),
            entryDate,
            hasRecord32,
          })
        );
        recordCount++; // count ONE per detail

        if (hasRecord32) {
          lines.push(
            record32({
              seqNum,
              detailNum: d + 1,
              comm: txComm.slice(73, 178),
              hasRecord33,
            })
          );
        }

        if (hasRecord33) {
          lines.push(
            record33({
              seqNum,
              detailNum: d + 1,
              comm: txComm.slice(178, 268),
            })
          );
        }
      }
    }
  }

  // Record 8
  lines.push(record8(stmt, sequence));

  // Record 9
  lines.push(record9({ recordCount, sumDebits, sumCredits }));

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
  const fileName = `${dateStr}-${acct}-${stmt.account.currency}-${stmt.statementId}-CAMT-${stmt.camtVersion}.cod`;

  return {
    fileName,
    lines,
    recordCount,
    validation: { valid: errors.length === 0, errors },
  };
}

export function resolveCommunication(entry: CamtEntry): {
  comm: string;
  commType: string;
} {
  const detail = entry.details[0];

  // Structured communication takes priority
  if (detail?.remittanceInfo?.structured?.creditorRef) {
    const ref = detail.remittanceInfo.structured.creditorRef;
    return {
      comm: "101" + padLeft(ref, 12, "0"),
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
