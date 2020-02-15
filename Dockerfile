FROM alpine:latest

RUN mkdir /mempool.space/
COPY ./backend /mempool.space/backend/
COPY ./frontend /mempool.space/frontend/
COPY ./mariadb-structure.sql /mempool.space/mariadb-structure.sql

RUN apk add mariadb mariadb-client git nginx npm rsync bash

RUN mysql_install_db --user=mysql --datadir=/var/lib/mysql/
RUN /usr/bin/mysqld_safe --datadir='/var/lib/mysql/'& \
    sleep 60 && \
    mysql -e "create database mempool" && \
    mysql -e "grant all privileges on mempool.* to 'mempool'@'localhost' identified by 'mempool'" && \
    mysql mempool < /mempool.space/mariadb-structure.sql
RUN sed -i "/^skip-networking/ c#skip-networking" /etc/my.cnf.d/mariadb-server.cnf

RUN export NG_CLI_ANALYTICS=ci && \
    npm install -g typescript && \
    cd /mempool.space/frontend && \
    npm install && \
    cd /mempool.space/backend && \
    npm install && \
    tsc

COPY ./nginx-nossl-docker.conf /etc/nginx/nginx.conf
    
ENV ENV dev
ENV DB_HOST localhost
ENV DB_PORT 3306
ENV DB_USER mempool
ENV DB_PASSWORD mempool
ENV DB_DATABASE mempool
ENV API_ENDPOINT /api/v1/
ENV CHAT_SSL_ENABLED false
ENV MEMPOOL_REFRESH_RATE_MS 500
ENV INITIAL_BLOCK_AMOUNT 8
ENV DEFAULT_PROJECTED_BLOCKS_AMOUNT 3
ENV KEEP_BLOCK_AMOUNT 24
ENV BITCOIN_NODE_HOST bitcoinhost
ENV BITCOIN_NODE_PORT 8332
ENV BITCOIN_NODE_USER bitcoinuser
ENV BITCOIN_NODE_PASS bitcoinpass
ENV TX_PER_SECOND_SPAN_SECONDS 150

RUN cd /mempool.space/frontend/ && \
    npm run build && \
    rsync -av --delete dist/mempool/ /var/www/html/

EXPOSE 80

COPY ./entrypoint.sh /mempool.space/entrypoint.sh
RUN chmod +x /mempool.space/entrypoint.sh
WORKDIR /mempool.space
CMD ["/mempool.space/entrypoint.sh"]
