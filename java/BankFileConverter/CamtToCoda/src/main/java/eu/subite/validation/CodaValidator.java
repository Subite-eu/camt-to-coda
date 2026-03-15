package eu.subite.validation;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/**
 * Validates CODA 2.6 files (Febelfin standard) for structural correctness,
 * field-level validity, and consistency between records.
 */
public class CodaValidator {

	private static final Logger LOGGER = LogManager.getLogger();
	private static final int LINE_LENGTH = 128;

	public ValidationResult validate(File codaFile) throws IOException {
		var lines = Files.readAllLines(codaFile.toPath());
		return validate(lines);
	}

	public ValidationResult validate(List<String> lines) {
		var errors = new ArrayList<String>();
		var warnings = new ArrayList<String>();

		if (lines.isEmpty()) {
			errors.add("CODA file is empty");
			return ValidationResult.of(errors, warnings);
		}

		// Line length check
		for (int i = 0; i < lines.size(); i++) {
			if (lines.get(i).length() != LINE_LENGTH) {
				errors.add("Line %d: invalid length %d (expected %d)".formatted(i + 1, lines.get(i).length(), LINE_LENGTH));
			}
		}

		if (!errors.isEmpty()) {
			return ValidationResult.of(errors, warnings);
		}

		validateStructure(lines, errors);
		validateFields(lines, errors, warnings);
		validateConsistency(lines, errors, warnings);

		LOGGER.info("CODA validation: {} errors, {} warnings", errors.size(), warnings.size());
		return ValidationResult.of(errors, warnings);
	}

	/**
	 * Validates record sequence follows the CODA state machine:
	 * 0 → 1 → [2.x, 3.x]* → 8 → [4]* → 9
	 */
	private void validateStructure(List<String> lines, List<String> errors) {
		boolean hasRecord0 = false;
		boolean hasRecord9 = false;
		// Track state per statement: after record 1, expect movements/info, then record 8
		String previousRecordType = null;
		boolean inStatement = false;

		for (int i = 0; i < lines.size(); i++) {
			String line = lines.get(i);
			int lineNum = i + 1;
			char recordId = line.charAt(0);
			String recordType = getRecordType(line);

			switch (recordId) {
				case '0' -> {
					if (i != 0) errors.add("Line %d: Record 0 (header) must be the first record".formatted(lineNum));
					hasRecord0 = true;
				}
				case '1' -> {
					inStatement = true;
				}
				case '2' -> {
					if (!inStatement) errors.add("Line %d: Record %s outside of statement (no Record 1)".formatted(lineNum, recordType));
					validateRecordSequence(recordType, previousRecordType, lineNum, errors);
				}
				case '3' -> {
					if (!inStatement) errors.add("Line %d: Record %s outside of statement (no Record 1)".formatted(lineNum, recordType));
					validateRecordSequence(recordType, previousRecordType, lineNum, errors);
				}
				case '4' -> {
					// Free communication - allowed after record 8
				}
				case '8' -> {
					if (!inStatement) errors.add("Line %d: Record 8 without preceding Record 1".formatted(lineNum));
					inStatement = false;
				}
				case '9' -> {
					if (i != lines.size() - 1) errors.add("Line %d: Record 9 (trailer) must be the last record".formatted(lineNum));
					hasRecord9 = true;
				}
				default -> errors.add("Line %d: unknown record identification '%c'".formatted(lineNum, recordId));
			}

			previousRecordType = recordType;
		}

		if (!hasRecord0) errors.add("Missing Record 0 (header)");
		if (!hasRecord9) errors.add("Missing Record 9 (trailer)");
	}

