// ── Normalized CAMT model (version-independent) ────────────────────────

export interface AccountInfo {
  iban?: string;
  otherId?: string;
  currency: string;
  ownerName?: string;
  bic?: string;
}

export interface Balance {
  amount: number;
  creditDebit: "CRDT" | "DBIT";
  date: string;
}

export interface TransactionCode {
  domain?: string;
  family?: string;
  subFamily?: string;
  proprietary?: string;
  proprietaryIssuer?: string;  // "BBA", "ISO", etc.
}

export interface TransactionDetail {
  refs?: {
    endToEndId?: string;
    txId?: string;
    instrId?: string;
  };
  counterparty?: {
    name?: string;
    iban?: string;
    bic?: string;
  };
  remittanceInfo?: {
    unstructured?: string;
    structured?: {
      creditorRef?: string;
    };
  };
  /** SEPA purpose / category purpose (CAMT Purp / CtgyPurp).
   *  Map to CODA Record 2.2 pos 118-121 (CategoryPurpose) and 122-125 (Purpose). */
  purpose?: string;
  categoryPurpose?: string;
}

export interface CamtEntry {
  amount: number;
  currency: string;
  creditDebit: "CRDT" | "DBIT";
  bookingDate?: string;
  valueDate?: string;
  entryRef?: string;
  accountServicerRef?: string;
  transactionCode?: TransactionCode;
  details: TransactionDetail[];
  batchCount?: number;
  /** SDD R-transaction info (EPC173-14): ISO reason code + reversal flag.
   *  Maps to CODA Record 2.2 — type (pos 113) and ISO reason (pos 114-117). */
  returnInfo?: {
    reasonCode?: string;
    isReversal?: boolean;
  };
}

export interface CamtStatement {
  camtVersion: "052" | "053";
  messageId: string;
  creationDate: string;
  statementId: string;
  account: AccountInfo;
  openingBalance: Balance;
  closingBalance: Balance;
  entries: CamtEntry[];
  reportDate: string;
  sequence?: number;
}
