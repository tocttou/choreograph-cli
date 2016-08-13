FROM mhart/alpine-node:6.3.1
MAINTAINER Ashish Chaudhary <me@ashishchaudhary.in>

RUN apk add --no-cache make gcc g++ python git
ENV DOCKER_VERSION 1.6.2

RUN apk --update add bash curl \
  && cd /tmp/ \
  && curl -sSL -O https://get.docker.com/builds/Linux/x86_64/docker-${DOCKER_VERSION}.tgz \
  && tar zxf docker-${DOCKER_VERSION}.tgz \
  && mkdir -p /usr/local/bin/ \
  && mv $(find -name 'docker') /usr/local/bin/ \
  && chmod +x /usr/local/bin/docker \
  && apk del curl

WORKDIR /

RUN git clone https://github.com/tocttou/choreograph-parent.git \
  && cd /choreograph-parent \
  && npm i \
  && npm run build -s

WORKDIR /choreograph-parent
EXPOSE 6003
ENTRYPOINT ["npm", "start", "-s"]
