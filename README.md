# mempool.space
Mempool visualizer for the Bitcoin blockchain. Live demo: https://mempool.space/
![blockchain](https://pbs.twimg.com/media/EAETXWAU8AAj4IP?format=jpg&name=4096x4096)
![mempool](https://pbs.twimg.com/media/EAETXWCU4AAv2v-?format=jpg&name=4096x4096)

## Prerequisites

* Bitcoin (full node required, no pruning)
* NodeJS (official stable LTS)
* MariaDB (default config)
* Nginx (use supplied nginx.conf)

## NodeJS setup

Install dependencies and build code:
```
cd mempool.space
npm install -g typescript
cd frontend
npm install
cd ../backend/
npm install
tsc
```

## Bitcoin Setup

Enable RPC and txindex in bitcoin.conf
```
rpcuser=mempool
rpcpassword=71b61986da5b03a5694d7c7d5165ece5
txindex=1
```

Edit mempool-config.json for your Bitcoin:
```
  "BITCOIN_NODE_HOST": "192.168.1.5",
  "BITCOIN_NODE_PORT": 8332,
  "BITCOIN_NODE_USER": "mempool",
  "BITCOIN_NODE_PASS": "71b61986da5b03a5694d7c7d5165ece5",
```

## Database Setup

Install MariaDB:
```
apt-get install mariadb-server mariadb-client
```

Create database and grant privileges:
```
MariaDB [(none)]> drop database mempool;
Query OK, 0 rows affected (0.00 sec)

MariaDB [(none)]> create database mempool;
Query OK, 1 row affected (0.00 sec)

MariaDB [(none)]> grant all privileges on mempool.* to 'mempool' identified by 'mempool';
Query OK, 0 rows affected (0.00 sec)
```

Initialize database structure:
```
mysql -u mempool -p mempool < mariadb-structure.sql
```

Edit mempool-config.json for your MariaDB:

```
  "DB_HOST": "127.0.0.1",
  "DB_PORT": 3306,
  "DB_USER": "mempool",
  "DB_PASSWORD": "mempool",
  "DB_DATABASE": "mempool",
```

## Start backend

Create an initial empty cache and start the app:
```
touch cache.json
node dist/index.js
```

After starting you should see:
```
Server started on port 8999 :)
New block found (#586498)! 0 of 1986 found in mempool. 1985 not found.
New block found (#586499)! 0 of 1094 found in mempool. 1093 not found.
New block found (#586500)! 0 of 2735 found in mempool. 2734 not found.
New block found (#586501)! 0 of 2675 found in mempool. 2674 not found.
New block found (#586502)! 0 of 975 found in mempool. 974 not found.
New block found (#586503)! 0 of 2130 found in mempool. 2129 not found.
New block found (#586504)! 0 of 2770 found in mempool. 2769 not found.
New block found (#586505)! 0 of 2759 found in mempool. 2758 not found.
Updating mempool
Calculated fee for transaction 1 / 3257
Calculated fee for transaction 2 / 3257
Calculated fee for transaction 3 / 3257
Calculated fee for transaction 4 / 3257
Calculated fee for transaction 5 / 3257
Calculated fee for transaction 6 / 3257
Calculated fee for transaction 7 / 3257
Calculated fee for transaction 8 / 3257
Calculated fee for transaction 9 / 3257
```

Now go make coffee for like 10 minutes while the backend indexes transactions, fees, etc. and builds the initial cache. When it's ready you will see output like this:

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

## Start frontend

Then in another terminal:

```
cd ../frontend/
npm run build
```

Start nginx using the supplied nginx.conf and copy the resulting dist/ into /var/www/html

## Open Browser

```
firefox http://127.0.0.1:4200/
```

And if everything went okay you should see beautiful mempool :grin:

