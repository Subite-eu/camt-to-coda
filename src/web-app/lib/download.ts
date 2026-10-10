import { strToU8, zipSync } from "fflate";
import type { Artifact } from "./convert";
export function downloadBlob(name:string,blob:Blob):void {
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function downloadText(name:string,text:string,mime="text/plain"):void { downloadBlob(name,new Blob([text],{type:mime})); }
export function downloadAll(files:Artifact[],anonymized:boolean):void {
  const entries:Record<string,Uint8Array>={};
  files.forEach((f,i)=> { const base=f.fileName.replace(/[^a-zA-Z0-9_.-]/g,"_"); entries[`${i+1}-${base}`]=strToU8(f.outputText); });
  const zip=zipSync(entries); downloadBlob(anonymized?"anonymized-statements.zip":"converted-statements.zip",new Blob([zip as Uint8Array<ArrayBuffer>],{type:"application/zip"}));
}
