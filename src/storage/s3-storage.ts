import { isS3Path, parseS3Path } from "./storage.js";
import type { Storage } from "./storage.js";

export interface S3StorageOptions {
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
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
          region: this.options.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
          forcePathStyle: true,
          credentials:
            this.options.accessKeyId && this.options.secretAccessKey
              ? {
                  accessKeyId: this.options.accessKeyId,
                  secretAccessKey: this.options.secretAccessKey,
                  sessionToken: this.options.sessionToken,
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

    const paths: string[] = [];
    const seenTokens = new Set<string>();
    let continuationToken: string | undefined;
    do {
      const response = await client.send(new ListObjectsV2Command({
        Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken,
      }));
      for (const object of response.Contents ?? []) {
        if (object.Key && !object.Key.endsWith("/")) paths.push(`s3://${bucket}/${object.Key}`);
      }
      if (!response.IsTruncated) break;
      const next = response.NextContinuationToken;
      if (!next || seenTokens.has(next)) throw new Error("Invalid S3 listing continuation token");
      seenTokens.add(next);
      continuationToken = next;
    } while (true);
    return paths;
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
    if (!isS3Path(from) || !isS3Path(to)) throw new Error("Cross-backend moves are unsupported");
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
        CopySource: `${srcBucket}/${srcKey.split("/").map(encodeURIComponent).join("/")}`,
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
      const response = err as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (response.name === "NotFound" || response.name === "NoSuchKey" || response.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw err;
    }
  }
}
