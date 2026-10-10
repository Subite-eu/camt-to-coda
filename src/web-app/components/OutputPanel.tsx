import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CodaLine } from "@src/core/field-defs/types";
import type { FieldEntry } from "@/lib/fields";
/** One record at a time bounds DOM size and keyboard stops independently of file size. */
export function OutputPanel({title,lines,index,selectedId,onSelect}: {
  title:string; lines:CodaLine[]; index:FieldEntry[]; selectedId:string|null; onSelect:(id:string)=>void;
}) {
  const [record,setRecord] = useState(0);
  const [search,setSearch] = useState("");
  const [active,setActive] = useState(0);
  const [expert,setExpert] = useState(false);
  const refs = useRef<(HTMLButtonElement|null)[]>([]);
  const selected = index.find(f => f.id === selectedId);
  useEffect(() => { setRecord(0); setActive(0); }, [lines]);
  useEffect(() => { if (selected) setRecord(selected.lineIndex); }, [lines,selected?.lineIndex]);
  const matches = index.filter(f => `${f.name} ${f.value} ${f.description}`.toLowerCase().includes(search.toLowerCase()));
  const fields = search ? matches.slice(0,40) : index.filter(f => f.lineIndex === record);
  const shownRecord = lines[record];
  return <Card className="document-panel py-0 gap-0">
    <div className="panel-toolbar p-3 border-b space-y-2">
      <h2 className="font-semibold text-sm">{title}</h2>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="outline" size="sm" disabled={record===0} onClick={() => setRecord(r=>r-1)}>Previous record</Button>
        <label>Record <input aria-label="Jump to record" type="number" min={1} max={lines.length || 1} value={record+1} className="border rounded px-2 py-1 w-20 bg-background" onChange={e => { setRecord(Math.max(0,Math.min(lines.length-1,Number(e.target.value)-1))); setSearch(""); }} /></label>
        <span>of {lines.length}</span>
        <Button variant="outline" size="sm" disabled={record>=lines.length-1} onClick={() => setRecord(r=>r+1)}>Next record</Button>
        <label className="flex gap-2 items-center"><input type="checkbox" checked={expert} onChange={e=>setExpert(e.target.checked)} />Expert raw record</label>
      </div>
      <label className="block text-sm">Find a field or value<input value={search} onChange={e=>{setSearch(e.target.value);setActive(0);}} className="block w-full border rounded px-2 py-1 bg-background" /></label>
    </div>
    <div className="panel-scroll p-3">
      {expert && shownRecord && <pre aria-label={`Raw record ${record+1}`} className="overflow-x-auto border rounded p-3 mb-3 text-xs font-mono">{shownRecord.raw}</pre>}
      {search && <p className="text-sm mb-2">{matches.length} matches{matches.length>40 ? "; showing first 40. Refine your search." : ""}</p>}
      <p className="text-sm text-muted-foreground mb-2">Select a field to inspect its mapping. Use ↑ and ↓ between fields.</p>
      <div role="group" aria-label="CODA fields" className="space-y-1" onKeyDown={e=>{
        if (!["ArrowDown","ArrowUp","Home","End"].includes(e.key)) return;
        e.preventDefault(); const next = e.key==="Home" ? 0 : e.key==="End" ? fields.length-1 : (active+(e.key==="ArrowDown"?1:-1)+fields.length)%fields.length;
        setActive(next); refs.current[next]?.focus();
      }}>
        {fields.map((f,i)=><button ref={el=>{refs.current[i]=el;}} key={f.id} type="button" tabIndex={i===Math.min(active,fields.length-1)?0:-1} aria-pressed={f.id===selectedId}
          aria-label={`Record ${f.recordType}, ${f.name}, position ${f.codaPos}, ${f.decodedValue ?? f.value}`}
          onFocus={()=>setActive(i)} onClick={()=>onSelect(f.id)}
          className={`field-row w-full text-left border rounded p-2 flex flex-wrap gap-x-3 gap-y-1 text-sm ${f.id===selectedId ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
            <span className="font-medium">{f.name}</span><span className="font-mono break-all">{f.value}</span><span className="ml-auto text-xs">{f.codaPos}</span>
          </button>)}
      </div>
    </div>
  </Card>;
}
