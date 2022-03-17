# The Mempool Open Source Project™ [![mempool](https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/ry4br7/master&style=flat-square)](https://dashboard.cypress.io/projects/ry4br7/runs)

Mempool is the fully featured visualizer, explorer, and API service running on [mempool.space](https://mempool.space/), an open source project developed and operated for the benefit of the Bitcoin community, with a focus on the emerging transaction fee market to help our transition into a multi-layer ecosystem.

![mempool](https://mempool.space/resources/screenshots/v2.3.0-dashboard.png)

## Installation Methods

Mempool can be self-hosted on a wide variety of your own hardware, ranging from a simple one-click installation on a Raspberry Pi distro, all the way to an advanced high availability cluster of powerful servers for a production instance. We support the following installation methods, ranked in order from simple to advanced:

1) One-click installation on: [Umbrel](https://github.com/getumbrel/umbrel), [RaspiBlitz](https://github.com/rootzoll/raspiblitz), [RoninDojo](https://code.samourai.io/ronindojo/RoninDojo), or [MyNode](https://github.com/mynodebtc/mynode).
2) [Docker installation on Linux using docker-compose](https://github.com/mempool/mempool/tree/master/docker)
3) [Manual installation on Linux or FreeBSD](https://github.com/mempool/mempool#manual-installation)
4) [Production installation on a powerful FreeBSD server](https://github.com/mempool/mempool/tree/master/production)
5) [High Availability cluster using powerful FreeBSD servers](https://github.com/mempool/mempool/tree/master/production#high-availability)

# Docker Installation

The `docker` directory contains the Dockerfiles used to build and release the official images and a `docker-compose.yml` file that is intended for end users to run a Mempool instance with minimal effort.

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

## bitcoind+electrum configuration

In order to run with a `electrum` compatible server as the backend, in addition to the settings required for running with `bitcoind` above, you will need to make the following changes to the `docker-compose.yml` file:

- Under the `api` service, change the value of the `MEMPOOL_BACKEND` key from `none` to `electrum`:

```
  api:
    environment:
      MEMPOOL_BACKEND: "none"
```

- Under the `api` service, set the `ELECTRUM_HOST` and `ELECTRUM_PORT` keys to your Docker host IP address and set `ELECTRUM_TLS_ENABLED` to `false`:

```
  api:
    environment:
      ELECTRUM_HOST: "172.27.0.1"
      ELECTRUM_PORT: "50002"
      ELECTRUM_TLS_ENABLED: "false"
```

You can update any of the backend settings in the `mempool-config.json` file using the following environment variables to override them under the same `api` `environment` section.

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
    "PRICE_FEED_UPDATE_INTERVAL": 600,
    "USE_SECOND_NODE_FOR_MINFEE": false,
    "EXTERNAL_ASSETS": ["https://raw.githubusercontent.com/mempool/mining-pools/master/pools.json"],
    "STDOUT_LOG_MIN_PRIORITY": "info"
  },
```

docker-compose overrides:
```
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
      CORE_RPC_HOST: ""
      CORE_RPC_PORT: ""
      CORE_RPC_USERNAME: ""
      CORE_RPC_PASSWORD: ""
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
      SECOND_CORE_RPC_HOST: ""
      SECOND_CORE_RPC_PORT: ""
      SECOND_CORE_RPC_USERNAME: ""
      SECOND_CORE_RPC_PASSWORD: ""
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
      DATABASE_ENABLED: ""
      DATABASE_HOST: ""
      DATABASE_PORT: ""
      DATABASE_DATABASE: ""
      DATABASE_USERAME: ""
      DATABASE_PASSWORD: ""
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

JSON:
```
  "SOCKS5PROXY": {
    "ENABLED": false,
    "HOST": "127.0.0.1",
    "PORT": "9050",
    "USERNAME": "",
    "PASSWORD": ""
  }
```

docker-compose overrides:
```
      SOCKS5PROXY_ENABLED: ""
      SOCKS5PROXY_HOST: ""
      SOCKS5PROXY_PORT: ""
      SOCKS5PROXY_USERNAME: ""
      SOCKS5PROXY_PASSWORD: ""
```

JSON:
```
  "PRICE_DATA_SERVER": {
    "TOR_URL": "http://wizpriceje6q5tdrxkyiazsgu7irquiqjy2dptezqhrtu7l2qelqktid.onion/getAllMarketPrices",
    "CLEARNET_URL": "https://price.bisq.wiz.biz/getAllMarketPrices"
  }
```

docker-compose overrides:
```
      PRICE_DATA_SERVER_TOR_URL: ""
      PRICE_DATA_SERVER_CLEARNET_URL: ""
```

# Manual Installation

The following instructions are for a manual installation on Linux or FreeBSD. The file and directory paths may need to be changed to match your OS.

## Dependencies

* [Bitcoin](https://github.com/bitcoin/bitcoin)
* [Electrum](https://github.com/romanz/electrs)
* [NodeJS](https://github.com/nodejs/node)
* [MariaDB](https://github.com/mariadb/server)
* [Nginx](https://github.com/nginx/nginx)

## Mempool

Clone the mempool repo, and checkout the latest release tag:
```bash
  git clone https://github.com/mempool/mempool
  cd mempool
  latestrelease=$(curl -s https://api.github.com/repos/mempool/mempool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
  git checkout $latestrelease
```

## Bitcoin Core (bitcoind)

Enable RPC and txindex in `bitcoin.conf`:
```bash
  rpcuser=mempool
  rpcpassword=mempool
  txindex=1
```

## MySQL

Install MariaDB from OS package manager:
```bash
  # Linux
  apt-get install mariadb-server mariadb-client

  # macOS
  brew install mariadb
  mysql.server start
```

Create database and grant privileges:
```bash
  MariaDB [(none)]> drop database mempool;
  Query OK, 0 rows affected (0.00 sec)

  MariaDB [(none)]> create database mempool;
  Query OK, 1 row affected (0.00 sec)

  MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
  Query OK, 0 rows affected (0.00 sec)
```

## Mempool Backend
Install mempool dependencies from npm and build the backend:

```bash
  # backend
  cd backend
  npm install --prod
  npm run build
```

In the `backend` folder, make a copy of the sample config and modify it to fit your settings.

```bash
  cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` to add your Bitcoin Core node RPC credentials:
```bash
{
  "MEMPOOL": {
    "NETWORK": "mainnet",
    "BACKEND": "electrum",
    "HTTP_PORT": 8999
  },
  "CORE_RPC": {
    "HOST": "127.0.0.1",
    "PORT": 8332,
    "USERNAME": "mempool",
    "PASSWORD": "mempool"
  },
  "ELECTRUM": {
    "HOST": "127.0.0.1",
    "PORT": 50002,
    "TLS_ENABLED": true
  },
  "DATABASE": {
    "ENABLED": true,
    "HOST": "127.0.0.1",
    "PORT": 3306,
    "USERNAME": "mempool",
    "PASSWORD": "mempool",
    "DATABASE": "mempool"
  }
}
```

Start the backend:

```bash
  npm run start
```

When it's running you should see output like this:

```bash
  Mempool updated in 0.189 seconds
  Updating mempool
  Mempool updated in 0.096 seconds
  Updating mempool
  Mempool updated in 0.099 seconds
  Updating mempool
  Calculated fee for transaction 1 / 10
  Calculated fee for transaction 2 / 10
  Calculated fee for transaction 3 / 10
  Calculated fee for transaction 4 / 10
  Calculated fee for transaction 5 / 10
  Calculated fee for transaction 6 / 10
  Calculated fee for transaction 7 / 10
  Calculated fee for transaction 8 / 10
  Calculated fee for transaction 9 / 10
  Calculated fee for transaction 10 / 10
  Mempool updated in 0.243 seconds
  Updating mempool
```

## Mempool Frontend

Install mempool dependencies from npm and build the frontend static HTML/CSS/JS:

```bash
  # frontend
  cd frontend
  npm install --prod
  npm run build
```

Install the output into nginx webroot folder:

```bash
  sudo rsync -av --delete dist/ /var/www/
```

## nginx + certbot

Install the supplied nginx.conf and nginx-mempool.conf in /etc/nginx

```bash
  # install nginx and certbot
  apt-get install -y nginx python3-certbot-nginx

  # install the mempool configuration for nginx
  cp nginx.conf nginx-mempool.conf /etc/nginx/

  # replace example.com with your domain name
  certbot --nginx -d example.com

```

If everything went okay you should see the beautiful mempool :grin:

If you get stuck on "loading blocks", this means the websocket can't connect.
Check your nginx proxy setup, firewalls, etc. and open an issue if you need help.
