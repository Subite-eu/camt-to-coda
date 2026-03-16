// Browser shim for Node.js "crypto" module.
// Anonymizer is never called in the browser.
export function createHash(): never {
  throw new Error("createHash is not available in the browser");
}
