# Docker

This directory contains the Dockerfiles used to build and release the official images and a `docker-compose.yml` file that is intended for end users to run a Mempool instance with minimal effort.

## bitcoind only configuration

To run an instance with the default settings, use the following command:

```bash
$ docker-compose up
```

The default configuration will allow you to run Mempool using `bitcoind` as the backend, so address lookups will be disabled. It assumes you have added RPC credentials for the `mempool` user with a `mempool` password in your `bitcoin.conf` file:

```
rpcuser=mempool
rpcpassword=mempool
```

If you want to use your current credentials, update them in the `docker-compose.yml` file:

```
  api:
    environment:
      MEMPOOL_BACKEND: "none"
      RPC_HOST: "172.27.0.1"
      RPC_PORT: "8332"
      RPC_USER: "mempool"
      RPC_PASS: "mempool"
```

Note: the IP in the example above refers to Docker's default gateway IP address so the container can hit the `bitcoind` instance running on the host machine. If your setup is different, update it accordingly.

You can check if the instance is running by visiting http://localhost - the graphs will be populated as new transactions are detected.

## bitcoind+romanz/electrs configuration

In order to run with `romanz/electrs` as the backend , in addition to the settings required for `bitcoind`  above, you will need to make the following changes to the `docker-compose.yml` file:

- Under the `api` service, change the value of `MEMPOOL_BACKEND` key from `none` to `electrum`:

```
  api:
    environment:
      MEMPOOL_BACKEND: "none"
```

- Under the `api` service, set the `ELECTRUM_HOST` and `ELECTRUM_PORT` keys to your Docker host ip address and set `ELECTRUM_TLS_ENABLED` to `false`:

```
  api:
    environment:
      ELECTRUM_HOST: "172.27.0.1"
      ELECTRUM_PORT: "50002"
      ELECTRUM_TLS: "false"
``` 

You can update any of the settings in the `mempool-config.json` file using the environment variables to override. Refer to the `start.sh` script for a list of variables and their default values.
