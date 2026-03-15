package eu.subite.cli;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;

import eu.subite.CamtToCodaFs;
import eu.subite.CamtToCodaS3;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

@Command(
	name = "convert",
	description = "Convert CAMT files to CODA format"
)
public class ConvertCommand implements Callable<Integer> {

	@Option(names = {"-i", "--input"}, required = true, description = "Input file or directory")
	private String input;

	@Option(names = {"-o", "--output"}, required = true, description = "Output directory")
	private String output;

	@Option(names = {"-v", "--version"}, required = true, description = "CAMT version (52 or 53)")
	private int version;

	@Option(names = {"-x", "--xslt"}, defaultValue = "./xslt", description = "XSLT directory (default: ./xslt)")
	private String xsltDir;

	@Option(names = {"-a", "--archive"}, defaultValue = "/tmp", description = "Archive directory")
	private String archiveDir;

	@Option(names = {"-e", "--error"}, defaultValue = "/tmp", description = "Error directory")
	private String errorDir;

	@Option(names = {"-t", "--tmp"}, defaultValue = "/tmp", description = "Temp directory")
	private String tmpDir;

	@Option(names = {"--mode"}, defaultValue = "fs", description = "Mode: fs or s3")
	private String mode;

	@Option(names = {"-d", "--dry-run"}, description = "Validate and transform but discard output")
	private boolean dryRun;

	@Option(names = {"--endpoint"}, description = "S3 endpoint URL (required for s3 mode)")
	private String endpoint;

	@Option(names = {"--access-key"}, description = "S3 access key (required for s3 mode)")
	private String accessKey;

	@Option(names = {"--secret-key"}, description = "S3 secret key (required for s3 mode)")
	private String secretKey;

	@Override
	public Integer call() throws Exception {
		List<String> args = new ArrayList<>();
		args.addAll(List.of("-v", String.valueOf(version)));
		args.addAll(List.of("-i", input));
		args.addAll(List.of("-o", output));
		args.addAll(List.of("-x", xsltDir));
		args.addAll(List.of("-a", archiveDir));
		args.addAll(List.of("-e", errorDir));
		args.addAll(List.of("-t", tmpDir));
		if (dryRun) args.add("-d");

		if ("s3".equals(mode)) {
			if (endpoint != null) args.addAll(List.of("-ep", endpoint));
			if (accessKey != null) args.addAll(List.of("-ak", accessKey));
			if (secretKey != null) args.addAll(List.of("-sk", secretKey));
			CamtToCodaS3.main(args.toArray(String[]::new));
		} else {
			CamtToCodaFs.main(args.toArray(String[]::new));
		}
		return 0;
	}
}
