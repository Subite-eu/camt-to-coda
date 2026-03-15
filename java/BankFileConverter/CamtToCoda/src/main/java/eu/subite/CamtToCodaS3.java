package eu.subite;

import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.util.List;

import javax.xml.transform.stream.StreamSource;

import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import eu.subite.params.S3Params;
import eu.subite.s3.FileManager;
import eu.subite.s3.S3Config;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

public class CamtToCodaS3 extends CamtToCoda<String, S3Params> {

	private static final Logger LOGGER = LogManager.getLogger();

	public static final String OP_END_POINT = "endPoint";
	public static final String OP_ACCESS_KEY = "accessKey";
	public static final String OP_SECRET_KEY = "secretKey";

	private FileManager fileManager;

	public CamtToCodaS3(String... args) throws ParseException {
		super(args);

		this.fileManager = new FileManager(
				new S3Config(
						getInitialParams().getEndPoint(),
						getInitialParams().getAccessKey(),
						getInitialParams().getSecretKey()));

		checkBuckets();
	}

	private void checkBuckets() {
		checkBucket(getInitialParams().getSource());
		checkBucket(getInitialParams().getTarget());
		createIfMissing(getInitialParams().getArchiveFolder());
		createIfMissing(getInitialParams().getErrorFolder());
		LOGGER.info("Source[{}] - Target[{}] - Archive[{}] - Error[{}] - Tmp[{}]",
				getInitialParams().getSource(),
				getInitialParams().getTarget(),
				getInitialParams().getArchiveFolder(),
				getInitialParams().getErrorFolder(),
				getInitialParams().getTmpFolder());
	}

	public static void main(String... args) throws Exception {
		new CamtToCodaS3(args).convert();
	}

	@Override
	protected void addCustomArgs(Options options, String[] args) {
		options.addOption(Option.builder("ep").longOpt(OP_END_POINT)
				.desc("S3 end point")
				.type(String.class)
				.required()
				.hasArg()
				.build());

		options.addOption(Option.builder("ak").longOpt(OP_ACCESS_KEY)
				.desc("S3 access key")
				.type(String.class)
				.required()
				.hasArg()
				.build());

		options.addOption(Option.builder("sk").longOpt(OP_SECRET_KEY)
				.desc("S3 secret key")
				.type(String.class)
				.required()
				.hasArg()
				.build());
	}

	@Override
	protected S3Params initParams(CommandLine cmd, String xslt, int version, String source, String tmpFolder,
			String archiveFolder, String errorFolder, String target) throws ParseException {
		String endPoint = cmd.getParsedOptionValue(OP_END_POINT);
		String accessKey = cmd.getParsedOptionValue(OP_ACCESS_KEY);
		String secretKey = cmd.getParsedOptionValue(OP_SECRET_KEY);
		LOGGER.info(
				"CAMT version[{}] - source[{}] - target[{}] - archive[{}] - error[{}] - endPoint[{}] - accessKey[{}] ",
				version, source, target, archiveFolder, errorFolder, endPoint, accessKey);
		return new S3Params(
				xslt, version, source, tmpFolder, archiveFolder, errorFolder, target, endPoint, accessKey, secretKey);
	}

	@Override
	protected Class<String> getInputType() {
		return String.class;
	}

	@Override
	protected boolean sourceExist(String source) {
		return fileManager.exists(getInitialParams().getSource(), source);
	}

	@Override
	protected boolean isSourceDirectory(String source) {
		return fileManager.bucketExists(source);
	}

	@Override
	protected List<String> listFiles(String folder) {
		// in S3, this works only on buckets
		LOGGER.info("Scanning bucket '{}' for files to convert", getInitialParams().getSource());
		return this.fileManager.listFiles(getInitialParams().getSource(), "");
	}

	@Override
	protected StreamSource toStreamSource(String source) throws IOException {
		return new StreamSource(getInputStream(source));
	}

	@Override
	protected Reader toReader(String source) throws IOException {
		return new InputStreamReader(getInputStream(source));
	}

	private ResponseInputStream<GetObjectResponse> getInputStream(String source) throws IOException {
		return this.fileManager.streamFile(getInitialParams().getSource(), source);
	}

	@Override
	protected String store(File file) throws IOException {
		this.fileManager.uploadFile(getInitialParams().getTarget(), file.getName(), file);
		return file.getName();
	}

	@Override
	protected void putFileInArchive(String source) throws IOException {
		this.fileManager.moveFile(
				getInitialParams().getSource(),
				source,
				getInitialParams().getArchiveFolder());

	}

	@Override
	protected void putFileInError(String source) throws IOException {
		this.fileManager.moveFile(
				getInitialParams().getSource(),
				source,
				getInitialParams().getErrorFolder());
	}

	private void checkBucket(String bucket) {
		if (!this.fileManager.bucketExists(bucket)) {
			throw new IllegalArgumentException("Bucket '%s' not found".formatted(bucket));
		}
	}

	private void createIfMissing(String bucket) {
		if (!this.fileManager.bucketExists(bucket)) {
			this.fileManager.createBucket(bucket);
		}
	}

	@Override
	protected String getDefaultArchiveFolder() {
		return "archive";
	}

	@Override
	protected String getDefaultErrorFolder() {
		return "error";
	}
}
