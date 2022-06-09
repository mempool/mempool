# Mempool Backend

These instructions are mostly intended for developers, but can be used as a basis for personal or small-scale production setups. 

If you choose to use these instructions for a production setup, be aware that you will still probably need to do additional configuration for your specific OS, environment, use-case, etc. We do our best here to provide a good starting point, but only proceed if you know what you're doing. Mempool does not provide support for custom setups.

See other ways to set up Mempool on [the main README](/../../#installation-methods).

Jump to a section in this doc:
- [Set Up the Backend](#setup)
- [Development Tips](#development-tips)

## Setup

### 1. Clone Mempool Repository

Get the latest Mempool code:

```
git clone https://github.com/mempool/mempool
cd mempool
```

Check out the latest release:

```
latestrelease=$(curl -s https://api.github.com/repos/mempool/mempool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
```

### 2. Configure Bitcoin Core

Turn on `txindex`, enable RPC, and set RPC credentials in `bitcoin.conf`:

```
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

### 3. Configure Electrum Server

[Pick an Electrum Server implementation](https://mempool.space/docs/faq#address-lookup-issues), configure it, and make sure it's synced.

**This step is optional.** You can run Mempool without configuring an Electrum Server for it, but address lookups will be disabled.

### 4. Configure MariaDB

_Mempool needs MariaDB v10.5 or later. If you already have MySQL installed, make sure to migrate any existing databases **before** installing MariaDB._

Get MariaDB from your operating system's package manager:

```
# Debian, Ubuntu, etc.
apt-get install mariadb-server mariadb-client

# macOS
brew install mariadb
mysql.server start
```

Create a database and grant privileges:

```
MariaDB [(none)]> drop database mempool;
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> create database mempool;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on mempool.* to 'mempool'@'%' identified by 'mempool';
Query OK, 0 rows affected (0.00 sec)
```

### 5. Prepare Mempool Backend

#### Build

_Make sure to use Node.js 16.10 and npm 7._

Install dependencies with `npm` and build the backend:

```
cd backend
npm install
npm run build
```

#### Configure

In the backend folder, make a copy of the sample config file:

```
cp mempool-config.sample.json mempool-config.json
```

Edit `mempool-config.json` as needed. 

In particular, make sure:
- the correct Bitcoin Core RPC credentials are specified in `CORE_RPC`
- the correct `BACKEND` is specified in `MEMPOOL`:
  - "electrum" if you're using [romanz/electrs](https://github.com/romanz/electrs) or [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
  - "esplora" if you're using [Blockstream/electrs](https://github.com/Blockstream/electrs)
  - "none" if you're not using any Electrum Server

### 6. Run Mempool Backend

Run the Mempool backend:

```
npm run start
```

When it's running, you should see output like this:

```
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

### 7. Set Up Mempool Frontend
With the backend configured and running, proceed to set up the [Mempool frontend](../frontend#manual-setup).

## Development Tips

### Set Up Backend Watchers

The Mempool backend is static. TypeScript scripts are compiled into the `dist` folder and served through a Node.js web server. 

As a result, for development purposes, you may find it helpful to set up backend watchers to avoid the manual shutdown/recompile/restart command-line cycle.

First, install `nodemon` and `ts-node`:

```
npm install -g ts-node nodemon
```

Then, run the watcher:

```
nodemon src/index.ts --ignore cache/ --ignore pools.json
```

`nodemon` should be in npm's global binary folder. If needed, you can determine where that is with `npm -g bin`.
