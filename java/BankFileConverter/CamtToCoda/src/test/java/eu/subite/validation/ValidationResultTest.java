package eu.subite.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class ValidationResultTest {

	@Test
	void successIsValid() {
		var result = ValidationResult.success();
		assertThat(result.valid()).isTrue();
		assertThat(result.errors()).isEmpty();
		assertThat(result.warnings()).isEmpty();
	}

	@Test
	void failureIsInvalid() {
		var result = ValidationResult.failure(List.of("error1", "error2"));
		assertThat(result.valid()).isFalse();
		assertThat(result.errors()).containsExactly("error1", "error2");
	}

	@Test
	void ofWithNoErrorsIsValid() {
		var result = ValidationResult.of(List.of(), List.of("warning1"));
		assertThat(result.valid()).isTrue();
		assertThat(result.warnings()).containsExactly("warning1");
	}

	@Test
	void mergesCombineErrorsAndWarnings() {
		var r1 = ValidationResult.of(List.of("err1"), List.of("warn1"));
		var r2 = ValidationResult.of(List.of("err2"), List.of("warn2"));
		var merged = r1.merge(r2);
		assertThat(merged.valid()).isFalse();
		assertThat(merged.errors()).containsExactly("err1", "err2");
		assertThat(merged.warnings()).containsExactly("warn1", "warn2");
	}

	@Test
	void mergeWithSuccessPreservesValidity() {
		var success = ValidationResult.success();
		var withWarning = ValidationResult.of(List.of(), List.of("warning"));
		var merged = success.merge(withWarning);
		assertThat(merged.valid()).isTrue();
		assertThat(merged.warnings()).containsExactly("warning");
	}

	@Test
	void mergeWithFailureIsInvalid() {
		var success = ValidationResult.success();
		var failure = ValidationResult.failure(List.of("error"));
		var merged = success.merge(failure);
		assertThat(merged.valid()).isFalse();
	}
}
