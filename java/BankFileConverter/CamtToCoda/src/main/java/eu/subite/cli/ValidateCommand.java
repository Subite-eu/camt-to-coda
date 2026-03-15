package eu.subite.cli;

import java.io.File;
import java.util.concurrent.Callable;

import eu.subite.validation.BusinessRuleValidator;
import eu.subite.validation.CamtSchemaValidator;
import eu.subite.validation.ValidationResult;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

@Command(
	name = "validate",
	description = "Validate a CAMT file without converting"
)
public class ValidateCommand implements Callable<Integer> {

	@Parameters(index = "0", description = "CAMT XML file to validate")
	private File inputFile;

	@Override
	public Integer call() {
		System.out.println("Validating: " + inputFile.getAbsolutePath());

		if (!inputFile.exists()) {
			System.err.println("File not found: " + inputFile);
			return 1;
		}

		var schemaValidator = new CamtSchemaValidator();
		var businessValidator = new BusinessRuleValidator();

		ValidationResult schemaResult = schemaValidator.validate(inputFile);
		ValidationResult businessResult = businessValidator.validate(inputFile);
		ValidationResult combined = schemaResult.merge(businessResult);

		if (!combined.warnings().isEmpty()) {
			System.out.println("Warnings:");
			combined.warnings().forEach(w -> System.out.println("  - " + w));
		}

		if (!combined.errors().isEmpty()) {
			System.out.println("Errors:");
			combined.errors().forEach(e -> System.out.println("  - " + e));
		}

		if (combined.valid()) {
			System.out.println("Validation passed.");
			return 0;
		} else {
			System.out.println("Validation failed.");
			return 1;
		}
	}
}
