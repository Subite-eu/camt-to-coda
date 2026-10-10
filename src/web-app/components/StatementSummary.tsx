import { useState } from "react";
import type { CamtStatement } from "@src/core/model";
import type { FieldEntry } from "@/lib/fields";
import { Button } from "./ui/button";
const signed = (a: {amount:number;creditDebit:string}) => (a.creditDebit==="DBIT"?-1:1)*Math.round(a.amount*1000);
const money = (v:number,c:string) => `${v.toFixed(3)} ${c}`;
export function StatementSummary({statement,index,onSelect}:{statement:CamtStatement;index:FieldEntry[];onSelect:(id:string)=>void}) {
  const [page,setPage] = useState(0);
  const entries = statement.entries;
  const delta = signed(statement.closingBalance)-signed(statement.openingBalance)-entries.reduce((s,e)=>s+signed(e),0);
  return <section aria-label="Statement summary" className="space-y-3">
    <h2 className="font-semibold">Statement summary</h2>
    <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
      <div><dt className="text-muted-foreground">Opening balance</dt><dd>{money(signed(statement.openingBalance)/1000,statement.account.currency)}</dd></div>
      <div><dt className="text-muted-foreground">Closing balance</dt><dd>{money(signed(statement.closingBalance)/1000,statement.account.currency)}</dd></div>
      <div><dt className="text-muted-foreground">Movements</dt><dd>{entries.length}</dd></div>
      <div><dt className="text-muted-foreground">Reconciliation difference</dt><dd>{money(delta/1000,statement.account.currency)}</dd></div>
    </dl>
    <div className="overflow-x-auto"><table className="w-full text-sm text-left"><caption className="sr-only">Movement amounts and dates</caption><thead><tr><th className="p-2">Movement</th><th className="p-2">Date</th><th className="p-2">Amount</th><th className="p-2">Inspect</th></tr></thead><tbody>
      {entries.slice(page*25,page*25+25).map((e,i)=> { const f=index.find(f=>f.entryIndex===page*25+i && f.name==="amount" && f.monetaryDetailIndex===undefined); return <tr key={page*25+i} className="border-t"><td className="p-2">{page*25+i+1}</td><td className="p-2">{e.bookingDate??e.valueDate??"Unavailable"}</td><td className="p-2">{money(signed(e)/1000,e.currency)}</td><td>{f && <Button size="sm" variant="ghost" onClick={()=>onSelect(f.id)}>Inspect movement {page*25+i+1}</Button>}</td></tr>; })}
    </tbody></table></div>
    {!entries.length && <p className="text-sm text-muted-foreground">This statement has no movements.</p>}
    {entries.length>25 && <div className="flex gap-2 items-center"><Button variant="outline" disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous movements</Button><span>Page {page+1} of {Math.ceil(entries.length/25)}</span><Button variant="outline" disabled={(page+1)*25>=entries.length} onClick={()=>setPage(p=>p+1)}>Next movements</Button></div>}
  </section>;
}
