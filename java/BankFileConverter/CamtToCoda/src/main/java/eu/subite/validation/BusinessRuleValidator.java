package eu.subite.validation;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

/**
 * Validates CAMT business rules beyond XSD schema compliance.
 * Checks semantic correctness: required fields, balance consistency, etc.
 */
public class BusinessRuleValidator {

	private static final Logger LOGGER = LogManager.getLogger();

	public ValidationResult validate(File xmlFile) {
		List<String> errors = new ArrayList<>();
		List<String> warnings = new ArrayList<>();

		try {
			var dbFactory = DocumentBuilderFactory.newInstance();
			dbFactory.setNamespaceAware(true);
			Document doc = dbFactory.newDocumentBuilder().parse(xmlFile);
			doc.getDocumentElement().normalize();

			checkAccountIdentifier(doc, errors);
			checkCurrency(doc, errors, warnings);
			checkBalances(doc, errors, warnings);
			checkDates(doc, warnings);

		} catch (ParserConfigurationException | SAXException e) {
			errors.add("XML parsing error: " + e.getMessage());
		} catch (IOException e) {
			errors.add("IO error: " + e.getMessage());
		}

		return ValidationResult.of(errors, warnings);
	}

	private void checkAccountIdentifier(Document doc, List<String> errors) {
		NodeList ibans = doc.getElementsByTagNameNS("*", "IBAN");
		NodeList othrs = doc.getElementsByTagNameNS("*", "Othr");

		boolean hasIban = false;
		for (int i = 0; i < ibans.getLength(); i++) {
			if (isDescendantOf(ibans.item(i), "Acct")) {
				hasIban = true;
				break;
			}
		}

		boolean hasOthr = false;
		for (int i = 0; i < othrs.getLength(); i++) {
			if (isDescendantOf(othrs.item(i), "Acct")) {
				hasOthr = true;
				break;
			}
		}

		if (!hasIban && !hasOthr) {
			errors.add("No account identifier found (IBAN or Othr/Id required)");
		}
	}

	private void checkCurrency(Document doc, List<String> errors, List<String> warnings) {
		NodeList ccys = doc.getElementsByTagNameNS("*", "Ccy");
		NodeList amts = doc.getElementsByTagNameNS("*", "Amt");

		boolean hasCcy = ccys.getLength() > 0;
		boolean hasAmtCcy = false;
		for (int i = 0; i < amts.getLength(); i++) {
			if (amts.item(i).getAttributes().getNamedItem("Ccy") != null) {
				hasAmtCcy = true;
				break;
			}
		}

		if (!hasCcy && !hasAmtCcy) {
			errors.add("No currency found in Acct/Ccy or Bal/Amt/@Ccy");
		}
	}

	private void checkBalances(Document doc, List<String> errors, List<String> warnings) {
		// Check for CAMT 053 balance codes
		NodeList balCodes = doc.getElementsByTagNameNS("*", "Cd");
		boolean hasOpening = false;
		boolean hasClosing = false;

		for (int i = 0; i < balCodes.getLength(); i++) {
			String code = balCodes.item(i).getTextContent().trim();
			if ("OPBD".equals(code) || "PRCD".equals(code) || "OPAV".equals(code)) {
				hasOpening = true;
			}
			if ("CLBD".equals(code) || "CLAV".equals(code) || "INFO".equals(code)) {
				hasClosing = true;
			}
		}

		if (!hasOpening) {
			warnings.add("No opening balance found (OPBD/PRCD/OPAV)");
		}
		if (!hasClosing) {
			warnings.add("No closing balance found (CLBD/CLAV/INFO)");
		}
	}

	private void checkDates(Document doc, List<String> warnings) {
		NodeList creDtTms = doc.getElementsByTagNameNS("*", "CreDtTm");
		NodeList frDtTms = doc.getElementsByTagNameNS("*", "FrDtTm");
		NodeList toDtTms = doc.getElementsByTagNameNS("*", "ToDtTm");

		if (creDtTms.getLength() == 0 && frDtTms.getLength() == 0 && toDtTms.getLength() == 0) {
			warnings.add("No date found (CreDtTm or FrDt/ToDt)");
		}
	}

	private boolean isDescendantOf(org.w3c.dom.Node node, String ancestorLocalName) {
		org.w3c.dom.Node current = node.getParentNode();
		while (current != null) {
			if (current instanceof org.w3c.dom.Element elem) {
				String name = elem.getLocalName();
				if (name == null) name = elem.getTagName();
				if (ancestorLocalName.equals(name)) return true;
			}
			current = current.getParentNode();
		}
		return false;
	}
}
