import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import type { FieldEntry } from "@/lib/fields";
export function SourcePanel({title,text,selected,index=[],onSelect}: {title:string;text:string;selected?:FieldEntry|null;index?:FieldEntry[];onSelect?:(id:string)=>void;highlight?:string}) {
  const mark = useRef<HTMLButtonElement>(null);
  const [active,setActive]=useState(0);
  const buttons=useRef<(HTMLButtonElement|null)[]>([]);
  const range = selected?.sourceRange;
  const start = range ? Math.max(0,range.start-5000) : 0;
  const end = range ? Math.min(text.length,range.end+5000) : Math.min(text.length,50000);
  const candidates = index.flatMap(f=>(f.sourceRanges?.length ? f.sourceRanges.map(r=>({...f,sourceRange:r,sourceXPath:r.path})) : [f]))
    .filter(f=>f.sourceRange && f.sourceRange.start>=start && f.sourceRange.end<=end)
    .sort((a,b)=>(a.id===selected?.id?-1:b.id===selected?.id?1:a.provenance==="direct"?-1:b.provenance==="direct"?1:0));
  // Split overlapping provenance at every boundary. This preserves selectable
  // continuation fragments even when movement and information zones overlap.
  const boundaries=[...new Set(candidates.flatMap(f=>[f.sourceRange!.start,f.sourceRange!.end]))].sort((a,b)=>a-b);
  const nodes:FieldEntry[]=[];
  for(let i=0;i<boundaries.length-1;i++) {
    const a=boundaries[i],b=boundaries[i+1];
    const field=candidates.find(f=>f.sourceRange!.start<=a&&f.sourceRange!.end>=b);
    if(field&&b>a)nodes.push({...field,sourceRange:{start:a,end:b}});
  }
  const chunks: React.ReactNode[] = [];
  let cursor = start;
  for (const [i,field] of nodes.entries()) {
    const r = field.sourceRange!;
    if (r.start<cursor) continue;
    chunks.push(text.slice(cursor,r.start));
    const isSelected = field.id===selected?.id;
    chunks.push(<button key={`${field.id}:${r.start}`} ref={el=>{buttons.current[i]=el;if(isSelected)mark.current=el;}} aria-label={`CAMT ${field.sourceXPath}, ${field.decodedValue}`} aria-pressed={isSelected} tabIndex={i===Math.min(active,nodes.length-1)?0:-1} onFocus={()=>setActive(i)} onClick={()=>onSelect?.(field.id)} className={isSelected?"bg-primary text-primary-foreground rounded":"underline decoration-dotted underline-offset-4 hover:bg-accent"}>{text.slice(r.start,r.end)}</button>);
    cursor=r.end;
  }
  chunks.push(text.slice(cursor,end));
  useEffect(()=> { mark.current?.scrollIntoView?.({block:"center"}); },[range?.start]);
  return <Card className="document-panel py-0 gap-0">
    <h2 className="panel-toolbar px-3 py-2 border-b font-semibold text-sm">{title}</h2>
    <div className="panel-scroll">
      {(start>0||end<text.length)&&<p className="p-3 text-sm text-muted-foreground">Showing a bounded XML excerpt{range ? " around the selected node" : " (first 50,000 characters)"}. The download contains the complete document.</p>}
      <pre tabIndex={nodes.length ? -1 : 0} aria-label={title} onKeyDown={e=>{
        if (!["ArrowDown","ArrowUp","Home","End"].includes(e.key)||!nodes.length)return;
        e.preventDefault(); const next=e.key==="Home"?0:e.key==="End"?nodes.length-1:(active+(e.key==="ArrowDown"?1:-1)+nodes.length)%nodes.length;setActive(next);buttons.current[next]?.focus();
      }} className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">{chunks}</pre>
    </div>
  </Card>;
}
