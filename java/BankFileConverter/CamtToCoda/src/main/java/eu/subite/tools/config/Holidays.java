package eu.subite.tools.config;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;
import java.util.function.Predicate;

public final class Holidays {
	private final Set<Predicate<LocalDate>> nationalHolidays;
	private final Set<Predicate<LocalDate>> bankHolidays;

	Holidays() {
		nationalHolidays = new HashSet<>();
		bankHolidays = new HashSet<>();
	}

	/**
	 * Returns true if the given date is a national holiday.
	 */
	public boolean isNationalHoliday(final LocalDate date) {
		return nationalHolidays.stream().anyMatch(p -> p.test(date));
	}

	/**
	 * Returns true if the given date is a bank holiday.
	 */
	public boolean isBankHoliday(final LocalDate date) {
		return isNationalHoliday(date) || bankHolidays.stream().anyMatch(p -> p.test(date));
	}

	// builder methods

	Holidays addNationalHoliday(final Predicate<LocalDate> p) {
		nationalHolidays.add(p);
		return this;
	}

	Holidays addBankHoliday(final Predicate<LocalDate> p) {
		bankHolidays.add(p);
		return this;
	}
}
