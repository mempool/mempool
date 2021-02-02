#!/bin/sh
__MEMPOOL_BACKEND_MAINNET_HTTP_HOST__=${BACKEND_MAINNET_HTTP_HOST}

sed -i "s/__MEMPOOL_BACKEND_MAINNET_HTTP_HOST__/${__MEMPOOL_BACKEND_MAINNET_HTTP_HOST__}/g" /etc/nginx/conf.d/nginx-mempool.conf

exec "$@"
