// Browser shim for Node.js "fs" module.
// parseCamtFile() is never called in the browser — only parseCamt(string) is used.
export function readFileSync(): never {
  throw new Error("readFileSync is not available in the browser");
}
