package eu.subite.s3;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;

import java.io.File;
import java.io.IOException;

import org.apache.commons.cli.ParseException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import eu.subite.CamtToCodaCommon;
import eu.subite.CamtToCodaFs;
import eu.subite.CamtToCodaS3;
import eu.subite.DockerUtils;
import eu.subite.params.S3Params;

abstract class CamtToCodaCommonS3 extends CamtToCodaCommon<String, S3Params, CamtToCodaS3> {

	private static final Logger LOGGER = LogManager.getLogger();

	private static final String BUCKET = "camt";
	private static final String TARGET = "coda";
	private static final String PATH_ARCHIVE = "archive";
	private static final String PATH_ERROR = "error";

	private static final String ACCESS_KEY = "s3_username";
	private static final String SECRET_KEY = "s3_password";

	protected FileManager fm;

	@BeforeEach
	protected void init() throws IOException {
		this.fm = new FileManager(new S3Config(getEndPoint(), ACCESS_KEY, SECRET_KEY));
		super.init();
	}

	protected CamtToCodaS3 buildConverter() throws ParseException {
		return new CamtToCodaS3(
				"--%s".formatted(CamtToCodaS3.OP_XSLT), getXslt(),
				"--%s".formatted(CamtToCodaS3.OP_VERSION), Integer.toString(getVersion()),
				"--%s".formatted(CamtToCodaS3.OP_IN),
				BUCKET,
				"--%s".formatted(CamtToCodaFs.OP_ARCHIVE), getArchivePath(),
				"--%s".formatted(CamtToCodaFs.OP_ERROR), getErrorPath(),
				"--%s".formatted(CamtToCodaFs.OP_OUT), getTarget(),
				"--%s".formatted(CamtToCodaS3.OP_END_POINT), getEndPoint(),
				"--%s".formatted(CamtToCodaS3.OP_ACCESS_KEY), ACCESS_KEY,
				"--%s".formatted(CamtToCodaS3.OP_SECRET_KEY), SECRET_KEY);
	}

	public String getEndPoint() {
		if (DockerUtils.isRunningInsideDocker()) {
			return "http://s3:9000";
		}
		return "http://127.0.0.1:9000";
	}

	@Override
	protected String getSource() {
		return BUCKET;
	}

	@Override
	protected String getTarget() {
		return TARGET;
	}

	@Override
	protected String getArchivePath() {
		return PATH_ARCHIVE;
	}

	@Override
	protected String getErrorPath() {
		return PATH_ERROR;
	}

	@Override
	protected String toSource(String source) {
		return source.length() > 0
				? source
				: getSource();
	}

	@Override
	protected void copySampleToIn(File... files) throws IOException {
		for (var file : files) {
			this.fm.uploadFile(BUCKET, file.getName(), file);
		}
	}

	@Override
	protected void expectFileToBeArchived(String file) {
		assertThat(this.fm.exists(getArchivePath(), file))
				.as("CAMT are in '%s' folder", getArchivePath())
				.isTrue();
	}

	@Override
	protected void expectFileToBeInError(String file) {
		assertThat(this.fm.exists(getErrorPath(), file))
				.as("CAMT are in '%s' folder", getErrorPath())
				.isTrue();
	}

	protected void isFolderEmpty(String bucket, boolean shouldBeEmpty) {
		if (shouldBeEmpty) {
			assertThat(this.fm.listFiles(bucket, ""))
					.as("bucket '%s' is empty", bucket)
					.isEmpty();
		}
		else {
			assertThat(this.fm.listFiles(bucket, ""))
					.as("bucket '%s' should not be empty", bucket)
					.isNotEmpty();
		}
	}

	@Override
	protected void deleteFiles(String bucket) throws IOException {
		if (this.fm.bucketExists(bucket)) {
			var list = this.fm.listFiles(bucket, "");
			if (!list.isEmpty()) {
				this.fm.deleteFiles(bucket, list);
			}
			isFolderEmpty(bucket, true);
		}
	}

	@Test
	void initParams() throws Exception {
		copySampleToIn(new File("%s/%s".formatted(getSamplePath(), getOneFileName())));
		assertThatNoException()
				.isThrownBy(
						() -> CamtToCodaS3.main(
								"-x", getXslt(),
								"-v", Integer.toString(getVersion()),
								"-i", getSource(),
								"-t", getTmp(),
								"-a", getArchivePath(),
								"-e", getErrorPath(),
								"-o", getTarget(),
								"-ep", getEndPoint(),
								"-ak", ACCESS_KEY,
								"-sk", SECRET_KEY));
		expectFileToBeArchived(getOneFileName());
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}
}
