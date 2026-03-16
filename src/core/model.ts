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
