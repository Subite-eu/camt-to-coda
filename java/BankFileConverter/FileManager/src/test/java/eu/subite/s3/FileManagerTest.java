package eu.subite.s3;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatException;
import static org.assertj.core.api.Assertions.assertThatNoException;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import eu.subite.DockerUtils;
import eu.subite.s3.FileManager;
import eu.subite.s3.S3Config;
import software.amazon.awssdk.services.s3.model.S3Exception;

class FileManagerTest {
	private static final Logger LOGGER = LogManager.getLogger();

	private static final String BUCKET = "camt";

	private static final String CAMT_053 = "../../../example-files/CAMT/LT625883379695428516/CAMT_053/2024-03-07.xml";
	private static final String ARCHVIVE = "archive";

	private static final String ACCESS_KEY = "s3_username";
	private static final String SECRET_KEY = "s3_password";

	private static String endPoint = "http://127.0.0.1:9000";
	private static S3Config conf;

	@BeforeAll
	static void init() throws IOException {
		endPoint = "http://127.0.0.1:9000";
		if (DockerUtils.isRunningInsideDocker()) {
			endPoint = "http://s3:9000";
		}
		conf = new S3Config(endPoint, ACCESS_KEY, SECRET_KEY);
	}

	@BeforeEach
	void cleanup() throws IOException {
		reset();
	}

	@AfterAll
	static void reset() throws IOException {
		var fm = new FileManager(conf);
		deleteFiles(fm, BUCKET);
		deleteFiles(fm, ARCHVIVE);
	}

	private static void deleteFiles(FileManager fm, String bucket) throws IOException {
		if (fm.bucketExists(bucket)) {
			fm.listFiles(bucket, "").forEach(o -> deleteQuietly(fm, bucket, o));
		}
	}

	private static void deleteQuietly(FileManager fm, String bucket, String o) {
		try {
			fm.deleteFile(bucket, o);
		}
		catch (IOException e) {
			LOGGER.warn(e);
		}
	}

	@Test
	void invalidAccessKey() throws Exception {
		var fm = new FileManager(new S3Config(endPoint, "xxxxxx", "xxxxxx"));
		assertThatException().isThrownBy(() -> fm.listFiles(BUCKET, ""))
				.as("should not connect")
				.isInstanceOf(S3Exception.class)
				.withMessageContaining("The Access Key Id you provided does not exist in our records");
	}

	@Test
	void invalidSecretsKey() throws Exception {
		var fm = new FileManager(new S3Config(endPoint, ACCESS_KEY, "xxxxxx"));
		assertThatException().isThrownBy(() -> fm.listFiles(BUCKET, ""))
				.as("should not connect")
				.isInstanceOf(S3Exception.class)
				.withMessageContaining("The request signature we calculated does not match the signature you provided");
	}

	@Test
	void listObjects() throws Exception {
		var fm = new FileManager(conf);
		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isEmpty();
	}

	@Test
	void uploadFile() throws Exception {
		var fm = new FileManager(conf);
		assertThatNoException()
				.isThrownBy(() -> fm.uploadFile(BUCKET, "2024-03-07.xml", new File(CAMT_053)));
	}

	@Test
	void downloadFile() throws Exception {
		var fm = new FileManager(conf);
		var sourceFile = "2024-03-07.xml";
		var targetFilePath = "target/%s".formatted(ARCHVIVE, sourceFile);
		new File(targetFilePath).delete();

		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isEmpty();
		assertThatNoException().isThrownBy(() -> fm.uploadFile(BUCKET, sourceFile, new File(CAMT_053)));
		try {
			fm.downloadFile(BUCKET, sourceFile, targetFilePath);
			assertThat(new File(targetFilePath)).as("TARGET file").hasSameTextualContentAs(new File(CAMT_053));
		}
		finally {
			Files.deleteIfExists(Path.of(targetFilePath));
		}
	}

	@Test
	void moveFile() throws Exception {
		var fm = new FileManager(conf);
		var file = "2024-03-07.xml";
		assertThatNoException().isThrownBy(() -> fm.uploadFile(BUCKET, file, new File(CAMT_053)));
		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isNotEmpty();
		assertThatNoException().isThrownBy(() -> fm.moveFile(BUCKET, file, ARCHVIVE));
		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isEmpty();
		assertThat(fm.listFiles(ARCHVIVE, "")).as("BUCKET").isNotEmpty();
	}

	@Test
	void exists() throws Exception {
		var fm = new FileManager(conf);
		var file = "2024-03-07.xml";
		assertThat(fm.exists(BUCKET, file)).as("exists").isFalse();
		assertThatNoException().isThrownBy(() -> fm.uploadFile(BUCKET, file, new File(CAMT_053)));
		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isNotEmpty();
		assertThat(fm.exists(BUCKET, file)).as("exists").isTrue();
	}

	@Test
	void deleteFile() throws Exception {
		var fm = new FileManager(conf);
		var file = "2024-03-07.xml";
		assertThatNoException().isThrownBy(() -> fm.uploadFile(BUCKET, file, new File(CAMT_053)));
		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isNotEmpty();
		assertThatNoException().isThrownBy(() -> fm.deleteFile(BUCKET, file));
		assertThat(fm.listFiles(BUCKET, "")).as("BUCKET").isEmpty();
	}

	@Test
	void createBucket() throws Exception {
		var fm = new FileManager(conf);
		var NEW_BUCKET = "new%s".formatted(System.currentTimeMillis());
		try {
			assertThatNoException().isThrownBy(() -> fm.createBucket(NEW_BUCKET));
		}
		finally {
			fm.deleteBucket(NEW_BUCKET);
		}
	}
}
