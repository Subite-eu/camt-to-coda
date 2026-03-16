// src/core/coda-to-statement.ts
// Reconstructs a CamtStatement from parsed CODA lines (CodaLine[]).

import type { CodaLine } from "./field-defs/types.js";
import type {
  CamtStatement,
  CamtEntry,
  TransactionDetail,
  Balance,
  AccountInfo,
} from "./model.js";
import { reverseMapTransactionCode } from "./transaction-codes.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function getField(line: CodaLine, name: string): string {
  const field = line.fields.find((f) => f.name === name);
  return field?.value.trim() ?? "";
}

function getRawField(line: CodaLine, name: string): string {
  const field = line.fields.find((f) => f.name === name);
  return field?.value ?? "";
}

function parseDate(ddmmyy: string): string {
  if (!ddmmyy || ddmmyy.trim().length < 6 || ddmmyy === "000000") return "";
  const dd = ddmmyy.slice(0, 2);
  const mm = ddmmyy.slice(2, 4);
  const yy = ddmmyy.slice(4, 6);
  const century = parseInt(yy, 10) > 50 ? "19" : "20";
  return `${century}${yy}-${mm}-${dd}`;
}

function parseAmount(raw: string): number {
  const trimmed = raw.replace(/\s/g, "");
  if (trimmed.length === 0) return 0;
  const integer = parseInt(trimmed.slice(0, -3), 10) || 0;
  const decimal = parseInt(trimmed.slice(-3), 10) || 0;
  return integer + decimal / 1000;
}

function parseSign(sign: string): "CRDT" | "DBIT" {
  return sign === "1" ? "DBIT" : "CRDT";
}

// ── Main conversion ──────────────────────────────────────────────────────

