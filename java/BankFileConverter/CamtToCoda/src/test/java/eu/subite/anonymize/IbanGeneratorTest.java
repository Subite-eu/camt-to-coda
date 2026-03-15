package eu.subite.anonymize;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Random;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class IbanGeneratorTest {

	@ParameterizedTest
	@ValueSource(strings = {"BE", "LT", "NL", "DE", "FR"})
	void generatedIbansHaveValidCheckDigits(String country) {
		var gen = new IbanGenerator(new Random(42), country);
		for (int i = 0; i < 100; i++) {
			String iban = gen.generate(country);
			assertThat(IbanGenerator.isValidCheckDigit(iban))
					.as("IBAN should have valid check digits: %s", iban)
					.isTrue();
		}
	}

	@Test
	void generatedIbansStartWithCorrectCountryCode() {
		var gen = new IbanGenerator(new Random(42), "BE");
		assertThat(gen.generate("BE")).startsWith("BE");
		assertThat(gen.generate("LT")).startsWith("LT");
		assertThat(gen.generate("NL")).startsWith("NL");
	}

	@Test
	void sameSeedProducesSameOutput() {
		var gen1 = new IbanGenerator(new Random(42), "BE");
		var gen2 = new IbanGenerator(new Random(42), "BE");
		for (int i = 0; i < 10; i++) {
			assertThat(gen1.generate()).isEqualTo(gen2.generate());
		}
	}

	@Test
	void differentSeedsProduceDifferentOutput() {
		var gen1 = new IbanGenerator(new Random(42), "BE");
		var gen2 = new IbanGenerator(new Random(99), "BE");
		assertThat(gen1.generate()).isNotEqualTo(gen2.generate());
	}

	@Test
	void beIbanHasCorrectLength() {
		var gen = new IbanGenerator(new Random(42), "BE");
		String iban = gen.generate("BE");
		assertThat(iban).hasSize(16); // BE + 2 check + 12 digits
	}

	@Test
	void ltIbanHasCorrectLength() {
		var gen = new IbanGenerator(new Random(42), "LT");
		String iban = gen.generate("LT");
		assertThat(iban).hasSize(20); // LT + 2 check + 16 digits
	}

	@Test
	void isValidCheckDigitReturnsFalseForInvalid() {
		assertThat(IbanGenerator.isValidCheckDigit("BE00000000000000")).isFalse();
		assertThat(IbanGenerator.isValidCheckDigit(null)).isFalse();
		assertThat(IbanGenerator.isValidCheckDigit("ABC")).isFalse();
	}

	@Test
	void knownBelgianIbanValidates() {
		// Known valid Belgian IBAN (synthetic test data)
		assertThat(IbanGenerator.isValidCheckDigit("BE68793230773034")).isTrue();
	}
}
