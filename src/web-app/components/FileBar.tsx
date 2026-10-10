import { X, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
export function FileBar({ fileName,recordCount,validation,onClear,version,onIssue }: {
  fileName:string;recordCount:number;validation:{valid:boolean;errors:string[];warnings:string[]};onClear:()=>void;version?:string|null;onIssue?:(message:string)=>void;
}) {
  return <section aria-label="File and validation" className="file-bar flex flex-wrap items-center gap-3 px-4 py-2 border-b bg-muted/30 text-sm">
    <p className="min-w-0 break-all flex gap-2 items-center"><FileText aria-hidden="true" className="size-4 shrink-0" /><span>{fileName || "Pasted text"}{version ? ` · ${version}` : ""} · {recordCount} CODA records</span></p>
    <Badge variant={validation.valid?"secondary":"destructive"}>{validation.valid ? "✓ Valid · runtime checks" : `✕ ${validation.errors.length} error${validation.errors.length===1?"":"s"}`}</Badge>
    {!!validation.errors.length && <details><summary className="cursor-pointer text-destructive">Review errors</summary><ul className="notice-list">{validation.errors.map((m,i)=><li key={i}><button type="button" onClick={()=>onIssue?.(m)}>{m}</button></li>)}</ul><p>Correct the source or load another file. Downloads are disabled.</p></details>}
    {!!validation.warnings.length && <details><summary className="cursor-pointer text-[color:var(--warning)]">{validation.warnings.length} note{validation.warnings.length===1?"":"s"}</summary><ul className="notice-list">{validation.warnings.map((m,i)=><li key={i}><button type="button" onClick={()=>onIssue?.(m)}>{m}</button></li>)}</ul></details>}
    <Button variant="ghost" size="icon" className="ml-auto" aria-label="Load another file" onClick={onClear}><X className="size-4" /></Button>
  </section>;
}
