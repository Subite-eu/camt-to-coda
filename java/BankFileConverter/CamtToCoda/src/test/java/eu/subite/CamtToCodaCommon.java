package eu.subite;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatException;
import static org.assertj.core.api.Assertions.assertThatNoException;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.when;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.commons.cli.ParseException;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.core.Appender;
import org.apache.logging.log4j.core.LogEvent;
import org.apache.logging.log4j.core.Logger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.invocation.InvocationOnMock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.Answer;

import eu.subite.error.InvalidCamtFileException;
import eu.subite.params.Params;
import eu.subite.tools.XsltErrorHelper;

public abstract class CamtToCodaCommon<T, P extends Params<T>, C extends CamtToCoda<T, P>> {

	private static final String XSLT = "target/classes/xslt";

	protected abstract int getVersion();

	protected abstract String getSource();

	protected abstract String getOneFileName();

	protected abstract String getTarget();

	protected abstract C buildConverter() throws ParseException;

	protected abstract T toSource(String source);

	protected abstract String getSamplePath();

	protected abstract void copySampleToIn(File... files) throws IOException;

	protected abstract void expectFileToBeArchived(String file);

	protected abstract void expectFileToBeInError(String file);

	protected abstract String getArchivePath();

	protected abstract String getErrorPath();

	protected abstract void isFolderEmpty(String path, boolean empty);

	protected abstract void deleteFiles(String path) throws IOException;

	@BeforeEach
	protected void init() throws IOException {
		deleteFiles(getSource());
		deleteFiles(getTarget());
		deleteFiles(getArchivePath());
		deleteFiles(getErrorPath());
	}

	protected String getTmp() {
		if (DockerUtils.isRunningInsideDocker()) {
			return "/tmp";
		}
		return "c:\\TMP";
	}

	@Test
	void invalidParams() throws Exception {
		assertThatException()
				.isThrownBy(
						() -> CamtToCodaFs.main())
				.isInstanceOf(ParseException.class)
				.withMessageContaining("Missing required options");
	}

	@Test
	protected void oneFile() throws Exception {
		copySampleToIn(new File("%s/%s".formatted(getSamplePath(), getOneFileName())));
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(toSource(getOneFileName())));
		expectFileToBeArchived(getOneFileName());
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	protected void folder() throws Exception {
		copySampleToIn(new File(getSamplePath()).listFiles());
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(toSource("")));
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), false);
	}

	@Test
	void unknownFile() throws Exception {
		var c = buildConverter();
		assertThatException()
				.isThrownBy(
						() -> c.convert(toSource("unknownFile")))
				.isInstanceOf(InvalidCamtFileException.class)
				.withMessageContaining("Source does not exist");
		isFolderEmpty(getSource(), true);
		isFolderEmpty(getTarget(), true);
	}

	@Test
	void invalidFile() throws Exception {
		var fileName = "invalid.camt";
		var filePath = "../test_data/invalid/%s".formatted(fileName);
		copySampleToIn(new File(filePath));
		var c = buildConverter();
		assertThatNoException()
				.isThrownBy(
						() -> c.convert(toSource(fileName)));
		isFolderEmpty(getSource(), false);
		isFolderEmpty(getTarget(), true);
	}

	@ExtendWith(
		MockitoExtension.class
	)
	public class XsltErrors {

		@Mock
		private Appender mockAppender;

		private List<LogEvent> capturedEvents = new ArrayList<>();

		private Logger logger;

		@BeforeEach
		public void setup() {
			// prepare the appender so Log4j likes it
			when(mockAppender.getName()).thenReturn("MockAppender");
			when(mockAppender.isStarted()).thenReturn(true);
//			when(mockAppender.isStopped()).thenReturn(false);

			doAnswer(new Answer<Void>() {
				@Override
				public Void answer(InvocationOnMock invocation) throws Throwable {
					Object[] arguments = invocation.getArguments();
					for (Object argument : arguments) {
						if (argument instanceof LogEvent event) {
							capturedEvents.add(event.toImmutable());
						}
					}
					return null;
				}
			}).when(mockAppender).append(any());

			logger = (Logger) LogManager.getLogger(XsltErrorHelper.class);
			logger.addAppender(mockAppender);
			logger.setLevel(Level.INFO);
		}

		@AfterEach
		public void tearDown() {
			// the appender we added will sit in the singleton logger forever
			// slowing future things down - so remove it
			logger.removeAppender(mockAppender);
		}

		private void verifyErrorMessages(String... messages) {
			for (String message : messages) {
				var found = false;
				for (var e : capturedEvents) {
					if (e.getMessage().getFormattedMessage().contains(message)) {
						found = true;
					}
				}
				assertThat(found)
						.as("Message '%s' not found in captured Events[%s]", message, capturedEvents)
						.isTrue();
			}
		}

		private void assertError(String... msgs) {
			isFolderEmpty(getSource(), true);
			isFolderEmpty(getTarget(), true);
			isFolderEmpty(getErrorPath(), false);
			verifyErrorMessages(msgs);
		}

		@Test
		void accountNotFound() throws Exception {
			var fileName = "account_not_found.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError("Bank Account not found");
		}

		@Test
		protected void bicNotFound() throws Exception {
			var fileName = "bic_not_found.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError("BIC not found");
		}

		@Test
		void currencyNotFound() throws Exception {
			var fileName = "currency_not_found.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError("Currency not found");
		}

		@Test
		void notAnIban() throws Exception {
			var fileName = "not_an_iban.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError("Bank Account not an IBAN... not supported yet: 123456");
		}

		@Test
		void reportDateRequired() throws Exception {
			var fileName = "report_date_required.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError("Report date required");
		}

		@Test
		@Disabled // not possible since report date is default if not entry date is available
		void entryDateRequired() throws Exception {
			var fileName = "entry_date_required.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError("Bank Account not found");
		}

		@Test
		void invalidBalance() throws Exception {
			var fileName = "invalid_balances.xml";
			var filePath = "../test_data/invalid/CAMT0%s/%s".formatted(getVersion(), fileName);
			copySampleToIn(new File(filePath));
			var c = buildConverter();
			assertThatNoException()
					.isThrownBy(
							() -> c.convert(toSource(fileName)));
			assertError(
					"Balances are inconsistent !?",
					"Open:            11111.11",
					"Movements:           0.00",
					"Close:           22222.22",
					"Diff:           -11111.11");
		}

	}

	protected String getXslt() {
		return XSLT;
	}

}
