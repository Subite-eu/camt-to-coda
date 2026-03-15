package eu.subite;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import javax.xml.transform.stream.StreamSource;

import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.HelpFormatter;
import org.apache.commons.cli.Option;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.apache.commons.io.FileUtils;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import eu.subite.error.InvalidCamtFileException;
import eu.subite.error.InvalidCodaFileException;
import eu.subite.params.Params;
import eu.subite.tools.DateToSequenceHelper;
import eu.subite.tools.XsltErrorHelper;
import eu.subite.validation.BusinessRuleValidator;
import eu.subite.validation.CamtSchemaValidator;
import eu.subite.validation.ValidationResult;
import net.sf.saxon.s9api.Processor;
import net.sf.saxon.s9api.SaxonApiException;
import net.sf.saxon.s9api.XsltCompiler;
import net.sf.saxon.s9api.XsltExecutable;

public abstract class CamtToCoda<T, P extends Params<T>> {

	private static final Logger LOGGER = LogManager.getLogger();

	public static final String OP_XSLT = "xslt";
	public static final String OP_XSLT_DEFAULT = "./xslt";
	public static final String OP_IN = "input";
	public static final String OP_TMP = "tmp";
	public static final String OP_TMP_DEFAULT = "/tmp";
	public static final String OP_ARCHIVE = "archive";
	public static final String OP_ERROR = "error";
	public static final String OP_OUT = "output";
	public static final String OP_VERSION = "version";
	public static final String OP_DRY_RUN = "dry-run";

	private static final String VERSION_GROUP = "VERSION";

	protected abstract P initParams(CommandLine cmd, String xslt, int version, T input, String tmpFolder,
			String archiveFolder, String errorFolder, String targetFolder) throws ParseException;

	protected abstract boolean sourceExist(T source);

	protected abstract boolean isSourceDirectory(T source);

	protected abstract List<T> listFiles(T source);

	protected abstract StreamSource toStreamSource(T source) throws IOException;

	protected abstract Reader toReader(T source) throws IOException;

	protected abstract String store(File file) throws IOException;

	protected abstract void putFileInArchive(T source) throws IOException;

	protected abstract void putFileInError(T source) throws IOException;

	protected abstract String getDefaultArchiveFolder();

	protected abstract String getDefaultErrorFolder();

	protected abstract Class<T> getInputType();

	private P initialParams;

	public CamtToCoda(P initialParams) throws ParseException {
		this.initialParams = initialParams;
	}

	public CamtToCoda(String... args) throws ParseException {
		this.initialParams = initParams(args);
	}

	public P initParams(String... args) throws ParseException {
		var cmd = parseArgs(args);

		String xslt = cmd.getParsedOptionValue(OP_XSLT, OP_XSLT_DEFAULT);
		T input = cmd.getParsedOptionValue(OP_IN);
		String tmpFolder = cmd.getParsedOptionValue(OP_TMP, OP_TMP_DEFAULT);
		String archiveFolder = cmd.getParsedOptionValue(OP_ARCHIVE, getDefaultArchiveFolder());
		String errorFolder = cmd.getParsedOptionValue(OP_ERROR, getDefaultErrorFolder());
		String outputFolder = cmd.getParsedOptionValue(OP_OUT);
		int version = cmd.getParsedOptionValue(OP_VERSION);
		return initParams(cmd, xslt, version, input, tmpFolder, archiveFolder, errorFolder, outputFolder);
	}

	protected abstract void addCustomArgs(Options options, String[] args);

	private CommandLine parseArgs(String[] args) throws ParseException {
		Options options = new Options();

		options.addOption(Option.builder("x").longOpt(OP_XSLT)
				.desc("xslt repo path (optional. default is %s)".formatted(OP_XSLT_DEFAULT))
				.type(String.class)
				.required(false)
				.hasArg()
				.build());

		options.addOption(Option.builder("v").longOpt(OP_VERSION)
				.desc("CAMT version")
				.type(Integer.class)
				.required()
				.hasArg()
				.build());

		options.addOption(Option.builder("i").longOpt(OP_IN)
				.desc("input file/dir/bucket")
				.type(getInputType())
				.required()
				.hasArg()
				.build());

		options.addOption(Option.builder("t").longOpt(OP_TMP)
				.desc("tmp directory path (optional. default is %s)".formatted(OP_XSLT_DEFAULT))
				.type(String.class)
				.required(false)
				.hasArg()
				.build());

		options.addOption(Option.builder("a").longOpt(OP_ARCHIVE)
				.desc("archive directory path (optional. default is %s)".formatted(getDefaultArchiveFolder()))
				.type(String.class)
				.required(false)
				.hasArg()
				.build());

		options.addOption(Option.builder("e").longOpt(OP_ERROR)
				.desc("error directory path (optional. default is %s)".formatted(getDefaultErrorFolder()))
				.type(String.class)
				.required(false)
				.hasArg()
				.build());

		options.addOption(Option.builder("o").longOpt(OP_OUT)
				.desc("output directory path")
				.type(String.class)
				.required()
				.hasArg()
				.build());

		options.addOption(Option.builder("d").longOpt(OP_DRY_RUN)
				.desc("dry-run mode: validate and transform but discard output")
				.type(Boolean.class)
				.required(false)
				.build());

		addCustomArgs(options, args);

		CommandLineParser parser = new DefaultParser();
		HelpFormatter formatter = new HelpFormatter();
		try {
			return parser.parse(options, args, true);
		}
		catch (ParseException e) {
			LOGGER.error(e.getMessage());
			formatter.printHelp("Camt to Coda converter", options);
			throw e;
		}
	}

