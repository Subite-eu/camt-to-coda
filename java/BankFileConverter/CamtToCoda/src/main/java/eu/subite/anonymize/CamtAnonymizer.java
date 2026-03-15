package eu.subite.anonymize;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.Random;

import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

/**
 * Anonymizes CAMT XML files by replacing sensitive fields with deterministic fake data.
 * Same input + same seed always produces identical output (reproducible golden files).
 * Maintains referential integrity: same IBAN always maps to same fake IBAN.
 */
public class CamtAnonymizer {

	private static final Logger LOGGER = LogManager.getLogger();

	private final AnonymizeConfig config;
	private final IbanGenerator ibanGen;
	private final BicGenerator bicGen;
	private final NameGenerator nameGen;
	private final ReferenceGenerator refGen;

	// Referential integrity maps: real value -> anonymized value
	private final Map<String, String> ibanMap = new HashMap<>();
	private final Map<String, String> bicMap = new HashMap<>();
	private final Map<String, String> nameMap = new HashMap<>();

	public CamtAnonymizer(AnonymizeConfig config) {
		this.config = config;
		Random random = new Random(config.getSeed());
		this.ibanGen = new IbanGenerator(random, config.getIbanCountry());
		this.bicGen = new BicGenerator(random);
		this.nameGen = new NameGenerator(random, config.getNameStyle());
		this.refGen = new ReferenceGenerator(random);
	}

	public void anonymizeFile(Path inputFile, Path outputDir) throws IOException {
		LOGGER.info("Anonymizing: {}", inputFile);
		try {
			var dbFactory = DocumentBuilderFactory.newInstance();
			dbFactory.setNamespaceAware(true);
			var doc = dbFactory.newDocumentBuilder().parse(inputFile.toFile());
			doc.getDocumentElement().normalize();

			anonymizeDocument(doc);

			Files.createDirectories(outputDir);
			Path outputFile = outputDir.resolve(inputFile.getFileName());

			var transformerFactory = TransformerFactory.newInstance();
			var transformer = transformerFactory.newTransformer();
			transformer.setOutputProperty(OutputKeys.INDENT, "yes");
			transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
			transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");
			transformer.transform(new DOMSource(doc), new StreamResult(outputFile.toFile()));

			LOGGER.info("Anonymized output: {}", outputFile);
		} catch (ParserConfigurationException | SAXException | TransformerException e) {
			throw new IOException("Failed to anonymize " + inputFile, e);
		}
	}

	public void anonymizeDirectory(Path inputDir, Path outputDir) throws IOException {
		try (var files = Files.list(inputDir)) {
			files.filter(p -> p.toString().toLowerCase().endsWith(".xml"))
					.forEach(f -> {
						try {
							anonymizeFile(f, outputDir);
						} catch (IOException e) {
							LOGGER.error("Failed to anonymize {}: {}", f, e.getMessage());
						}
					});
		}
	}

	void anonymizeDocument(Document doc) {
		Element root = doc.getDocumentElement();
		processNode(root);
	}

