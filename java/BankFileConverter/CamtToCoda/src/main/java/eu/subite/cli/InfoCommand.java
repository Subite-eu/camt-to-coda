package eu.subite.cli;

import java.io.File;
import java.util.concurrent.Callable;

import javax.xml.parsers.DocumentBuilderFactory;

import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

import eu.subite.validation.CamtSchemaValidator;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

@Command(
	name = "info",
	description = "Display CAMT file metadata (version, accounts, entries, dates)"
)
public class InfoCommand implements Callable<Integer> {

	@Parameters(index = "0", description = "CAMT XML file to inspect")
	private File inputFile;

	@Override
	public Integer call() {
		if (!inputFile.exists()) {
			System.err.println("File not found: " + inputFile);
			return 1;
		}

		try {
			var schemaValidator = new CamtSchemaValidator();
			String version = schemaValidator.detectVersion(inputFile);
			System.out.println("CAMT Version: " + (version != null ? version : "unknown"));

			var dbFactory = DocumentBuilderFactory.newInstance();
			dbFactory.setNamespaceAware(true);
			Document doc = dbFactory.newDocumentBuilder().parse(inputFile);

			// Account info
			NodeList ibans = doc.getElementsByTagNameNS("*", "IBAN");
			NodeList othrs = doc.getElementsByTagNameNS("*", "Othr");
			System.out.println("Accounts:");
			for (int i = 0; i < ibans.getLength(); i++) {
				if (isAccountIban(ibans.item(i))) {
					System.out.println("  IBAN: " + ibans.item(i).getTextContent());
				}
			}

			// Currency
			NodeList ccys = doc.getElementsByTagNameNS("*", "Ccy");
			if (ccys.getLength() > 0) {
				System.out.println("Currency: " + ccys.item(0).getTextContent());
			}

			// Entries
			NodeList entries = doc.getElementsByTagNameNS("*", "Ntry");
			System.out.println("Entries: " + entries.getLength());

			// Statements
			NodeList stmts = doc.getElementsByTagNameNS("*", "Stmt");
			NodeList rpts = doc.getElementsByTagNameNS("*", "Rpt");
			System.out.println("Statements: " + (stmts.getLength() + rpts.getLength()));

			// Dates
			NodeList creDtTms = doc.getElementsByTagNameNS("*", "CreDtTm");
			if (creDtTms.getLength() > 0) {
				System.out.println("Creation Date: " + creDtTms.item(0).getTextContent());
			}

			return 0;
		} catch (Exception e) {
			System.err.println("Error reading file: " + e.getMessage());
			return 1;
		}
	}

	private boolean isAccountIban(org.w3c.dom.Node node) {
		org.w3c.dom.Node parent = node.getParentNode();
		while (parent != null) {
			if (parent instanceof org.w3c.dom.Element elem) {
				String name = elem.getLocalName();
				if (name == null) name = elem.getTagName();
				if ("Acct".equals(name)) return true;
				if ("RltdPties".equals(name)) return false;
			}
			parent = parent.getParentNode();
		}
		return false;
	}
}
