package eu.subite.validation;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BusinessRuleValidatorTest {

	private final BusinessRuleValidator validator = new BusinessRuleValidator();

	@TempDir
	File tempDir;

	@Test
	void validCamt053PassesValidation() throws IOException {
		String xml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
				  <BkToCstmrStmt>
				    <GrpHdr><CreDtTm>2024-03-07T19:47:17Z</CreDtTm></GrpHdr>
				    <Stmt>
				      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
				      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt></Bal>
				      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">2000</Amt></Bal>
				    </Stmt>
				  </BkToCstmrStmt>
				</Document>
				""";
		File xmlFile = writeXml(xml);
		ValidationResult result = validator.validate(xmlFile);
		assertThat(result.valid()).isTrue();
		assertThat(result.errors()).isEmpty();
	}

	@Test
	void missingAccountIdentifierIsError() throws IOException {
		String xml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
				  <BkToCstmrStmt>
				    <GrpHdr><CreDtTm>2024-03-07T19:47:17Z</CreDtTm></GrpHdr>
				    <Stmt>
				      <Acct><Ccy>EUR</Ccy></Acct>
				      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt></Bal>
				    </Stmt>
				  </BkToCstmrStmt>
				</Document>
				""";
		File xmlFile = writeXml(xml);
		ValidationResult result = validator.validate(xmlFile);
		assertThat(result.errors()).anyMatch(e -> e.contains("account identifier"));
	}

	@Test
	void missingCurrencyIsError() throws IOException {
		String xml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
				  <BkToCstmrStmt>
				    <GrpHdr><CreDtTm>2024-03-07T19:47:17Z</CreDtTm></GrpHdr>
				    <Stmt>
				      <Acct><Id><IBAN>BE68793230773034</IBAN></Id></Acct>
				    </Stmt>
				  </BkToCstmrStmt>
				</Document>
				""";
		File xmlFile = writeXml(xml);
		ValidationResult result = validator.validate(xmlFile);
		assertThat(result.errors()).anyMatch(e -> e.contains("currency"));
	}

	@Test
	void missingBalancesAreWarnings() throws IOException {
		String xml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
				  <BkToCstmrStmt>
				    <GrpHdr><CreDtTm>2024-03-07T19:47:17Z</CreDtTm></GrpHdr>
				    <Stmt>
				      <Acct><Id><IBAN>BE68793230773034</IBAN></Id><Ccy>EUR</Ccy></Acct>
				    </Stmt>
				  </BkToCstmrStmt>
				</Document>
				""";
		File xmlFile = writeXml(xml);
		ValidationResult result = validator.validate(xmlFile);
		assertThat(result.warnings()).anyMatch(w -> w.contains("opening balance"));
		assertThat(result.warnings()).anyMatch(w -> w.contains("closing balance"));
	}

	@Test
	void othrIdAlsoAcceptedAsAccountIdentifier() throws IOException {
		String xml = """
				<?xml version="1.0" encoding="UTF-8"?>
				<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
				  <BkToCstmrStmt>
				    <GrpHdr><CreDtTm>2024-03-07T19:47:17Z</CreDtTm></GrpHdr>
				    <Stmt>
				      <Acct><Id><Othr><Id>LT625883379695428516</Id></Othr></Id><Ccy>EUR</Ccy></Acct>
				      <Bal><Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt></Bal>
				      <Bal><Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp><Amt Ccy="EUR">1000</Amt></Bal>
				    </Stmt>
				  </BkToCstmrStmt>
				</Document>
				""";
		File xmlFile = writeXml(xml);
		ValidationResult result = validator.validate(xmlFile);
		assertThat(result.valid()).isTrue();
	}

	private File writeXml(String content) throws IOException {
		File file = new File(tempDir, "test.xml");
		Files.writeString(file.toPath(), content);
		return file;
	}
}
