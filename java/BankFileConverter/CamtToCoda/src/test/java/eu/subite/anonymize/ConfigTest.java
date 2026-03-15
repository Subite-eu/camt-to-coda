package eu.subite.anonymize;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class ConfigTest {

	@Test
	void defaultConfigHasExpectedValues() {
		var config = AnonymizeConfig.defaultConfig();
		assertThat(config.isIban()).isTrue();
		assertThat(config.isBic()).isTrue();
		assertThat(config.isAmounts()).isFalse();
		assertThat(config.isDates()).isFalse();
		assertThat(config.getIbanCountry()).isEqualTo("BE");
		assertThat(config.getSeed()).isEqualTo(42);
	}

	@Test
	void loadFromStreamParsesYaml() {
		String yaml = """
				fields:
				  iban: false
				  amounts: true
				strategy:
				  iban_country: "NL"
				  seed: 99
				""";
		var config = AnonymizeConfig.loadFromStream(
				new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8)));

		assertThat(config.isIban()).isFalse();
		assertThat(config.isAmounts()).isTrue();
		assertThat(config.getIbanCountry()).isEqualTo("NL");
		assertThat(config.getSeed()).isEqualTo(99);
	}

	@Test
	void loadFromStreamWithEmptyYaml() {
		var config = AnonymizeConfig.loadFromStream(
				new ByteArrayInputStream("".getBytes(StandardCharsets.UTF_8)));
		// Should fall back to defaults
		assertThat(config.isIban()).isTrue();
		assertThat(config.getSeed()).isEqualTo(42);
	}

	@Test
	void loadFromStreamWithPartialFields() {
		String yaml = """
				fields:
				  iban: true
				""";
		var config = AnonymizeConfig.loadFromStream(
				new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8)));
		assertThat(config.isIban()).isTrue();
		assertThat(config.isBic()).isTrue(); // default
		assertThat(config.getIbanCountry()).isEqualTo("BE"); // default (no strategy section)
	}

	@Test
	void nameStyleConfig() {
		String yaml = """
				strategy:
				  name_style: "person"
				""";
		var config = AnonymizeConfig.loadFromStream(
				new ByteArrayInputStream(yaml.getBytes(StandardCharsets.UTF_8)));
		assertThat(config.getNameStyle()).isEqualTo("person");
	}
}
