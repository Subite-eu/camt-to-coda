package eu.subite.fs;

import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class FsCamt52ToCodaTest extends CamtToCodaCommonFs {

	private static final String PATH_IN_SAMPLES = "../../../example-files/CAMT/LT809872649478701594/CAMT_052";

	@Override
	protected int getVersion() {
		return 52;
	}

	@Override
	protected String getSamplePath() {
		return PATH_IN_SAMPLES;
	}

	@Override
	protected String getOneFileName() {
		return "2024-10-13.xml";
	}

	@Test
	void initParams() throws Exception {
		super.initParams();
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
		super.seqCheck();
	}

	@Nested
	class XsltErrors52 extends XsltErrors {
		@Test
		@Disabled
		protected void bicNotFound() {
			// not mandatory in this format
		}
	}

}
