package eu.subite.tools.config;

import java.time.LocalDate;
import java.time.Month;
import java.util.function.Predicate;

/**
 * Definition of a day in a month regardless of the year.
 */
class AbsoluteDay implements Predicate<LocalDate> {
	private final Month month;
	private final int day;

	AbsoluteDay(final Month month, final int day) {
		this.month = month;
		this.day = day;
	}

	@Override
	public boolean test(final LocalDate date) {
		return (null != date) && (month == date.getMonth()) && (day == date.getDayOfMonth());
	}
}
