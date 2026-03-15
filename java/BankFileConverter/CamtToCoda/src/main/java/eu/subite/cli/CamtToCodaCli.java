package eu.subite.cli;

import picocli.CommandLine;
import picocli.CommandLine.Command;

@Command(
	name = "camt2coda",
	description = "CAMT to CODA bank statement converter",
	version = "camt2coda 1.0.0",
	mixinStandardHelpOptions = true,
	subcommands = {
		ConvertCommand.class,
		ValidateCommand.class,
		InfoCommand.class,
		AnonymizeCommand.class
	}
)
public class CamtToCodaCli implements Runnable {

	@Override
	public void run() {
		CommandLine.usage(this, System.out);
	}

	public static void main(String[] args) {
		int exitCode = new CommandLine(new CamtToCodaCli()).execute(args);
		System.exit(exitCode);
	}
}
