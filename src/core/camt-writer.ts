// ── CAMT XML Writer ──────────────────────────────────────────────────────────
// Serializes a CamtStatement back into a CAMT 053 XML string.

import type { CamtStatement, CamtEntry, Balance, TransactionDetail } from "./model.js";

const DEFAULT_VERSION = "camt.053.001.08";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tag(name: string, value: string, attrs = ""): string {
  const attrStr = attrs ? " " + attrs : "";
  return `<${name}${attrStr}>${esc(value)}</${name}>`;
}

function amountTag(amount: number, currency: string): string {
  return `<Amt Ccy="${esc(currency)}">${amount.toFixed(2)}</Amt>`;
}

function indent(xml: string, level: number): string {
  const pad = "  ".repeat(level);
  return xml
    .split("\n")
    .map((line) => (line.trim() ? pad + line : line))
    .join("\n");
}

function balanceXml(bal: Balance, type: "OPBD" | "CLBD"): string {
  return [
    "<Bal>",
    "  <Tp>",
    "    <CdOrPrtry>",
    `      ${tag("Cd", type)}`,
    "    </CdOrPrtry>",
    "  </Tp>",
    `  ${amountTag(bal.amount, "EUR")}`,
    `  ${tag("CdtDbtInd", bal.creditDebit)}`,
    "  <Dt>",
    `    ${tag("Dt", bal.date)}`,
    "  </Dt>",
    "</Bal>",
  ].join("\n");
}

function txDetailsXml(detail: TransactionDetail, creditDebit: "CRDT" | "DBIT"): string {
  const lines: string[] = ["<TxDtls>"];

  // Refs
  if (detail.refs) {
    const refLines: string[] = ["<Refs>"];
    if (detail.refs.endToEndId) {
      refLines.push(`  ${tag("EndToEndId", detail.refs.endToEndId)}`);
    }
    if (detail.refs.txId) {
      refLines.push(`  ${tag("TxId", detail.refs.txId)}`);
    }
    if (detail.refs.instrId) {
      refLines.push(`  ${tag("InstrId", detail.refs.instrId)}`);
    }
    refLines.push("</Refs>");
    lines.push(...refLines.map((l) => "  " + l));
  }

  // Counterparty: CRDT => Dbtr (payer), DBIT => Cdtr (payee)
  if (detail.counterparty) {
    const cp = detail.counterparty;
    const elementName = creditDebit === "CRDT" ? "Dbtr" : "Cdtr";
    const acctElementName = creditDebit === "CRDT" ? "DbtrAcct" : "CdtrAcct";
    const agentElementName = creditDebit === "CRDT" ? "DbtrAgt" : "CdtrAgt";

    if (cp.name) {
      lines.push(`  <${elementName}>`);
      lines.push(`    ${tag("Nm", cp.name)}`);
      lines.push(`  </${elementName}>`);
    }
    if (cp.iban) {
      lines.push(`  <${acctElementName}>`);
      lines.push("    <Id>");
      lines.push(`      ${tag("IBAN", cp.iban)}`);
      lines.push("    </Id>");
      lines.push(`  </${acctElementName}>`);
    }
    if (cp.bic) {
      lines.push(`  <${agentElementName}>`);
      lines.push("    <FinInstnId>");
      lines.push(`      ${tag("BIC", cp.bic)}`);
      lines.push("    </FinInstnId>");
      lines.push(`  </${agentElementName}>`);
    }
  }

  // Remittance info
  if (detail.remittanceInfo) {
    const ri = detail.remittanceInfo;
    const riLines: string[] = ["<RmtInf>"];
    if (ri.unstructured) {
      riLines.push(`  ${tag("Ustrd", ri.unstructured)}`);
    }
    if (ri.structured?.creditorRef) {
      riLines.push("  <Strd>");
      riLines.push("    <CdtrRefInf>");
      riLines.push(`      ${tag("Ref", ri.structured.creditorRef)}`);
      riLines.push("    </CdtrRefInf>");
      riLines.push("  </Strd>");
    }
    riLines.push("</RmtInf>");
    lines.push(...riLines.map((l) => "  " + l));
  }

  lines.push("</TxDtls>");
  return lines.join("\n");
}

