package eu.subite.anonymize;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import org.yaml.snakeyaml.Yaml;

public class AnonymizeConfig {

	private boolean iban = true;
	private boolean bic = true;
	private boolean accountName = true;
	private boolean counterpartyIban = true;
	private boolean counterpartyBic = true;
	private boolean counterpartyName = true;
	private boolean counterpartyAddress = true;
	private boolean amounts = false;
	private boolean currency = false;
	private boolean dates = false;
	private boolean references = true;
	private boolean remittanceInfo = true;
	private boolean structuredComm = true;
	private String ibanCountry = "BE";
	private String nameStyle = "company";
	private long seed = 42;

	public static AnonymizeConfig loadFromFile(Path configPath) throws IOException {
		try (InputStream is = Files.newInputStream(configPath)) {
			return loadFromStream(is);
		}
	}

	@SuppressWarnings("unchecked")
	public static AnonymizeConfig loadFromStream(InputStream is) {
		Yaml yaml = new Yaml();
		Map<String, Object> data = yaml.load(is);
		var config = new AnonymizeConfig();
		if (data == null) return config;

		if (data.containsKey("fields")) {
			Map<String, Object> fields = (Map<String, Object>) data.get("fields");
			if (fields != null) {
				config.iban = getBoolean(fields, "iban", true);
				config.bic = getBoolean(fields, "bic", true);
				config.accountName = getBoolean(fields, "account_name", true);
				config.counterpartyIban = getBoolean(fields, "counterparty_iban", true);
				config.counterpartyBic = getBoolean(fields, "counterparty_bic", true);
				config.counterpartyName = getBoolean(fields, "counterparty_name", true);
				config.counterpartyAddress = getBoolean(fields, "counterparty_address", true);
				config.amounts = getBoolean(fields, "amounts", false);
				config.currency = getBoolean(fields, "currency", false);
				config.dates = getBoolean(fields, "dates", false);
				config.references = getBoolean(fields, "references", true);
				config.remittanceInfo = getBoolean(fields, "remittance_info", true);
				config.structuredComm = getBoolean(fields, "structured_comm", true);
			}
		}

		if (data.containsKey("strategy")) {
			Map<String, Object> strategy = (Map<String, Object>) data.get("strategy");
			if (strategy != null) {
				config.ibanCountry = getString(strategy, "iban_country", "BE");
				config.nameStyle = getString(strategy, "name_style", "company");
				config.seed = getLong(strategy, "seed", 42);
			}
		}

		return config;
	}

	public static AnonymizeConfig defaultConfig() {
		return new AnonymizeConfig();
	}

	private static boolean getBoolean(Map<String, Object> map, String key, boolean defaultVal) {
		Object val = map.get(key);
		return val instanceof Boolean ? (Boolean) val : defaultVal;
	}

	private static String getString(Map<String, Object> map, String key, String defaultVal) {
		Object val = map.get(key);
		return val instanceof String ? (String) val : defaultVal;
	}

	private static long getLong(Map<String, Object> map, String key, long defaultVal) {
		Object val = map.get(key);
		if (val instanceof Number) return ((Number) val).longValue();
		return defaultVal;
	}

	public boolean isIban() { return iban; }
	public boolean isBic() { return bic; }
	public boolean isAccountName() { return accountName; }
	public boolean isCounterpartyIban() { return counterpartyIban; }
	public boolean isCounterpartyBic() { return counterpartyBic; }
	public boolean isCounterpartyName() { return counterpartyName; }
	public boolean isCounterpartyAddress() { return counterpartyAddress; }
	public boolean isAmounts() { return amounts; }
	public boolean isCurrency() { return currency; }
	public boolean isDates() { return dates; }
	public boolean isReferences() { return references; }
	public boolean isRemittanceInfo() { return remittanceInfo; }
	public boolean isStructuredComm() { return structuredComm; }
	public String getIbanCountry() { return ibanCountry; }
	public String getNameStyle() { return nameStyle; }
	public long getSeed() { return seed; }
}
