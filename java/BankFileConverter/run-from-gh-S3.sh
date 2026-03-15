#! /bin/bash

# on linux, these should work 
#docker run -i -e VERSION=53 -v ./in:/in -v ./out:/out ghcr.io/subite-eu/camt-to-coda:main

CURPATH=`pwd`

if [[ "$OSTYPE" == "msys" ]]; then
  CURPATH="/$CURPATH"
fi

echo $CURPATH

docker run -i \
	-e VERSION=$1 \
	-e MODE=S3 \
	-e IN=camt \
	-e OUT=coda \
	-e ARCHIVE=archive \
	-e ERROR=error \
	-e EP=localhost:9000 \
	-e AK=s3_username \
	-e SK=s3_password \
	ghcr.io/subite-eu/camt-to-coda:main