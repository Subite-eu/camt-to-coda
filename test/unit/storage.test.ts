import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { FsStorage } from "../../src/storage/fs-storage.js";
import { S3Storage } from "../../src/storage/s3-storage.js";
import { isS3Path, parseS3Path } from "../../src/storage/storage.js";

// ── Storage utility helpers ───────────────────────────────────────────────────

describe("isS3Path()", () => {
  it("returns true for s3:// paths", () => {
    expect(isS3Path("s3://my-bucket/some/key.xml")).toBe(true);
  });

  it("returns false for filesystem paths", () => {
    expect(isS3Path("/tmp/some/file.xml")).toBe(false);
    expect(isS3Path("relative/path.xml")).toBe(false);
    expect(isS3Path("")).toBe(false);
  });

  it("returns false for other URI schemes", () => {
    expect(isS3Path("http://example.com")).toBe(false);
    expect(isS3Path("file:///tmp/test.xml")).toBe(false);
  });
});

describe("parseS3Path()", () => {
  it("parses bucket and key", () => {
    expect(parseS3Path("s3://my-bucket/path/to/file.xml")).toEqual({
      bucket: "my-bucket",
      key: "path/to/file.xml",
    });
  });

  it("parses bucket-only path (no slash after bucket)", () => {
    expect(parseS3Path("s3://my-bucket")).toEqual({
      bucket: "my-bucket",
      key: "",
    });
  });

  it("parses path with trailing slash prefix only", () => {
    expect(parseS3Path("s3://my-bucket/")).toEqual({
      bucket: "my-bucket",
      key: "",
    });
  });

  it("parses simple key", () => {
    expect(parseS3Path("s3://bucket/file.xml")).toEqual({
      bucket: "bucket",
      key: "file.xml",
    });
  });
});

// ── FsStorage ─────────────────────────────────────────────────────────────────

describe("FsStorage", () => {
  const storage = new FsStorage();
  const createdDirs: string[] = [];

  async function makeTempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "camt2coda-test-"));
    createdDirs.push(dir);
    return dir;
  }

  afterEach(async () => {
    for (const dir of createdDirs.splice(0)) {
      await rm(dir, { recursive: true, force: true });
    }
  });

  describe("list()", () => {
    it("returns xml files in the directory", async () => {
      const dir = await makeTempDir();
      await writeFile(join(dir, "a.xml"), "<doc/>");
      await writeFile(join(dir, "b.xml"), "<doc/>");
      await writeFile(join(dir, "ignore.txt"), "text");

      const results = await storage.list(dir);
      const names = results.map((p) => p.split("/").at(-1));
      expect(names).toContain("a.xml");
      expect(names).toContain("b.xml");
      expect(names).not.toContain("ignore.txt");
    });

    it("returns empty array when directory has no xml files", async () => {
      const dir = await makeTempDir();
      await writeFile(join(dir, "notes.txt"), "hello");

      const results = await storage.list(dir);
      expect(results).toEqual([]);
    });

    it("returns empty array for an empty directory", async () => {
      const dir = await makeTempDir();
      const results = await storage.list(dir);
      expect(results).toEqual([]);
    });

    it("returns full paths (not just filenames)", async () => {
      const dir = await makeTempDir();
      await writeFile(join(dir, "stmt.xml"), "<doc/>");

      const results = await storage.list(dir);
      expect(results[0]).toContain(dir);
      expect(results[0]).toMatch(/\.xml$/);
    });
  });

  describe("read()", () => {
    it("reads file content as string", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "test.xml");
      await writeFile(filePath, "<root>hello</root>", "utf-8");

      const content = await storage.read(filePath);
      expect(content).toBe("<root>hello</root>");
    });

    it("reads utf-8 content correctly", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "unicode.xml");
      await writeFile(filePath, "Héllo Wörld €100", "utf-8");

      const content = await storage.read(filePath);
      expect(content).toBe("Héllo Wörld €100");
    });

    it("throws when file does not exist", async () => {
      await expect(storage.read("/nonexistent/path/file.xml")).rejects.toThrow();
    });
  });

  describe("write()", () => {
    it("writes content to file", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "out.coda");

      await storage.write(filePath, "CODA content");
      const content = await storage.read(filePath);
      expect(content).toBe("CODA content");
    });

    it("creates parent directories if they do not exist", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "nested", "deep", "out.coda");

      await storage.write(filePath, "deep content");
      const content = await storage.read(filePath);
      expect(content).toBe("deep content");
    });

    it("overwrites existing file", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "file.txt");
      await writeFile(filePath, "original");

      await storage.write(filePath, "updated");
      const content = await storage.read(filePath);
      expect(content).toBe("updated");
    });
  });

  describe("move()", () => {
    it("moves a file to a new path", async () => {
      const dir = await makeTempDir();
      const srcPath = join(dir, "source.xml");
      const dstPath = join(dir, "dest.xml");
      await writeFile(srcPath, "moved content");

      await storage.move(srcPath, dstPath);

      expect(await storage.exists(dstPath)).toBe(true);
      expect(await storage.exists(srcPath)).toBe(false);
    });

    it("preserves file content after move", async () => {
      const dir = await makeTempDir();
      const srcPath = join(dir, "source.xml");
      const dstPath = join(dir, "archive", "source.xml");
      await writeFile(srcPath, "<camt/>");

      await storage.move(srcPath, dstPath);

      const content = await storage.read(dstPath);
      expect(content).toBe("<camt/>");
    });

    it("creates target directory if it does not exist", async () => {
      const dir = await makeTempDir();
      const srcPath = join(dir, "file.xml");
      const dstPath = join(dir, "new-subdir", "file.xml");
      await writeFile(srcPath, "data");

      await storage.move(srcPath, dstPath);
      expect(await storage.exists(dstPath)).toBe(true);
    });
  });

  describe("exists()", () => {
    it("returns true when file exists", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "exists.xml");
      await writeFile(filePath, "present");

      expect(await storage.exists(filePath)).toBe(true);
    });

    it("returns false when file does not exist", async () => {
      const dir = await makeTempDir();
      const filePath = join(dir, "ghost.xml");

      expect(await storage.exists(filePath)).toBe(false);
    });

    it("returns true for a directory", async () => {
      const dir = await makeTempDir();
      const subDir = join(dir, "subdir");
      await mkdir(subDir);

      expect(await storage.exists(subDir)).toBe(true);
    });

    it("returns false for a nonexistent path", async () => {
      expect(await storage.exists("/nonexistent/path/that/doesnt/exist")).toBe(
        false
      );
    });
  });
});

