# Docker

## Initialization

In an empty dir create 2 sub-dirs

```bash
mkdir -p data mysql/data mysql/db-scripts
```

In the `mysql/db-scripts` sub-dir add the `mariadb-structure.sql` file from the mempool repo

Your dir should now look like that:

```bash
$ls -R
.:
data mysql

./data:

./mysql:
data  db-scripts

./mysql/data:

./mysql/db-scripts:
mariadb-structure.sql
```

In the main dir add the following `docker-compose.yml`

```bash
version: "3.7"

services:
  web:
    image: mempool/frontend:latest
    user: "1000:1000"
    restart: on-failure
    stop_grace_period: 1m
    command: "./wait-for db:3306 --timeout=720 -- nginx -g 'daemon off;'"
    ports:
      - 80:8080
    environment:
      FRONTEND_HTTP_PORT: "8080"
      BACKEND_MAINNET_HTTP_HOST: "api"
  api:
    image: mempool/backend:latest
    user: "1000:1000"
    restart: on-failure
    stop_grace_period: 1m
    command: "./wait-for-it.sh db:3306 --timeout=720 --strict -- ./start.sh"
    volumes:
      - ./data:/backend/cache
    environment:
      RPC_HOST: "127.0.0.1"
      RPC_PORT: "8332"
      RPC_USER: "mempool"
      RPC_PASS: "mempool"
      ELECTRUM_HOST: "127.0.0.1"
      ELECTRUM_PORT: "50002"
      ELECTRUM_TLS: "false"
      MYSQL_HOST: "db"
      MYSQL_PORT: "3306"
      MYSQL_DATABASE: "mempool"
      MYSQL_USER: "mempool"
      MYSQL_PASS: "mempool"
      BACKEND_MAINNET_HTTP_PORT: "8999"
      CACHE_DIR: "/backend/cache"
      MEMPOOL_CLEAR_PROTECTION_MINUTES: "20"
  db:
    image: mariadb:10.5.8
    user: "1000:1000"
    restart: on-failure
    stop_grace_period: 1m
    volumes:
      - ./mysql/data:/var/lib/mysql
      - ./mysql/db-scripts:/docker-entrypoint-initdb.d
    environment:
      MYSQL_DATABASE: "mempool"
      MYSQL_USER: "mempool"
      MYSQL_PASSWORD: "mempool"
      MYSQL_ROOT_PASSWORD: "admin"

```

You can update all the environment variables inside the API container, especially the RPC and ELECTRUM ones

## Run it

To run our docker-compose use the following cmd:

```bash
docker-compose up
```

If everything went okay you should see the beautiful mempool :grin:

If you get stuck on "loading blocks", this means the websocket can't connect.
Check your nginx proxy setup, firewalls, etc. and open an issue if you need help.
