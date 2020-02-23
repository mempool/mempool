#!/bin/sh
mysqld_safe&
sleep 5
nginx
cd /mempool.space/backend 
rm -f mempool-config.json
rm -f cache.json
touch cache.json
jq -n env > mempool-config.json
node dist/index.js
