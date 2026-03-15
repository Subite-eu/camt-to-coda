package eu.subite.validation;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;

import javax.xml.XMLConstants;
import javax.xml.transform.stream.StreamSource;
import javax.xml.validation.SchemaFactory;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.xml.sax.SAXException;

/**
 * Validates CAMT XML files against their XSD schemas.
 * Detects CAMT version from the XML namespace and selects the matching XSD.
 */
public class CamtSchemaValidator {

	private static final Logger LOGGER = LogManager.getLogger();
	private static final Pattern VERSION_PATTERN =
			Pattern.compile("xmlns=\"urn:iso:std:iso:20022:tech:xsd:(camt\\.0\\d+\\.\\d+\\.\\d+)\"");

	public ValidationResult validate(File xmlFile) {
		List<String> errors = new ArrayList<>();
		List<String> warnings = new ArrayList<>();

		try {
			String version = detectVersion(xmlFile);
			if (version == null) {
				errors.add("Could not detect CAMT version from XML namespace");
				return ValidationResult.of(errors, warnings);
			}

			LOGGER.info("Detected CAMT version: {}", version);

			String xsdResource = "/xsd/" + version + ".xsd";
			InputStream xsdStream = getClass().getResourceAsStream(xsdResource);
			if (xsdStream == null) {
				warnings.add("No XSD schema found for version " + version + " - skipping schema validation");
				return ValidationResult.of(errors, warnings);
			}

			var schemaFactory = SchemaFactory.newInstance(XMLConstants.W3C_XML_SCHEMA_NS_URI);
			var schema = schemaFactory.newSchema(new StreamSource(xsdStream));
			var validator = schema.newValidator();

			validator.validate(new StreamSource(xmlFile));
			LOGGER.info("XSD validation passed for {}", xmlFile.getName());

		} catch (SAXException e) {
			errors.add("XSD validation error: " + e.getMessage());
		} catch (IOException e) {
			errors.add("IO error during validation: " + e.getMessage());
		}

		return ValidationResult.of(errors, warnings);
	}

	String detectVersion(File xmlFile) throws IOException {
		var lines = java.nio.file.Files.readAllLines(xmlFile.toPath());
		for (String line : lines) {
			var matcher = VERSION_PATTERN.matcher(line);
			if (matcher.find()) {
				return matcher.group(1);
			}
		}
		return null;
	}
}
