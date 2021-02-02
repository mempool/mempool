#!/bin/sh

#backend
gitMaster="\.\.\/\.git\/refs\/heads\/master"
cp .git/refs/heads/master ./docker/backend
cp -fr ./backend/* ./docker/backend/
sed -i "s/${gitMaster}/master/g" ./docker/backend/src/api/backend-info.ts

#frontend
localhostIP="127.0.0.1"
cp -fr ./frontend/* ./docker/frontend
cp ./nginx.conf ./docker/frontend/
cp ./nginx-mempool.conf ./docker/frontend/
sed -i "s/${localhostIP}:/0.0.0.0:80/g" ./docker/frontend/nginx.conf
sed -i "s/${localhostIP}/0.0.0.0/g" ./docker/frontend/nginx.conf
sed -i "s/user nobody;//g" ./docker/frontend/nginx.conf
sed -i "s!/etc/nginx/nginx-mempool.conf!/etc/nginx/conf.d/nginx-mempool.conf!g" ./docker/frontend/nginx.conf
sed -i "s/${localhostIP}:/__MEMPOOL_BACKEND_MAINNET_HTTP_HOST__:/g" ./docker/frontend/nginx-mempool.conf

#db
cp ./mariadb-structure.sql ./docker/mysql/setup.sql
