import { useEffect, useMemo, useState } from "react";
import bankData from "../../../examples/bank-catalog/catalog.json";
import referenceData from "../../../examples/bank-catalog/country-references.json";

type Resource = { kind: string; access: string; label: string; url: string };
type Entry = {
  id: string; title: string; markets: { region: string; country: string }[];
  formats: string[]; resources: Resource[]; notes: string; context: string;
};
const resourceLabels: Record<string, string> = {
  "sample-file": "XML / ZIP sample", "inline-example": "Inline XML example", "pdf-example": "PDF example",
  specification: "Technical specification", portal: "Sample / testing portal", availability: "Service information",
  standard: "Global standard", "payment-guideline": "Payment guideline",
};
const accessLabels: Record<string, string> = {
  "public-page": "Public page", "public-file": "Public file", registration: "Registration / client access",
  "linked-unverified": "Publisher-linked; download unverified", unavailable: "Currently unavailable",
};
const banks: Entry[] = bankData.banks.map(b => ({ ...b, title: b.bank, context: b.marketBasis }));
const references: Entry[] = referenceData.references.map(r => ({ ...r, title: r.authority, context: r.reportingCoverage }));
const controlClass = "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm";

export function BankCatalog() {
  useEffect(() => { document.getElementById("catalog-title")?.focus(); }, []);
  const [section, setSection] = useState<"banks" | "references">("banks");
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("");
  const [country, setCountry] = useState("");
  const [kind, setKind] = useState("");
  const entries = section === "banks" ? banks : references;
  const regions = [...new Set(entries.flatMap(e => e.markets.map(m => m.region)))].sort();
  const countries = [...new Set(entries.flatMap(e => e.markets.filter(m => !region || m.region === region).map(m => m.country)))].sort();
  const kinds = [...new Set(entries.flatMap(e => e.resources.map(r => r.kind)))].sort();
  const filtered = useMemo(() => {
    const words = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    return entries.filter(e => {
      const text = [e.title, ...e.formats, ...e.markets.map(m => m.country), e.notes, e.context].join(" ").toLocaleLowerCase();
      const nameWords = [e.title, ...e.formats, ...e.markets.map(m => m.country)].join(" ").toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u);
      return words.every(w => w.length <= 3 ? nameWords.some(part => part.startsWith(w)) : text.includes(w)) && e.markets.some(m => (!region || m.region === region) && (!country || m.country === country))
        && (!kind || e.resources.some(r => r.kind === kind));
    });
  }, [entries, query, region, country, kind]);
  function reset() { setQuery(""); setRegion(""); setCountry(""); setKind(""); }
  return <section className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6" aria-labelledby="catalog-title">
    <a href="#workspace" className="inline-flex min-h-11 items-center underline underline-offset-4">← Return to converter</a>
    <div className="space-y-3 max-w-3xl">
      <h1 id="catalog-title" tabIndex={-1} className="text-2xl font-bold tracking-tight focus:outline-none">Bank reporting catalog</h1>
      <p>Official bank examples and specifications, with national and regional ISO 20022 references.</p>
      <details className="text-sm"><summary className="cursor-pointer min-h-11 py-3">Scope, access and converter support</summary><p className="text-sm text-muted-foreground">Geography follows the documented market, rather than a bank’s headquarters. Account and channel eligibility must be confirmed with the bank. A public specification does not establish availability for every customer. CAMT054 and wrapped XML are reference material; this converter supports standalone CAMT052/053. Download rights do not automatically permit redistribution.</p>
      <p className="text-sm text-muted-foreground">Sources checked {bankData.verifiedOn}. This is a curated inventory; an absent country or bank means coverage has not yet been verified.</p></details>
    </div>
    <nav aria-label="Catalog sections" className="flex flex-wrap gap-2">
      <button className="min-h-11 rounded-md border px-4 text-sm aria-pressed:bg-secondary aria-pressed:font-semibold" aria-pressed={section === "banks"} onClick={() => { setSection("banks"); reset(); }}>Banks ({banks.length})</button>
      <button className="min-h-11 rounded-md border px-4 text-sm aria-pressed:bg-secondary aria-pressed:font-semibold" aria-pressed={section === "references"} onClick={() => { setSection("references"); reset(); }}>Country & regional references ({references.length})</button>
    </nav>
    {section === "references" && <p className="max-w-3xl text-sm">National authorities often publish local implementation rules, but some cover payment clearing only. Each entry states whether CAMT account reporting is covered. Regional and global references are listed separately from country rules.</p>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <label className="col-span-2 lg:col-span-1 space-y-1 text-sm">{section === "banks" ? "Search banks and reporting formats" : "Search authorities and message formats"}<input type="search" aria-label={section === "banks" ? "Search banks and reporting formats" : "Search authorities and message formats"} value={query} onChange={e => setQuery(e.target.value)} className={controlClass} placeholder="Name, country or CAMT version" /></label>
      <label className="space-y-1 text-sm">Region<select aria-label="Region" value={region} onChange={e => { setRegion(e.target.value); setCountry(""); }} className={controlClass}><option value="">All regions</option>{regions.map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="space-y-1 text-sm">Country / market<select aria-label="Country / market" value={country} onChange={e => setCountry(e.target.value)} className={controlClass}><option value="">All countries / markets</option>{countries.map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="col-span-2 lg:col-span-1 space-y-1 text-sm">Resource type<select aria-label="Resource type" value={kind} onChange={e => setKind(e.target.value)} className={controlClass}><option value="">All resource types</option>{kinds.map(k => <option key={k} value={k}>{resourceLabels[k] ?? k}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center gap-4 text-sm"><p role="status">{filtered.length} of {entries.length} {section === "banks" ? "banks" : "references"}</p><button className="min-h-11 underline underline-offset-4" onClick={reset}>Reset filters</button></div>
    {!filtered.length && <p>No {section === "banks" ? "banks" : "references"} match these filters. Try another country, resource type or search term.</p>}
    <div className="space-y-4">{filtered.map(e => <article key={e.id} aria-label={e.title} className="rounded-lg border p-4 sm:p-5 space-y-3 break-words">
      <div><p className="text-sm text-muted-foreground">{e.markets.map(m => `${m.region} · ${m.country}`).join(" / ")}</p><h2 className="text-lg font-semibold">{e.title}</h2></div>
      <p className="text-sm">{e.context}</p><p className="text-sm font-medium">{e.formats.join(" · ")}</p>
      <ul className="space-y-2">{e.resources.filter(r => !kind || r.kind === kind).map((r, i) => <li key={`${r.url}-${i}`} className="text-sm"><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">{r.label} ↗</a><span className="block text-muted-foreground">{resourceLabels[r.kind] ?? r.kind} · {accessLabels[r.access] ?? r.access}</span></li>)}</ul>
      <details className="text-sm"><summary className="cursor-pointer min-h-11 py-3">Scope and source notes</summary><p className="mt-2 text-muted-foreground">{e.notes}</p></details>
    </article>)}</div>
  </section>;
}
