FROM mariadb:10.5.8

WORKDIR /db
COPY . .

COPY setup.sql /docker-entrypoint-initdb.d/
COPY mysql-mempool.cnf /etc/mysql/conf.d/
