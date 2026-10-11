import { it, expect } from "vitest";
import { buildFieldIndex } from "./fields";
import { convert } from "./convert";
import basic from "../../../examples/camt/camt.053.001.08.xml?raw";
it("selects the exact amount node rather than repeated raw text", () => {
  const sample = basic;
  const r = convert(sample,"camt-to-coda",false);
  const fields = buildFieldIndex(r.codaLines,sample);
  const amount = fields.find(f => f.name === "amount")!;
  expect(amount.sourceRange).toBeDefined();
  expect(sample.slice(amount.sourceRange!.start,amount.sourceRange!.end)).not.toBe(amount.value);
  expect(amount.sourceXPath).toContain("Ntry[1]/Amt[1]");
  expect(amount.provenance).toBe("derived");
});
it("maps repeated statement amounts to separate exact nodes and closing versus opening balances",()=> {
  const sample=basic;
  const multi=sample.replace("</Stmt>","</Stmt>"+sample.match(/<Stmt>[\s\S]*?<\/Stmt>/)![0]);
  const r=convert(multi,"camt-to-coda",false);
  const a=r.fieldIndexes[0].find(f=>f.name==="amount")!;
  const b=r.fieldIndexes[1].find(f=>f.name==="amount")!;
  expect(a.sourceRange!.start).not.toBe(b.sourceRange!.start);
  expect(a.sourceXPath).toContain("Stmt[1]");expect(b.sourceXPath).toContain("Stmt[2]");
  const balances=r.fieldIndexes[0].filter(f=>f.name==="balanceAmount");
  expect(multi.slice(balances[0].sourceRange!.start,balances[0].sourceRange!.end)).toBe("100.000");
  expect(multi.slice(balances[1].sourceRange!.start,balances[1].sourceRange!.end)).toBe("112.345");
});
it("reverse mappings locate specific output nodes and mark CODA constants honestly",()=> {
  const plain=convert(basic,"camt-to-coda",false);
  const r=convert(plain.outputText,"coda-to-camt",false);
  expect(r.error).toBeUndefined();
  const amount=r.fieldIndexes[0].find(f=>f.name==="amount")!;
  expect(r.outputText.slice(amount.sourceRange!.start,amount.sourceRange!.end)).toBe("12.345");
  expect(r.fieldIndexes[0].find(f=>f.name==="recordType")?.provenance).toBe("defaulted");
});
it("maps continuation communication to the contributing second Ustrd in the public long-remittance source",async()=> {
  const xml=(await import("../../../examples/camt/camt-long-remittance.xml?raw")).default;
  const r=convert(xml,"camt-to-coda",false);
  expect(r.error).toBeUndefined();
  const final=r.fieldIndexes[0].find(f=>f.recordType==="3.3"&&f.name==="communication")!;
  expect(final.sourceXPath).toContain("Ustrd[2]");
  expect(final.decodedValue).toBe(final.value);
  expect(final.provenance).toBe("derived");
  expect(xml.slice(final.sourceRange!.start,final.sourceRange!.end)).toContain("DDDD");
  const crossing=r.fieldIndexes[0].find(f=>f.recordType==="3.2"&&f.name==="communication")!;
  expect(crossing.sourceRanges).toHaveLength(2);
  expect(crossing.rule).toContain("73");
});
it("maps public monetary breakdowns inside their aggregate entry in both directions",async()=> {
  const coda=(await import("../../../examples/coda/coda-monetary-details.cod?raw")).default;
  const reverse=convert(coda,"coda-to-camt",false);
  const forward=convert(reverse.outputText,"camt-to-coda",false);
  for(const r of [reverse,forward]) {
    expect(r.error).toBeUndefined();expect(r.statements[0].entries).toHaveLength(1);
    const amounts=r.fieldIndexes[0].filter(f=>f.recordType==="2.1"&&f.name==="amount");
    expect(amounts).toHaveLength(3);expect(amounts.map(f=>f.entryIndex)).toEqual([0,0,0]);
    expect(amounts.map(f=>f.decodedValue)).toEqual(["12.345","6.000","6.345"]);
    expect(amounts[1].sourceXPath).toMatch(/Ntry\[1\].*TxDtls\[2\]\/Amt\[1\]/);
    expect(amounts[2].sourceXPath).toMatch(/Ntry\[1\].*TxDtls\[3\]\/Amt\[1\]/);
    expect(amounts[1].monetaryDetailIndex).toBe(0);expect(amounts[2].monetaryDetailIndex).toBe(1);
    expect(amounts[1].currency).toBe("EUR");expect(amounts[1].creditDebit).toBe("CRDT");
    const sign=r.fieldIndexes[0].find(f=>f.lineIndex===amounts[1].lineIndex&&f.name==="amountSign")!;
    expect(sign.sourceXPath).toContain("TxDtls[2]/CdtDbtInd[1]");
    expect(sign.decodedValue).toBe("CRDT");
  }
});
it("uses a monetary detail's own debit direction to locate its creditor party",async()=> {
  const coda=(await import("../../../examples/coda/coda-monetary-details.cod?raw")).default;
  const reverse=convert(coda,"coda-to-camt",false);
  const xml=reverse.outputText.replace('<Amt Ccy="EUR">6.000</Amt><CdtDbtInd>CRDT</CdtDbtInd>', '<Amt Ccy="EUR">6.000</Amt><CdtDbtInd>DBIT</CdtDbtInd><RltdPties><Cdtr><Pty><Nm>Detail Supplier</Nm></Pty></Cdtr></RltdPties>');
  const r=convert(xml,"camt-to-coda",false);
  expect(r.error).toBeUndefined();
  const name=r.fieldIndexes[0].find(f=>f.name==="counterpartName"&&f.value==="Detail Supplier")!;
  expect(name.sourceXPath).toContain("Cdtr[1]/Pty[1]/Nm[1]");
  expect(name.creditDebit).toBe("DBIT");expect(name.entryIndex).toBe(0);expect(name.monetaryDetailIndex).toBe(0);
  const sign=r.fieldIndexes[0].find(f=>f.name==="amountSign"&&f.monetaryDetailIndex===0)!;
  expect(sign.decodedValue).toBe("DBIT");expect(sign.value).toBe("1");
});
it("maps a monetary counterparty currency to its detail amount attribute rather than account currency",async()=> {
  const coda=(await import("../../../examples/coda/coda-monetary-details.cod?raw")).default;
  const reverse=convert(coda,"coda-to-camt",false);
  const xml=reverse.outputText.replace('<Amt Ccy="EUR">6.000</Amt><CdtDbtInd>CRDT</CdtDbtInd>', '<Amt Ccy="USD">6.000</Amt><CdtDbtInd>CRDT</CdtDbtInd><RltdPties><Dbtr><Pty><Nm>Foreign Detail</Nm></Pty></Dbtr></RltdPties>');
  const r=convert(xml,"camt-to-coda",false);
  expect(r.error).toBeUndefined();
  const currency=r.fieldIndexes[0].find(f=>f.recordType==="2.3"&&f.name==="currency"&&f.monetaryDetailIndex===0)!;
  expect(currency.value).toBe("USD");expect(currency.decodedValue).toBe("USD");expect(currency.sourceXPath).toContain("TxDtls[2]/Amt[1]/@Ccy");
  expect(xml.slice(currency.sourceRange!.start,currency.sourceRange!.end)).toBe("USD");
});
it("maps CAMT v02 monetary amounts nested in AmtDtls and their inherited direction",async()=> {
  const {statementsToXml}=await import("@src/core/camt-writer");
  const coda=(await import("../../../examples/coda/coda-monetary-details.cod?raw")).default;
  const reverse=convert(coda,"coda-to-camt",false);
  const xml=statementsToXml(reverse.statements,"camt.053.001.02");
  const r=convert(xml,"camt-to-coda",false);
  expect(r.error).toBeUndefined();
  const detail=r.fieldIndexes[0].find(f=>f.name==="amount"&&f.monetaryDetailIndex===0)!;
  expect(detail.sourceXPath).toContain("TxDtls[2]/AmtDtls[1]/TxAmt[1]/Amt[1]");
  expect(detail.decodedValue).toBe("6.000");expect(detail.currency).toBe("EUR");expect(detail.creditDebit).toBe("CRDT");
  expect(xml.slice(detail.sourceRange!.start,detail.sourceRange!.end)).toBe("6.000");
  const sign=r.fieldIndexes[0].find(f=>f.name==="amountSign"&&f.monetaryDetailIndex===0)!;
  expect(sign.sourceXPath).toMatch(/Ntry\[1\]\/CdtDbtInd\[1\]$/);expect(sign.decodedValue).toBe("CRDT");
});
