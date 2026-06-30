// SEPA Direct Debit R-transaction reason codes.
// Source: EPC173-14 v8.0 "Guidance on Reason Codes for SDD R-transactions".
//
// In CAMT these appear as RmtInf-adjacent return info: Ntry/.../RtrInf/Rsn/Cd.
// In CODA they map to Record 2.2 — the ISO reason code (pos 114-117) and the
// R-transaction type (pos 113: 1=Reject 2=Return 3=Refund 4=Reversal 5=Cancellation).

export type RTransactionType = "Reject" | "Return" | "Refund" | "Reversal" | "Refusal";

export interface SddReason {
  /** ISO 20022 name as in the rulebook */
  name: string;
  /** R-transaction types this reason can be used for (EPC173-14 §3) */
  types: RTransactionType[];
}

export const SDD_REASON_CODES: Record<string, SddReason> = {
  AC01: { name: "Incorrect Account Number", types: ["Reject", "Return"] },
  AC04: { name: "Closed Account Number", types: ["Reject", "Return"] },
  AC06: { name: "Blocked Account", types: ["Reject", "Return"] },
  AC13: { name: "Invalid Debtor Account Type", types: ["Reject", "Return"] },
  AG01: { name: "Transaction Forbidden", types: ["Reject", "Return"] },
  AG02: { name: "Invalid Bank Operation Code", types: ["Reject", "Return"] },
  AM04: { name: "Insufficient Funds", types: ["Reject", "Return"] },
  AM05: { name: "Duplication", types: ["Reject", "Return", "Reversal"] },
  BE05: { name: "Unrecognised Initiating Party", types: ["Reject", "Return"] },
  CNOR: { name: "Creditor Bank Is Not Registered", types: ["Reject"] },
  DNOR: { name: "Debtor Bank Is Not Registered", types: ["Reject"] },
  ED05: { name: "Settlement Failed", types: ["Reject"] },
  FF01: { name: "Invalid File Format", types: ["Reject"] },
  MD01: { name: "No Mandate", types: ["Reject", "Return", "Refund"] },
  MD02: { name: "Missing Mandatory Mandate Information", types: ["Reject"] },
  MD06: { name: "Refund Request By End Customer", types: ["Refund"] },
  MD07: { name: "End Customer Deceased", types: ["Reject", "Return"] },
  MS02: { name: "Not Specified Reason Customer Generated", types: ["Reject", "Return", "Reversal", "Refusal"] },
  MS03: { name: "Not Specified Reason Agent Generated", types: ["Reject", "Return", "Reversal"] },
  RC01: { name: "Bank Identifier Incorrect", types: ["Reject", "Return"] },
  RR01: { name: "Missing Debtor Account Or Identification", types: ["Reject", "Return"] },
  RR02: { name: "Missing Debtor Name Or Address", types: ["Reject", "Return"] },
  RR03: { name: "Missing Creditor Name Or Address", types: ["Reject", "Return"] },
  RR04: { name: "Regulatory Reason", types: ["Reject", "Return"] },
  SL01: { name: "Specific Service Offered By Debtor Agent", types: ["Reject", "Return"] },
};

// CODA Record 2.2 pos 113 — type of R-transaction.
export const CODA_RTRANSACTION_TYPE: Record<Exclude<RTransactionType, "Refusal">, string> = {
  Reject: "1",
  Return: "2",
  Refund: "3",
  Reversal: "4",
  // "5" = Cancellation (no SDD reason code maps to it in EPC173-14)
};

/** True if `code` is a known EPC SDD R-transaction reason code. */
export function isSddReasonCode(code: string): boolean {
  return Object.prototype.hasOwnProperty.call(SDD_REASON_CODES, code.trim().toUpperCase());
}
