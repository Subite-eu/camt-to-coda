import { useEffect, useRef, useState } from "react";
import catalog from "../../../examples/download-catalog.json";
import { SAMPLES } from "../lib/samples";
import { downloadBlob } from "../lib/download";
import { fetchExampleOriginal, type PublisherSource } from "../lib/publisher-download";
import type { Direction } from "../lib/convert";

type Example = {
  id: string; filename: string; format: string; version: string; provenance: "bank" | "third-party" | "synthetic";
  publisher: string; publisherId: string; bank: string; countries: string[]; countryBasis: string;
  status: string; caution: boolean; description: string; documentationUrl: string; termsUrl: string | null; license: string;
  source?: PublisherSource; archive?: string | null; member?: string | null; extractedPayload?: boolean; sampleId?: string; verifiedOn?: string;
  classification?: string; encoding?: string;
};
const examples = catalog.examples as Example[];
const provenanceLabels = { bank: "Bank-published original", "third-party": "Third-party fixture", synthetic: "Synthetic test data" };
const normalize = (text: string) => text.normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase();
const controlClass = "min-h-11 w-full rounded-md border bg-background px-3 py-2 text-sm";
type TryExample = (content: string, direction: Direction, filename: string) => void;

function ExampleRow({ example: e, onTry }: { example: Example; onTry?: TryExample }) {
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => () => controller.current?.abort(), []);
  async function act(tryInConverter = false) {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setBusy(true); setError(""); setSaved(false);
    try {
      if (e.source) {
        const bytes = await fetchExampleOriginal(e.source, current.signal);
        if (!current.signal.aborted) downloadBlob(e.filename, new Blob([bytes], { type: "application/octet-stream" }));
      } else {
        const sample = SAMPLES.find(s => s.id === e.sampleId);
        if (!sample) throw new Error("Test file unavailable");
        const content = await sample.load();
        if (current.signal.aborted) return;
        if (tryInConverter) onTry?.(content, sample.direction, e.filename);
        else downloadBlob(e.filename, new Blob([content], { type: "text/plain;charset=utf-8" }));
      }
      if (!current.signal.aborted) setSaved(!tryInConverter);
    } catch {
      if (!current.signal.aborted) setError(e.source
        ? "Your browser could not save this publisher file. Use the publisher download link; archives may need unpacking. If it opens in a tab, save the file from that tab."
        : "This test file could not be loaded. Please try again.");
    } finally { if (!current.signal.aborted) setBusy(false); }
  }
  return <article aria-label={e.id} className="border-b py-5 space-y-3 min-w-0">
    <div className="flex flex-wrap gap-2 text-xs font-medium"><span className="rounded border px-2 py-1">{provenanceLabels[e.provenance]}</span><span className="rounded border px-2 py-1">{e.version}</span><span className={`rounded border px-2 py-1 ${e.caution ? "text-[color:var(--warning)]" : ""}`}>{e.status}</span></div>
    <h2 className="font-semibold break-all">{e.filename}</h2>
    <div className="text-sm space-y-1 break-words"><p>Bank: {e.bank} · Publisher: {e.publisher}</p><p>Country / scope: {e.countries.join(" · ")}</p><p className="text-muted-foreground">{e.countryBasis}</p></div>
    <p className="text-sm break-words">{e.description}</p>
    {e.member && <p className="text-sm text-muted-foreground break-all">{e.extractedPayload ? "Extracted payload" : "Individual file"} inside publisher {e.archive}: {e.member}. Save original file extracts the pinned bytes without rewriting them.</p>}
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      <button disabled={busy} onClick={() => void act()} className="min-h-11 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">{busy ? "Preparing file…" : e.source ? "Save original file" : "Download test file"}</button>
      {!e.source && onTry && <button disabled={busy} onClick={() => void act(true)} className="min-h-11 underline underline-offset-4 text-sm">Try in converter</button>}
      {e.source && <a href={e.source.url} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center underline underline-offset-4 text-sm">Publisher {e.archive ?? e.format} download ↗</a>}
    </div>
    {error && <p role="alert" className="text-sm">{error}</p>}
    {saved && <p role="status" className="text-sm">File prepared. Check your browser’s downloads.</p>}
    <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">Provenance, verification and usage terms</summary>
      <div className="space-y-2 break-words"><p>{e.license}</p>{e.verifiedOn && <p>Source checked {e.verifiedOn}.</p>}
        {e.classification && <p>Fixture type: {e.classification.replaceAll("-", " ")} · Encoding: {e.encoding}</p>}
        {e.source && <p className="break-all">Original SHA-256: {e.source.sourceSha256} · {e.source.sourceBytes.toLocaleString()} bytes</p>}
        <p><a href={e.documentationUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Publisher documentation ↗</a></p>
        {e.termsUrl ? <p><a href={e.termsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Usage terms ↗</a></p> : <p>No separate usage-terms link verified. Check publisher documentation before reuse.</p>}
      </div>
    </details>
  </article>;
}

export function ExampleLibrary({ initialBank = "", onTry }: { initialBank?: string; onTry?: TryExample }) {
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState("");
  const [provenance, setProvenance] = useState("");
  const [country, setCountry] = useState("");
  const [publisher, setPublisher] = useState(examples.some(e => e.publisherId === `bank:${initialBank}`) ? `bank:${initialBank}` : "");
  const [page, setPage] = useState(0);
  useEffect(() => { document.getElementById("examples-title")?.focus(); }, []);
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  const filtered = examples.filter(e => {
    const text = normalize([e.filename, e.bank, e.publisher, e.version, e.format, ...e.countries, e.description].join(" "));
    const tokens = text.split(/[^\p{L}\p{N}]+/u);
    return (!format || e.format === format) && (!provenance || e.provenance === provenance)
      && (!country || e.countries.includes(country)) && (!publisher || e.publisherId === publisher)
      && words.every(w => w.length <= 3 ? tokens.some(t => t.startsWith(w)) : text.includes(w));
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const publishers = [...new Map(examples.map(e => [e.publisherId, e.publisher])).entries()].sort((a, b) => a[1].localeCompare(b[1]));
  function reset() { setQuery(""); setFormat(""); setProvenance(""); setCountry(""); setPublisher(""); setPage(0); }
  function turnPage(next: number) { setPage(next); document.getElementById("example-results")?.focus(); }
  return <section className="mx-auto max-w-6xl p-4 sm:p-6 space-y-6 min-w-0" aria-labelledby="examples-title">
    <a href="#workspace" className="inline-flex min-h-11 items-center underline underline-offset-4">← Return to converter</a>
    <div className="max-w-3xl space-y-3"><h1 id="examples-title" tabIndex={-1} className="text-2xl font-bold tracking-tight focus:outline-none">Example files</h1>
      <p>Find and download CAMT and CODA examples by country, bank and source. {examples.filter(e => e.provenance === "bank").length} bank originals, {examples.filter(e => e.provenance === "third-party").length} third-party CODA fixtures and {SAMPLES.length} fictional test files.</p>
      <details className="text-sm"><summary className="min-h-11 cursor-pointer py-3">How sources and downloads work</summary><div className="space-y-3 text-muted-foreground">
        <p>Bank originals download from their publishers when you request them. If your browser cannot save a file, use its publisher download link. Published examples may have known defects or unsupported formats; check the status and source notes. Examples are for testing, never bank import.</p>
        <p>No complete bank-issued CODA original has been verified. Third-party fixtures are labeled separately. “XSD valid” does not guarantee conversion support; this converter supports standalone CAMT052/053 and CODA 2.6.</p>
      </div></details>
    </div>
    <nav aria-label="Catalog sections" className="flex flex-wrap gap-4 text-sm"><a aria-current="page" href="#examples" className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4">Example files ({examples.length})</a><a href="#bank-catalog" className="inline-flex min-h-11 items-center underline underline-offset-4">Banks</a><a href="#bank-catalog?section=references" className="inline-flex min-h-11 items-center underline underline-offset-4">Country & regional references</a></nav>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <label className="col-span-2 space-y-1 text-sm">Search example files<input type="search" value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} placeholder="Bank, country, filename or version" className={controlClass} /></label>
      <label className="space-y-1 text-sm">Format<select value={format} onChange={e => { setFormat(e.target.value); setPage(0); }} className={controlClass}><option value="">CAMT and CODA</option><option>CAMT</option><option>CODA</option></select></label>
      <label className="space-y-1 text-sm">Provenance<select value={provenance} onChange={e => { setProvenance(e.target.value); setPage(0); }} className={controlClass}><option value="">All sources</option>{Object.entries(provenanceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="col-span-2 lg:col-span-2 space-y-1 text-sm">Country / scope<select value={country} onChange={e => { setCountry(e.target.value); setPage(0); }} className={controlClass}><option value="">All countries / scopes</option>{[...new Set(examples.flatMap(e => e.countries))].sort().map(c => <option key={c}>{c}</option>)}</select></label>
      <label className="col-span-2 lg:col-span-2 space-y-1 text-sm">Bank or publisher<select value={publisher} onChange={e => { setPublisher(e.target.value); setPage(0); }} className={controlClass}><option value="">All banks / publishers</option>{publishers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    <div className="flex flex-wrap items-center gap-4 text-sm"><p id="example-results" tabIndex={-1} role="status">{filtered.length} of {examples.length} examples</p><button className="min-h-11 underline underline-offset-4" onClick={reset}>Reset filters</button></div>
    {!filtered.length && <p>No examples match these filters. Try another country, publisher or search term.</p>}
    <div>{filtered.slice(page * 20, (page + 1) * 20).map(e => <ExampleRow key={`${page}:${query}:${format}:${provenance}:${country}:${publisher}:${e.id}`} example={e} onTry={onTry} />)}</div>
    <nav aria-label="Example pages" className="flex flex-wrap items-center justify-between gap-3 text-sm"><button disabled={!page} onClick={() => turnPage(page - 1)} className="min-h-11 rounded-md border px-4 disabled:opacity-50">Previous examples</button><span>Page {page + 1} of {pageCount}</span><button disabled={page + 1 >= pageCount} onClick={() => turnPage(page + 1)} className="min-h-11 rounded-md border px-4 disabled:opacity-50">Next examples</button></nav>
  </section>;
}
