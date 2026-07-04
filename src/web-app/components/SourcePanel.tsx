import { Card } from "@/components/ui/card";

/** Renders the free-form side (XML for forward, or CAMT output for reverse) with the
 *  currently-selected field's value highlighted via string match. */
export function SourcePanel({ title, text, highlight }: { title: string; text: string; highlight?: string }) {
  const parts = highlight && text.includes(highlight) ? text.split(highlight) : [text];
  return (
    <Card className="flex-1 min-w-0 overflow-auto py-0 gap-0">
      <div className="px-3 py-2 border-b text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 bg-card">
        {title}
      </div>
      <pre className="p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {parts.flatMap((p, i) =>
          i === 0
            ? [p]
            : [
                <mark key={i} className="bg-primary text-primary-foreground rounded-sm px-0.5">
                  {highlight}
                </mark>,
                p,
              ],
        )}
      </pre>
    </Card>
  );
}
