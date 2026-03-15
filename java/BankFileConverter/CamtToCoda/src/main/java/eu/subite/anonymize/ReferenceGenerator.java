package eu.subite.anonymize;

import java.util.Random;

/**
 * Generates fake message IDs, statement references, and transaction IDs.
 */
public class ReferenceGenerator {

	private static final String ALPHANUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

	private final Random random;
	private int counter = 0;

	public ReferenceGenerator(Random random) {
		this.random = random;
	}

	public String generateMessageId() {
		return "MSG" + String.format("%08d", ++counter) + "-" + randomAlphaNum(8);
	}

	public String generateStatementId() {
		return "STMT" + String.format("%010d", ++counter);
	}

	public String generateEntryRef() {
		return "REF" + String.format("%012d", Math.abs(random.nextLong()) % 1000000000000L);
	}

	public String generateEndToEndId() {
		return "E2E" + randomAlphaNum(16);
	}

	public String generateTxId() {
		return String.valueOf(100000 + random.nextInt(900000));
	}

	public String generateRemittanceText() {
		String[] templates = {
			"Payment for invoice %s",
			"Transfer ref %s",
			"Settlement %s",
			"Order %s payment",
			"Service fee %s"
		};
		String template = templates[random.nextInt(templates.length)];
		return String.format(template, randomAlphaNum(8));
	}

	public String generateStructuredComm() {
		// Belgian structured communication: +++NNN/NNNN/NNNNN+++
		long num = Math.abs(random.nextLong()) % 1000000000000L;
		long check = num % 97;
		if (check == 0) check = 97;
		return String.format("%010d%02d", num, check);
	}

	private String randomAlphaNum(int length) {
		StringBuilder sb = new StringBuilder(length);
		for (int i = 0; i < length; i++) {
			sb.append(ALPHANUM.charAt(random.nextInt(ALPHANUM.length())));
		}
		return sb.toString();
	}
}
