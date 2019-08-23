# mempool.space
🚨This is beta software, and may have issues!🚨  
Please help us test and report bugs to our GitHub issue tracker.

Mempool visualizer for the Bitcoin blockchain. Live demo: https://mempool.space/
![blockchain](https://pbs.twimg.com/media/EAETXWAU8AAj4IP?format=jpg&name=4096x4096)
![mempool](https://pbs.twimg.com/media/EAETXWCU4AAv2v-?format=jpg&name=4096x4096)

## deps

* Bitcoin (full node required, no pruning, txindex=1)
* NodeJS (official stable LTS)
* MySQL or MariaDB (default config)
* Nginx (use supplied nginx.conf)

## nodejs

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

## bitcoind

Enable RPC and txindex in bitcoin.conf
```
rpcuser=mempool
rpcpassword=71b61986da5b03a5694d7c7d5165ece5
txindex=1
```

## mempool config
Make a copy of the sample config and edit it
```
cp mempool-config.sample.json mempool-config.json
```

Edit mempool-config.json to add your Bitcoin node RPC credentials:
```
  "BITCOIN_NODE_HOST": "192.168.1.5",
  "BITCOIN_NODE_PORT": 8332,
  "BITCOIN_NODE_USER": "mempool",
  "BITCOIN_NODE_PASS": "71b61986da5b03a5694d7c7d5165ece5",
```

## mysql

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

## mempool backend

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

You need to wait for 8 blocks to be mined, so please wait ~80 minutes.
The backend also needs to index transactions, calculate fees, etc.
When it's ready you will see output like this:

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

## nginx + certbot (let's encrypt)
Setup nginx using the supplied nginx.conf, replacing example.com with your domain name.
```
apt-get install -y nginx python-certbot-nginx
cp nginx.conf /etc/nginx/nginx.conf
certbot -d example.com # replace with your domain name
```
Make sure you can access https://example.com/ in browser before proceeding


## mempool frontend

Build the frontend static HTML/CSS/JS, rsync the output into nginx folder:

```
cd frontend/
npm run build
sudo rsync -av --delete dist/mempool/ /var/www/html/
```

## try it out

If everything went okay you should see the beautiful mempool :grin:

If you get stuck on "loading blocks", this means the websocket can't connect.
Check your nginx proxy setup, firewalls, etc. and open an issue if you need help.
