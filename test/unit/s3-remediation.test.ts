import { describe, expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn());
const clientOptions = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = send; constructor(options: unknown) { clientOptions(options); } },
  ListObjectsV2Command: class { constructor(public input: unknown) {} },
  CopyObjectCommand: class { constructor(public input: unknown) {} },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  HeadObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}));
import { S3Storage } from '../../src/storage/s3-storage.js';
import { FsStorage } from '../../src/storage/fs-storage.js';
describe('S3 discovery and archive contracts', () => {
  it('exhausts pagination and retains both formats, excluding directory placeholders', async () => {
    send.mockReset().mockResolvedValueOnce({ Contents: [{ Key: 'in/one.XML' }, { Key: 'in/' }], IsTruncated: true, NextContinuationToken: 'page-2' })
      .mockResolvedValueOnce({ Contents: [{ Key: 'in/two.COD' }], IsTruncated: false });
    expect(await new S3Storage().list('s3://bucket/in/')).toEqual(['s3://bucket/in/one.XML', 's3://bucket/in/two.COD']);
    expect(send.mock.calls[1][0].input.ContinuationToken).toBe('page-2');
  });
  it('fails explicitly if a truncated response cannot be continued', async () => {
    send.mockReset().mockResolvedValue({ Contents: [], IsTruncated: true });
    await expect(new S3Storage().list('s3://bucket/in/')).rejects.toThrow(/continuation/i);
  });
  it('rejects cross-backend moves before copying or deleting', async () => {
    send.mockReset();
    await expect(new S3Storage().move('s3://bucket/input.xml', '/tmp/output.xml')).rejects.toThrow(/cross.backend/i);
    expect(send).not.toHaveBeenCalled();
    await expect(new FsStorage().move('/tmp/input.xml', 's3://bucket/output.xml')).rejects.toThrow(/cross.backend/i);
  });
  it('URL-encodes S3 copy source keys without changing the destination key', async () => {
    send.mockReset().mockResolvedValue({});
    await new S3Storage().move('s3://bucket/in/a b#c.xml', 's3://archive/out.xml');
    expect(send.mock.calls[0][0].input).toMatchObject({ CopySource: 'bucket/in/a%20b%23c.xml', Bucket: 'archive', Key: 'out.xml' });
  });
  it('reads a streamed object and writes the exact original body', async () => {
    const body = '<Document>original source</Document>';
    send.mockReset().mockResolvedValueOnce({ Body: { transformToString: async () => body } }).mockResolvedValueOnce({});
    const storage = new S3Storage();
    expect(await storage.read('s3://bucket/source.xml')).toBe(body);
    await storage.write('s3://bucket/result.cod', body);
    expect(send.mock.calls[1][0].input).toMatchObject({ Bucket: 'bucket', Key: 'result.cod', Body: body });
  });
  it('distinguishes absent objects from access and network failures', async () => {
    const storage = new S3Storage();
    send.mockReset().mockResolvedValueOnce({}).mockRejectedValueOnce({ name: 'NotFound' }).mockRejectedValueOnce({ name: 'NoSuchKey' }).mockRejectedValueOnce({ name: 'Error', $metadata: { httpStatusCode: 404 } }).mockRejectedValueOnce(new Error('AccessDenied'));
    expect(await storage.exists('s3://bucket/present')).toBe(true);
    expect(await storage.exists('s3://bucket/missing')).toBe(false);
    expect(await storage.exists('s3://bucket/missing')).toBe(false);
    expect(await storage.exists('s3://bucket/missing')).toBe(false);
    await expect(storage.exists('s3://bucket/private')).rejects.toThrow('AccessDenied');
  });

  it('leaves credential resolution to the SDK and respects environment region', async () => {
    vi.stubEnv('AWS_REGION', 'eu-west-1');
    send.mockReset().mockResolvedValue({ Contents: [], IsTruncated: false });
    try {
      await new S3Storage().list('s3://bucket/in/');
      expect(clientOptions).toHaveBeenLastCalledWith(expect.objectContaining({ credentials: undefined, region: 'eu-west-1' }));
    } finally { vi.unstubAllEnvs(); }
  });

});
