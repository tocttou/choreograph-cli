FROM mhart/alpine-node:6.3.1
MAINTAINER Ashish Chaudhary <me@ashishchaudhary.in>

RUN apk add --no-cache make gcc g++ python python3 bash curl \
  && rm -rf /var/cache/apk/* \
  && curl -O https://cdn.pmylund.com/files/tools/cpuburn/linux/cpuburn-1.0-amd64.tar.gz \
  && tar -xvzf cpuburn-1.0-amd64.tar.gz \
  && cp cpuburn/cpuburn /stress

WORKDIR /tmp