export function codaToStatement(lines: CodaLine[]): CamtStatement {
  const account: AccountInfo = { currency: "EUR" };
  let openingBalance: Balance = { amount: 0, creditDebit: "CRDT", date: "" };
  let closingBalance: Balance = { amount: 0, creditDebit: "CRDT", date: "" };
  const entries: CamtEntry[] = [];

  let messageId = "";
  let creationDate = "";
  let statementId = "";
  let reportDate = "";
  let sequence: number | undefined;

  // Current entry being built (from 2.1, extended by 2.2, 2.3)
  let currentEntry: CamtEntry | null = null;
  let currentDetail: TransactionDetail | null = null;
  let commZone1 = "";
  let commZone2 = "";
  let commZone3 = "";
  let communicationType = "0";

  function flushEntry(): void {
    if (!currentEntry) return;

    // Build communication from all 3 zones
    const fullComm = (commZone1 + commZone2 + commZone3).trim();

    // Populate remittance info on the first detail
    if (currentDetail) {
      if (communicationType === "1" && fullComm.startsWith("101")) {
        // Structured: Belgian creditor reference
        currentDetail.remittanceInfo = {
          structured: {
            creditorRef: fullComm.slice(3).trim(),
          },
        };
      } else if (fullComm.length > 0) {
        currentDetail.remittanceInfo = {
          unstructured: fullComm,
        };
      }

      // Add detail if not already added
      if (currentEntry.details.length === 0) {
        currentEntry.details.push(currentDetail);
      }
    }

    entries.push(currentEntry);
    currentEntry = null;
    currentDetail = null;
    commZone1 = "";
    commZone2 = "";
    commZone3 = "";
    communicationType = "0";
  }

  for (const line of lines) {
    switch (line.recordType) {
      case "0": {
        // Header: BIC, creation date
        account.bic = getField(line, "bic") || undefined;
        creationDate = parseDate(getField(line, "creationDate"));
        messageId = getField(line, "fileReference") || creationDate;
        break;
      }

      case "1": {
        // Old balance: IBAN, currency, opening balance, holder name
        account.iban = getField(line, "accountNumber") || undefined;
        account.currency = getField(line, "currency") || "EUR";
        account.ownerName = getField(line, "holderName") || undefined;

        const seqStr = getField(line, "sequence");
        if (seqStr) sequence = parseInt(seqStr, 10) || undefined;

        openingBalance = {
          amount: parseAmount(getField(line, "balanceAmount")),
          creditDebit: parseSign(getField(line, "balanceSign")),
          date: parseDate(getField(line, "balanceDate")),
        };
        reportDate = openingBalance.date;
        statementId = messageId || `STMT-${openingBalance.date}`;
        break;
      }

      case "2.1": {
        // Flush any previous entry
        flushEntry();

        // New movement entry
        const amountSign = getField(line, "amountSign");
        const creditDebit = parseSign(amountSign);
        const amount = parseAmount(getField(line, "amount"));
        const valueDate = parseDate(getField(line, "valueDate"));
        const bookingDate = parseDate(getField(line, "entryDate"));
        const bankReference = getField(line, "bankReference");
        const transactionCode = getField(line, "transactionCode");

        communicationType = getField(line, "communicationType");
        // Use raw field to preserve spaces within the communication zone
        commZone1 = getRawField(line, "communication");

        currentEntry = {
          amount,
          currency: account.currency,
          creditDebit,
          bookingDate: bookingDate || undefined,
          valueDate: valueDate || undefined,
          entryRef: bankReference || undefined,
          transactionCode: reverseMapTransactionCode(transactionCode),
          details: [],
        };

        currentDetail = {};
        break;
      }

      case "2.2": {
        // Continuation: communication zone 2, counterpart BIC
        commZone2 = getRawField(line, "communication");
        const counterpartBic = getField(line, "counterpartBic");

        if (currentDetail && counterpartBic) {
          if (!currentDetail.counterparty) {
            currentDetail.counterparty = {};
          }
          currentDetail.counterparty.bic = counterpartBic;
        }
        break;
      }

      case "2.3": {
        // Counterparty: IBAN, name, communication zone 3
        commZone3 = getRawField(line, "communication");
        const counterpartAccount = getField(line, "counterpartAccount");
        const counterpartName = getField(line, "counterpartName");

        if (currentDetail) {
          if (counterpartAccount || counterpartName) {
            if (!currentDetail.counterparty) {
              currentDetail.counterparty = {};
            }
            if (counterpartAccount) {
              currentDetail.counterparty.iban = counterpartAccount;
            }
            if (counterpartName) {
              currentDetail.counterparty.name = counterpartName;
            }
          }
        }
        break;
      }

      case "3.1": {
        // Batch detail: a new TransactionDetail within the current entry
        // Record 3.x are details of a globalised movement
        if (currentEntry) {
          const detail: TransactionDetail = {};

          const communication31 = getRawField(line, "communication").trim();
          const commType31 = getField(line, "communicationType");

          if (commType31 === "1" && communication31.startsWith("101")) {
            detail.remittanceInfo = {
              structured: { creditorRef: communication31.slice(3).trim() },
            };
          } else if (communication31.length > 0) {
            detail.remittanceInfo = { unstructured: communication31 };
          }

          currentEntry.details.push(detail);
        }
        break;
      }

      case "3.2": {
        // Batch continuation: append communication to the last detail
        if (currentEntry && currentEntry.details.length > 0) {
          const lastDetail = currentEntry.details[currentEntry.details.length - 1];
          const comm32 = getRawField(line, "communication").trim();
          if (comm32.length > 0 && lastDetail.remittanceInfo) {
            if (lastDetail.remittanceInfo.unstructured) {
              lastDetail.remittanceInfo.unstructured += comm32;
            }
          }
        }
        break;
      }

      case "3.3": {
        // Batch counterparty: similar to 2.3 but for a detail line
        // Append communication to the last detail if applicable
        break;
      }

      case "4": {
        // Free communication: skip (not mapped to model)
        break;
      }

      case "8": {
        // Flush any pending entry before closing balance
        flushEntry();

        closingBalance = {
          amount: parseAmount(getField(line, "balanceAmount")),
          creditDebit: parseSign(getField(line, "balanceSign")),
          date: parseDate(getField(line, "balanceDate")),
        };
        break;
      }

      case "9": {
        // Trailer: skip
        break;
      }
    }
  }

  // Flush any remaining entry (shouldn't happen in well-formed CODA, but just in case)
  flushEntry();

  return {
    camtVersion: "053",
    messageId,
    creationDate,
    statementId,
    account,
    openingBalance,
    closingBalance,
    entries,
    reportDate,
    sequence,
  };
}
