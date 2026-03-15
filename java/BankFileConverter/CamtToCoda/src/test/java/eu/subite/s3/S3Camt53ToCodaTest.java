package eu.subite.s3;

import org.junit.jupiter.api.Test;

class S3Camt53ToCodaTest extends CamtToCodaCommonS3 {

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

}
