package eu.subite;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileReader;
import java.io.FilenameFilter;
import java.io.IOException;
import java.io.Reader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;

import javax.xml.transform.stream.StreamSource;

import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import eu.subite.params.FsParams;

public class CamtToCodaFs extends CamtToCoda<File, FsParams> {

	private static final Logger LOGGER = LogManager.getLogger();

	private static final FilenameFilter FILE_NAME_FILTER_CAMT = (dir, name) -> name.endsWith(".xml");

	public CamtToCodaFs(String... args) throws ParseException {
		super(args);
	}

	public static void main(String... args) throws Exception {
		new CamtToCodaFs(args).convert();
	}

	@Override
	protected void addCustomArgs(Options options, String[] args) {
	}

	@Override
	protected Class<File> getInputType() {
		return File.class;
	}

	@Override
	protected FsParams initParams(CommandLine cmd, String xslt, int version, File source, String tmpFolder,
			String archiveFolder, String errorFolder, String targetFolder) throws ParseException {
		boolean dryRun = cmd.hasOption(OP_DRY_RUN);
		LOGGER.info("CAMT version[{}] - source[{}] - target[{}] - archive[{}] - error[{}] - dryRun[{}]",
				version, source, targetFolder, archiveFolder, errorFolder, dryRun);
		return new FsParams(xslt, version, source, tmpFolder, archiveFolder, errorFolder, targetFolder, dryRun);
	}

	@Override
	protected boolean sourceExist(File source) {
		return source.exists();
	}

	@Override
	protected boolean isSourceDirectory(File source) {
		return source.isDirectory();
	}

	@Override
	protected List<File> listFiles(File folder) {
		LOGGER.info("Scanning folder '{}' for files to convert", folder);
		return List.of(folder.listFiles(FILE_NAME_FILTER_CAMT));
	}

	@Override
	protected StreamSource toStreamSource(File source) {
		return new StreamSource(source);
	}

	@Override
	protected Reader toReader(File source) throws FileNotFoundException {
		return new FileReader(source);
	}

	@Override
	protected String store(File file) throws IOException {
		return move(getInitialParams().getTarget(), file);
	}

	@Override
	protected void putFileInArchive(File file) throws IOException {
		move(getInitialParams().getArchiveFolder(), file);
	}

	@Override
	protected void putFileInError(File file) throws IOException {
		move(getInitialParams().getErrorFolder(), file);
	}

	protected String move(String targetFolder, File file) throws IOException {
		var targetFolderFile = new File(targetFolder);
		if (!targetFolderFile.exists()) {
			Files.createDirectory(targetFolderFile.toPath());
		}
		var target = Path.of(targetFolder, file.getName());
		Files.move(file.toPath(), target, StandardCopyOption.REPLACE_EXISTING);
		return target.toString();
	}

	@Override
	protected String getDefaultArchiveFolder() {
		return "/tmp";
	}

	@Override
	protected String getDefaultErrorFolder() {
		return "/tmp";
	}
}
