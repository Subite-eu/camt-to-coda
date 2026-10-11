import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "./ThemeToggle";
import type { Direction } from "@/lib/convert";

export function Header(props: {
  direction: Direction;
  onDirectionChange: (d: Direction) => void;
  anonymize: boolean;
  onAnonymizeChange: (v: boolean) => void;
  locked?: boolean;
  catalogOpen?: boolean;
  examplesOpen?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center gap-3 px-4 py-3 border-b">
      <p className="font-bold tracking-tight">
        camt2coda <span className="text-muted-foreground text-xs font-medium">bank statement converter</span>
      </p>
      {!props.catalogOpen && <ToggleGroup
        aria-label="Conversion direction"
        disabled={props.locked}
        type="single"
        value={props.direction}
        onValueChange={(v) => v && props.onDirectionChange(v as Direction)}
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="camt-to-coda">CAMT → CODA</ToggleGroupItem>
        <ToggleGroupItem value="coda-to-camt">CODA → CAMT</ToggleGroupItem>
      </ToggleGroup>}
      <div className="ml-auto flex flex-wrap items-center gap-3">
        {!props.catalogOpen && <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <Switch aria-label="Anonymize exported artifact" checked={props.anonymize} onCheckedChange={props.onAnonymizeChange} />
          Anonymize
        </label>}
        <a aria-current={props.examplesOpen ? "page" : undefined} href="#examples" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Example files</a>
        <a aria-current={props.catalogOpen && !props.examplesOpen ? "page" : undefined} href="#bank-catalog" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Bank catalog</a>
        <ThemeToggle />
      </div>
    </header>
  );
}
