package eu.subite.xslt;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;

import javax.xml.transform.stream.StreamSource;

import eu.subite.tools.DateToSequenceHelper;
import eu.subite.tools.XsltErrorHelper;
import net.sf.saxon.s9api.Processor;
import net.sf.saxon.s9api.SaxonApiException;
import net.sf.saxon.s9api.Serializer;
import net.sf.saxon.s9api.XsltCompiler;

/**
 * Utility class for XSLT template tests.
 * Sets up Saxon processor with custom extension functions and transforms XML snippets.
 */
public class XsltTestHelper {

	private static final String XSLT_DIR = "src/main/resources/xslt";

	public static String transform(String camtXml, String xsltFileName) throws SaxonApiException {
		File xsltFile = Path.of(XSLT_DIR, xsltFileName).toFile();
		if (!xsltFile.exists()) {
			throw new IllegalArgumentException("XSLT file not found: " + xsltFile.getAbsolutePath());
		}

		Processor processor = new Processor();
		processor.getUnderlyingConfiguration().setProcessor(processor);
		processor.registerExtensionFunction(new DateToSequenceHelper());
		processor.registerExtensionFunction(new XsltErrorHelper());
		XsltCompiler compiler = processor.newXsltCompiler();

		var xsltExecutable = compiler.compile(new StreamSource(xsltFile));
		var transformer = xsltExecutable.load30();

		StringWriter writer = new StringWriter();
		Serializer serializer = processor.newSerializer(writer);

		var xmlSource = new StreamSource(
				new ByteArrayInputStream(camtXml.getBytes(StandardCharsets.UTF_8)));

		transformer.transform(xmlSource, serializer);

		return writer.toString();
	}

	/**
	 * Validates that every line in the output is exactly 128 characters.
	 */
	public static void assertAllLinesAre128Chars(String output) {
		String[] lines = output.split("\n");
		for (int i = 0; i < lines.length; i++) {
			String line = lines[i];
			if (line.length() != 128) {
				throw new AssertionError(
						"Line %d has %d chars (expected 128): '%s'".formatted(i + 1, line.length(), line));
			}
		}
	}

	/**
	 * Extracts a specific record type from CODA output.
	 */
	public static String getRecord(String output, String recordId) {
		for (String line : output.split("\n")) {
			if (line.startsWith(recordId)) {
				return line;
			}
		}
		return null;
	}
}
