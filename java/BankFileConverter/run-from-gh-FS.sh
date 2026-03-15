#! /bin/bash

# on linux, these should work 
#docker run -i -e VERSION=53 -v ./in:/in -v ./out:/out ghcr.io/subite-eu/camt-to-coda:main

rm -Rf ./test_data/fs/in/*
rm -Rf ./test_data/fs/out/*
cp ../../example-files/CAMT/Other/BE68793230773034-202411.xml ./test_data/fs/in
#cp ../../example-files/CAMT/Other/account_statement.xml ./test_data/fs/in
#cp ../../example-files/CAMT/LT625883379695428516/CAMT_053/2024-03-07.xml ./test_data/fs/in
#cp ../../example-files/CAMT/LT809872649478701594/CAMT_052/2024-03-11.xml ./test_data/fs/in

CURPATH=`pwd`

if [[ "$OSTYPE" == "msys" ]]; then
  CURPATH="/$CURPATH"
fi

echo $CURPATH

docker run -i \
	-e VERSION=$1 \
	-e MODE=FS \
	-v $CURPATH/test_data/fs/in:/in \
	-v $CURPATH/test_data/fs/out:/out \
	ghcr.io/subite-eu/camt-to-coda:main