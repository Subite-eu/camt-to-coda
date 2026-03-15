#! /bin/bash

cp ../../example-files/CAMT/Other/account_statement.xml ./test_data/fs/in
cp ../../example-files/CAMT/LT625883379695428516/CAMT_053/2024-03-07.xml ./test_data/fs/in
cp ../../example-files/CAMT/LT809872649478701594/CAMT_052/2024-03-11.xml ./test_data/fs/in

MSYS_NO_PATHCONV=1

export MODE=FS \
	VERSION=${1:-53} \
	IN= \
	OUT= \
	ARCHIVE= \
	ERROR=

docker compose build java-run

docker compose up java-run

