import type { Direction } from "./convert";

export interface Sample {
  label: string;
  direction: Direction;
  content: string;
}

const CAMT_053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"><BkToCstmrStmt>
<GrpHdr><MsgId>SAMPLE-001</MsgId><CreDtTm>2024-03-15T08:00:00</CreDtTm></GrpHdr>
<Stmt><Id>STMT-1</Id>
<Acct><Id><IBAN>BE68539007547034</IBAN></Id><Ccy>EUR</Ccy>
<Ownr><Nm>ACME BVBA</Nm></Ownr>
<Svcr><FinInstnId><BIC>GEBABEBB</BIC></FinInstnId></Svcr></Acct>
<Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">23005.04</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
<Ntry><Amt Ccy="EUR">19000.00</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><Dt>2024-03-15</Dt></BookgDt><ValDt><Dt>2024-03-15</Dt></ValDt>
<BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>RCDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
<NtryDtls><TxDtls><RltdPties><Dbtr><Nm>CLIENT NV</Nm></Dbtr></RltdPties><RmtInf><Ustrd>Invoice 2024/0042</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Ntry><Amt Ccy="EUR">2325.48</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2024-03-15</Dt></BookgDt><ValDt><Dt>2024-03-15</Dt></ValDt>
<BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>ICDT</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>
<NtryDtls><TxDtls><RltdPties><Cdtr><Nm>SUPPLIER SA</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Payment supplier</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
<Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">39679.56</Amt><CdtDbtInd>CRDT</CdtDbtInd><Dt><Dt>2024-03-15</Dt></Dt></Bal>
</Stmt></BkToCstmrStmt></Document>`;

// A minimal, valid CODA file (records 0,1,8,9 — empty movement) for the reverse demo.
const CODA = [
  "0" + "0000" + "150324" + "000" + "05" + " " + " ".repeat(7) + " ".repeat(10) + " ".repeat(26) + "GEBABEBB   " + " ".repeat(11) + " " + "00000" + " ".repeat(16) + " ".repeat(16) + " ".repeat(7) + "2",
  "1" + "2" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000023005040" + "150324" + "ACME BVBA".padEnd(26) + " ".repeat(35) + "001",
  "8" + "001" + "BE68539007547034".padEnd(34) + "EUR" + "0" + "000000023005040" + "150324" + " ".repeat(64) + "0",
  "9" + " ".repeat(15) + "000002" + "000000000000000" + "000000000000000" + " ".repeat(75) + "2",
].join("\n");

export const SAMPLES: Sample[] = [
  { label: "CAMT 053 statement", direction: "camt-to-coda", content: CAMT_053 },
  { label: "CODA file", direction: "coda-to-camt", content: CODA },
];
