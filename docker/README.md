# Docker Installation

This directory contains the Dockerfiles used to build and release the official images and a `docker-compose.yml` for end users to run a Mempool instance with minimal effort.

You can choose to configure Mempool to run with a basic backend powered by just `bitcoind`, or with `bitcoind` along with an Electrum-compatible server for full functionality.

## `bitcoind`-only Configuration

_Note: address lookups require an Electrum server and will not work with this configuration._

Make sure `bitcoind` is running and synced.

The default Docker configuration assumes you have added RPC credentials for a `mempool` user with a `mempool` password in your `bitcoin.conf` file, like so:

```
rpcuser=mempool
rpcpassword=mempool
```

If you want to use different credentials, specify them in the `docker-compose.yml` file:

```
  api:
    environment:
      MEMPOOL_BACKEND: "none"
      CORE_RPC_HOST: "172.27.0.1"
      CORE_RPC_PORT: "8332"
      CORE_RPC_USERNAME: "customuser"
      CORE_RPC_PASSWORD: "custompassword"
```

The IP address in the example above refers to Docker's default gateway IP address so that the container can hit the `bitcoind` instance running on the host machine. If your setup is different, update it accordingly.

Now, run:

```bash
docker-compose up
```

Your Mempool instance should be running at http://localhost. The graphs will be populated as new transactions are detected.

## `bitcoind` + Electrum Server Configuration

First, configure `bitcoind` as specified above, and make sure your Electrum server is running and synced.

Then, make sure the following variables are set in `docker-compose.yml`, as shown below, so Mempool can connect to your Electrum server:

```
  api:
    environment:
      MEMPOOL_BACKEND: "electrum"
      ELECTRUM_HOST: "172.27.0.1"
      ELECTRUM_PORT: "50002"
      ELECTRUM_TLS_ENABLED: "false"
```

Of course, if your Docker host IP address is different, update accordingly.

With `bitcoind` and Electrum Server set up, run Mempool with:

```bash
docker-compose up
```

## Further Configuration

Optionally, you can override any other backend settings from `mempool-config.json`.

Below we list all settings from `mempool-config.json` and the corresponding overrides you can make in the `api` > `environment` section of `docker-compose.yml`. 

<br/>

`mempool-config.json`:
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
    "PRICE_FEED_UPDATE_INTERVAL": 600,
    "USE_SECOND_NODE_FOR_MINFEE": false,
    "EXTERNAL_ASSETS": ["https://raw.githubusercontent.com/mempool/mining-pools/master/pools.json"],
    "STDOUT_LOG_MIN_PRIORITY": "info"
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      MEMPOOL_NETWORK: ""
      MEMPOOL_BACKEND: ""
      MEMPOOL_HTTP_PORT: ""
      MEMPOOL_SPAWN_CLUSTER_PROCS: ""
      MEMPOOL_API_URL_PREFIX: ""
      MEMPOOL_POLL_RATE_MS: ""
      MEMPOOL_CACHE_DIR: ""
      MEMPOOL_CLEAR_PROTECTION_MINUTES: ""
      MEMPOOL_RECOMMENDED_FEE_PERCENTILE: ""
      MEMPOOL_BLOCK_WEIGHT_UNITS: ""
      MEMPOOL_INITIAL_BLOCKS_AMOUNT: ""
      MEMPOOL_MEMPOOL_BLOCKS_AMOUNT: ""
      MEMPOOL_PRICE_FEED_UPDATE_INTERVAL: ""
      MEMPOOL_USE_SECOND_NODE_FOR_MINFEE: ""
      MEMPOOL_EXTERNAL_ASSETS: ""
      MEMPOOL_STDOUT_LOG_MIN_PRIORITY: ""
      ...
```

<br/>

`mempool-config.json`:
```
"CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 8332,
    "USERNAME": "mempool",
    "PASSWORD": "mempool"
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      CORE_RPC_HOST: ""
      CORE_RPC_PORT: ""
      CORE_RPC_USERNAME: ""
      CORE_RPC_PASSWORD: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "ELECTRUM": {
    "HOST": "127.0.0.1",
    "PORT": 50002,
    "TLS_ENABLED": true
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      ELECTRUM_HOST: ""
      ELECTRUM_PORT: ""
      ELECTRUM_TLS: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "ESPLORA": {
    "REST_API_URL": "http://127.0.0.1:3000"
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      ESPLORA_REST_API_URL: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "SECOND_CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 8332,
    "USERNAME": "mempool",
    "PASSWORD": "mempool"
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      SECOND_CORE_RPC_HOST: ""
      SECOND_CORE_RPC_PORT: ""
      SECOND_CORE_RPC_USERNAME: ""
      SECOND_CORE_RPC_PASSWORD: ""
      ...
```

<br/>

`mempool-config.json`:
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

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      DATABASE_ENABLED: ""
      DATABASE_HOST: ""
      DATABASE_PORT: ""
      DATABASE_DATABASE: ""
      DATABASE_USERAME: ""
      DATABASE_PASSWORD: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "SYSLOG": {
    "ENABLED": true,
    "HOST": "127.0.0.1",
    "PORT": 514,
    "MIN_PRIORITY": "info",
    "FACILITY": "local7"
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      SYSLOG_ENABLED: ""
      SYSLOG_HOST: ""
      SYSLOG_PORT: ""
      SYSLOG_MIN_PRIORITY: ""
      SYSLOG_FACILITY: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "STATISTICS": {
    "ENABLED": true,
    "TX_PER_SECOND_SAMPLE_PERIOD": 150
  },
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      STATISTICS_ENABLED: ""
      STATISTICS_TX_PER_SECOND_SAMPLE_PERIOD: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "BISQ": {
    "ENABLED": false,
    "DATA_PATH": "/bisq/statsnode-data/btc_mainnet/db"
  }
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      BISQ_ENABLED: ""
      BISQ_DATA_PATH: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "SOCKS5PROXY": {
    "ENABLED": false,
    "HOST": "127.0.0.1",
    "PORT": "9050",
    "USERNAME": "",
    "PASSWORD": ""
  }
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      SOCKS5PROXY_ENABLED: ""
      SOCKS5PROXY_HOST: ""
      SOCKS5PROXY_PORT: ""
      SOCKS5PROXY_USERNAME: ""
      SOCKS5PROXY_PASSWORD: ""
      ...
```

<br/>

`mempool-config.json`:
```
  "PRICE_DATA_SERVER": {
    "TOR_URL": "http://wizpriceje6q5tdrxkyiazsgu7irquiqjy2dptezqhrtu7l2qelqktid.onion/getAllMarketPrices",
    "CLEARNET_URL": "https://price.bisq.wiz.biz/getAllMarketPrices"
  }
```

Corresponding `docker-compose.yml` overrides:
```
  api:
    environment:
      PRICE_DATA_SERVER_TOR_URL: ""
      PRICE_DATA_SERVER_CLEARNET_URL: ""
      ...
```
