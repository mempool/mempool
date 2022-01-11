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

You can update any of the backend settings in the `mempool-config.json` file using the following environment variables to override them.

JSON:
```
  "MEMPOOL": {
    "NETWORK": "mainnet",
    "BACKEND": "electrum",
    "HTTP_PORT": 8999,
    "SPAWN_CLUSTER_PROCS": 0,
    "API_URL_PREFIX": "/api/v1/",
    "POLL_RATE_MS": 2000,
    "CACHE_DIR": "./cache",
    "CLEAR_PROTECTION_MINUTES": 20,
    "RECOMMENDED_FEE_PERCENTILE": 50,
    "BLOCK_WEIGHT_UNITS": 4000000,
    "INITIAL_BLOCKS_AMOUNT": 8,
    "MEMPOOL_BLOCKS_AMOUNT": 8,
    "PRICE_FEED_UPDATE_INTERVAL": 3600,
    "USE_SECOND_NODE_FOR_MINFEE": false,
    "EXTERNAL_ASSETS": []
  },
```

docker-compose overrides::
```
      MEMPOOL_BACKEND_NETWORK: ""
      MEMPOOL_BACKEND: ""
      BACKEND_MAINNET_HTTP_PORT: ""
      MEMPOOL_SPAWN_CLUSTER_PROCS: ""
      MEMPOOL_API_URL_PREFIX: ""
      MEMPOOL_POLL_RATE_MS: ""
      CACHE_DIR: ""
      MEMPOOL_CLEAR_PROTECTION_MINUTES: ""
      MEMPOOL_RECOMMENDED_FEE_PERCENTILE: ""
      MEMPOOL_BLOCK_WEIGHT_UNITS: ""
      MEMPOOL_INITIAL_BLOCKS_AMOUNT: ""
      MEMPOOL_BLOCKS_AMOUNT: ""
      MEMPOOL_PRICE_FEED_UPDATE_INTERVAL: ""
      MEMPOOL_USE_SECOND_NODE_FOR_MINFEE: ""
      MEMPOOL_EXTERNAL_ASSETS: ""
```

JSON:
```
"CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 8332,
    "USERNAME": "mempool",
    "PASSWORD": "mempool"
  },
```
docker-compose overrides:
```
      RPC_HOST: ""
      RPC_PORT: ""
      RPC_USER: ""
      RPC_PASS: ""
```

JSON:
```
  "ELECTRUM": {
    "HOST": "127.0.0.1",
    "PORT": 50002,
    "TLS_ENABLED": true
  },
```

docker-compose overrides:
```
      ELECTRUM_HOST: ""
      ELECTRUM_PORT: ""
      ELECTRUM_TLS: ""
```

JSON:
```
  "ESPLORA": {
    "REST_API_URL": "http://127.0.0.1:3000"
  },
```
docker-compose overrides:
```
      ESPLORA_REST_API_URL: ""
```

JSON:
```
  "SECOND_CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 8332,
    "USERNAME": "mempool",
    "PASSWORD": "mempool"
  },
```

docker-compose overrides:
```
      SECOND_RPC_HOST: ""
      SECOND_RPC_PORT: ""
      SECOND_RPC_USER: ""
      SECOND_RPC_PASS: ""
```

JSON:
```
  "DATABASE": {
    "ENABLED": true,
    "HOST": "127.0.0.1",
    "PORT": 3306,
    "DATABASE": "mempool",
    "USERNAME": "mempool",
    "PASSWORD": "mempool"
  },
```

docker-compose overrides:
```
      MYSQL_ENABLED: ""
      MYSQL_HOST: ""
      MYSQL_PORT: ""
      MYSQL_DATABASE: ""
      MYSQL_USER: ""
      MYSQL_PASS: ""
```

JSON:
```
  "SYSLOG": {
    "ENABLED": true,
    "HOST": "127.0.0.1",
    "PORT": 514,
    "MIN_PRIORITY": "info",
    "FACILITY": "local7"
  },
```

docker-compose overrides:
```
      SYSLOG_ENABLED: ""
      SYSLOG_HOST: ""
      SYSLOG_PORT: ""
      SYSLOG_MIN_PRIORITY: ""
      SYSLOG_FACILITY: ""
```

JSON:
```
  "STATISTICS": {
    "ENABLED": true,
    "TX_PER_SECOND_SAMPLE_PERIOD": 150
  },
```

docker-compose overrides:
```
      STATISTICS_ENABLED: ""
      STATISTICS_TX_PER_SECOND_SAMPLE_PERIOD: ""
```

JSON:
```
  "BISQ": {
    "ENABLED": false,
    "DATA_PATH": "/bisq/statsnode-data/btc_mainnet/db"
  }
```

docker-compose overrides:
```
      BISQ_ENABLED: ""
      BISQ_DATA_PATH: ""
```
