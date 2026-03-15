package eu.subite.params;

public abstract class Params<T> {

	private String xsltRepo;
	private int version;
	private T source;
	private String tmpFolder;
	private String archiveFolder;
	private String errorFolder;
	private String target;
	private boolean dryRun;

	public Params(String xsltRepo, int version, T source, String tmpFolder, String archiveFolder, String errorFolder,
			String target) {
		this(xsltRepo, version, source, tmpFolder, archiveFolder, errorFolder, target, false);
	}

	public Params(String xsltRepo, int version, T source, String tmpFolder, String archiveFolder, String errorFolder,
			String target, boolean dryRun) {
		this.xsltRepo = xsltRepo;
		this.version = version;
		this.source = source;
		this.tmpFolder = tmpFolder;
		this.archiveFolder = archiveFolder;
		this.errorFolder = errorFolder;
		this.target = target;
		this.dryRun = dryRun;
	}

	public String getXsltRepo() {
		return xsltRepo;
	}

	public T getSource() {
		return source;
	}

	public String getTmpFolder() {
		return tmpFolder;
	}

	public String getArchiveFolder() {
		return archiveFolder;
	}

	public String getErrorFolder() {
		return errorFolder;
	}

	public String getTarget() {
		return target;
	}

	public int getVersion() {
		return version;
	}

	public boolean isDryRun() {
		return dryRun;
	}

}
