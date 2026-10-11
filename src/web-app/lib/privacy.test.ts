import { it, expect } from "vitest";
import { sha256 } from "@src/anonymize/sha256";
import { convert } from "./convert";
import basic from "../../../examples/camt/camt.053.001.08.xml?raw";
import { parseCamt } from "@src/core/camt-parser";
it("uses standard SHA-256 including non-ASCII UTF-8",()=> {
  expect(sha256("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  expect(sha256("é")).toBe("4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c");
});
it("privacy exports every reverse statement and removes names, bank identifiers, free text and references",()=> {
  const sample=basic.replace("<Id>EXAMPLE-001</Id>","<Id>SECRET-STATEMENT</Id>")
    .replace("<NtryRef>ENTRY-1</NtryRef>", "<NtryRef>SECRET-REFERENCE</NtryRef>");
  const plain=convert(sample,"camt-to-coda",false);
  expect(plain.error).toBeUndefined();
  const multi=plain.outputText.slice(0,-1)+"1\n"+plain.outputText;
  const r=convert(multi,"coda-to-camt",true);
  expect(r.error).toBeUndefined();
  expect(r.statements).toHaveLength(2);
  expect(parseCamt(r.outputText)).toHaveLength(2);
  for(const secret of ["SECRET-REFERENCE","SECRET-STATEMENT","BE68539007547034","Example Company","Example Counterparty","BANK-EXAMPLE-1","Example invoice 42","EXAMBEBB"])
    expect(r.outputText).not.toContain(secret);
  expect(r.outputText).toContain("ANON-");
  expect(r.outputText).toContain("12.345");
  expect(r.files[0].outputText).toBe(r.outputText);
});
it("anonymized forward metadata exactly describes bytes exported for every statement",()=> {
  const sample=basic;
  const multi=sample.replace("</Stmt>","</Stmt>"+sample.match(/<Stmt>[\s\S]*?<\/Stmt>/)![0]);
  const r=convert(multi,"camt-to-coda",true);
  expect(r.error).toBeUndefined();
  expect(r.files).toHaveLength(2);
  for(const f of r.files){expect(f.codaLines.map(l=>l.raw).join("\n")).toBe(f.outputText);expect(f.fileName).toMatch(/^anonymized-statement-\d\.cod$/);expect(f.outputText).not.toContain("Example Company");}
});
it("preserves packed Belgian BBAN currency and nonidentifying account metadata",()=> {
  const xml=basic.replace("<IBAN>BE68539007547034</IBAN>","<Othr><Id>539007547034</Id></Othr>");
  const r=convert(xml,"camt-to-coda",true);
  expect(r.error).toBeUndefined();
  for(const type of ["1","8"]) {
    const line=r.codaLines.find(l=>l.recordType===type)!;
    expect(line.raw).toHaveLength(128);
    expect(line.fields.find(f=>f.name==="currency")?.value).toBe("EUR");
    const account=line.fields.find(f=>f.name==="accountNumber")!.value;
    expect(account).toHaveLength(12);expect(account).not.toBe("539007547034");
  }
});
