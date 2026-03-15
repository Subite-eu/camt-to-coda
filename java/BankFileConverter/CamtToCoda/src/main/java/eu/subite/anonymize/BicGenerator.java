package eu.subite.anonymize;

import java.util.Random;

/**
 * Generates realistic fake BIC/SWIFT codes.
 * Format: 4 letters (bank) + 2 letters (country) + 2 alphanum (location) + optional 3 alphanum (branch).
 */
public class BicGenerator {

	private static final String[] BANK_PREFIXES = {
		"BNPA", "GEBA", "KRED", "ABNA", "INGB", "RABO", "DEUT", "CITI",
		"HBUK", "LOYD", "BKAU", "UNIB", "SWED", "NDEA", "DABA", "FINA"
	};

	private static final String ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
	private static final String ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	private final Random random;

	public BicGenerator(Random random) {
		this.random = random;
	}

	public String generate(String countryCode) {
		String bank = BANK_PREFIXES[random.nextInt(BANK_PREFIXES.length)];
		String country = countryCode.length() >= 2 ? countryCode.substring(0, 2) : "BE";
		String location = randomString(ALPHANUM, 2);
		return bank + country + location;
	}

	public String generate11(String countryCode) {
		return generate(countryCode) + randomString(ALPHANUM, 3);
	}

	private String randomString(String chars, int length) {
		StringBuilder sb = new StringBuilder(length);
		for (int i = 0; i < length; i++) {
			sb.append(chars.charAt(random.nextInt(chars.length())));
		}
		return sb.toString();
	}
}
