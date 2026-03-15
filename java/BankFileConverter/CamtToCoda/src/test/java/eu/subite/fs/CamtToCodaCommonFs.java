package eu.subite.fs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.assertj.core.api.Assertions.fail;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.regex.Pattern;

import org.apache.commons.cli.ParseException;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.junit.jupiter.api.Test;

import eu.subite.CamtToCodaCommon;
import eu.subite.CamtToCodaFs;
import eu.subite.params.FsParams;

abstract class CamtToCodaCommonFs extends CamtToCodaCommon<File, FsParams, CamtToCodaFs> {

	private static final Logger LOGGER = LogManager.getLogger();

	public static final String SEQ_GROUP = "sequence";
	public static final Pattern SEQ_PATTERN = Pattern.compile(
			"^13(?<%s>\\d{3}).*".formatted(SEQ_GROUP),
			Pattern.CASE_INSENSITIVE);

	private static final String PATH_IN = "../test_data/fs/in";
	private static final String PATH_OUT = "../test_data/fs/out";
	private static final String PATH_ARCHIVE = "../test_data/fs/archive";
	private static final String PATH_ERROR = "../test_data/fs/error";

	protected CamtToCodaFs buildConverter() throws ParseException {
		return new CamtToCodaFs(
				"--%s".formatted(CamtToCodaFs.OP_XSLT), getXslt(),
				"--%s".formatted(CamtToCodaFs.OP_VERSION), Integer.toString(getVersion()),
				"--%s".formatted(CamtToCodaFs.OP_IN), "%s/%s".formatted(getSource(), getOneFileName()),
				"--%s".formatted(CamtToCodaFs.OP_TMP), getTmp(),
				"--%s".formatted(CamtToCodaFs.OP_ARCHIVE), getArchivePath(),
				"--%s".formatted(CamtToCodaFs.OP_ERROR), getErrorPath(),
				"--%s".formatted(CamtToCodaFs.OP_OUT), getTarget());
	}

	@Override
	protected final String getSource() {
		return PATH_IN;
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
	protected final String getTarget() {
		return PATH_OUT;
	}

	@Override
	protected File toSource(String source) {
		return new File("%s/%s".formatted(getSource(), source));
	}

	@Test
	void initParams() throws Exception {
		copySampleToIn(new File("%s/%s".formatted(getSamplePath(), getOneFileName())));
		assertThatNoException()
				.isThrownBy(
						() -> CamtToCodaFs.main(
								"-x", getXslt(),
								"-v", Integer.toString(getVersion()),
								"-i", toSource(getOneFileName()).toString(),
								"-t", getTmp(),
								"-a", getArchivePath(),
								"-e", getErrorPath(),
								"-o", getTarget()));
		expectFileToBeArchived(getOneFileName());
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	void seqCheck() throws Exception {
		int current = 0;
		for (var file : new File(getSource()).listFiles()) {
			var c = buildConverter();
			var results = c.convertFile(file);
			for (String result : results) {
				var seq = getSeq(result);
				if (current == 0) {
					current = seq;
				}
				else {
					assertThat(seq)
							.as("Sequence is respected by file %s", result)
							.isEqualTo(current);
				}
			}
			current++;
		}
	}

	private Integer getSeq(String target) throws Exception {
		var lines = Files.readAllLines(Path.of(target));
		int seq = 0;
		for (String line : lines) {

			assertThat(line)
					.as(target)
					.hasSize(128);

			var m = SEQ_PATTERN.matcher(line);
			if (m.find()) {
				seq = Integer.parseInt(m.group(SEQ_GROUP));
			}
		}
		if (seq == 0) {
			fail("Seq not found in file %s!?", target);
		}
		return seq;
	}

	@Override
	protected void copySampleToIn(File... files) throws IOException {
		for (var file : files) {
			Files.copy(file.toPath(), Path.of(getSource(), file.getName()), StandardCopyOption.REPLACE_EXISTING);
		}
	}

	@Override
	protected void expectFileToBeArchived(String file) {
		assertThat(new File("%s/%s".formatted(getArchivePath(), file)))
				.as("CAMT are in '%s' folder", getArchivePath())
				.exists();
	}

	@Override
	protected void expectFileToBeInError(String file) {
		assertThat(new File("%s/%s".formatted(getErrorPath(), file)))
				.as("CAMT are in '%s' folder", getErrorPath())
				.exists();
	}

	@Override
	protected void isFolderEmpty(String folder, boolean empty) {
		if (empty) {
			assertThat(new File(folder))
					.as("'%s' should be empty ", folder)
					.isEmptyDirectory();
		}
		else {
			assertThat(new File(folder))
					.as("'%s' should NOT be empty ", folder)
					.isNotEmptyDirectory();
		}
	}

	@Override
	protected void deleteFiles(String path) throws IOException {
		Files.list(Path.of(path)).forEach(this::deleteQuietly);
	}

	private void deleteQuietly(Path p) {
		try {
			Files.deleteIfExists(p);
		}
		catch (IOException e) {
			LOGGER.warn(e);
		}
	}

}
