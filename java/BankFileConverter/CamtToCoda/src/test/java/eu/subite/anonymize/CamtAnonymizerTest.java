package eu.subite.anonymize;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

import javax.xml.parsers.DocumentBuilderFactory;

import org.junit.jupiter.api.Test;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;

class CamtAnonymizerTest {

	private static final String SAMPLE_CAMT = """
			<?xml version="1.0" encoding="UTF-8"?>
			<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
			  <BkToCstmrStmt>
			    <GrpHdr>
			      <MsgId>ORIGINAL-MSG-ID</MsgId>
			      <CreDtTm>2024-11-01T00:00:00Z</CreDtTm>
			    </GrpHdr>
			    <Stmt>
			      <Id>ORIGINAL-STMT-ID</Id>
			      <Acct>
			        <Id><IBAN>BE68793230773034</IBAN></Id>
			        <Ownr><Nm>Test Company Name</Nm></Ownr>
			        <Svcr><FinInstnId><BIC>EXMPBE21XXX</BIC></FinInstnId></Svcr>
			      </Acct>
			      <Ntry>
			        <Amt Ccy="EUR">1000.00</Amt>
			        <CdtDbtInd>CRDT</CdtDbtInd>
			        <NtryDtls>
			          <TxDtls>
			            <Refs>
			              <EndToEndId>ORIGINAL-E2E-ID</EndToEndId>
			              <TxId>123456</TxId>
			            </Refs>
			            <RltdPties>
			              <Dbtr><Nm>Test Debtor Name</Nm></Dbtr>
			              <DbtrAcct><Id><IBAN>BE91516952884376</IBAN></Id></DbtrAcct>
			            </RltdPties>
			            <RltdAgts>
			              <DbtrAgt><FinInstnId><BIC>TESTBE20</BIC></FinInstnId></DbtrAgt>
			            </RltdAgts>
			            <RmtInf><Ustrd>Test payment description</Ustrd></RmtInf>
			          </TxDtls>
			        </NtryDtls>
			      </Ntry>
			    </Stmt>
			  </BkToCstmrStmt>
			</Document>
			""";

	@Test
	void anonymizesIbans() throws Exception {
		var config = AnonymizeConfig.defaultConfig();
		var anonymizer = new CamtAnonymizer(config);
		var doc = parseXml(SAMPLE_CAMT);

		anonymizer.anonymizeDocument(doc);

		NodeList ibans = doc.getElementsByTagNameNS("*", "IBAN");
		for (int i = 0; i < ibans.getLength(); i++) {
			String iban = ibans.item(i).getTextContent();
			assertThat(iban).isNotEqualTo("BE68793230773034");
			assertThat(iban).isNotEqualTo("BE91516952884376");
			assertThat(IbanGenerator.isValidCheckDigit(iban))
					.as("Anonymized IBAN should be valid: %s", iban)
					.isTrue();
		}
	}

	@Test
	void anonymizesBics() throws Exception {
		var config = AnonymizeConfig.defaultConfig();
		var anonymizer = new CamtAnonymizer(config);
		var doc = parseXml(SAMPLE_CAMT);

		anonymizer.anonymizeDocument(doc);

		NodeList bics = doc.getElementsByTagNameNS("*", "BIC");
		for (int i = 0; i < bics.getLength(); i++) {
			String bic = bics.item(i).getTextContent();
			assertThat(bic).isNotIn("EXMPBE21XXX", "TESTBE20");
		}
	}

	@Test
	void anonymizesNames() throws Exception {
		var config = AnonymizeConfig.defaultConfig();
		var anonymizer = new CamtAnonymizer(config);
		var doc = parseXml(SAMPLE_CAMT);

		anonymizer.anonymizeDocument(doc);

		NodeList names = doc.getElementsByTagNameNS("*", "Nm");
		for (int i = 0; i < names.getLength(); i++) {
			String name = names.item(i).getTextContent();
			assertThat(name).isNotIn("Real Company Name", "Real Debtor Name");
		}
	}

