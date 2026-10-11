import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { SAMPLES, type Sample } from "@/lib/samples";
import { Button } from "./ui/button";

export function SampleLibrary({ onSelect, loading }: { onSelect: (sample: Sample) => void; loading: boolean }) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("all");
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const matches = SAMPLES.filter(s => (includeInvalid || s.valid) && (format === "all" || s.format === format)
    && query.toLowerCase().trim().split(/\s+/).every(word => s.keywords.includes(word)));
  return <section aria-label="Sample library" className="sample-library min-w-0 space-y-4">
    <div><h2 className="text-xl font-semibold">Explore sample files</h2>
      <p className="text-sm text-muted-foreground mt-1">{SAMPLES.length} original samples. Try payroll, card purchases, international transfers, batches and more.</p></div>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
      <label className="text-sm space-y-1">Search samples<input type="search" aria-label="Search samples" placeholder="Try salary, USD, batch or version 13" value={query} onChange={e => setQuery(e.target.value)} className="block w-full rounded-md border bg-background px-3 py-2 min-h-11" /></label>
      <label className="text-sm space-y-1">Sample format<select aria-label="Sample format" value={format} onChange={e => setFormat(e.target.value)} className="block w-full rounded-md border bg-background px-3 py-2 min-h-11"><option value="all">CAMT and CODA</option><option value="camt">CAMT XML</option><option value="coda">CODA</option></select></label>
    </div>
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <label className="inline-flex gap-2 items-center min-h-8"><input type="checkbox" checked={includeInvalid} onChange={e => setIncludeInvalid(e.target.checked)} />Include invalid examples</label>
      <p role="status" className="text-muted-foreground self-center">{matches.length} matching samples</p>
    </div>
    <ul className="sample-list divide-y border-y overflow-y-auto max-h-96" aria-label="Sample files">
      {matches.map(s => <li key={s.id} className="py-3 pr-2">
        <Button variant="ghost" disabled={loading} onClick={() => onSelect(s)} aria-label={`Load sample: ${s.label}`} aria-describedby={`sample-description-${s.id}${s.valid ? "" : ` sample-error-${s.id}`}`} className="sample-choice w-full justify-between text-left h-auto min-h-11 whitespace-normal px-2 py-2">
          <span className="min-w-0"><span className="block font-medium">{s.label}</span><span id={`sample-description-${s.id}`} className="block text-sm font-normal text-muted-foreground mt-1">{s.description}</span>{!s.valid && <span id={`sample-error-${s.id}`} className="block text-sm text-[color:var(--warning)] mt-1">Expected error</span>}</span><ArrowRight aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </li>)}
    </ul>
    {!matches.length && <p className="text-sm">No samples match. Try another search or include invalid examples to test error handling.</p>}
    <p className="text-sm text-muted-foreground">Independently authored with invented data. For testing and review, never bank import.</p>
  </section>;
}