// ── S3Storage (skipped: requires MinIO) ──────────────────────────────────────

describe.skip("S3Storage (integration — needs MinIO)", () => {
  const storage = new S3Storage({
    endpoint: "http://localhost:9000",
    accessKeyId: "minioadmin",
    secretAccessKey: "minioadmin",
    region: "us-east-1",
  });

  const bucket = "test-bucket";
  const prefix = "camt2coda-test/";

  it("writes and reads a file", async () => {
    const key = `${prefix}write-read-test.xml`;
    const path = `s3://${bucket}/${key}`;

    await storage.write(path, "<test>hello</test>");
    const content = await storage.read(path);
    expect(content).toBe("<test>hello</test>");
  });

  it("exists() returns true for an existing object", async () => {
    const key = `${prefix}exists-test.xml`;
    const path = `s3://${bucket}/${key}`;

    await storage.write(path, "<x/>");
    expect(await storage.exists(path)).toBe(true);
  });

  it("exists() returns false for a missing object", async () => {
    const path = `s3://${bucket}/${prefix}no-such-file-${Date.now()}.xml`;
    expect(await storage.exists(path)).toBe(false);
  });

  it("list() returns xml objects under a prefix", async () => {
    const key1 = `${prefix}list-a.xml`;
    const key2 = `${prefix}list-b.xml`;
    await storage.write(`s3://${bucket}/${key1}`, "<a/>");
    await storage.write(`s3://${bucket}/${key2}`, "<b/>");

    const results = await storage.list(`s3://${bucket}/${prefix}`);
    expect(results.some((r) => r.includes("list-a.xml"))).toBe(true);
    expect(results.some((r) => r.includes("list-b.xml"))).toBe(true);
  });

  it("move() copies then deletes source", async () => {
    const src = `s3://${bucket}/${prefix}move-src.xml`;
    const dst = `s3://${bucket}/${prefix}move-dst.xml`;

    await storage.write(src, "<moved/>");
    await storage.move(src, dst);

    expect(await storage.exists(dst)).toBe(true);
    expect(await storage.exists(src)).toBe(false);
    const content = await storage.read(dst);
    expect(content).toBe("<moved/>");
  });
});
