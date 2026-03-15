package eu.subite.anonymize;

import java.util.Random;

/**
 * Generates fake company or person names for anonymization.
 */
public class NameGenerator {

	private static final String[] COMPANY_PREFIXES = {
		"Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Sigma",
		"Omega", "Nova", "Apex", "Vertex", "Quantum", "Stellar", "Pinnacle", "Nexus"
	};

	private static final String[] COMPANY_SUFFIXES = {
		"Corp", "SA", "NV", "BV", "GmbH", "Ltd", "SRL", "Inc",
		"Solutions", "Systems", "Holdings", "Group", "Partners", "Services"
	};

	private static final String[] FIRST_NAMES = {
		"Jean", "Marie", "Pierre", "Sophie", "Marc", "Anne", "Luc", "Claire",
		"Thomas", "Emma", "Nicolas", "Laura", "Philippe", "Julie", "Antoine", "Charlotte"
	};

	private static final String[] LAST_NAMES = {
		"Dupont", "Martin", "Janssen", "Peeters", "Claes", "Wouters", "Maes", "Lambert",
		"Willems", "Jacobs", "Mertens", "Dubois", "Hermans", "Simon", "Laurent", "Renard"
	};

	private final Random random;
	private final String style;

	public NameGenerator(Random random, String style) {
		this.random = random;
		this.style = style;
	}

	public String generate() {
		return switch (style) {
			case "person" -> generatePerson();
			default -> generateCompany();
		};
	}

	private String generateCompany() {
		return COMPANY_PREFIXES[random.nextInt(COMPANY_PREFIXES.length)] + " "
				+ COMPANY_SUFFIXES[random.nextInt(COMPANY_SUFFIXES.length)];
	}

	private String generatePerson() {
		return FIRST_NAMES[random.nextInt(FIRST_NAMES.length)] + " "
				+ LAST_NAMES[random.nextInt(LAST_NAMES.length)];
	}
}