	@Test
	void anonymizesReferences() throws Exception {
		var config = AnonymizeConfig.defaultConfig();
		var anonymizer = new CamtAnonymizer(config);
		var doc = parseXml(SAMPLE_CAMT);

		anonymizer.anonymizeDocument(doc);

		assertThat(getElementText(doc, "MsgId")).isNotEqualTo("ORIGINAL-MSG-ID");
		assertThat(getElementText(doc, "EndToEndId")).isNotEqualTo("ORIGINAL-E2E-ID");
	}

	@Test
	void anonymizesRemittanceInfo() throws Exception {
		var config = AnonymizeConfig.defaultConfig();
		var anonymizer = new CamtAnonymizer(config);
		var doc = parseXml(SAMPLE_CAMT);

		anonymizer.anonymizeDocument(doc);

		assertThat(getElementText(doc, "Ustrd")).isNotEqualTo("Real payment description");
	}

	@Test
	void preservesAmountsByDefault() throws Exception {
		var config = AnonymizeConfig.defaultConfig();
		var anonymizer = new CamtAnonymizer(config);
		var doc = parseXml(SAMPLE_CAMT);

		anonymizer.anonymizeDocument(doc);

		assertThat(getElementText(doc, "Amt")).isEqualTo("1000.00");
	}

	@Test
	void maintainsReferentialIntegrity() throws Exception {
		// Same IBAN should map to same fake IBAN
		String xml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
				  <BkToCstmrStmt>
				    <Stmt>
				      <Acct><Id><IBAN>BE68793230773034</IBAN></Id></Acct>
				      <Ntry>
				        <NtryDtls><TxDtls>
				          <RltdPties>
				            <DbtrAcct><Id><IBAN>BE68793230773034</IBAN></Id></DbtrAcct>
				          </RltdPties>
				        </TxDtls></NtryDtls>
				      </Ntry>
				    </Stmt>
				  </BkToCstmrStmt>
				</Document>
				""";
		var anonymizer = new CamtAnonymizer(AnonymizeConfig.defaultConfig());
		var doc = parseXml(xml);

		anonymizer.anonymizeDocument(doc);

		NodeList ibans = doc.getElementsByTagNameNS("*", "IBAN");
		String first = ibans.item(0).getTextContent();
		String second = ibans.item(1).getTextContent();
		assertThat(first).isEqualTo(second);
		assertThat(first).isNotEqualTo("BE68793230773034");
	}

	@Test
	void reproducibleWithSameSeed() throws Exception {
		var config = AnonymizeConfig.defaultConfig();

		var anonymizer1 = new CamtAnonymizer(config);
		var doc1 = parseXml(SAMPLE_CAMT);
		anonymizer1.anonymizeDocument(doc1);

		var anonymizer2 = new CamtAnonymizer(config);
		var doc2 = parseXml(SAMPLE_CAMT);
		anonymizer2.anonymizeDocument(doc2);

		NodeList ibans1 = doc1.getElementsByTagNameNS("*", "IBAN");
		NodeList ibans2 = doc2.getElementsByTagNameNS("*", "IBAN");
		for (int i = 0; i < ibans1.getLength(); i++) {
			assertThat(ibans1.item(i).getTextContent())
					.isEqualTo(ibans2.item(i).getTextContent());
		}
	}

	private Document parseXml(String xml) throws Exception {
		var factory = DocumentBuilderFactory.newInstance();
		factory.setNamespaceAware(true);
		return factory.newDocumentBuilder()
				.parse(new ByteArrayInputStream(xml.getBytes(StandardCharsets.UTF_8)));
	}

	private String getElementText(Document doc, String localName) {
		NodeList nodes = doc.getElementsByTagNameNS("*", localName);
		return nodes.getLength() > 0 ? nodes.item(0).getTextContent() : "";
	}
}
