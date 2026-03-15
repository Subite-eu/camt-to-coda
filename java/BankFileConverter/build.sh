#! /bin/bash

docker compose down -v

docker compose build java-build

docker compose up s3 -d

docker compose up java-build