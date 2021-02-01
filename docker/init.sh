#!/bin/sh

#backend
gitMaster="\.\.\/\.git\/refs\/heads\/master"
cp .git/refs/heads/master ./backend
cp ./docker/backend/* ./backend/
sed -i "s/${gitMaster}/master/g" ./backend/src/api/backend-info.ts

#frontend
localIP="127.0.0.1"
cp ./docker/frontend/* ./frontend
cp ./nginx.conf ./frontend/
cp ./nginx-mempool.conf ./frontend/
sed -i "s/${localIP}:/0.0.0.0:80/g" ./frontend/nginx.conf
sed -i "s/${localIP}/0.0.0.0/g" ./frontend/nginx.conf
sed -i "s/user nobody;//g" ./frontend/nginx.conf
sed -i "s/\/etc\/nginx\/nginx-mempool.conf/\/etc\/nginx\/conf.d\/nginx-mempool.conf/g" ./frontend/nginx.conf
sed -i "s/${localIP}:/<API_IP>:/g" ./frontend/nginx-mempool.conf

#db
cp -fr docker/mysql .
cp ./mariadb-structure.sql ./mysql/setup.sql