	private void validateRecordSequence(String current, String previous, int lineNum, List<String> errors) {
		if (previous == null) return;

		switch (current) {
			case "2.1" -> {
				// 2.1 can follow 1, 2.3, 3.x, or another completed movement chain
			}
			case "2.2" -> {
				if (!previous.equals("2.1"))
					errors.add("Line %d: Record 2.2 must follow Record 2.1, found after %s".formatted(lineNum, previous));
			}
			case "2.3" -> {
				if (!previous.equals("2.2"))
					errors.add("Line %d: Record 2.3 must follow Record 2.2, found after %s".formatted(lineNum, previous));
			}
			case "3.1" -> {
				if (!previous.equals("2.3") && !previous.equals("2.2") && !previous.equals("2.1") && !previous.startsWith("3."))
					errors.add("Line %d: Record 3.1 must follow a Record 2.x or 3.x chain, found after %s".formatted(lineNum, previous));
			}
			case "3.2" -> {
				if (!previous.equals("3.1"))
					errors.add("Line %d: Record 3.2 must follow Record 3.1, found after %s".formatted(lineNum, previous));
			}
			case "3.3" -> {
				if (!previous.equals("3.2"))
					errors.add("Line %d: Record 3.3 must follow Record 3.2, found after %s".formatted(lineNum, previous));
			}
		}
	}

	/**
	 * Validates field-level constraints: numeric fields, date fields, sign codes.
	 */
	private void validateFields(List<String> lines, List<String> errors, List<String> warnings) {
		for (int i = 0; i < lines.size(); i++) {
			String line = lines.get(i);
			int lineNum = i + 1;
			char recordId = line.charAt(0);

			switch (recordId) {
				case '1' -> validateRecord1Fields(line, lineNum, errors);
				case '2' -> {
					char articleCode = line.charAt(1);
					if (articleCode == '1') validateRecord21Fields(line, lineNum, errors);
				}
				case '8' -> validateRecord8Fields(line, lineNum, errors);
				case '9' -> validateRecord9Fields(line, lineNum, errors);
			}
		}
	}

	private void validateRecord1Fields(String line, int lineNum, List<String> errors) {
		// Pos 2: Account structure (0-3)
		char acctStructure = line.charAt(1);
		if (acctStructure < '0' || acctStructure > '3')
			errors.add("Line %d (Record 1): invalid account structure '%c' (must be 0-3)".formatted(lineNum, acctStructure));

		// Pos 43: Old balance sign (0=credit, 1=debit)
		char balSign = line.charAt(42);
		if (balSign != '0' && balSign != '1')
			errors.add("Line %d (Record 1): invalid balance sign '%c' (must be 0 or 1)".formatted(lineNum, balSign));

		// Pos 44-58: Old balance (15 digits)
		validateNumericField(line, 43, 58, "old balance", lineNum, errors);

		// Pos 59-64: Old balance date (DDMMYY)
		validateDateField(line, 58, 64, "old balance date", lineNum, errors);
	}

	private void validateRecord21Fields(String line, int lineNum, List<String> errors) {
		// Pos 3-6: Continuous sequence number (4 digits)
		validateNumericField(line, 2, 6, "sequence number", lineNum, errors);

		// Pos 32: Movement sign (0=credit, 1=debit)
		char mvtSign = line.charAt(31);
		if (mvtSign != '0' && mvtSign != '1')
			errors.add("Line %d (Record 2.1): invalid movement sign '%c' (must be 0 or 1)".formatted(lineNum, mvtSign));

		// Pos 33-47: Amount (15 digits)
		validateNumericField(line, 32, 47, "amount", lineNum, errors);

		// Pos 48-53: Value date (DDMMYY or 000000)
		String valueDate = line.substring(47, 53);
		if (!valueDate.equals("000000")) {
			validateDateField(line, 47, 53, "value date", lineNum, errors);
		}

		// Pos 126: Next code (0 or 1)
		char nextCode = line.charAt(125);
		if (nextCode != '0' && nextCode != '1')
			errors.add("Line %d (Record 2.1): invalid next code '%c' (must be 0 or 1)".formatted(lineNum, nextCode));

		// Pos 128: Link code (0 or 1)
		char linkCode = line.charAt(127);
		if (linkCode != '0' && linkCode != '1')
			errors.add("Line %d (Record 2.1): invalid link code '%c' (must be 0 or 1)".formatted(lineNum, linkCode));
	}

	private void validateRecord8Fields(String line, int lineNum, List<String> errors) {
		// Pos 42: New balance sign (0=credit, 1=debit)
		char balSign = line.charAt(41);
		if (balSign != '0' && balSign != '1')
			errors.add("Line %d (Record 8): invalid balance sign '%c' (must be 0 or 1)".formatted(lineNum, balSign));

		// Pos 43-57: New balance (15 digits)
		validateNumericField(line, 42, 57, "new balance", lineNum, errors);

		// Pos 58-63: New balance date (DDMMYY)
		validateDateField(line, 57, 63, "new balance date", lineNum, errors);
	}

