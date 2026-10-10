import { useEffect, useState } from "react";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FieldEntry } from "@/lib/fields";
export function Inspector({ field, onClose }: { field: FieldEntry | null; onClose?: () => void }) {
  const [fallback, setFallback] = useState(false);
  useEffect(() => setFallback(false), [field?.id]);
  if (!field) return null;
  return (
    <section aria-label="Selected field" className="field-inspector border-t bg-card px-4 py-3 overflow-auto">
      <div className="flex items-center gap-2">
        <h2 className="font-semibold">Field mapping · {field.name}</h2>
        <Button variant="ghost" size="icon" aria-label="Copy value" onClick={async () => {
          try { if (!navigator.clipboard) throw new Error("Clipboard unavailable"); await navigator.clipboard.writeText(field.value); toast.success("Copied value"); }
          catch { setFallback(true); toast.error("Clipboard unavailable. Select and copy the value below."); }
        }}><Copy className="size-4" /></Button>
        {onClose && <Button variant="ghost" size="icon" className="ml-auto" aria-label="Close field inspector" onClick={onClose}><X className="size-4" /></Button>}
      </div>
      {field.monetaryDetailIndex!==undefined && <p className="text-sm mt-1">Breakdown {field.monetaryDetailIndex+1} of movement {(field.entryIndex??0)+1} · {field.currency} · {field.creditDebit}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm mt-2">
        <Detail label="CAMT node" value={field.sourceXPath ?? "No source node"} />
        <Detail label="CODA" value={`Record ${field.recordType} · pos ${field.codaPos}`} />
        <Detail label="Decoded value" value={field.decodedValue ?? field.value} />
        <Detail label="Raw bytes (spaces visible)" value={(field.rawValue ?? field.value).replace(/ /g,"·")} />
        <div className="sm:col-span-2"><p className="font-medium">Provenance: {field.provenance ?? "unavailable"}</p><p className="text-muted-foreground">{field.rule ?? field.description}</p></div>
      </div>
      {fallback && <label className="block text-sm mt-2">Select value to copy manually<textarea aria-label="Select value to copy manually" readOnly value={field.value} onFocus={e => e.currentTarget.select()} className="block w-full border p-2 rounded" /></label>}
    </section>
  );
}
function Detail({label,value}: {label:string;value:string}) { return <div className="min-w-0"><p className="text-muted-foreground">{label}</p><p className="font-mono break-all">{value}</p></div>; }
