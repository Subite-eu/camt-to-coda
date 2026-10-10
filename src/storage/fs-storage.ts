import {
  readdir,
  readFile,
  writeFile,
  rename,
  mkdir,
  access,
  stat,
} from "fs/promises";
import { dirname, join } from "path";
import { isS3Path } from "./storage.js";
import type { Storage } from "./storage.js";

export class FsStorage implements Storage {
  /**
   * List regular files without imposing a conversion format.
   */
  async list(path: string): Promise<string[]> {
    const info = await stat(path);
    if (info.isFile()) return [path];
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => join(path, entry.name));
  }

  async read(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  async move(from: string, to: string): Promise<void> {
    if (isS3Path(from) || isS3Path(to)) throw new Error("Cross-backend moves are unsupported");
    await mkdir(dirname(to), { recursive: true });
    await rename(from, to);
  }

  async exists(path: string): Promise<boolean> {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  }
}
