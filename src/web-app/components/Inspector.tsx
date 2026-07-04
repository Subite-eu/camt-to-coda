import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { FieldEntry } from "@/lib/fields";

/** Bottom slide-up strip showing the selected field's cross-format mapping. */
export function Inspector({ field }: { field: FieldEntry | null }) {
  if (!field) return null;
  return (
    <div className="border-t bg-muted/40 px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Field mapping</div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-base">{field.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="Copy value"
          onClick={() => {
            navigator.clipboard?.writeText(field.value);
            toast.success("Copied value");
          }}
        >
          <Copy className="size-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-x-10 gap-y-2 mt-1 text-sm">
        <Detail label="CAMT" mono value={field.sourceXPath ?? "—"} />
        <Detail label="CODA" mono value={`Record ${field.recordType} · pos ${field.codaPos}`} />
        <Detail label="Value" mono value={field.value} />
        {field.description && (
          <div className="md:ml-auto self-center text-xs text-muted-foreground max-w-xs">{field.description}</div>
        )}
      </div>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono" : ""}>{value}</div>
    </div>
  );
}
