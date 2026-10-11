import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Toaster } from "sonner";
import { Header } from "./components/Header";
import { DownloadPanel } from "./components/DownloadPanel";
import { FileBar } from "./components/FileBar";
import { DropZone } from "./components/DropZone";
import { SourcePanel } from "./components/SourcePanel";
import { OutputPanel } from "./components/OutputPanel";
import { Inspector } from "./components/Inspector";
import { StatementSummary } from "./components/StatementSummary";
import { Button } from "./components/ui/button";
import type { ConvertResult, Direction } from "./lib/convert";
import { startConversion } from "./lib/worker-client";
import { downloadAll, downloadText } from "./lib/download";
import { detectDirection, inputError } from "./lib/input";

const BankCatalog = lazy(() => import("./components/BankCatalog").then(m => ({ default: m.BankCatalog })));
const ExampleLibrary = lazy(() => import("./components/ExampleLibrary").then(m => ({ default: m.ExampleLibrary })));

export default function App() {
  const [catalogRoute, setCatalogRoute] = useState(() => window.location.hash);
  const examplesOpen = catalogRoute.split("?")[0] === "#examples";
  const catalogOpen = examplesOpen || catalogRoute.split("?")[0] === "#bank-catalog";
  const routeParams = new URLSearchParams(catalogRoute.split("?")[1]);
  useEffect(() => {
    const update = () => setCatalogRoute(window.location.hash);
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => { if (catalogOpen) document.getElementById("catalog-title")?.focus(); }, [catalogOpen]);
  const [input,setInput]=useState("");
  const [originalName,setOriginalName]=useState("");
  const [direction,setDirection]=useState<Direction>("camt-to-coda");
  const [anonymize,setAnonymize]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [statement,setStatement]=useState(0);
  const [result,setResult]=useState<ConvertResult|null>(null);
  const [busy,setBusy]=useState(false);
  const [cancelled,setCancelled]=useState(false);
  const [workerError,setWorkerError]=useState("");
  const [retry,setRetry]=useState(0);
  const [view,setView]=useState<"summary"|"expert">("summary");
  const [mobileTab,setMobileTab]=useState<"source"|"result">("result");
  const [acknowledged,setAcknowledged]=useState(false);
  const [announcement,setAnnouncement]=useState("");
  const cancelRef=useRef<()=>void>(()=>{});
  const generation=useRef(0);
  function load(content:string, _direction?:Direction, name="Pasted text") {
    cancelRef.current(); generation.current++;
    setOriginalName(name); setInput(content);setDirection(detectDirection(content)??_direction??direction);
    setStatement(0);setSelectedId(null);setResult(null);setAcknowledged(false);setCancelled(false);setWorkerError("");setMobileTab("result");
  }
  useEffect(()=> {
    if (!input) return;
    const id=++generation.current;
    setBusy(true);setResult(null);setWorkerError("");setCancelled(false);setAcknowledged(false);
    const issue=inputError(input);
    if(issue) {setBusy(false);setWorkerError(issue);return;}
    const stop=startConversion(input,direction,anonymize,r=> {
      if(id!==generation.current)return;
      setResult(r);setBusy(false);setAnnouncement(r.error?"Conversion failed. Source retained.":`Converted ${r.statements.length} statements. Review validation before downloading.`);
    },message=> {if(id===generation.current){setWorkerError(message);setBusy(false);}});
    cancelRef.current=stop;
    return()=> {generation.current++;stop();};
  },[input,direction,anonymize,retry]);
  useEffect(()=> {
    if(input || catalogOpen)return;
    const onPaste=(e:ClipboardEvent)=>{const text=e.clipboardData?.getData("text")??"";if(text.trim())load(text);};
    document.addEventListener("paste",onPaste);return()=>document.removeEventListener("paste",onPaste);
  },[input,direction,catalogOpen]);
  useEffect(()=> {
    const esc=(e:KeyboardEvent)=>{if(e.key==="Escape")setSelectedId(null);};
    document.addEventListener("keydown",esc);return()=>document.removeEventListener("keydown",esc);
  },[]);
  const isForward=direction==="camt-to-coda";
  const artifact=result?.files[isForward?statement:0];
  const lines=useMemo(()=> {
    if(!result)return [];
    if(isForward)return artifact?.codaLines??[];
    let logical=-1;
    return result.codaLines.filter(l=>{if(l.recordType==="0")logical++;return logical===statement;});
  },[result,isForward,artifact,statement]);
  const xml=isForward?input:artifact?.outputText??"";
  const index=result?.fieldIndexes[statement]??[];
  const selected=index.find(f=>f.id===selectedId)??null;
  const selectedValidation=artifact?.validation??result?.validation??{valid:false,errors:workerError?[workerError]:[],warnings:[]};
  const validation={...selectedValidation,warnings:result?.files.flatMap((f,i)=>f.validation.warnings.map(w=>result.files.length>1?`Statement ${i+1}: ${w}`:w))??selectedValidation.warnings};
  const warnings=validation.warnings;
  const canDownload=!!artifact&&validation.valid&&!result?.error&&!busy&&(!warnings.length||acknowledged);
  function select(id:string) {
    setSelectedId(id); const f=index.find(f=>f.id===id);
    if(f)setAnnouncement(`${f.name}, record ${f.recordType}, position ${f.codaPos}. ${f.provenance}. ${f.rule}`);
  }
  function clear() { cancelRef.current();generation.current++;setInput("");setResult(null);setSelectedId(null);setBusy(false);setWorkerError("");setCancelled(false); }
  function navigateIssue(message:string) {
    const line=message.match(/(?:line|record)\s+(\d+)/i);
    const entry=message.match(/(?:entry|movement)\s+(\d+)/i);
    const field=index.find(f=>line?f.lineIndex===Number(line[1])-1:entry?f.entryIndex===Number(entry[1])-1:/balance|reconcil/i.test(message)?f.recordType==="8"&&f.name==="balanceAmount":false);
    if(field){select(field.id);setView("expert");}else setAnnouncement(`${message}. This issue applies to the document; no exact field location is available.`);
  }
  const codaPanel=<OutputPanel title={isForward?"Output · CODA":"Source · CODA"} lines={lines} index={index} selectedId={selectedId} onSelect={select} />;
  const xmlPanel=<SourcePanel title={isForward?"Source · CAMT":"Output · CAMT"} text={xml} selected={selected} index={index} onSelect={select} />;
  useEffect(()=> {
    if(selectedId && view==="expert" && window.matchMedia("(max-width: 767px)").matches) document.querySelector(".document-workspace")?.scrollIntoView({block:"start"});
  },[selectedId,view]);
  const failure=result?.error||workerError;
  return <div className={`app-shell ${selected?"has-selection":""}`}>
    <a href="#workspace" className="skip-link">Skip to workspace</a>
    <Header catalogOpen={catalogOpen} examplesOpen={examplesOpen} direction={direction} locked={!!input} onDirectionChange={setDirection} anonymize={anonymize} onAnonymizeChange={v=>{setResult(null);setSelectedId(null);setAnonymize(v);}} />
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {catalogOpen ? <main id="workspace" className="flex-1 min-h-0 overflow-y-auto"><Suspense fallback={<p className="p-4" role="status">Loading reporting catalog…</p>}>{examplesOpen ? <ExampleLibrary key={catalogRoute} initialBank={routeParams.get("bank") ?? ""} onTry={(content, direction, filename) => { load(content, direction, filename); window.location.hash = "#workspace"; }} /> : <BankCatalog key={catalogRoute} initialSection={routeParams.get("section") === "channels" ? "channels" : routeParams.get("section") === "references" ? "references" : "banks"} />}</Suspense></main> : !input?<main id="workspace" className="flex-1"><DropZone onLoad={load} /></main>:<>
      <FileBar fileName={originalName} version={isForward?(result?.version??"Detected CAMT XML"):"Detected CODA 2.6"} recordCount={lines.length} validation={validation} onClear={clear} onIssue={navigateIssue} />
      <DownloadPanel direction={direction} fileName={artifact?.fileName} busy={busy} cancelled={cancelled}
        valid={!!artifact&&validation.valid&&!result?.error&&!workerError} warnings={warnings} acknowledged={acknowledged} onAcknowledge={setAcknowledged}
        canDownload={canDownload} onDownload={()=>artifact&&downloadText(artifact.fileName,artifact.outputText,isForward?"text/plain":"application/xml")}
        fileCount={result?.files.length??0} canDownloadAll={canDownload&&!!result?.files.every(f=>f.validation.valid)}
        onDownloadAll={()=>result&&downloadAll(result.files,anonymize)} />
      <section aria-label="Processing and privacy scope" className="px-4 py-2 border-b text-sm space-y-2">
        <p className="text-muted-foreground">Local processing. Runtime syntax, structure, business and reconciliation checks are separate from full XSD validation. Review conversion warnings and format limits before bank import.</p>
        <details><summary className="cursor-pointer">Privacy and conversion scope</summary><p className="mt-1 max-w-prose">Anonymize protects the exported artifact and its result preview. The source pane retains your original bank data. Names, accounts, bank identifiers, references and free text are replaced or removed; amounts, dates, currency and transaction patterns remain identifiable. Pseudonyms are deterministic and linkable. CODA replacement account identifiers are demonstration data and are not valid IBANs for bank import. CAMT privacy exports use synthetic Other account identifiers. Reloading this page requires the app to be available.</p></details>
        {anonymize&&<p className="text-[color:var(--warning)]">Privacy export · Source remains original. Amounts and dates are retained. Use exported samples for review, not bank import.</p>}
      </section>
      <main id="workspace" className="workspace" tabIndex={-1} aria-busy={busy}>
        {busy||cancelled||failure?<div className="flex flex-col min-h-0 flex-1 p-3 gap-3">
          <section className="space-y-2" aria-label="Conversion status">
            <h1 className="font-semibold">{busy?"Converting locally…":cancelled?"Conversion cancelled":"Conversion needs attention"}</h1>
            {failure&&<p role="alert" className="text-destructive break-words">{failure}</p>}
            <p className="text-sm text-muted-foreground">Your source is retained. Correct the input or load another file to recover.</p>
            <div className="flex gap-2 flex-wrap">{busy?<Button variant="outline" onClick={()=>{generation.current++;cancelRef.current();setBusy(false);setCancelled(true);setAnnouncement("Conversion cancelled. Source retained.");}}>Cancel conversion</Button>:<><Button variant="outline" onClick={()=>setRetry(r=>r+1)}>Retry conversion</Button>{failure&&<Button variant="outline" onClick={()=>setDirection(isForward?"coda-to-camt":"camt-to-coda")}>Try as {isForward?"CODA":"CAMT XML"}</Button>}{anonymize&&<Button variant="outline" onClick={()=>setAnonymize(false)}>Retry without anonymization</Button>}</>}
              <Button variant="outline" onClick={clear}>Load another file</Button></div>
          </section>
          <SourcePanel title="Original source" text={input} />
        </div>:result&&artifact?<>
          <section className="workspace-toolbar p-3 border-b flex flex-wrap gap-3 items-center text-sm" aria-label="Review controls">
            <h1 className="font-semibold">Review conversion</h1>
            <label>Statement <select aria-label="Statement" value={statement} onChange={e=>{setStatement(Number(e.target.value));setSelectedId(null);setAcknowledged(false);}} className="border rounded p-2 bg-background">{result.statements.map((_,i)=><option key={i} value={i}>Statement {i+1} of {result.statements.length}</option>)}</select></label>
            <Button variant={view==="summary"?"secondary":"outline"} aria-pressed={view==="summary"} onClick={()=>setView("summary")}>Summary</Button>
            <Button variant={view==="expert"?"secondary":"outline"} aria-pressed={view==="expert"} onClick={()=>setView("expert")}>Inspect fields</Button>
          </section>
          {view==="summary"?<div className="panel-scroll p-4"><StatementSummary key={statement} statement={result.statements[statement]} index={index} onSelect={id=>{select(id);setView("expert");}} /><p className="text-sm mt-4 text-muted-foreground">Select Inspect fields to compare the original source and converted result. The XML and CODA views share exact node mappings where available.</p></div>:<>
            <div role="tablist" aria-label="Document view" className="mobile-tabs px-3 pt-2" onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();const next=mobileTab==="source"?"result":"source";setMobileTab(next);document.getElementById(`${next}-tab`)?.focus();}}}><button role="tab" tabIndex={mobileTab==="source"?0:-1} id="source-tab" aria-controls="source-document" aria-selected={mobileTab==="source"} onClick={()=>setMobileTab("source")}>Source</button><button role="tab" tabIndex={mobileTab==="result"?0:-1} id="result-tab" aria-controls="result-document" aria-selected={mobileTab==="result"} onClick={()=>setMobileTab("result")}>Result</button></div>
            <div className="document-workspace"><div id="source-document" role="tabpanel" aria-labelledby="source-tab" className={`document-side ${mobileTab!=="source"?"mobile-inactive":""}`}>{isForward?xmlPanel:codaPanel}</div><div id="result-document" role="tabpanel" aria-labelledby="result-tab" className={`document-side ${mobileTab!=="result"?"mobile-inactive":""}`}>{isForward?codaPanel:xmlPanel}</div></div>
          </>}
          {selected?<Inspector field={selected} onClose={()=>setSelectedId(null)} />:<p className="border-t p-3 text-sm text-muted-foreground">Select a movement, CODA field or mapped XML value to inspect its origin and transformation. Escape closes field details.</p>}
        </>:null}
      </main>
    </>}
    <Toaster position="bottom-center" />
  </div>;
}
