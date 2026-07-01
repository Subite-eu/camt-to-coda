import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import { TriangleAlert } from "lucide-react";
import { Header } from "./components/Header";
import { FileBar } from "./components/FileBar";
import { DropZone } from "./components/DropZone";
import { SourcePanel } from "./components/SourcePanel";
import { OutputPanel } from "./components/OutputPanel";
import { Inspector } from "./components/Inspector";
import { convert, type Direction } from "./lib/convert";
import { buildFieldIndex } from "./lib/fields";
import { downloadText } from "./lib/download";

export default function App() {
  const [input, setInput] = useState("");
  const [direction, setDirection] = useState<Direction>("camt-to-coda");
  const [anonymize, setAnonymize] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const result = useMemo(() => (input ? convert(input, direction, anonymize) : null), [input, direction, anonymize]);
  const index = useMemo(() => (result && !result.error ? buildFieldIndex(result.codaLines) : []), [result]);
  const selected = index.find((f) => f.id === selectedId) ?? null;

  // Clear a stale selection when the field list changes.
  useEffect(() => {
    if (selectedId && !index.some((f) => f.id === selectedId)) setSelectedId(null);
  }, [index, selectedId]);

  // Surface conversion errors as a toast.
  useEffect(() => {
    if (result?.error) toast.error(result.error);
  }, [result?.error]);

  // Paste-to-load when idle.
  useEffect(() => {
    if (input) return;
    const onPaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text") ?? "";
      if (text.trim()) setInput(text);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [input]);

  const isForward = direction === "camt-to-coda";
  const codaPanel = result && (
    <OutputPanel
      title={isForward ? "Output · CODA" : "Source · CODA"}
      lines={result.codaLines}
      index={index}
      selectedId={selectedId}
      onSelect={setSelectedId}
    />
  );
  const xmlPanel = result && (
    <SourcePanel
      title={isForward ? "Source · CAMT" : "Output · CAMT"}
      text={isForward ? result.sourceText : result.outputText}
      highlight={selected?.value}
    />
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        direction={direction}
        onDirectionChange={setDirection}
        anonymize={anonymize}
        onAnonymizeChange={setAnonymize}
        canDownload={!!result && !result.error}
        onDownload={() =>
          result && downloadText(result.fileName, result.outputText, isForward ? "text/plain" : "application/xml")
        }
      />

      {!result ? (
        <main className="flex-1">
          <DropZone
            onLoad={(content, d) => {
              setInput(content);
              if (d) setDirection(d);
            }}
          />
        </main>
      ) : (
        <>
          <FileBar
            fileName={result.fileName}
            recordCount={result.codaLines.length}
            validation={result.validation}
            onClear={() => {
              setInput("");
              setSelectedId(null);
            }}
          />
          <main className="flex-1 min-h-0 flex flex-col">
            {result.error ? (
              <div className="flex-1 grid place-items-center p-6">
                <div className="flex items-center gap-2 text-destructive">
                  <TriangleAlert className="size-5" /> {result.error}
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col md:flex-row gap-3 p-3">
                {isForward ? (
                  <>
                    {xmlPanel}
                    {codaPanel}
                  </>
                ) : (
                  <>
                    {codaPanel}
                    {xmlPanel}
                  </>
                )}
              </div>
            )}
          </main>
          <Inspector field={selected} />
        </>
      )}

      <Toaster position="bottom-center" />
    </div>
  );
}
