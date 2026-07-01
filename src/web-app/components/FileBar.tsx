import { X, FileText, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function FileBar({
  fileName,
  recordCount,
  validation,
  onClear,
}: {
  fileName: string;
  recordCount: number;
  validation: { valid: boolean; errors: string[]; warnings: string[] };
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b bg-muted/30 text-sm">
      <span className="flex items-center gap-1.5 font-mono text-xs px-2 py-1 rounded-md border bg-card">
        <FileText className="size-3.5" /> {fileName || "output"} · {recordCount} records
      </span>
      <Badge variant={validation.valid ? "secondary" : "destructive"}>
        {validation.valid ? "✓ Valid" : `✕ ${validation.errors.length} error${validation.errors.length === 1 ? "" : "s"}`}
      </Badge>
      {validation.warnings.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-[color:var(--warning)]">
              <TriangleAlert className="size-3.5" /> {validation.warnings.length} note
              {validation.warnings.length === 1 ? "" : "s"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-sm">
            <ul className="list-disc pl-4 space-y-1">
              {validation.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
      <Button variant="ghost" size="icon" className="ml-auto" aria-label="Load another file" onClick={onClear}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
