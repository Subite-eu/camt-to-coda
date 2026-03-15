package eu.subite;

public class DockerUtils {
	public static Boolean isRunningInsideDocker() {
		var props = System.getenv("INSIDE-BUILD-CI");
		return props != null && props.equals("true");
//		try (Stream<String> stream = Files.lines(Paths.get("/proc/1/cgroup"))) {
//			return stream.anyMatch(line -> line.contains("/docker"));
//		}
//		catch (IOException e) {
//			return false;
//		}
	}

}
