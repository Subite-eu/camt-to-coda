import { parseS3Path } from "./storage.js";
import type { Storage } from "./storage.js";

export interface S3StorageOptions {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  region?: string;
}

export class S3Storage implements Storage {
  private options: S3StorageOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private clientPromise: Promise<any> | null = null;

  constructor(options: S3StorageOptions = {}) {
    this.options = options;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getClient(): Promise<any> {
    if (!this.clientPromise) {
      this.clientPromise = (async () => {
        const { S3Client } = await import("@aws-sdk/client-s3");
        return new S3Client({
          endpoint: this.options.endpoint,
          region: this.options.region ?? "us-east-1",
          forcePathStyle: true,
          credentials:
            this.options.accessKeyId && this.options.secretAccessKey
              ? {
                  accessKeyId: this.options.accessKeyId,
                  secretAccessKey: this.options.secretAccessKey,
                }
              : undefined,
        });
      })();
    }
    return this.clientPromise;
  }

  async list(path: string): Promise<string[]> {
    const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const { bucket, key: prefix } = parseS3Path(path);

    const response = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix })
    );

    const contents = response.Contents ?? [];
    return contents
      .map((obj: { Key?: string }) => obj.Key ?? "")
      .filter((k: string) => k.length > 0)
      .map((k: string) => `s3://${bucket}/${k}`);
  }

  async read(path: string): Promise<string> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const { bucket, key } = parseS3Path(path);

    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    return response.Body.transformToString();
  }

  async write(path: string, content: string): Promise<void> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const { bucket, key } = parseS3Path(path);

    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: content })
    );
  }

  async move(from: string, to: string): Promise<void> {
    const { CopyObjectCommand, DeleteObjectCommand } = await import(
      "@aws-sdk/client-s3"
    );
    const client = await this.getClient();
    const { bucket: srcBucket, key: srcKey } = parseS3Path(from);
    const { bucket: dstBucket, key: dstKey } = parseS3Path(to);

    await client.send(
      new CopyObjectCommand({
        Bucket: dstBucket,
        Key: dstKey,
        CopySource: `${srcBucket}/${srcKey}`,
      })
    );

    await client.send(
      new DeleteObjectCommand({ Bucket: srcBucket, Key: srcKey })
    );
  }

  async exists(path: string): Promise<boolean> {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.getClient();
    const { bucket, key } = parseS3Path(path);

    try {
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return true;
    } catch (err: unknown) {
      const code =
        (err as { name?: string; $metadata?: { httpStatusCode?: number } })
          ?.name ??
        (err as { $metadata?: { httpStatusCode?: number } })?.$metadata
          ?.httpStatusCode;
      if (
        code === "NotFound" ||
        code === "NoSuchKey" ||
        code === 404
      ) {
        return false;
      }
      throw err;
    }
  }
}
