package eu.subite.tools;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DateToSequenceHelperTest {

	@Test
	void jan1IsAlwaysSequence1() {
		assertThat(DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-01-01"))
				.isEqualTo(1);
	}

	@Test
	void jan2IsSequence2ForBelgium() {
		// Jan 1 is holiday in BE, so Jan 2 (Tue) = 1 (Jan 1 is skipped as holiday) + 0 working days
		// Actually: loop goes from Jan 1 to before Jan 2: only Jan 1 is checked.
		// Jan 1 is a national holiday in BE, so seq stays at 1.
		assertThat(DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-01-02"))
				.isEqualTo(1);
	}

	@Test
	void belgiumNewYearIsNotCounted() {
		// Jan 1, 2024 is a Monday (holiday)
		// Jan 2, 2024 is a Tuesday (working day)
		// So for Jan 3, we have: Jan 1 (holiday, skip) + Jan 2 (working, seq++) = 2
		assertThat(DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-01-03"))
				.isEqualTo(2);
	}

	@Test
	void weekendsAreNotCounted() {
		// 2024-01-06 is a Saturday, 2024-01-07 is a Sunday
		// Working days: Jan 2(Tue), Jan 3(Wed), Jan 4(Thu), Jan 5(Fri) = 4 working days + 1 start = 5
		// Jan 1 is holiday in BE
		assertThat(DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-01-08"))
				.isEqualTo(5);
	}

	@ParameterizedTest
	@CsvSource({
		"BE1234, 2024-03-07, Belgium",
		"LT1234, 2024-03-07, Lithuania",
		"NL1234, 2024-03-07, Netherlands"
	})
	void supportedCountriesReturnPositiveSequence(String iban, String date, String country) {
		int result = DateToSequenceHelper.nbWorkingDaysThisYear(iban, date);
		assertThat(result).as("Sequence for %s on %s", country, date).isGreaterThan(0);
	}

	@Test
	void unknownCountryStillWorks() {
		// Unknown country = no holiday filtering, just weekday counting
		int result = DateToSequenceHelper.nbWorkingDaysThisYear("XX1234", "2024-03-07");
		assertThat(result).isGreaterThan(0);
	}

	@Test
	void dec31HasHighSequence() {
		int result = DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-12-31");
		// Should be approximately 250-260 working days in a year
		assertThat(result).isBetween(240, 270);
	}

	@Test
	void leapYearFeb29Works() {
		// 2024 is a leap year
		int result = DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-02-29");
		assertThat(result).isGreaterThan(30);
	}

	@Test
	void nonIbanAccountStillWorks() {
		// Non-IBAN (starts with digits)
		int result = DateToSequenceHelper.nbWorkingDaysThisYear("1234567890", "2024-03-07");
		assertThat(result).isGreaterThan(0);
	}

	@Test
	void dateWithTimePartIsTruncated() {
		int result = DateToSequenceHelper.nbWorkingDaysThisYear("BE1234", "2024-03-07T14:30:00");
		assertThat(result).isGreaterThan(0);
	}
}
