package eu.subite.tools.config;

import java.time.LocalDate;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Definition of a day in a month regardless of the year. The day is calculated
 * using the passed in function; which receives a year as input. Optionally a
 * delta days can be applied to it.
 */
class RelativeDay implements Predicate<LocalDate> {
	private final Function<Integer, LocalDate> relativeTo;
	private final long deltaDays;

	RelativeDay(final Function<Integer, LocalDate> relativeTo, final long deltaDays) {
		this.relativeTo = relativeTo;
		this.deltaDays = deltaDays;
	}

	RelativeDay(final Function<Integer, LocalDate> relativeTo) {
		this(relativeTo, 0);
	}

	@Override
	public boolean test(final LocalDate date) {
		final LocalDate d = relativeTo.apply(date.getYear()).plusDays(deltaDays);
		return (d.getMonth() == date.getMonth()) && (d.getDayOfMonth() == date.getDayOfMonth());
	}
}
