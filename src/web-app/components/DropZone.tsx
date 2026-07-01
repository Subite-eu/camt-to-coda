import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SAMPLES } from "@/lib/samples";
import type { Direction } from "@/lib/convert";
import { cn } from "@/lib/cn";

export function DropZone({ onLoad }: { onLoad: (content: string, direction?: Direction) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  async function fromFile(file?: File | null) {
    if (file) onLoad(await file.text());
  }

  return (
    <div className="grid place-items-center min-h-[60vh] p-6">
      <Card
        className={cn(
          "w-full max-w-xl p-10 text-center border-dashed transition-colors",
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
        <p className="font-medium">Drop a CAMT XML or CODA file</p>
        <p className="text-sm text-muted-foreground mb-4">or paste it anywhere, or browse</p>
        <input
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
          {SAMPLES.map((s) => (
            <Button key={s.label} variant="ghost" size="sm" onClick={() => onLoad(s.content, s.direction)}>
              Sample: {s.label}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
