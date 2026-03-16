// ISO 20022 Domain/Family/SubFamily → 8-char CODA transaction code

const TRANSACTION_CODE_MAP: Record<string, string> = {
  "PMNT/RCDT/ESCT": "04500001", // Incoming SEPA credit transfer
  "PMNT/ICDT/ESCT": "13010001", // Outgoing SEPA credit transfer
  "PMNT/ICDT/ISCT": "41010000", // Outgoing international transfer
  "PMNT/RCDT/ISCT": "41500000", // Incoming international transfer
  "PMNT/IDDT/ESDD": "05010000", // SEPA direct debit outgoing
  "PMNT/RDDT/ESDD": "05500000", // SEPA direct debit incoming
  "PMNT/RCDT/INST": "02500001", // Instant SEPA credit transfer in
  "PMNT/ICDT/INST": "02010001", // Instant SEPA credit transfer out
  "CAMT/ACCB/INTR": "35010000", // Interest
  "CAMT/ACCB/CHRG": "80370000", // Bank charges
};

// Card payments: any SubFamily under PMNT/CCRD
const CARD_FAMILY = "PMNT/CCRD";
const CARD_CODE = "04370000";

export function mapTransactionCode(
  domain?: string,
  family?: string,
  subFamily?: string
): string {
  if (!domain || !family) return "        ";

  // Check card payments first (wildcard SubFamily)
  if (`${domain}/${family}` === CARD_FAMILY) return CARD_CODE;

  const key = `${domain}/${family}/${subFamily || ""}`;
  return TRANSACTION_CODE_MAP[key] || "        ";
}
