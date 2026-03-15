import {
  readdir,
  readFile,
  writeFile,
  rename,
  mkdir,
  access,
  stat,
} from "fs/promises";
import { dirname } from "path";
import type { Storage } from "./storage.js";

export class FsStorage implements Storage {
  /**
   * List all .xml files in the given directory path.
   */
  async list(path: string): Promise<string[]> {
    const entries = await readdir(path);
    return entries.filter((e) => e.endsWith(".xml")).map((e) => `${path}/${e}`);
  }

  async read(path: string): Promise<string> {
    return readFile(path, "utf-8");
  }

  async write(path: string, content: string): Promise<void> {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content, "utf-8");
  }

  async move(from: string, to: string): Promise<void> {
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
