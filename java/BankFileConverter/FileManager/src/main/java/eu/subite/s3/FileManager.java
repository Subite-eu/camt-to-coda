package eu.subite.s3;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.stream.Stream;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.Bucket;
import software.amazon.awssdk.services.s3.model.CopyObjectRequest;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.Delete;
import software.amazon.awssdk.services.s3.model.DeleteBucketRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Request;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Object;

public class FileManager {

	private static final Logger LOGGER = LogManager.getLogger();

	private S3Config config;
	private S3Client s3;

	public FileManager(S3Config config) {
		this.config = config;

		var credentials = AwsBasicCredentials.builder()
				.accessKeyId(config.accessKey())
				.secretAccessKey(config.secretKey())
				.build();
		var credentialsProvider = StaticCredentialsProvider.create(credentials);

		this.s3 = S3Client.builder()
				.region(Region.EU_WEST_1)
				.endpointOverride(URI.create(config.endPoint()))
				.forcePathStyle(true)
				.credentialsProvider(credentialsProvider)
				.build();
	}

	public boolean exists(String bucket, String object) {
		LOGGER.info("Does '{}' exist in bucket '{}'?", object, bucket);
		try {
			getHeadObject(bucket, object);
			return true;
		}
		catch (NoSuchKeyException e) {
			LOGGER.warn("'{}' not found in bucket '{}' - msg[{}]", object, bucket, e);
			return false;
		}
	}

	public boolean bucketExists(String bucket) {
		LOGGER.info("Does bucket '{}' exist ?", bucket);
		return s3.listBuckets().buckets()
				.stream()
				.map(Bucket::name)
				.filter(b -> b.equals(bucket))
				.count() > 0;
	}

	public void createBucket(String bucket) {
		LOGGER.info("Create bucket '{}'", bucket);
		s3.createBucket(CreateBucketRequest.builder()
				.objectLockEnabledForBucket(true)
				.bucket(bucket)
				.build());

		// Wait until the bucket is created
		s3.waiter().waitUntilBucketExists(HeadBucketRequest.builder()
				.bucket(bucket)
				.build());
	}

	public void deleteBucket(String bucket) {
		LOGGER.info("Delete bucket '{}'", bucket, bucket);
		s3.deleteBucket(DeleteBucketRequest.builder().bucket(bucket).build());

		// Wait until the bucket is deleted
		s3.waiter().waitUntilBucketNotExists(HeadBucketRequest.builder()
				.bucket(bucket)
				.build());
	}

//	/**
//	 * @deprecated not working very well !? Use bucket instead
//	 */
//	public boolean isDirectory(String bucket, String object) {
//		LOGGER.info("Is '{}' a directory in bucket '{}'?", object, bucket);
//		var res = getHeadObject(bucket, object);
//		return res.contentType().contains("directory");
//	}
//
//	/**
//	 * @deprecated not working very well !? Use bucket instead
//	 */
//	public void createDirectory(String bucket, String object) {
//		LOGGER.info("Create directory '{}' in bucket '{}'", object, bucket);
//		s3.putObject(PutObjectRequest.builder()
//				.bucket(bucket)
//				.key(object)
//				.build(), RequestBody.empty());
//	}

	private HeadObjectResponse getHeadObject(String bucket, String object) {
		return s3.headObject(HeadObjectRequest.builder()
				.bucket(bucket)
				.key(object)
				.build());
	}

	public List<String> listFiles(String bucket, String prefix) {
		var result = s3.listObjectsV2(ListObjectsV2Request.builder()
				.bucket(bucket)
				.prefix(prefix)
				.build());
		return result.contents()
				.stream()
				.map(S3Object::key)
				.toList();
	}

	public void downloadFile(String bucket, String key, String target) throws IOException {
		try (var ris = streamFile(bucket, key);
				FileOutputStream fos = new FileOutputStream(new File(target))) {
			byte[] read_buf = new byte[1024];
			int read_len = 0;
			while ((read_len = ris.read(read_buf)) > 0) {
				fos.write(read_buf, 0, read_len);
			}
		}
	}

	public ResponseInputStream<GetObjectResponse> streamFile(String bucket, String object) throws IOException {
		LOGGER.info("Stream '{}' from bucket '{}'", object, bucket);
		return s3.getObject(GetObjectRequest.builder()
				.bucket(bucket)
				.key(object)
				.build());
	}

	public void uploadFile(String bucket, String object, File file) throws IOException {
		LOGGER.info("Upload file '{}' as '{}' in bucket '{}'", file, object, bucket);
		s3.putObject(PutObjectRequest.builder()
				.bucket(bucket)
				.key(object)
				.build(), file.toPath());
//		s3.waiter().waitUntilObjectExists(HeadObjectRequest.builder()
//				.bucket(bucket)
//				.key(object)
//				.build());
	}

	public void copyFile(String sourceBucket, String object, String targetBucket) throws IOException {
		LOGGER.info("Copy '{}' from bucket '{}' to bucket '{}'", object, sourceBucket, targetBucket);
		s3.copyObject(CopyObjectRequest.builder()
				.sourceBucket(sourceBucket)
				.sourceKey(object)
				.destinationBucket(targetBucket)
				.destinationKey(object)
				.build());
//		s3.waiter().waitUntilObjectExists(HeadObjectRequest.builder()
//				.bucket(targetBucket)
//				.key(object)
//				.build());
	}

	public void deleteFile(String bucket, String object) throws IOException {
		LOGGER.info("delete file '{}' from bucket '{}'", object, bucket);
		s3.deleteObject(DeleteObjectRequest.builder()
				.bucket(bucket)
				.key(object).build());
	}

	public void deleteFiles(String bucket, List<String> objects) throws IOException {
		LOGGER.info("delete {} files from bucket '{}'", objects.size(), bucket);
		LOGGER.debug("Files to delete: {}", objects);

		Delete toDelete = Delete.builder()
				.objects(objects.stream().map(o -> ObjectIdentifier.builder().key(o).build()).toList())
				.build();

		s3.deleteObjects(DeleteObjectsRequest.builder()
				.bucket(bucket)
				.delete(toDelete)
				.build());
	}

	public void moveFile(String sourceBucket, String sourcePath, String targetBucket) throws IOException {
		LOGGER.info("Move '{}' from bucket '{}' to bucket '{}'", sourcePath, sourceBucket, targetBucket);
		copyFile(sourceBucket, sourcePath, targetBucket);
		deleteFile(sourceBucket, sourcePath);
	}
}
