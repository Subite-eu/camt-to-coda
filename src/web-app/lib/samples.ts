import originals from "../../../examples/catalog.json";
import type { Direction } from "./convert";

export interface Sample {
  id: string;
  label: string;
  description: string;
  format: "camt" | "coda";
  direction: Direction;
  valid: boolean;
  path: string;
  keywords: string;
  load: () => Promise<string>;
}
interface Original {
  id: string; format: "camt" | "coda"; path: string; valid: boolean;
  schema?: string | null; features: string[]; title?: string; description?: string;
}
// Each original is a separate lazy chunk: browsing metadata doesn't fetch bank
// documents, and the initial application bundle stays small as the library grows.
const sources = import.meta.glob<string>("../../../examples/{camt,coda,invalid}/*.{xml,cod}", { query: "?raw", import: "default" });
const titles: Record<string, string> = {
  "empty-statement": "Empty statement", "three-decimal-kwd": "Three-decimal currency · KWD",
  "debit-and-zero": "Overdraft and zero movements", "multiple-statements": "Multiple statements",
  "other-account": "Local account identifier", "structured-ogm": "Structured Belgian reference",
  "long-remittance": "Long payment communication", "repeated-entry-details": "Multiple information details",
  "return-purpose": "Return, reversal and purpose", "counterparty": "Counterparty account and name",
  "free-communication": "Free statement communication", "crlf": "Windows line endings",
  "monetary-details": "Monetary batch breakdown", "belgian-bban": "Belgian BBAN account",
  "mixed-sign-details": "Mixed credit/debit batch details", "local-detail-return-reason": "Return reason on one detail",
  "maximum-coda-amount": "Maximum CODA amount", "maximum-amount": "Maximum CODA amount",
  "negative-opening": "Negative opening and closing balances", "foreign-iban": "Dutch IBAN account",
  "prefixed-namespace": "Prefixed XML namespace", "single-quoted-namespace": "Single-quoted XML namespace",
  "datetime-choices": "Dates with time and timezone", "missing-trailer": "Missing trailer",
  "unclosed": "Unclosed XML", "mixed-currency": "Mismatched movement currency",
  "subprecision": "More than three amount decimals", "tiny-subprecision": "Tiny excess precision",
  "large-subprecision": "Large amount with excess precision", "detail-subprecision": "Excess detail precision",
  "overflow": "Amount exceeds CODA capacity", "unsupported-version": "Unsupported XML version",
  "broken-continuation": "Broken continuation link", "mismatched-closing-account": "Closing account mismatch",
  "nonnumeric-amount": "Nonnumeric amount", "missing-account": "Missing account",
  "invalid-ogm-checksum": "Invalid Belgian reference checksum", "empty": "Empty file",
  "short-record": "Short fixed-width record", "wrong-trailer-total": "Incorrect trailer total",
};
function sample(original: Original): Sample {
  const version = original.id.match(/^camt\.(052|053)\.001\.(\d+)$/);
  const slug = original.id.replace(/^(camt|coda)-/, "");
  const label = original.id === "camt.053.001.08" ? "CAMT 053 statement"
    : original.id === "coda-basic-eur" ? "CODA file"
    : version ? `CAMT ${version[1]} · version ${version[2]}`
    : `${original.format.toUpperCase()} · ${original.title ?? titles[slug] ?? slug.replaceAll("-", " ")}`;
  const description = original.description ?? (version ? `ISO 20022 ${original.schema}. Booked entry, counterparty and payment reference.`
    : `${original.valid ? "Explore" : "Expected rejection:"} ${original.features.map(f => f.replaceAll("-", " ")).join(", ")}.`);
  return { ...original, label, description, direction: original.format === "camt" ? "camt-to-coda" : "coda-to-camt",
    keywords: `${label} ${description} ${original.path} ${original.features.join(" ")}`.toLowerCase(),
    load: sources[`../../../examples/${original.path}`],
  };
}
const priority = (s: Sample) => s.id === "camt.053.001.08" ? 0 : s.id === "coda-basic-eur" ? 1
  : s.id.includes(".001.") ? 4 : s.valid ? 2 : 3;
export const SAMPLES: Sample[] = (originals.cases as Original[]).map(sample)
  .sort((a, b) => priority(a) - priority(b) || a.label.localeCompare(b.label));
