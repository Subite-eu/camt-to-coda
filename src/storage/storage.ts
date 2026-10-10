export interface Storage {
  /** List regular files/objects without extension filtering. */
  list(path: string): Promise<string[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  move(from: string, to: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export function isS3Path(path: string): boolean {
  return path.startsWith("s3://");
}

export function parseS3Path(path: string): { bucket: string; key: string } {
  const rest = path.slice(5);
  const idx = rest.indexOf("/");
  if (idx === -1) return { bucket: rest, key: "" };
  return { bucket: rest.slice(0, idx), key: rest.slice(idx + 1) };
}

/** Convert untrusted source metadata to one portable filename, never a path. */
export function safeFileName(name: string): string {
  const safe = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").replace(/^\.+/, "_");
  if (!safe || safe === "." || safe === "..") throw new Error("Invalid output filename");
  if (safe.length > 240) throw new Error("Output filename exceeds 240 characters");
  return safe;
}
