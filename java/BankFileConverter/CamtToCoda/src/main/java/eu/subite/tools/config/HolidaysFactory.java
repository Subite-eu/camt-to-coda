package eu.subite.tools.config;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.Month;

public final class HolidaysFactory {
	private HolidaysFactory() {
		// intentionally left blank
	}

	/**
	 * Belgian public and bank holiday according to:
	 * https://www.febelfin.be/nl/banksluitingsdagen-2018
	 */
	public static Holidays belgium() {
		return new Holidays().addNationalHoliday(new AbsoluteDay(Month.JANUARY, 1)) // New Year's Day
				.addBankHoliday(new RelativeDay(HolidaysFactory::easterSunday, -2)) // Good Friday
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 1)) // Easter Monday
				.addNationalHoliday(new AbsoluteDay(Month.MAY, 1)) // Labour Day
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 39)) // Ascension Day
				.addBankHoliday(new RelativeDay(HolidaysFactory::easterSunday, 39L + 1)) // Ascension Friday
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 49L + 1)) // Pentecost Monday
				.addNationalHoliday(new AbsoluteDay(Month.JULY, 21)) // Independence Day
				.addNationalHoliday(new AbsoluteDay(Month.AUGUST, 15)) // Assumption Day
				.addNationalHoliday(new AbsoluteDay(Month.NOVEMBER, 1)) // All Saints Day
				.addNationalHoliday(new AbsoluteDay(Month.NOVEMBER, 11)) // Armistice Day
				.addNationalHoliday(new AbsoluteDay(Month.DECEMBER, 25)) // Christmas Day
				.addBankHoliday(new AbsoluteDay(Month.DECEMBER, 26)); // Boxing Day
	}

	/**
	 * The Netherlands public and bank holiday according to:
	 * https://www.officeholidays.com/countries/netherlands/2018.php
	 */
	public static Holidays netherlands() {
		return new Holidays().addNationalHoliday(new AbsoluteDay(Month.JANUARY, 1)) // New Year's Day
				.addBankHoliday(new RelativeDay(HolidaysFactory::easterSunday, -2)) // Good Friday
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 1)) // Easter Monday
				.addNationalHoliday(new RelativeDay(HolidaysFactory::dutchKingBirthday)) // King's birthday
				.addNationalHoliday(new AbsoluteDay(Month.MAY, 5)) // Liberation Day
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 39)) // Ascension Day
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 49L + 1)) // Pentecost Monday
				.addNationalHoliday(new AbsoluteDay(Month.DECEMBER, 25)) // Christmas Day
				.addBankHoliday(new AbsoluteDay(Month.DECEMBER, 26)); // Boxing Day
	}

	/**
	 * https://www.qppstudio.net/publicholidays2024/lithuania.htm
	 * https://www.ecb.europa.eu/ecb/contacts/working-hours/html/index.en.html
	 * https://www.sepaforcorporates.com/single-euro-payments-area/sepa-target-closing-days-2022-2023/
	 * 
	 * taking only the TARGET closing days 
	 */
	public static Holidays lithuania() {
		return new Holidays().addNationalHoliday(new AbsoluteDay(Month.JANUARY, 1)) // New Year's Day
//				.addNationalHoliday(new AbsoluteDay(Month.FEBRUARY, 16)) // Day of Restoration of the State of Lithuania
				// .addNationalHoliday(new AbsoluteDay(Month.MARCH, 11)) // Day of Restoration
				// of Independence
				.addBankHoliday(new RelativeDay(HolidaysFactory::easterSunday, -2)) // Good Friday
				.addNationalHoliday(new RelativeDay(HolidaysFactory::easterSunday, 1)) // Easter Monday
				.addNationalHoliday(new AbsoluteDay(Month.MAY, 1)) // International Working Day
//				.addNationalHoliday(new AbsoluteDay(Month.MAY, 5)) // Mother's Day
//				.addNationalHoliday(new AbsoluteDay(Month.JUNE, 2)) // Father's Day
				// .addNationalHoliday(new AbsoluteDay(Month.JUNE, 24)) // St. John's Day
//				.addNationalHoliday(new AbsoluteDay(Month.JULY, 6)) // Statehood Day
//				.addNationalHoliday(new AbsoluteDay(Month.AUGUST, 15)) // Assumption Day
//				.addNationalHoliday(new AbsoluteDay(Month.NOVEMBER, 1)) // All Saints Day
//				.addNationalHoliday(new AbsoluteDay(Month.NOVEMBER, 2)) // All Souls' Day
//				.addNationalHoliday(new AbsoluteDay(Month.DECEMBER, 24)) // Christmas Eve
				.addNationalHoliday(new AbsoluteDay(Month.DECEMBER, 25)) // Christmas Day
				.addNationalHoliday(new AbsoluteDay(Month.DECEMBER, 26)) // St. Stephen's Day
		;
	}

	/**
	 * No day is a holiday. Useful in unit testing.
	 */
	public static Holidays noHolidays() {
		return new Holidays().addNationalHoliday(d -> false).addBankHoliday(d -> false);
	}

	/**
	 * Every day is a holiday. Useful in unit testing.
	 */
	public static Holidays allHolidays() {
		return new Holidays().addNationalHoliday(d -> true).addBankHoliday(d -> true);
	}

	/**
	 * From https://en.wikipedia.org/wiki/Computus
	 */
	private static LocalDate easterSunday(final int year) {
		final int a = year % 19;
		final int b = year / 100;
		final int c = year % 100;
		final int d = b / 4;
		final int e = b % 4;
		final int f = (b + 8) / 25;
		final int g = (b - f + 1) / 3;
		final int h = (19 * a + b - d - g + 15) % 30;
		final int i = c / 4;
		final int k = c % 4;
		final int l = (32 + 2 * e + 2 * i - h - k) % 7;
		final int m = (a + 11 * h + 22 * l) / 451;
		final int n = (h + l - 7 * m + 114) / 31;
		final int p = (h + l - 7 * m + 114) % 31;
		return LocalDate.of(year, n, p + 1);
	}

	/**
	 * Netherlands king's birthday If 27th is a Sunday, celebration are held on 26th
	 */
	private static LocalDate dutchKingBirthday(final int year) {
		LocalDate kingBirthday = LocalDate.of(year, Month.APRIL, 27);
		if (kingBirthday.getDayOfWeek() == DayOfWeek.SUNDAY) {
			kingBirthday = LocalDate.of(year, Month.APRIL, 26);
		}
		return kingBirthday;
	}
}