	private void validateRecord9Fields(String line, int lineNum, List<String> errors) {
		// Pos 17-22: Number of records (6 digits)
		validateNumericField(line, 16, 22, "record count", lineNum, errors);

		// Pos 23-37: Debit sum (15 digits)
		validateNumericField(line, 22, 37, "debit sum", lineNum, errors);

		// Pos 38-52: Credit sum (15 digits)
		validateNumericField(line, 37, 52, "credit sum", lineNum, errors);
	}

	/**
	 * Cross-record consistency: balance check, record counts, debit/credit sums.
	 */
	private void validateConsistency(List<String> lines, List<String> errors, List<String> warnings) {
		long totalDebit = 0;
		long totalCredit = 0;
		int movementRecordCount = 0;

		for (int i = 0; i < lines.size(); i++) {
			String line = lines.get(i);
			char recordId = line.charAt(0);

			if (recordId == '1' || recordId == '2' || recordId == '3' || recordId == '8') {
				movementRecordCount++;
			}

			// Sum movements from Record 2.1
			if (recordId == '2' && line.charAt(1) == '1') {
				char mvtSign = line.charAt(31);
				long amount = parseAmount(line, 32, 47);
				if (mvtSign == '1') { // debit
					totalDebit += amount;
				} else { // credit
					totalCredit += amount;
				}
			}

			// Balance consistency per statement: opening + movements = closing
			if (recordId == '8') {
				validateBalanceConsistency(lines, i, errors, warnings);
			}

			// Record 9 count and sum checks
			if (recordId == '9') {
				long expectedDebit = parseAmount(line, 22, 37);
				long expectedCredit = parseAmount(line, 37, 52);
				int expectedCount = Integer.parseInt(line.substring(16, 22).trim());

				if (expectedCount != 0 && expectedCount != movementRecordCount) {
					errors.add("Record 9: record count %d does not match actual count %d".formatted(expectedCount, movementRecordCount));
				}

				if (expectedDebit != 0 && expectedDebit != totalDebit) {
					warnings.add("Record 9: debit sum %d does not match computed sum %d".formatted(expectedDebit, totalDebit));
				}
				if (expectedCredit != 0 && expectedCredit != totalCredit) {
					warnings.add("Record 9: credit sum %d does not match computed sum %d".formatted(expectedCredit, totalCredit));
				}
			}
		}

		validateNextAndLinkCodes(lines, errors);
	}

	private void validateBalanceConsistency(List<String> lines, int record8Index, List<String> errors, List<String> warnings) {
		// Find the matching Record 1 (scan backwards)
		String record8Line = lines.get(record8Index);
		long closingBalance = parseSignedBalance(record8Line, 41, 42, 57);

		for (int i = record8Index - 1; i >= 0; i--) {
			String line = lines.get(i);
			if (line.charAt(0) == '1') {
				long openingBalance = parseSignedBalance(line, 42, 43, 58);

				// Sum all movements between Record 1 and Record 8
				long movementSum = 0;
				for (int j = i + 1; j < record8Index; j++) {
					String mvtLine = lines.get(j);
					if (mvtLine.charAt(0) == '2' && mvtLine.charAt(1) == '1') {
						char mvtSign = mvtLine.charAt(31);
						long amount = parseAmount(mvtLine, 32, 47);
						movementSum += (mvtSign == '0') ? amount : -amount; // 0=credit(+), 1=debit(-)
					}
				}

				long computed = openingBalance + movementSum;
				if (computed != closingBalance) {
					errors.add("Balance inconsistency: opening(%d) + movements(%d) = %d, but closing = %d (diff=%d)"
							.formatted(openingBalance, movementSum, computed, closingBalance, computed - closingBalance));
				}
				break;
			}
		}
	}

