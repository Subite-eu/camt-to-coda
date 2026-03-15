package eu.subite.validation;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public record ValidationResult(boolean valid, List<String> errors, List<String> warnings) {

	public static ValidationResult success() {
		return new ValidationResult(true, List.of(), List.of());
	}

	public static ValidationResult failure(List<String> errors) {
		return new ValidationResult(false, List.copyOf(errors), List.of());
	}

	public static ValidationResult of(List<String> errors, List<String> warnings) {
		return new ValidationResult(errors.isEmpty(), List.copyOf(errors), List.copyOf(warnings));
	}

	public ValidationResult merge(ValidationResult other) {
		var allErrors = new ArrayList<>(this.errors);
		allErrors.addAll(other.errors);
		var allWarnings = new ArrayList<>(this.warnings);
		allWarnings.addAll(other.warnings);
		return new ValidationResult(this.valid && other.valid, Collections.unmodifiableList(allErrors),
				Collections.unmodifiableList(allWarnings));
	}
}
