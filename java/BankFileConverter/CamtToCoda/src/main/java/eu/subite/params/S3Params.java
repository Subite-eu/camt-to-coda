package eu.subite.params;

public class S3Params extends Params<String> {

	private String endPoint;
	private String accessKey;
	private String secretKey;

	public S3Params(String xsltRepo, int version, String bucketName, String tmpFolder, String archiveFolder,
			String errorFolder, String targetFolder, String endPoint, String accessKey, String secretKey) {
		super(xsltRepo, version, bucketName, tmpFolder, archiveFolder, errorFolder, targetFolder);
		this.endPoint = endPoint;
		this.accessKey = accessKey;
		this.secretKey = secretKey;
	}

	public String getEndPoint() {
		return endPoint;
	}

	public String getAccessKey() {
		return accessKey;
	}

	public String getSecretKey() {
		return secretKey;
	}

	@Override
	public String toString() {
		return "converting CAMT %s from S3 bucket '%s' and put results in bucket '%s'".formatted(
				getVersion(), getSource(), getTarget());
	}

}