	public void convert() throws Exception {
		LOGGER.info("converting {}", initialParams);
		convert(initialParams.getSource());
	}

	public void convert(T item) throws Exception {
		if (isSourceDirectory(item)) {
			for (var subSource : listFiles(item)) {
				convert(subSource);
			}
		}
		else {
			if (sourceExist(item)) {
				convertFile(item);
			}
			else {
				throw new InvalidCamtFileException(item, "Source does not exist");
			}
		}
	}

	public List<String> convertFile(T source) throws IOException {
		LOGGER.info("File to convert: '{}'", source);
		var tmp = Files.createTempDirectory(Path.of(initialParams.getTmpFolder()), ".tmp_coda_").toFile();
		try {
			var xslt = getXsltFileMatchingSourceVersion(source);

			if (initialParams.isDryRun()) {
				LOGGER.info("[DRY-RUN] Would use XSLT: {}", xslt.getName());
			}

			doConvertFile(toStreamSource(source), xslt, tmp);

			var list = tmp.listFiles();
			for (File file : list) {
				validate(file);
			}

			if (initialParams.isDryRun()) {
				LOGGER.info("[DRY-RUN] Validation passed. Would produce {} output file(s):", list.length);
				for (File file : list) {
					var lines = Files.readAllLines(file.toPath());
					LOGGER.info("[DRY-RUN]   {} ({} records)", file.getName(), lines.size());
				}
				LOGGER.info("[DRY-RUN] Source file would be archived. No files written.");
				return List.of();
			}

			// all ok ? lets put all produced files into target folder
			var results = new ArrayList<String>();
			for (File file : list) {
				var target = store(file);
				results.add(target.toString());
				LOGGER.info("Generated file: {}", target);
			}
			putFileInArchive(source);
			return results;
		}
		catch (InvalidCamtFileException e) {
			LOGGER.warn("Ignore invalid source: {} - reason: {}", source, e.toString());
			return List.of();
		}
		catch (Exception e) {
			if (!initialParams.isDryRun()) {
				putFileInError(source);
			} else {
				LOGGER.error("[DRY-RUN] Conversion would fail: {}", e.getMessage());
			}
			return List.of();
		}
		finally {
			FileUtils.deleteDirectory(tmp);
		}
	}

	protected File getXsltFileMatchingSourceVersion(T source) throws IOException, InvalidCamtFileException {
		var versionFinder = Pattern.compile("xmlns=\"urn:iso:std:iso:20022:tech:xsd:(?<%s>camt.0%s.\\d+.\\d+)\""
				.formatted(VERSION_GROUP, initialParams.getVersion()));

		try (BufferedReader reader = new BufferedReader(toReader(source))) {
			String line = reader.readLine();
			while (line != null) {
				var matcher = versionFinder.matcher(line);
				if (matcher.find()) {
					return new File(
							"%s/%s-to-coda.xslt".formatted(initialParams.getXsltRepo(), matcher.group(VERSION_GROUP)));
				}
				line = reader.readLine();
			}
		}
		throw new InvalidCamtFileException(
				source, "CAMT 0%s Namespace version not found".formatted(initialParams.getVersion()));
	}

	protected void doConvertFile(StreamSource xmlSource, File xslt, File tmp) throws SaxonApiException, IOException {
		LOGGER.info("Converting file source using '{}'", xslt);
		var xsltSource = new StreamSource(xslt);

		Processor processor = new Processor();
		processor.getUnderlyingConfiguration().setProcessor(processor);
		processor.registerExtensionFunction(new DateToSequenceHelper());
		processor.registerExtensionFunction(new XsltErrorHelper());
		XsltCompiler xsltCompiler = processor.newXsltCompiler();

		XsltExecutable xsltExecutable = xsltCompiler.compile(xsltSource);

		var transformer = xsltExecutable.load30();

		// var serializer = processor.newSerializer(new File("c:/TMP/error.txt"));
		var serializer = processor.newSerializer(tmp);

		transformer.transform(xmlSource, serializer);
	}

	protected void validate(File targetFile) throws InvalidCodaFileException, IOException {
		// TODO possible validations
		// - line length => done
		// - mandatory records are present
		// - open + sum of statement = close
		// - X statement => X full coda (records 0, 1, 2 for each Ntry, 8 & 9)
		// - ?
		var errors = new ArrayList<String>();
		var lines = Files.readAllLines(targetFile.toPath());
		int nb = 0;
		for (String line : lines) {
			nb++;
			if (line.length() != 128) {
				errors.add("line %s - Invalid line length".formatted(nb));
			}
		}
		if (errors.size() > 0) {
			throw new InvalidCodaFileException(targetFile.getAbsolutePath(), errors);
		}
	}

	public P getInitialParams() {
		return initialParams;
	}

}
