package eu.subite.fs;

import static org.assertj.core.api.Assertions.assertThatNoException;

import java.io.File;
import java.nio.file.Path;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import eu.subite.CamtToCodaCommon;
import eu.subite.CamtToCodaCommon.XsltErrors;

class FsCamt53ToCodaTest extends CamtToCodaCommonFs {

	private static final String PATH_IN_SAMPLES = "../../../example-files/CAMT/LT625883379695428516/CAMT_053";

	@Override
	protected int getVersion() {
		return 53;
	}

	@Override
	protected String getSamplePath() {
		return PATH_IN_SAMPLES;
	}

	@Override
	protected String getOneFileName() {
		return "2024-03-07.xml";
	}

	@Test
	void oneFile_053_001_02_file_1() throws Exception {
		var file = new File("%s/../../Other/account_statement.xml".formatted(getSamplePath()));
		copySampleToIn(file);
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(Path.of(getSource(), file.getName()).toFile()));
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);

		// TODO add deep check on file content
	}

	@Test
	void oneFile_053_001_02_file_2() throws Exception {
		var file = new File("%s/../../Other/account_statement-2.xml".formatted(getSamplePath()));
		copySampleToIn(file);
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(Path.of(getSource(), file.getName()).toFile()));
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	void oneFile_053_001_02_file_3() throws Exception {
		var file = new File("%s/../../Other/account_statement-3.xml".formatted(getSamplePath()));
		copySampleToIn(file);
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(Path.of(getSource(), file.getName()).toFile()));
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	void oneFile_053_001_02_file_4() throws Exception {
		var file = new File("%s/../../Other/BE68793230773034-202411.xml".formatted(getSamplePath()));
		copySampleToIn(file);
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(Path.of(getSource(), file.getName()).toFile()));
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	void oneFile_053_001_02_file_5() throws Exception {
		var file = new File("%s/../../Other/BE68793230773034-202412.xml".formatted(getSamplePath()));
		copySampleToIn(file);
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(Path.of(getSource(), file.getName()).toFile()));
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	protected void oneFile() throws Exception {
		super.oneFile();
	}

	@Test
	protected void folder() throws Exception {
		super.folder();
	}

	@Test
	@Disabled
	void seqCheck() throws Exception {
		copySampleToIn(new File(getSamplePath()).listFiles());
		super.seqCheck();
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Nested
	class XsltErrors53 extends XsltErrors {
	}
}
