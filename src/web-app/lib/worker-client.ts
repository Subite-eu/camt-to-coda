import { convert, type ConvertResult, type Direction } from "./convert";
/** A fresh worker per job makes termination a real cancellation boundary. */
export function startConversion(input: string, direction: Direction, anonymize: boolean, done: (result: ConvertResult) => void, failed: (message: string) => void): () => void {
  let cancelled = false;
  // jsdom/non-worker environments retain a deferred testable fallback.
  if (typeof Worker === "undefined") {
    const timer = setTimeout(() => { if (!cancelled) done(convert(input, direction, anonymize)); }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }
  let worker: Worker;
  try { worker = new Worker(new URL("./conversion.worker.ts", import.meta.url), { type: "module" }); }
  catch { failed("Your browser could not start the conversion worker. Reload or use the CLI."); return () => {}; }
  worker.onmessage = event => { if (!cancelled) done(event.data); worker.terminate(); };
  worker.onerror = () => { if (!cancelled) failed("The conversion worker stopped. Retry or use the CLI for this file."); worker.terminate(); };
  worker.postMessage({ input, direction, anonymize });
  return () => { cancelled = true; worker.terminate(); };
}
