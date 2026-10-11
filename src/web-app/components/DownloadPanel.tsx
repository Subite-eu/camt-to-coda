import { Download } from "lucide-react";
import { Button } from "./ui/button";
import type { Direction } from "@/lib/convert";
export function DownloadPanel({ direction, fileName, busy, cancelled, valid, warnings, acknowledged, onAcknowledge, canDownload, onDownload, fileCount, canDownloadAll, onDownloadAll }: {
  direction: Direction; fileName?: string; busy: boolean; cancelled: boolean; valid: boolean;
  warnings: string[]; acknowledged: boolean; onAcknowledge: (value: boolean) => void;
  canDownload: boolean; onDownload: () => void; fileCount: number; canDownloadAll: boolean; onDownloadAll: () => void;
}) {
  const forward = direction === "camt-to-coda";
  const title = busy ? "Converting your file…" : cancelled ? "Conversion cancelled" : !valid ? "Download unavailable"
    : warnings.length && !acknowledged ? "Review notes to download" : "Ready to download";
  return <section aria-label="Converted file" className="download-panel border-b bg-secondary px-4 py-4 shrink-0">
    <div className="download-layout flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1"><h2 className="font-semibold text-lg">{title}</h2>
        {fileName && <p className="text-sm font-mono break-all mt-1">{fileName}</p>}
        <p id="download-help" className="text-sm text-secondary-foreground mt-1">{busy ? "Processing locally. The download will be available when conversion finishes."
          : cancelled ? "Retry conversion to create your download."
          : !valid ? "Correct the input errors before downloading. Reviewing notes cannot unlock an invalid result."
          : warnings.length && !acknowledged ? "Review the conversion notes below, then check the box to enable your download."
          : forward ? "Save the converted CODA file to your device." : "Save the converted CAMT XML file to your device. It includes all statements."}</p>
      </div>
      <div className="download-actions flex flex-wrap gap-2">
        <Button size="lg" className="min-h-12" aria-describedby="download-help" disabled={!canDownload} onClick={onDownload}><Download aria-hidden="true" />{forward ? "Download CODA (.cod)" : "Download CAMT (.xml)"}</Button>
        {fileCount > 1 && <Button size="lg" className="min-h-12" variant="outline" disabled={!canDownloadAll} onClick={onDownloadAll}><Download aria-hidden="true" />Download all ({fileCount}) · ZIP</Button>}
      </div>
    </div>
    {!!warnings.length && <div className="mt-3 space-y-2 text-sm">
      <details><summary className="cursor-pointer">Review {warnings.length} conversion note{warnings.length === 1 ? "" : "s"}</summary><ul className="notice-list">{warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul></details>
      <label className="flex gap-2 items-start"><input className="mt-1" type="checkbox" checked={acknowledged} onChange={e => onAcknowledge(e.target.checked)} />I reviewed the conversion notes and accept the documented losses for this download.</label>
    </div>}
  </section>;
}
