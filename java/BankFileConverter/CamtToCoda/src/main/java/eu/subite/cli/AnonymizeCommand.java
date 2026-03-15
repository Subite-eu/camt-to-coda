package eu.subite.cli;

import java.io.File;
import java.nio.file.Path;
import java.util.concurrent.Callable;

import eu.subite.anonymize.AnonymizeConfig;
import eu.subite.anonymize.CamtAnonymizer;
import picocli.CommandLine.Command;
import picocli.CommandLine.Option;

@Command(
	name = "anonymize",
	description = "Anonymize CAMT files by replacing sensitive data with fakes"
)
public class AnonymizeCommand implements Callable<Integer> {

	@Option(names = {"-i", "--input"}, required = true, description = "Input file or directory")
	private File input;

	@Option(names = {"-o", "--output"}, required = true, description = "Output directory")
	private File output;

	@Option(names = {"--config"}, description = "Anonymization config YAML file")
	private File configFile;

	@Option(names = {"--dry-run"}, description = "Preview what would change without writing files")
	private boolean dryRun;

	@Override
	public Integer call() {
		try {
			AnonymizeConfig config;
			if (configFile != null && configFile.exists()) {
				config = AnonymizeConfig.loadFromFile(configFile.toPath());
				System.out.println("Using config: " + configFile.getAbsolutePath());
			} else {
				config = AnonymizeConfig.defaultConfig();
				System.out.println("Using default anonymization config");
			}

			var anonymizer = new CamtAnonymizer(config);
			Path outputPath = output.toPath();

			if (dryRun) {
				System.out.println("[DRY-RUN] Would anonymize files from: " + input);
				System.out.println("[DRY-RUN] Output would go to: " + output);
				System.out.println("[DRY-RUN] IBAN country: " + config.getIbanCountry());
				System.out.println("[DRY-RUN] Seed: " + config.getSeed());
				return 0;
			}

			if (input.isDirectory()) {
				anonymizer.anonymizeDirectory(input.toPath(), outputPath);
			} else {
				anonymizer.anonymizeFile(input.toPath(), outputPath);
			}

			// Print mapping summary
			var ibanMap = anonymizer.getIbanMap();
			if (!ibanMap.isEmpty()) {
				System.out.println("\nIBAN mappings (" + ibanMap.size() + " unique):");
				ibanMap.forEach((orig, anon) -> System.out.println("  " + orig + " -> " + anon));
			}

			System.out.println("\nAnonymization complete.");
			return 0;
		} catch (Exception e) {
			System.err.println("Anonymization failed: " + e.getMessage());
			return 1;
		}
	}
}
