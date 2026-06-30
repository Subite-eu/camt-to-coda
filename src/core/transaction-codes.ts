// ISO 20022 Domain/Family/SubFamily ↔ 8-char CODA transaction code.
//
// A CODA transaction code is type(1) + family(2) + transaction(2) + category(3),
// per CODA 2.6 §3 and Annexe II. For standard individual booked movements the
// type is 0 and the category is 000 ("Net amount"). The codes below were
// derived from Annexe II (see coda-transaction-codes.ts) and verified against a
// real Belgian .cod (incoming SEPA CT = 00150000, outgoing = 00101000).
//
// This map is a FALLBACK: when a CAMT file carries a BBA proprietary code
// (BkTxCd/Prtry with Issr=BBA) that code IS the CODA code and is used directly.
import type { TransactionCode } from "./model.js";
import { CODA_FAMILIES, CODA_CATEGORIES } from "./coda-transaction-codes.js";

const TRANSACTION_CODE_MAP: Record<string, string> = {
  // Family 01 — domestic/local SEPA credit transfers
  "PMNT/ICDT/ESCT": "00101000", // outgoing: individual transfer order (tx 01)
  "PMNT/RCDT/ESCT": "00150000", // incoming: transfer in your favour (tx 50)
  // Family 02 — instant SEPA credit transfers
  "PMNT/ICDT/INST": "00201000", // outgoing instant (tx 01)
  "PMNT/RCDT/INST": "00250000", // incoming instant (tx 50)
  // Family 05 — direct debit
  "PMNT/IDDT/ESDD": "00501000", // paid direct debit (tx 01, payment)
  "PMNT/RDDT/ESDD": "00550000", // collected direct debit (tx 50, credit after collection)
  // Family 41 — foreign / non-SEPA credit transfers
  "PMNT/ICDT/ISCT": "04101000", // outgoing international (tx 01)
  "PMNT/RCDT/ISCT": "04150000", // incoming international (tx 50)
  // Family 35 — closing (periodical settlements: interest, costs). Approximate.
  "CAMT/ACCB/INTR": "03550000", // interest credited (tx 50, closing)
  "CAMT/ACCB/CHRG": "03537000", // costs/charges (tx 37, costs)
};

// Card payments: any SubFamily under PMNT/CCRD → family 04, tx 02
// (payment by means of a payment card within the Eurozone).
const CARD_FAMILY = "PMNT/CCRD";
const CARD_CODE = "00402000";

// Build reverse map from the forward map.
const REVERSE_MAP: Record<string, TransactionCode> = {};
for (const [key, code] of Object.entries(TRANSACTION_CODE_MAP)) {
  const [domain, family, subFamily] = key.split("/");
  REVERSE_MAP[code] = { domain, family, subFamily };
}
// Card code: synthetic SubFamily since the original is lost.
REVERSE_MAP[CARD_CODE] = { domain: "PMNT", family: "CCRD", subFamily: "OTHR" };

export function reverseMapTransactionCode(codaCode: string): TransactionCode | undefined {
  const trimmed = codaCode.trim();
  if (trimmed.length === 0) return undefined;
  return REVERSE_MAP[trimmed];
}

export function mapTransactionCode(
  domain?: string,
  family?: string,
  subFamily?: string,
  proprietary?: string,
  proprietaryIssuer?: string,
): string {
  // BBA proprietary code IS the CODA transaction code.
  if (proprietary && proprietaryIssuer === "BBA" && /^\d{8}$/.test(proprietary)) {
    return proprietary;
  }
  // Also accept a raw 8-digit proprietary without issuer when no domain is given.
  if (proprietary && !domain && /^\d{8}$/.test(proprietary)) {
    return proprietary;
  }

  if (!domain || !family) return "        ";

  // Card payments first (wildcard SubFamily).
  if (`${domain}/${family}` === CARD_FAMILY) return CARD_CODE;

  const key = `${domain}/${family}/${subFamily || ""}`;
  return TRANSACTION_CODE_MAP[key] || "        ";
}

// ── CODA code description (decodes any 8-digit code via Annexe II tables) ──

export interface CodaCodeDescription {
  type: string;
  family: string;
  transaction: string;
  category: string;
  familyName?: string;
  transactionDescription?: string;
  categoryDescription?: string;
}

/** Decode an 8-digit CODA code into its type/family/transaction/category parts
 *  and their Annexe II descriptions (undefined parts are simply omitted). */
export function describeCodaCode(code8: string): CodaCodeDescription | undefined {
  const trimmed = code8.trim();
  if (!/^\d{8}$/.test(trimmed)) return undefined;
  const family = trimmed.slice(1, 3);
  const transaction = trimmed.slice(3, 5);
  const category = trimmed.slice(5, 8);
  const fam = CODA_FAMILIES.find((f) => f.code === family);
  const tx = fam?.transactions.find((t) => t.code === transaction);
  return {
    type: trimmed.slice(0, 1),
    family,
    transaction,
    category,
    familyName: fam?.name,
    transactionDescription: tx?.description,
    categoryDescription: CODA_CATEGORIES[category],
  };
}
