import { sha256 } from "../anonymize/sha256.js";
/** Minimal browser-compatible SHA-256 API. */
export function createHash(algorithm = "sha256") {
  if (algorithm !== "sha256") throw new Error("Only SHA-256 is supported in the browser");
  let value = "";
  const hash = {
    update(text: string) { value += text; return hash; },
    digest(encoding: string) { if (encoding !== "hex") throw new Error("Only hex digests are supported"); return sha256(value); },
  };
  return hash;
}
