#!/bin/sh

RPC_HOST=$RPC_HOST
RPC_PORT=$RPC_PORT
RPC_USER=$RPC_USER
RPC_PASS=$RPC_PASS
ELECTRS_HOST=$ELECTRS_HOST
ELECTRS_PORT=$ELECTRS_PORT
MYSQL_HOST=$MYSQL_HOST
CACHE_DIR=$CACHE_DIR

sed -i "s/<RPC_HOST>/${RPC_HOST}/g" mempool-config.json
sed -i "s/<RPC_PORT>/${RPC_PORT}/g" mempool-config.json
sed -i "s/<RPC_USER>/${RPC_USER}/g" mempool-config.json
sed -i "s/<RPC_PASS>/${RPC_PASS}/g" mempool-config.json
sed -i "s/<ELECTRS_HOST>/${ELECTRS_HOST}/g" mempool-config.json
sed -i "s/<ELECTRS_PORT>/${ELECTRS_PORT}/g" mempool-config.json
sed -i "s/<MYSQL_HOST>/${MYSQL_HOST}/g" mempool-config.json
sed -i "s/<CACHE_DIR>/${CACHE_DIR}/g" mempool-config.json

node /backend/dist/index.js
