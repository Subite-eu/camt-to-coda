FROM amazoncorretto:23-alpine

RUN apk update \
	&& apk add bash \
	&& apk add unzip

RUN rm -rf /CamtToCoda \
	mkdir /CamtToCoda 

COPY ./CamtToCoda/target/CamtToCoda-1.0.0.zip /
RUN unzip /CamtToCoda-1.0.0.zip -d /CamtToCoda/

ENV MODE=${MODE:-FS}
ENV VERSION=${VERSION:-53}
ENV IN=${IN:-/in}
ENV OUT=${OUT:-/out}
ENV TMP=${TMP:-/tmp}
ENV ARCHIVE=${ARCHIVE:-/archive}
ENV ERROR=${ERROR:-/error}
ENV EP=${EP:-NA}
ENV AK=${AK:-NA}
ENV SK=${SK:-NA}

WORKDIR /CamtToCoda

CMD bash CamtToCoda.sh \
	-v $VERSION \
	-i $IN \
	-o $OUT \
	-t $TMP \
	-a $ARCHIVE \
	-e $ERROR \
	-ep $EP \
	-ak $AK \
	-sk $SK \
