#! /bin/bash

source "Common.sh"

#echo "MODE: ${MODE}"
#echo "VERSION: ${VERSION}"
#echo "IN: ${IN}"
#echo "OUT: ${OUT}"
#echo "TMP: ${TMP}"
#echo "ARCHIVE: ${ARCHIVE}"
#echo "ERROR: ${ERROR}"
#echo "EP: ${EP}"
#echo "AK: ${AK}"
#echo "SK: ${SK}"

if [[ "$MODE" == "FS" ]]; then
	run eu.subite.CamtToCodaFs "$@"
elif [[ "$MODE" == "S3" ]]; then
	run eu.subite.CamtToCodaS3 "$@"
else 
	echo "Invalid MODE !? Should be FS or S3"
fi
