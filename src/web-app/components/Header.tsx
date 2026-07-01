import { Download } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import type { Direction } from "@/lib/convert";

export function Header(props: {
  direction: Direction;
  onDirectionChange: (d: Direction) => void;
  anonymize: boolean;
  onAnonymizeChange: (v: boolean) => void;
  onDownload: () => void;
  canDownload: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
      <span className="font-bold tracking-tight">
        camt2coda <span className="text-muted-foreground text-xs font-medium">field inspector</span>
      </span>
      <ToggleGroup
        type="single"
        value={props.direction}
        onValueChange={(v) => v && props.onDirectionChange(v as Direction)}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="camt-to-coda">CAMT → CODA</ToggleGroupItem>
        <ToggleGroupItem value="coda-to-camt">CODA → CAMT</ToggleGroupItem>
      </ToggleGroup>
      <div className="ml-auto flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Switch checked={props.anonymize} onCheckedChange={props.onAnonymizeChange} />
          Anonymize
        </label>
        <ThemeToggle />
        <Button onClick={props.onDownload} disabled={!props.canDownload}>
          <Download className="size-4" /> Download
        </Button>
      </div>
    </header>
  );
}
