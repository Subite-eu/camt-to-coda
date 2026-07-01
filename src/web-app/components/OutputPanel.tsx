import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { CodaLine } from "@src/core/field-defs/types";
import type { FieldEntry } from "@/lib/fields";

/** Renders the CODA side (fixed-width records) with clickable, linkable field spans. */
export function OutputPanel({
  title,
  lines,
  index,
  selectedId,
  onSelect,
}: {
  title: string;
  lines: CodaLine[];
  index: FieldEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const known = new Set(index.map((e) => e.id));
  return (
    <Card className="flex-1 min-w-0 overflow-auto py-0 gap-0">
      <div className="px-3 py-2 border-b text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-card">
        {title}
      </div>
      <pre className="p-3 font-mono text-xs leading-relaxed">
        {lines.map((line, li) => (
          <div key={li} className="whitespace-pre">
            {line.fields.map((f) => {
              const id = `${line.recordType}:${f.name}:${li}`;
              if (!known.has(id)) return <span key={f.name}>{f.value}</span>;
              const isSel = id === selectedId;
              return (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={cn(
                    "rounded-sm transition-colors",
                    isSel ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                  )}
                  title={f.name}
                >
                  {f.value}
                </button>
              );
            })}
          </div>
        ))}
      </pre>
    </Card>
  );
}
