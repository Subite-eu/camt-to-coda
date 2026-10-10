import type { CodaLine } from "@src/core/field-defs/types";
export interface FieldEntry {
  id: string; recordType: string; name: string; value: string; codaPos: string;
  sourceXPath?: string; description?: string; lineIndex: number;
  rawValue?: string; decodedValue?: string;
  sourceRange?: { start: number; end: number };
  sourceRanges?: { start: number; end: number; path: string }[];
  provenance?: "direct" | "derived" | "defaulted" | "truncated" | "unavailable";
  rule?: string; statementIndex?: number; entryIndex?: number; detailIndex?: number;
  monetaryDetailIndex?: number; currency?: string; creditDebit?: string;
}
interface Node { name: string; start: number; end: number; path: string; children: Node[]; }
/** Token offsets refer to this exact XML string; never to globally matching text. */
function xmlTree(xml: string): Node {
  const root: Node = { name: "", start: 0, end: xml.length, path: "", children: [] };
  const stack = [root];
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<[^>]*>/g;
  for (const token of xml.matchAll(tokens)) {
    const raw = token[0];
    if (/^<[!?]/.test(raw)) continue;
    if (raw.startsWith("</")) { const n = stack.pop(); if (n && n !== root) n.end = token.index; continue; }
    const name = raw.match(/^<([^\s/>]+)/)?.[1]?.split(":").pop();
    if (!name) continue;
    const parent = stack[stack.length-1];
    const siblings = parent.children.filter(n => n.name === name).length + 1;
    const n: Node = { name, start: token.index + raw.length, end: token.index + raw.length, path: `${parent.path}/${name}[${siblings}]`, children: [] };
    parent.children.push(n);
    if (!raw.endsWith("/>")) stack.push(n);
  }
  return root;
}
function all(node: Node, name: string): Node[] {
  return node.children.flatMap(n => [...(n.name === name ? [n] : []), ...all(n, name)]);
}
function child(node: Node | undefined, ...path: string[]): Node | undefined {
  let current = node;
  for (const name of path) current = current?.children.find(n => n.name === name);
  return current;
}
function transactionAmount(node:Node|undefined):Node|undefined { return child(node,"Amt") ?? child(node,"AmtDtls","TxAmt","Amt"); }
function attributeNode(xml:string,node:Node|undefined,name:string):Node|undefined {
  if(!node)return undefined;
  const openStart=xml.lastIndexOf("<",node.start-1),open=xml.slice(openStart,node.start);
  const match=open.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`));
  if(!match)return undefined;
  const start=openStart+match.index!+match[0].indexOf(match[1])+1;
  return {name:`@${name}`,start,end:start+match[2].length,path:`${node.path}/@${name}`,children:[]};
}
function leaf(n: Node | undefined): Node | undefined { return n?.children.length ? leaf(n.children[0]) : n; }
function decoded(value: string) {
  return value.replace(/&(lt|gt|quot|apos|amp|#x[\da-f]+|#\d+);/gi, (match,code:string) => {
    if(code[0]==="#") return String.fromCodePoint(parseInt(code.slice(code[1]==="x"?2:1),code[1]==="x"?16:10));
    return ({lt:"<",gt:">",quot:'"',apos:"'",amp:"&"} as Record<string,string>)[code]??match;
  });
}
/** Map a decoded character boundary back onto this node's exact XML bytes. */
function boundary(raw: string, offset: number): number {
  let pos=0, chars=0;
  while(pos<raw.length && chars<offset) {
    const entity=raw.slice(pos).match(/^&(?:lt|gt|quot|apos|amp|#x[\da-f]+|#\d+);/i)?.[0];
    if(entity){chars+=decoded(entity).length;pos+=entity.length;}else {chars++;pos++;}
  }
  return pos;
}
function communicationMap(xml:string,tx:Node|undefined,line:CodaLine,structuredType:boolean,length:number) {
  if(!tx)return undefined;
  const rmt=child(tx,"RmtInf");
  if(!rmt)return undefined;
  const ustrds=rmt.children.filter(n=>n.name==="Ustrd");
  const ref=all(rmt,"Ref")[0];
  const information=line.recordType.startsWith("3.");
  const nodes=information&&ustrds.length ? ustrds : ref ? [ref] : ustrds;
  if(!nodes.length)return undefined;
  const offsets:Record<string,number>={"2.1":0,"2.2":53,"2.3":106,"3.1":0,"3.2":73,"3.3":178};
  const offset=offsets[line.recordType]??0;
  const structured=nodes[0]===ref && structuredType;
  let cursor=structured?3:0;
  const ranges:{start:number;end:number;path:string}[]=[];
  let full=structured?"101":"";
  for(const n of nodes){
    const raw=xml.slice(n.start,n.end), value=decoded(raw);
    const start=Math.max(0,offset-cursor),end=Math.min(value.length,offset+length-cursor);
    if(end>start)ranges.push({start:n.start+boundary(raw,start),end:n.start+boundary(raw,end),path:n.path});
    cursor+=value.length;full+=value;
  }
  if(!ranges.length)return undefined;
  return {ranges,value:full.slice(offset,offset+length).trim(),offset,fullLength:full.length,structured};
}
/** Flatten fields and resolve statement/entry/detail-scoped provenance. */
export function buildFieldIndex(lines: CodaLine[], xml?: string, selectedStatement = 0): FieldEntry[] {
  const root = xml ? xmlTree(xml) : null;
  const statements = root ? [...all(root,"Stmt"), ...all(root,"Rpt")] : [];
  let logical = -1, entry = -1, detail = 0;
  let movementStructured=false, informationStructured=false;
  let movementDetail=0; const aggregateEntries=new Map<string,number>();
  const out: FieldEntry[] = [];
  lines.forEach((line,lineIndex) => {
    if (line.recordType === "0") { logical++; entry = -1; aggregateEntries.clear(); movementDetail=0; }
    if (line.recordType === "2.1") {
      movementDetail=Number(line.raw.slice(6,10)); detail=0;
      const sequence=line.raw.slice(2,6);
      if(movementDetail===0) {entry=aggregateEntries.size;aggregateEntries.set(sequence,entry);}
      else entry=aggregateEntries.get(sequence)??-1;
    }
    if(!line.recordType.startsWith("2.")&&!line.recordType.startsWith("3."))movementDetail=0;
    if (line.recordType === "3.1") detail = Math.max(0, Number(line.raw.slice(6,10))-1);
    if(line.recordType==="2.1")movementStructured=line.fields.find(f=>f.name==="communicationType")?.value==="1";
    if(line.recordType==="3.1")informationStructured=line.fields.find(f=>f.name==="communicationType")?.value==="1";
    const statementIndex = selectedStatement + Math.max(0,logical);
    const statement = statements[statementIndex];
    const ntry = statement?.children.filter(n => n.name === "Ntry")[entry];
    const transactions=ntry ? all(ntry,"TxDtls") : [];
    const monetary=transactions.filter(n=>transactionAmount(n));
    const summaryDetails=transactions.filter(n=>!transactionAmount(n));
    const tx=movementDetail>0 ? monetary[movementDetail-1] : summaryDetails[detail];
    const amountNode=transactionAmount(movementDetail>0?tx:ntry);
    const directionNode=child(movementDetail>0?tx:ntry,"CdtDbtInd") ?? child(ntry,"CdtDbtInd");
    const direction=directionNode&&xml?xml.slice(directionNode.start,directionNode.end):undefined;
    const amountTag=amountNode&&xml?xml.slice(xml.lastIndexOf("<",amountNode.start-1),amountNode.start):"";
    const currency=amountTag.match(/\bCcy\s*=\s*["']([^"']*)["']/)?.[1];
    const balance = statement?.children.filter(n => n.name === "Bal").find(n => {
      const code = child(n,"Tp","CdOrPrtry","Cd");
      return code && xml?.slice(code.start,code.end) === (line.recordType === "8" ? "CLBD" : "OPBD");
    });
    for (const f of line.fields) {
      if (!f.value.trim()) continue;
      let node: Node | undefined;
      let rule = "No specific CAMT source node is available for this field.";
      let provenance: FieldEntry["provenance"] = "unavailable";
      const cp = tx && child(tx,"RltdPties");
      const cpRole = directionNode;
      const credit = cpRole && xml?.slice(cpRole.start,cpRole.end) === "CRDT";
      const role = credit ? "Dbtr" : "Cdtr";
      if (f.name === "accountNumber" || f.name === "accountStructure") node = leaf(child(statement,"Acct","Id"));
      if (f.name === "holderName" || f.name === "addresseeName") node = leaf(child(statement,"Acct","Ownr"));
      if (f.name === "currency") node = line.recordType==="2.3" && xml ? attributeNode(xml,amountNode,"Ccy") ?? attributeNode(xml,child(ntry,"Amt"),"Ccy") : child(statement,"Acct","Ccy");
      if (f.name === "balanceAmount") node = child(balance,"Amt");
      if (f.name === "balanceSign") node = child(balance,"CdtDbtInd");
      if (f.name === "balanceDate") node = leaf(child(balance,"Dt"));
      if (f.name === "amount") node = amountNode;
      if (f.name === "amountSign") node = directionNode;
      if (f.name === "valueDate") node = leaf(child(movementDetail>0?tx:undefined,"ValDt") ?? child(ntry,"ValDt"));
      if (f.name === "entryDate") node = leaf(child(movementDetail>0?tx:undefined,"BookgDt") ?? child(ntry,"BookgDt"));
      if (f.name === "bankReference") node = (movementDetail>0?child(tx,"Refs","AcctSvcrRef"):undefined) ?? child(ntry,"AcctSvcrRef") ?? child(ntry,"NtryRef");
      if (f.name === "customerRef") node = child(tx,"Refs","EndToEndId");
      if (f.name === "counterpartAccount") node = leaf(child(cp,`${role}Acct`,"Id"));
      if (f.name === "counterpartName") node = child(cp,role,"Nm") ?? child(cp,role,"Pty","Nm");
      if (f.name === "counterpartBic") node = tx && leaf(child(tx,"RltdAgts",`${role}Agt`,"FinInstnId"));
      if (f.name === "purpose") node = leaf(child(tx,"Purp"));
      if (f.name === "categoryPurpose") node = leaf(child(tx,"CtgyPurp") ?? child(tx,"PmtTpInf","CtgyPurp"));
      if (f.name === "isoReason") node = ntry && leaf(all(ntry,"RtrInf")[0]);
      if (f.name === "communication") node = child(tx,"RmtInf","Ustrd") ?? (tx && all(tx,"Ref")[0]);
      if (f.name === "transactionCode") node = child(movementDetail>0?tx:undefined,"BkTxCd") ?? child(ntry,"BkTxCd");
      if (node) {
        provenance = "direct"; rule = "Text copied and padded to the CODA field width.";
        if (/Amount$|^amount$/.test(f.name)) { provenance = "derived"; rule = "Decimal amount × 1000, zero-padded to 15 digits; sign is stored separately."; }
        else if (/Sign$/.test(f.name)) { provenance = "derived"; rule = "CRDT → 0; DBIT → 1."; }
        else if (/Date$/.test(f.name)) { provenance = "derived"; rule = "ISO date → DDMMYY; time is not represented in CODA."; }
        else if (f.name === "accountStructure") { provenance = "derived"; rule = "Account identifier determines the CODA account structure code."; }
        else if (f.name === "transactionCode") { provenance = "derived"; rule = "Bank transaction-code mapping; format-specific defaults may apply."; }
        else if (xml && decoded(xml.slice(node.start,node.end)).trim().length > f.length) { provenance = "truncated"; rule = "This CODA field contains a portion of a longer value; inspect continuation records."; }
      } else if (!f.sourceXPath) { provenance = "defaulted"; rule = "CODA structural value, sequence, link, reserved field or format default; no direct XML node."; }
      const communication = f.name === "communication" && xml ? communicationMap(xml,tx,line,line.recordType.startsWith("3.")?informationStructured:movementStructured,f.length) : undefined;
      if (communication) {
        provenance = "derived";
        rule = `Concatenate remittance nodes in document order${communication.structured ? "; prefix CODA type 101" : ""}; take CODA communication characters ${communication.offset}–${communication.offset+f.length-1} (zero-based), then pad to field width. Source ranges identify only contributing characters.`;
      }
      const rawValue = f.value;
      out.push({ id: `${line.recordType}:${f.name}:${lineIndex}`, recordType: line.recordType, name:f.name, value:f.value.trim(), rawValue,
        codaPos:`${f.start+1}-${f.start+f.length}`, sourceXPath: communication?.ranges.map(r=>r.path).join(" + ") ?? node?.path ?? f.sourceXPath, description:f.description, lineIndex,
        sourceRange: communication ? {start:communication.ranges[0].start,end:communication.ranges[communication.ranges.length-1].end} : node ? { start:node.start,end:node.end } : undefined,
        sourceRanges: communication?.ranges,
        decodedValue: communication?.value ?? (node && xml ? decoded(xml.slice(node.start,node.end)).trim() : f.value.trim()), provenance,rule,statementIndex,entryIndex:entry,detailIndex:detail,
        monetaryDetailIndex:movementDetail>0?movementDetail-1:undefined,currency,creditDebit:direction });
    }
  });
  return out;
}
