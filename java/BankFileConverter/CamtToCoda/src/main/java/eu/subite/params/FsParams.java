package eu.subite.params;

import java.io.File;

public class FsParams extends Params<File> {

	public FsParams(String xsltRepo, int version, File source, String tmpFolder, String archiveFolder,
			String errorFolder, String targetFolder) {
		super(xsltRepo, version, source, tmpFolder, archiveFolder, errorFolder, targetFolder);
	}

	public FsParams(String xsltRepo, int version, File source, String tmpFolder, String archiveFolder,
			String errorFolder, String targetFolder, boolean dryRun) {
		super(xsltRepo, version, source, tmpFolder, archiveFolder, errorFolder, targetFolder, dryRun);
	}

	@Override
	public String toString() {
		return "converting CAMT %s from file system %s and put results in %s".formatted(
				getVersion(), getSource(), getTarget());
	}

}
