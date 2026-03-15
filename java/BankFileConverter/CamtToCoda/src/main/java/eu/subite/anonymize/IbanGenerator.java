package eu.subite.anonymize;

import java.math.BigInteger;
import java.util.Random;

/**
 * Generates valid-format fake IBANs with correct check digits per ISO 13616.
 * Uses deterministic random for reproducible output.
 */
public class IbanGenerator {

	private static final BigInteger NINETY_SEVEN = BigInteger.valueOf(97);
	private static final BigInteger NINETY_EIGHT = BigInteger.valueOf(98);

	private final Random random;
	private final String defaultCountry;

	public IbanGenerator(Random random, String defaultCountry) {
		this.random = random;
		this.defaultCountry = defaultCountry;
	}

	public String generate() {
		return generate(defaultCountry);
	}

	public String generate(String countryCode) {
		return switch (countryCode) {
			case "BE" -> generateBE();
			case "LT" -> generateLT();
			case "NL" -> generateNL();
			case "DE" -> generateDE();
			case "FR" -> generateFR();
			default -> generateBE();
		};
	}

	private String generateBE() {
		// BE: 2 check digits + 12 digits (3 bank + 7 account + 2 national check)
		String bankCode = String.format("%03d", random.nextInt(1000));
		String account = String.format("%07d", random.nextInt(10000000));
		String nationalCheck = String.format("%02d", Integer.parseInt(bankCode + account) % 97);
		if (nationalCheck.equals("00")) nationalCheck = "97";
		String bban = bankCode + account + nationalCheck;
		return "BE" + computeCheckDigits("BE", bban) + bban;
	}

	private String generateLT() {
		// LT: 2 check digits + 16 digits (5 bank + 11 account)
		String bankCode = String.format("%05d", random.nextInt(100000));
		String account = String.format("%011d", Math.abs(random.nextLong()) % 100000000000L);
		String bban = bankCode + account;
		return "LT" + computeCheckDigits("LT", bban) + bban;
	}

	private String generateNL() {
		// NL: 2 check digits + 4 alpha bank code + 10 digit account
		String[] bankCodes = {"ABNA", "INGB", "RABO", "KNAB", "TRIO"};
		String bankCode = bankCodes[random.nextInt(bankCodes.length)];
		String account = String.format("%010d", Math.abs(random.nextLong()) % 10000000000L);
		String bban = bankCode + account;
		return "NL" + computeCheckDigits("NL", bban) + bban;
	}

	private String generateDE() {
		// DE: 2 check digits + 18 digits (8 bank + 10 account)
		String bankCode = String.format("%08d", random.nextInt(100000000));
		String account = String.format("%010d", Math.abs(random.nextLong()) % 10000000000L);
		String bban = bankCode + account;
		return "DE" + computeCheckDigits("DE", bban) + bban;
	}

	private String generateFR() {
		// FR: 2 check digits + 23 chars (5 bank + 5 branch + 11 account + 2 check)
		String bankCode = String.format("%05d", random.nextInt(100000));
		String branch = String.format("%05d", random.nextInt(100000));
		String account = String.format("%011d", Math.abs(random.nextLong()) % 100000000000L);
		String nationalCheck = String.format("%02d", random.nextInt(100));
		String bban = bankCode + branch + account + nationalCheck;
		return "FR" + computeCheckDigits("FR", bban) + bban;
	}

	/**
	 * Computes IBAN check digits using the ISO 13616 mod-97 algorithm.
	 */
	static String computeCheckDigits(String countryCode, String bban) {
		// Move country code + "00" to end, convert letters to numbers (A=10, B=11, ...)
		String rearranged = bban + countryLettersToDigits(countryCode) + "00";
		BigInteger numeric = new BigInteger(rearranged);
		BigInteger remainder = numeric.mod(NINETY_SEVEN);
		BigInteger checkDigits = NINETY_EIGHT.subtract(remainder);
		return String.format("%02d", checkDigits.intValue());
	}

	/**
	 * Validates an IBAN's check digits.
	 */
	public static boolean isValidCheckDigit(String iban) {
		if (iban == null || iban.length() < 5) return false;
		// Move first 4 chars to end, convert to digits
		String rearranged = iban.substring(4) + iban.substring(0, 4);
		String numeric = countryLettersToDigits(rearranged);
		BigInteger number = new BigInteger(numeric);
		return number.mod(NINETY_SEVEN).intValue() == 1;
	}

	private static String countryLettersToDigits(String s) {
		StringBuilder sb = new StringBuilder();
		for (char c : s.toCharArray()) {
			if (Character.isLetter(c)) {
				sb.append(Character.toUpperCase(c) - 'A' + 10);
			} else {
				sb.append(c);
			}
		}
		return sb.toString();
	}
}
