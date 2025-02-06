MOCHA=./node_modules/.bin/mocha
BOX=test/testnet-box

test:
	$(MAKE) test-ssl-no
	sleep 20
	$(MAKE) clean
	$(MAKE) test-ssl

test-ssl-no:
	$(MAKE) start
	sleep 20
	$(MAKE) run-test
	$(MAKE) stop

test-ssl:
	$(MAKE) start-ssl
	sleep 20
	$(MAKE) run-test-ssl
	$(MAKE) stop-ssl
	
start:
	$(MAKE) -C $(BOX) start

start-ssl:
	$(MAKE) -C $(BOX) start B1_FLAGS=-rpcssl=1 B2_FLAGS=-rpcssl=1
	
stop:
	$(MAKE) -C $(BOX) stop
	@while ps -C bitcoind > /dev/null; do sleep 1; done

stop-ssl:
	$(MAKE) -C $(BOX) stop B1_FLAGS=-rpcssl=1 B2_FLAGS=-rpcssl=1
	
run-test:
	$(MOCHA) --invert --grep SSL

run-test-ssl:
	$(MOCHA) --grep SSL
	
clean:
	$(MAKE) -C $(BOX) clean

.PHONY: test
