#! /bin/bash

run() {
	echo "Running $0"
		
	if [[ -z "${JAVA_HOME}" ]]; then
		echo "JAVA_HOME must be set" >> /dev/stderr
		exit 1
	fi
	
	SEP=":"
	if [[ "$OSTYPE" == "msys" ]]; then
	  SEP=";"
	fi
	CLASSPATH=".${SEP}CamtToCoda.jar"
	
	"$JAVA_HOME/bin/java" -Dfile.encoding=UTF-8 -cp $CLASSPATH $@
}