function entryXml(entry: CamtEntry): string {
  const lines: string[] = ["<Ntry>"];

  lines.push(`  ${amountTag(entry.amount, entry.currency)}`);
  lines.push(`  ${tag("CdtDbtInd", entry.creditDebit)}`);

  if (entry.bookingDate) {
    lines.push(`  <BookgDt><Dt>${esc(entry.bookingDate)}</Dt></BookgDt>`);
  }
  if (entry.valueDate) {
    lines.push(`  <ValDt><Dt>${esc(entry.valueDate)}</Dt></ValDt>`);
  }
  if (entry.entryRef) {
    lines.push(`  ${tag("NtryRef", entry.entryRef)}`);
  }
  if (entry.accountServicerRef) {
    lines.push(`  ${tag("AcctSvcrRef", entry.accountServicerRef)}`);
  }

  // Transaction code
  if (entry.transactionCode) {
    const tc = entry.transactionCode;
    const tcLines: string[] = ["<BkTxCd>"];
    if (tc.domain || tc.family || tc.subFamily) {
      tcLines.push("  <Domn>");
      if (tc.domain) tcLines.push(`    ${tag("Cd", tc.domain)}`);
      if (tc.family || tc.subFamily) {
        tcLines.push("    <Fmly>");
        if (tc.family) tcLines.push(`      ${tag("Cd", tc.family)}`);
        if (tc.subFamily) tcLines.push(`      ${tag("SubFmlyCd", tc.subFamily)}`);
        tcLines.push("    </Fmly>");
      }
      tcLines.push("  </Domn>");
    }
    if (tc.proprietary) {
      tcLines.push("  <Prtry>");
      tcLines.push(`    ${tag("Cd", tc.proprietary)}`);
      tcLines.push("  </Prtry>");
    }
    tcLines.push("</BkTxCd>");
    lines.push(...tcLines.map((l) => "  " + l));
  }

  // Entry details
  if (entry.details && entry.details.length > 0) {
    const dtlsLines: string[] = ["<NtryDtls>"];
    for (const detail of entry.details) {
      const txXml = txDetailsXml(detail, entry.creditDebit);
      dtlsLines.push(...txXml.split("\n").map((l) => "  " + l));
    }
    dtlsLines.push("</NtryDtls>");
    lines.push(...dtlsLines.map((l) => "  " + l));
  }

  lines.push("</Ntry>");
  return lines.join("\n");
}

export function statementToXml(stmt: CamtStatement, version?: string): string {
  const ver = version ?? DEFAULT_VERSION;
  const namespace = `urn:iso:std:iso:20022:tech:xsd:${ver}`;

  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<Document xmlns="${namespace}">`);
  lines.push("  <BkToCstmrStmt>");

  // Group header
  lines.push("    <GrpHdr>");
  lines.push(`      ${tag("MsgId", stmt.messageId)}`);
  lines.push(`      ${tag("CreDtTm", stmt.creationDate)}`);
  lines.push("    </GrpHdr>");

  // Statement
  lines.push("    <Stmt>");
  lines.push(`      ${tag("Id", stmt.statementId)}`);

  // Account
  const acct = stmt.account;
  lines.push("      <Acct>");
  lines.push("        <Id>");
  if (acct.iban) {
    lines.push(`          ${tag("IBAN", acct.iban)}`);
  } else if (acct.otherId) {
    lines.push("          <Othr>");
    lines.push(`            ${tag("Id", acct.otherId)}`);
    lines.push("          </Othr>");
  }
  lines.push("        </Id>");
  lines.push(`        ${tag("Ccy", acct.currency)}`);
  if (acct.ownerName) {
    lines.push("        <Ownr>");
    lines.push(`          ${tag("Nm", acct.ownerName)}`);
    lines.push("        </Ownr>");
  }
  if (acct.bic) {
    lines.push("        <Svcr>");
    lines.push("          <FinInstnId>");
    lines.push(`            ${tag("BIC", acct.bic)}`);
    lines.push("          </FinInstnId>");
    lines.push("        </Svcr>");
  }
  lines.push("      </Acct>");

  // Opening balance
  const opbdLines = balanceXml(stmt.openingBalance, "OPBD")
    .split("\n")
    .map((l) => "      " + l);
  lines.push(...opbdLines);

  // Entries
  for (const entry of stmt.entries) {
    const ntryLines = entryXml(entry)
      .split("\n")
      .map((l) => "      " + l);
    lines.push(...ntryLines);
  }

  // Closing balance
  const clbdLines = balanceXml(stmt.closingBalance, "CLBD")
    .split("\n")
    .map((l) => "      " + l);
  lines.push(...clbdLines);

  lines.push("    </Stmt>");
  lines.push("  </BkToCstmrStmt>");
  lines.push("</Document>");

  return lines.join("\n");
}
