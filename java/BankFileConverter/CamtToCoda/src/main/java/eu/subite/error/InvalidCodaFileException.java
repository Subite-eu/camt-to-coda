package eu.subite.error;

import java.util.List;

public class InvalidCodaFileException extends InvalidFileException {

	public InvalidCodaFileException(Object source, List<String> errors) {
		super("Invalid CODA '%s' - errors[%s]".formatted(source, errors));
	}

}