	private void processNode(Node node) {
		if (node.getNodeType() == Node.ELEMENT_NODE) {
			Element elem = (Element) node;
			String localName = elem.getLocalName();
			if (localName == null) localName = elem.getTagName();

			switch (localName) {
				// Account IBANs
				case "IBAN" -> {
					if (config.isIban() || config.isCounterpartyIban()) {
						replaceWithMappedValue(elem, ibanMap, () -> ibanGen.generate(guessCountry(elem)));
					}
				}
				// Other account identifiers
				case "Id" -> {
					if (isChildOf(elem, "Othr") && isDescendantOf(elem, "Acct") && config.isIban()) {
						String text = elem.getTextContent().trim();
						if (text.length() >= 10) { // looks like an account number
							replaceWithMappedValue(elem, ibanMap, () -> ibanGen.generate(guessCountry(elem)));
						}
					}
				}
				// BICs
				case "BIC", "AnyBIC", "BICFI" -> {
					if (config.isBic() || config.isCounterpartyBic()) {
						replaceWithMappedValue(elem, bicMap, () -> {
							String orig = elem.getTextContent().trim();
							return orig.length() > 8 ? bicGen.generate11(config.getIbanCountry())
									: bicGen.generate(config.getIbanCountry());
						});
					}
				}
				// Names
				case "Nm" -> {
					if (isDescendantOf(elem, "Ownr") && config.isAccountName()) {
						replaceWithMappedValue(elem, nameMap, nameGen::generate);
					} else if ((isDescendantOf(elem, "Cdtr") || isDescendantOf(elem, "Dbtr"))
							&& config.isCounterpartyName()) {
						replaceWithMappedValue(elem, nameMap, nameGen::generate);
					} else if (isDescendantOf(elem, "FinInstnId") && config.isCounterpartyName()) {
						replaceWithMappedValue(elem, nameMap, nameGen::generate);
					}
				}
				// Addresses
				case "StrtNm", "BldgNb", "PstCd", "TwnNm", "Ctry", "AdrLine" -> {
					if (config.isCounterpartyAddress() && isDescendantOf(elem, "PstlAdr")) {
						elem.setTextContent("Anonymized");
					}
				}
				// References
				case "MsgId", "StmtId", "AcctRptId" -> {
					if (config.isReferences()) {
						elem.setTextContent(refGen.generateMessageId());
					}
				}
				case "NtryRef", "AcctSvcrRef" -> {
					if (config.isReferences()) {
						elem.setTextContent(refGen.generateEntryRef());
					}
				}
				case "EndToEndId" -> {
					if (config.isReferences()) {
						String text = elem.getTextContent().trim();
						if (!"NOTPROVIDED".equals(text)) {
							elem.setTextContent(refGen.generateEndToEndId());
						}
					}
				}
				case "TxId" -> {
					if (config.isReferences()) {
						elem.setTextContent(refGen.generateTxId());
					}
				}
				case "InstrId" -> {
					if (config.isReferences()) {
						String text = elem.getTextContent().trim();
						if (!"NOTPROVIDED".equals(text)) {
							elem.setTextContent(refGen.generateMessageId());
						}
					}
				}
				// Remittance info
				case "Ustrd" -> {
					if (config.isRemittanceInfo() && isDescendantOf(elem, "RmtInf")) {
						String text = elem.getTextContent().trim();
						if (!"NOTPROVIDED".equals(text)) {
							elem.setTextContent(refGen.generateRemittanceText());
						}
					}
				}
				// Structured communication
				case "Ref" -> {
					if (config.isStructuredComm() && isDescendantOf(elem, "CdtrRefInf")) {
						elem.setTextContent(refGen.generateStructuredComm());
					}
				}
				// Amounts
				case "Amt" -> {
					if (config.isAmounts()) {
						String text = elem.getTextContent().trim();
						try {
							double original = Double.parseDouble(text);
							double factor = 0.5 + new Random(Double.doubleToLongBits(original) + config.getSeed()).nextDouble();
							elem.setTextContent(String.format("%.2f", original * factor));
						} catch (NumberFormatException ignored) {}
					}
				}
				default -> {}
			}

			// Recurse into children
			NodeList children = elem.getChildNodes();
			for (int i = 0; i < children.getLength(); i++) {
				processNode(children.item(i));
			}
		}
	}

	private void replaceWithMappedValue(Element elem, Map<String, String> map, java.util.function.Supplier<String> generator) {
		String original = elem.getTextContent().trim();
		if (original.isEmpty()) return;
		String replacement = map.computeIfAbsent(original, k -> generator.get());
		elem.setTextContent(replacement);
	}

	private String guessCountry(Element elem) {
		String text = elem.getTextContent().trim();
		if (text.length() >= 2 && Character.isLetter(text.charAt(0)) && Character.isLetter(text.charAt(1))) {
			return text.substring(0, 2);
		}
		return config.getIbanCountry();
	}

	private static boolean isChildOf(Element elem, String parentLocalName) {
		Node parent = elem.getParentNode();
		if (parent instanceof Element) {
			String name = ((Element) parent).getLocalName();
			if (name == null) name = ((Element) parent).getTagName();
			return parentLocalName.equals(name);
		}
		return false;
	}

	private static boolean isDescendantOf(Element elem, String ancestorLocalName) {
		Node current = elem.getParentNode();
		while (current != null) {
			if (current instanceof Element) {
				String name = ((Element) current).getLocalName();
				if (name == null) name = ((Element) current).getTagName();
				if (ancestorLocalName.equals(name)) return true;
			}
			current = current.getParentNode();
		}
		return false;
	}

	public Map<String, String> getIbanMap() { return Map.copyOf(ibanMap); }
	public Map<String, String> getBicMap() { return Map.copyOf(bicMap); }
	public Map<String, String> getNameMap() { return Map.copyOf(nameMap); }
}
