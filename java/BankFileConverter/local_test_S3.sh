#! /bin/bash

cp -r ./test_data/s3/sample/* ./test_data/s3/camt/

MSYS_NO_PATHCONV=1

export MODE=S3 \
	VERSION=${1:-53} \
	IN=camt \
	OUT=coda \
	ARCHIVE=archive \
	export ERROR=error \
	EP=http://s3:9000 \
	AK=s3_username \
	SK=s3_password

#docker compose down -v

docker compose build java-run

#docker compose up s3 -d

docker compose up java-run

#docker compose down -v