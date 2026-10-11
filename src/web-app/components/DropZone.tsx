import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SAMPLES, type Sample } from "@/lib/samples";
import type { Direction } from "@/lib/convert";
import { detectDirection, inputError, MAX_INPUT_BYTES } from "@/lib/input";
import { SampleLibrary } from "./SampleLibrary";
import { cn } from "@/lib/cn";

export function DropZone({ onLoad }: { onLoad: (content: string, direction?: Direction, fileName?: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const [error, setError] = useState("");
  const request = useRef(0);
  const [loadingSample, setLoadingSample] = useState(false);
  useEffect(() => () => { request.current++; }, []);
  async function fromFile(file?: File | null) {
    if (!file) return;
    const id = ++request.current;
    setError(""); setLoadingSample(false);
    if (file.size > MAX_INPUT_BYTES) { setError("This file exceeds the 5 MiB browser limit. Use the CLI for larger files."); return; }
    try {
      const content = await file.text();
      if (request.current !== id) return;
      const issue = inputError(content);
      if (issue) { setError(issue); return; }
      onLoad(content, detectDirection(content) ?? undefined, file.name);
    } catch { if (request.current === id) setError("The file could not be read. Try browsing for it again or paste its contents."); }
  }

  async function fromSample(sample: Sample) {
    const id = ++request.current;
    setError(""); setLoadingSample(true);
    try {
      const content = await sample.load();
      if (request.current !== id) return;
      const issue = inputError(content);
      if (issue) { setError(issue); return; }
      onLoad(content, sample.direction, sample.path.split("/").pop());
    } catch {
      if (request.current === id) setError("The sample could not be loaded. Reload this page to try again, or browse for a local file.");
    } finally {
      if (request.current === id) setLoadingSample(false);
    }
  }
  return (
    <div className="start-workspace grid gap-8 p-6 mx-auto w-full max-w-6xl lg:grid-cols-2 lg:items-start">
      <Card
        className={cn(
          "w-full p-6 sm:p-8 text-center border-dashed transition-colors",
          over && "border-primary bg-accent",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          fromFile(e.dataTransfer.files[0]);
        }}
      >
        <Upload className="size-8 mx-auto mb-3 text-muted-foreground" />
        <h1 className="font-medium text-xl">Drop a CAMT XML or CODA file</h1>
        <p className="text-sm text-muted-foreground mb-4">Convert, review and download. Drop a file, paste its contents or browse.</p>
        <p className="text-sm text-muted-foreground mb-4">Processed locally in this browser; bank data is not uploaded. Maximum 5 MiB; CODA allows up to 9,999 movements and details per statement. CAMT 052/053 v02–13 and CODA 2.6. Keep this tab open; offline reload is not guaranteed.</p>
        {error && <p role="alert" className="text-destructive mb-4">{error}</p>}
        <input
          aria-label="Choose CAMT or CODA file"
          ref={fileRef}
          type="file"
          accept=".xml,.cod,.coda,text/xml,text/plain"
          hidden
          onChange={(e) => fromFile(e.target.files?.[0])}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          Browse…
        </Button>
        <div className="mt-6 flex flex-wrap gap-2 justify-center">
          {SAMPLES.slice(0, 2).map((s) => (
            <Button key={s.label} variant="ghost" size="sm" disabled={loadingSample} onClick={() => fromSample(s)}>
              Sample: {s.label}
            </Button>
          ))}
        </div>
        {loadingSample && <p role="status" className="text-sm mt-3">Loading sample…</p>}
      </Card>
      <SampleLibrary onSelect={fromSample} loading={loadingSample} />
    </div>
  );
}
