# The Mempool Open Source Project™ [![mempool](https://img.shields.io/endpoint?url=https://dashboard.cypress.io/badge/simple/ry4br7/master&style=flat-square)](https://dashboard.cypress.io/projects/ry4br7/runs)

Mempool is the fully-featured mempool visualizer, explorer, and API service running at [mempool.space](https://mempool.space/). 

![mempool](https://mempool.space/resources/screenshots/v2.4.0-dashboard.png)

# Installation Methods

Mempool can be self-hosted on a wide variety of your own hardware, ranging from a simple one-click installation on a Raspberry Pi full-node distro all the way to a robust production instance on a powerful FreeBSD server. 

We support the following installation methods, ranked in order from simple to advanced:

1) [One-click installation on full-node distros](#one-click-installation)
2) [Docker installation on Linux using docker-compose](./docker)
3) [Manual installation on Linux or FreeBSD](#manual-installation)
4) [Production installation on a powerful FreeBSD server](./production)

This doc offers install notes on the one-click method and manual install method. Follow the links above for install notes on Docker and production installations.

<a id="one-click-installation"></a>
## One-Click Installation

Mempool can be conveniently installed on the following full-node distros: 
- [Umbrel](https://github.com/getumbrel/umbrel)
- [RaspiBlitz](https://github.com/rootzoll/raspiblitz)
- [RoninDojo](https://code.samourai.io/ronindojo/RoninDojo)
- [myNode](https://github.com/mynodebtc/mynode)
- [Start9](https://github.com/Start9Labs/embassy-os)

<a id="manual-installation"></a>
## Manual Installation

The following instructions are for a manual installation on Linux or FreeBSD. You may need to change file and directory paths to match your OS.

You will need [Bitcoin Core](https://github.com/bitcoin/bitcoin), [Electrum Server](https://github.com/romanz/electrs), [Node.js](https://github.com/nodejs/node), [MariaDB](https://github.com/mariadb/server), and [Nginx](https://github.com/nginx/nginx). Below, we walk through how to configure each of these.

### 1. Get Latest Mempool Release

Clone the Mempool repo, and checkout the latest release tag:

```bash
$ git clone https://github.com/mempool/mempool
$ cd mempool
$ latestrelease=$(curl -s https://api.github.com/repos/mempool/mempool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
$ git checkout $latestrelease
```

### 2. Configure Bitcoin Core

Enable RPC and txindex in `bitcoin.conf`:

```bash
rpcuser=mempool
rpcpassword=mempool
txindex=1
```

### 3. Get & Configure MySQL

Install MariaDB from your OS package manager:

```bash
# Debian, Ubuntu, etc.
$ apt-get install mariadb-server mariadb-client

# macOS
$ brew install mariadb
$ mysql.server start
```

Create a database and grant privileges:

```bash
MariaDB [(none)]> drop database mempool;
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> create database mempool;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
Query OK, 0 rows affected (0.00 sec)
```

### 4. Build Mempool Backend

Install Mempool dependencies with npm and build the backend:

```bash
$ cd backend
$ npm install --prod
$ npm run build
```

In the `backend` folder, make a copy of the sample config:

```bash
$ cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` with your Bitcoin Core node RPC credentials:

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
$ npm run start
```

When it's running, you should see output like this:

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

### 5. Build Mempool Frontend

Install the Mempool dependencies with npm and build the frontend:

```bash
$ cd frontend
$ npm install --prod
$ npm run build
```

Install the output into the nginx webroot folder:

```bash
$ sudo rsync -av --delete dist/ /var/www/
```

### 6. `nginx` + `certbot`

Install the supplied `nginx.conf` and `nginx-mempool.conf` in `/etc/nginx`:

```bash
# install nginx and certbot
$ apt-get install -y nginx python3-certbot-nginx

# install the mempool configuration for nginx
$ cp nginx.conf nginx-mempool.conf /etc/nginx/

# replace example.com with your domain name
$ certbot --nginx -d example.com
```

If everything went well, you should see the beautiful mempool :grin:

If you get stuck on "loading blocks", this means the websocket can't connect. Check your nginx proxy setup, firewalls, etc. and open an issue if you need help.
