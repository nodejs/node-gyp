test: build-buffertools build-leveldown

build-buffertools:
	cd node_modules/buffertools/ && \
		../../bin/node-gyp.js rebuild

build-leveldown:
	cd node_modules/leveldown/ && \
		../../bin/node-gyp.js rebuild

test-docker-node:
	docker run \
		--rm=true -i -v `pwd`:/opt/node-gyp/ \
		nodesource/node:wheezy \
		bash -c 'rm -rf /root/.node-gyp/ && cd /opt/node-gyp && make test'

test-docker-iojs:
	docker run \
		--rm=true -i -v `pwd`:/opt/node-gyp/ \
		iojs/iojs:1.0 \
		bash -c 'rm -rf /root/.node-gyp/ && cd /opt/node-gyp && make test'

test-docker: test-docker-node test-docker-iojs