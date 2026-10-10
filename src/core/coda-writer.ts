import type { CamtStatement, CamtEntry } from "./model.js";
import { mapTransactionCode } from "./transaction-codes.js";
import { padLeft, formatDate } from "./formatting.js";
import { toMillis, fromMillis, addMillis } from "./money.js";
import { isValidOgmVcs } from "./ogm-vcs.js";
import { validateCamt } from "../validation/camt-validator.js";
import { CODA_RTRANSACTION_TYPE } from "./sdd-reason-codes.js";
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
import { RECORD4_FIELDS } from "./field-defs/record4-fields.js";
import type { CodaLine, AnnotatedCodaOutput } from "./field-defs/types.js";

// ── Main conversion ─────────────────────────────────────────────────────

export function statementToCoda(stmt: CamtStatement): AnnotatedCodaOutput {
  if (stmt.entries.length > 9999 || stmt.entries.some(e => e.details.length > 9999)) throw new Error("CODA sequence capacity exceeded: at most 9999 movements and details are supported per statement");
  const lines: CodaLine[] = [];
  const inputValidation = validateCamt(stmt);
  const errors: string[] = [...inputValidation.errors];

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
  // Accumulate in integer thousandths so Record 9 totals are exact (no float drift).
  let sumDebitsMillis = 0;
  let sumCreditsMillis = 0;

  // CODA §§6–7.1: nonzero detail numbers describe the aggregate movement;
  // they are not extra account movements and are excluded from trailer totals.
  const movements = stmt.entries.flatMap((entry, i) => [
    { entry: { ...entry, details: entry.details.filter(d => d.amount === undefined) }, seq: i + 1, detail: 0 },
    ...entry.details.filter(d => d.amount !== undefined).map((detail, d) => ({
      entry: { ...entry, amount: detail.amount!, currency: detail.currency ?? entry.currency,
        creditDebit: detail.creditDebit ?? entry.creditDebit,
        accountServicerRef: detail.refs?.accountServicerRef ?? entry.accountServicerRef,
        bookingDate: detail.bookingDate ?? entry.bookingDate, valueDate: detail.valueDate ?? entry.valueDate,
        transactionCode: detail.transactionCode ?? entry.transactionCode, returnInfo: detail.returnInfo,
        details: [{ ...detail, amount: undefined, currency: undefined, creditDebit: undefined }] },
      seq: i + 1, detail: d + 1,
    })),
  ]);
  for (const movement of movements) {
    const entry = movement.entry;
    const seqNum = padLeft(String(movement.seq), 4, "0");

    // Track sums
    if (movement.detail === 0 && entry.creditDebit === "DBIT") sumDebitsMillis = addMillis(sumDebitsMillis, toMillis(entry.amount));
    else if (movement.detail === 0) sumCreditsMillis = addMillis(sumCreditsMillis, toMillis(entry.amount));

    // Resolve communication
    const { comm, commType } = resolveCommunication(entry);

    // Resolve transaction code
    const txCode = entry.transactionCode
      ? mapTransactionCode(
          entry.transactionCode.domain,
          entry.transactionCode.family,
          entry.transactionCode.subFamily,
          entry.transactionCode.proprietary,
          entry.transactionCode.proprietaryIssuer,
        )
      : "        ";

    const entryDate = entry.bookingDate
      ? formatDate(entry.bookingDate)
      : formatDate(stmt.reportDate);

    // Determine which records are needed
    const detail = entry.details[0];
    const counterpartBic = detail?.counterparty?.bic || "";
    const counterpartIban = detail?.counterparty?.iban || detail?.counterparty?.otherId || "";
    const counterpartName = detail?.counterparty?.name || "";

    // SDD R-transaction (EPC173-14) → Record 2.2 pos 113 (type) + 114-117 (reason).
    // Reversal → "4"; otherwise a booked entry carrying a return reason is a Return ("2").
    const isoReason = entry.returnInfo?.reasonCode || "";
    const rTransactionType = entry.returnInfo?.isReversal
      ? CODA_RTRANSACTION_TYPE.Reversal
      : isoReason
        ? CODA_RTRANSACTION_TYPE.Return
        : "";
    const categoryPurpose = detail?.categoryPurpose || "";
    const purpose = detail?.purpose || "";

    const needRec22 =
      comm.length > 53 ||
      counterpartBic.length > 0 ||
      Boolean(detail?.refs?.endToEndId && detail.refs.endToEndId !== "NOTPROVIDED") ||
      isoReason.length > 0 ||
      rTransactionType.length > 0 ||
      categoryPurpose.length > 0 ||
      purpose.length > 0;
    const needRec23 = comm.length > 106 || counterpartIban.length > 0 || counterpartName.length > 0;
    const needRecord3 = true;  // Always generate Record 3

    // Record 2.1
    lines.push(
      record21({
        entry,
        seqNum,
        sequence,
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
      const endToEndId = detail?.refs?.endToEndId;
      const customerRef = endToEndId && endToEndId !== "NOTPROVIDED" ? endToEndId : "";
      lines.push(
        record22({
          seqNum,
          comm: comm.slice(53, 106),
          counterpartBic,
          hasMore: needRec23,
          customerRef,
          rTransactionType,
          isoReason,
          categoryPurpose,
          purpose,
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

    // Records 3.x: always generate information records
    const detailsToEmit = entry.details.length > 0
      ? entry.details
      : [{}]; // empty detail fallback for entries with no details

    for (let d = 0; d < detailsToEmit.length; d++) {
      const detailEntry = detailsToEmit[d];
      const txRefs = [detailEntry.refs?.endToEndId, detailEntry.refs?.txId]
        .filter((r) => r && r !== "NOTPROVIDED")
        .join("/");
      const resolvedDetail = resolveCommunication({ ...entry, details: [detailEntry] });
      const txComm =
        detailEntry.remittanceInfo?.unstructured &&
        detailEntry.remittanceInfo.unstructured !== "NOTPROVIDED"
          ? detailEntry.remittanceInfo.unstructured
          : resolvedDetail.comm || txRefs || comm || "";

      const hasRecord32 = txComm.length > 73;
      const hasRecord33 = txComm.length > 178;

      lines.push(
        record31({
          seqNum,
          detailNum: d + 1,
          bankRef: entry.accountServicerRef || entry.entryRef || txRefs || "",
          txCode,
          commType: resolvedDetail.commType,
          comm: txComm.slice(0, 73),
          hasRecord32,
        })
      );
      recordCount++;

      if (hasRecord32) {
        lines.push(
          record32({
            seqNum,
            detailNum: d + 1,
            comm: txComm.slice(73, 178),
            hasRecord33,
          })
        );
        recordCount++;
      }

      if (hasRecord33) {
        lines.push(
          record33({
            seqNum,
            detailNum: d + 1,
            comm: txComm.slice(178, 268),
          })
        );
        recordCount++;
      }
    }
    // Builders default to the aggregate detail 0000; bind this movement's
    // detail number on every 2.x continuation after all optional rows exist.
    const detailNumber = padLeft(String(movement.detail), 4, "0");
    for (let l = lines.length - 1; l >= 0; l--) {
      if (lines[l].recordType === "2.1" || lines[l].recordType === "2.2" || lines[l].recordType === "2.3") {
        const field = lines[l].fields.find(f => f.name === "detailNumber")!;
        field.value = detailNumber;
        lines[l].raw = lines[l].fields.map(f => f.value).join("");
        if (lines[l].recordType === "2.1") break;
      }
    }
  }

  // Record 8
  lines.push(record8(stmt, sequence));

  // CODA 2.6 free communication follows the closing balance and is excluded
  // from the Record 9 count. Split into its 80-character physical zones.
  const free = stmt.freeCommunications?.flatMap(text => text.match(/[\s\S]{1,80}/g) || []) || [];
  if (free.length) {
    const closing = lines[lines.length - 1];
    closing.fields.find(f => f.name === "linkCode")!.value = "1";
    closing.raw = closing.fields.map(f => f.value).join("");
    free.forEach((communication, i) => {
      const values: Record<string, string> = { recordType: "4", sequenceNumber: padLeft(String(i + 1), 4, "0"), detailNumber: "0000", communication: communication.padEnd(80), linkCode: i < free.length - 1 ? "1" : "0" };
      const fields = RECORD4_FIELDS.map(def => ({ ...def, value: values[def.name] ?? " ".repeat(def.length) }));
      lines.push({ recordType: "4", fields, raw: fields.map(f => f.value).join("") });
    });
  }

  // Record 9
  lines.push(record9({ recordCount, sumDebits: fromMillis(sumDebitsMillis), sumCredits: fromMillis(sumCreditsMillis) }));

  const warnings: string[] = [...inputValidation.warnings];
  for (const entry of stmt.entries) {
    entry.details.forEach((d, i) => {
      const comm = resolveCommunication({ ...entry, details: [d] }).comm;
      if (comm.length > 268) warnings.push(`Remittance detail ${i + 1} truncated to CODA capacity 268 characters`);
      if (d.refs?.endToEndId && d.refs.endToEndId.length > 35) warnings.push("EndToEndId truncated to 35 characters");
      if (d.counterparty?.name && d.counterparty.name.length > 35) warnings.push("Counterparty name truncated to 35 characters");

      if (d.categoryPurpose) warnings.push("CategoryPurpose is retained in CODA but is unavailable in CAMT 053 output before v10");
      if (i > 0 && d.amount === undefined && (d.counterparty || d.refs)) warnings.push(`Counterparty/references on detail ${i + 1} cannot be represented independently by CODA information records`);
      if (d.refs?.txId || d.refs?.instrId) warnings.push("Transaction/instruction references have no dedicated CODA field; only available as free communication when remittance is absent");
    });
  }
  // CODA 2.6 §§5.5–5.6: compute links from the complete emitted sequence.
  lines.forEach((line, i) => {
    const field = line.fields.find(f => f.name === "linkCode");
    if (field && /^[23]\./.test(line.recordType)) {
      field.value = lines[i + 1]?.recordType === "3.1" ? "1" : "0";
      line.raw = line.fields.map(f => f.value).join("");
    }
  });

  // Reconcile: Record 8 closing balance must equal Record 1 opening + movements
  // (CODA 2.6). Computed in integer thousandths so the check is exact.
  const openSign = stmt.openingBalance.creditDebit === "CRDT" ? 1 : -1;
  const closeSign = stmt.closingBalance.creditDebit === "CRDT" ? 1 : -1;
  const openingMillis = openSign * toMillis(stmt.openingBalance.amount);
  const closingMillis = closeSign * toMillis(stmt.closingBalance.amount);
  const expectedClosingMillis = openingMillis + sumCreditsMillis - sumDebitsMillis;
  if (expectedClosingMillis !== closingMillis) {
    warnings.push(
      `Balance mismatch: opening ${fromMillis(openingMillis)} + credits ${fromMillis(sumCreditsMillis)} ` +
        `- debits ${fromMillis(sumDebitsMillis)} = ${fromMillis(expectedClosingMillis)}, ` +
        `but closing balance is ${fromMillis(closingMillis)}`
    );
  }

  // Validate all lines are 128 chars
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].raw.length !== 128) {
      errors.push(
        `Line ${i + 1} (record ${lines[i].raw[0]}): ${lines[i].raw.length} chars (expected 128)`
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
    validation: { valid: errors.length === 0, errors, warnings },
  };
}

export function resolveCommunication(entry: CamtEntry): {
  comm: string;
  commType: string;
} {
  const detail = entry.details[0];

  // Structured communication takes priority.
  // CODA structured type "101" is the Belgian OGM-VCS (12 numeric digits).
  // Non-numeric references (e.g. ISO 11649 "RF...") are not OGM-VCS, so they
  // are carried as free communication rather than mislabelled as type 101.
  if (detail?.remittanceInfo?.structured?.creditorRef) {
    const ref = detail.remittanceInfo.structured.creditorRef;
    if (isValidOgmVcs(ref) && (!detail.remittanceInfo.structured.type || detail.remittanceInfo.structured.type === "SCOR") && (!detail.remittanceInfo.structured.issuer || detail.remittanceInfo.structured.issuer === "BBA")) {
      return { comm: "101" + padLeft(ref, 12, "0"), commType: "1" };
    }
    return { comm: ref, commType: "0" };
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
