package eu.subite.error;

public class InvalidCamtFileException extends InvalidFileException {

	public InvalidCamtFileException(Object source, String error) {
		super("Invalid CAMT '%s' - error[%s]".formatted(source, error));
	}

}
