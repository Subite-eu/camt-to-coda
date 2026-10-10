import type { CamtStatement } from "../core/model.js";
import { sha256 } from "./sha256.js";
/** Allowlist avoids copying free text or unknown identifying extensions. Amounts,
 * dates and currency remain visible and can still identify a transaction. */
export function anonymizeStatement(s: CamtStatement, index = 0): CamtStatement {
  return {
    camtVersion: s.camtVersion,
    messageId: "ANONYMIZED", statementId: `STATEMENT-${index+1}`,
    creationDate: s.creationDate, reportDate: s.reportDate, sequence: s.sequence,
    account: { otherId: `ANON-${sha256(s.account.iban ?? s.account.otherId ?? String(index)).slice(0,16)}`, currency: s.account.currency },
    openingBalance: { ...s.openingBalance }, closingBalance: { ...s.closingBalance },
    entries: s.entries.map(e => ({
      amount: e.amount, currency: e.currency, creditDebit: e.creditDebit,
      bookingDate: e.bookingDate, valueDate: e.valueDate, batchCount: e.batchCount,
      transactionCode: e.transactionCode?.domain ? { domain: e.transactionCode.domain, family: e.transactionCode.family, subFamily: e.transactionCode.subFamily } : undefined,
      details: e.details.map(d => ({ amount: d.amount, currency: d.currency, creditDebit: d.creditDebit })),
    })),
  };
}