	private void validateNextAndLinkCodes(List<String> lines, List<String> errors) {
		for (int i = 0; i < lines.size() - 1; i++) {
			String line = lines.get(i);
			String recordType = getRecordType(line);
			if (recordType == null) continue;

			// Check next code (pos 126) for records that have it
			if (recordType.equals("2.1") || recordType.equals("2.2") || recordType.equals("3.1") || recordType.equals("3.2")) {
				char nextCode = line.charAt(125);
				if (nextCode == '1') {
					// Verify a continuation record follows
					if (i + 1 < lines.size()) {
						String nextRecordType = getRecordType(lines.get(i + 1));
						boolean validNext = switch (recordType) {
							case "2.1" -> "2.2".equals(nextRecordType) || "2.3".equals(nextRecordType);
							case "2.2" -> "2.3".equals(nextRecordType);
							case "3.1" -> "3.2".equals(nextRecordType);
							case "3.2" -> "3.3".equals(nextRecordType);
							default -> true;
						};
						if (!validNext) {
							errors.add("Line %d: next code is 1 but next record is %s (expected continuation of %s)"
									.formatted(i + 1, nextRecordType, recordType));
						}
					}
				}
			}

			// Check link code (pos 128) for records 2.x
			if (recordType.startsWith("2.") || recordType.startsWith("3.")) {
				char linkCode = line.charAt(127);
				if (linkCode == '1') {
					// Verify a Record 3.1 follows (possibly after remaining 2.x records)
					boolean found3 = false;
					for (int j = i + 1; j < lines.size(); j++) {
						String futureType = getRecordType(lines.get(j));
						if (futureType != null && futureType.equals("3.1")) {
							found3 = true;
							break;
						}
						// Stop searching if we hit a new movement, record 8, or record 9
						if (futureType != null && (futureType.equals("2.1") || lines.get(j).charAt(0) == '8' || lines.get(j).charAt(0) == '9')) {
							break;
						}
					}
					if (!found3 && recordType.startsWith("2.")) {
						errors.add("Line %d: link code is 1 but no Record 3.1 follows for this movement".formatted(i + 1));
					}
				}
			}
		}
	}

	// --- Utility methods ---

	private String getRecordType(String line) {
		if (line.length() < 2) return null;
		char recordId = line.charAt(0);
		char articleCode = line.charAt(1);
		return switch (recordId) {
			case '0' -> "0";
			case '1' -> "1";
			case '2' -> "2." + articleCode;
			case '3' -> "3." + articleCode;
			case '4' -> "4";
			case '8' -> "8";
			case '9' -> "9";
			default -> null;
		};
	}

	private void validateNumericField(String line, int start, int end, String fieldName, int lineNum, List<String> errors) {
		String value = line.substring(start, end);
		for (int i = 0; i < value.length(); i++) {
			if (!Character.isDigit(value.charAt(i))) {
				errors.add("Line %d: %s field (pos %d-%d) contains non-numeric character '%c'"
						.formatted(lineNum, fieldName, start + 1, end, value.charAt(i)));
				return;
			}
		}
	}

	private void validateDateField(String line, int start, int end, String fieldName, int lineNum, List<String> errors) {
		String value = line.substring(start, end);
		if (value.equals("000000")) return; // 000000 = not known

		for (int i = 0; i < value.length(); i++) {
			if (!Character.isDigit(value.charAt(i))) {
				errors.add("Line %d: %s (pos %d-%d) is not a valid date: '%s'".formatted(lineNum, fieldName, start + 1, end, value));
				return;
			}
		}

		int day = Integer.parseInt(value.substring(0, 2));
		int month = Integer.parseInt(value.substring(2, 4));
		if (day < 1 || day > 31 || month < 1 || month > 12) {
			errors.add("Line %d: %s '%s' is not a valid DDMMYY date".formatted(lineNum, fieldName, value));
		}
	}

	private long parseAmount(String line, int start, int end) {
		try {
			return Long.parseLong(line.substring(start, end));
		} catch (NumberFormatException e) {
			return 0;
		}
	}

	private long parseSignedBalance(String line, int signPos, int amountStart, int amountEnd) {
		char sign = line.charAt(signPos);
		long amount = parseAmount(line, amountStart, amountEnd);
		return (sign == '1') ? -amount : amount; // 0=credit(+), 1=debit(-)
	}
}
