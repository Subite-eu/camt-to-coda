# Prerequesite

- docker and docker compose are installed
- for now this app is running with volumes mounted in the 'java-run' container. 
	Next version will use S3 to fetch CAMT file and store resulting CODA files


# Build

Run command: 

	sh build.sh 

# Test local image using File System

Put CAMT files in **./in** folder. Results will be put in **./out** folder (or whatever custom value(s) you've put in volumes of docker-compose.yml)

Then Run command: 

	sh local_test_FS.sh [version number. Default is 53]

# Test local image using AWS S3

Put CAMT files in **camt** folder. Results will be put in **coda** folder (or whatever custom value(s) you've put in volumes of docker-compose.yml)

Then Run command: 

	sh local_test_S3.sh

# Run GH image using File System

	run-from-gh-FS.sh
	
# Run GH image using AWS S3 (start minio container defined in docker-compose.yml or change script to use another one)
# files can be loaded here: http://localhost:9001/browser/camt

	run-from-gh-S3.sh
