FROM amazoncorretto:23-alpine

RUN apk update \
	&& apk add bash \
	&& apk add maven
	
CMD cd src/java/BankFileConverter; mvn clean package -DskipTests