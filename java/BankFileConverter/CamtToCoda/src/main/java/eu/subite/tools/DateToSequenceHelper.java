package eu.subite.tools;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Optional;
import java.util.regex.Pattern;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import eu.subite.tools.config.Holidays;
import eu.subite.tools.config.HolidaysFactory;
import net.sf.saxon.expr.XPathContext;
import net.sf.saxon.lib.ExtensionFunctionCall;
import net.sf.saxon.lib.ExtensionFunctionDefinition;
import net.sf.saxon.om.Sequence;
import net.sf.saxon.om.StructuredQName;
import net.sf.saxon.trans.XPathException;
import net.sf.saxon.value.Int64Value;
import net.sf.saxon.value.SequenceType;
import net.sf.saxon.value.StringValue;

public class DateToSequenceHelper extends ExtensionFunctionDefinition {

	private static final Logger LOGGER = LogManager.getLogger();

	private static final String COUNTRY_GROUP = "country";

	private static final Pattern IBAN_PATTERN = Pattern.compile("^(?<%s>[a-z]{2}).*".formatted(COUNTRY_GROUP),
			Pattern.CASE_INSENSITIVE);

	@Override
	public StructuredQName getFunctionQName() {
		return new StructuredQName("cf", "http://custom.functions.subite.eu/cf", "nb-working-days-this-year");
	}

	@Override
	public SequenceType[] getArgumentTypes() {
		return new SequenceType[] { SequenceType.SINGLE_STRING, SequenceType.SINGLE_STRING };
	}

	@Override
	public SequenceType getResultType(SequenceType[] suppliedArgumentTypes) {
		return SequenceType.SINGLE_INTEGER;
	}

	@Override
	public ExtensionFunctionCall makeCallExpression() {
		return new ExtensionFunctionCall() {
			@Override
			public Sequence call(XPathContext context, Sequence[] arguments) throws XPathException {
				var iban = ((StringValue) arguments[0].iterate().next()).getStringValue();
				var date = ((StringValue) arguments[1].iterate().next()).getStringValue();
				long result = nbWorkingDaysThisYear(iban, date);
				return Int64Value.makeIntegerValue(result);

			}
		};
	}

	public static int nbWorkingDaysThisYear(String iban, String date) {
		LOGGER.info("{}: {}", iban, date);
		var thisDate = LocalDate.parse(date.substring(0, 10));
		var firstJan = thisDate.withMonth(1).withDayOfMonth(1);
//		var thisDate = LocalDate.parse(date.substring(0, 10));

		var holidays = getCountrySpecificHolidays(iban);

		int seq = 1;
		for (var d = firstJan; d.isBefore(thisDate); d = d.plusDays(1)) {
			if (d.getDayOfWeek() != DayOfWeek.SATURDAY && d.getDayOfWeek() != DayOfWeek.SUNDAY) {
				if (holidays.isPresent()) {
					if (!holidays.get().isBankHoliday(d) && !holidays.get().isNationalHoliday(d)) {
						seq++;
					}
				} else {
					seq++;
				}
			}
		}
		LOGGER.info("{} working days between {} and {}", seq, firstJan, thisDate);
		return seq;
	}

	private static Optional<Holidays> getCountrySpecificHolidays(String iban) {
		var matcher = IBAN_PATTERN.matcher(iban);
		if (matcher.find()) {
			var country = matcher.group(COUNTRY_GROUP);
			return Optional.ofNullable(switch (country) {
			case "BE" -> HolidaysFactory.belgium();
			case "LT" -> HolidaysFactory.lithuania();
			case "NL" -> HolidaysFactory.netherlands();
			default -> notSupported();
			});
		}
		return Optional.empty();
	}

	private static Holidays notSupported() {
		LOGGER.warn("Country not supported yet. Do not use holidays");
		return null;
	}

}
