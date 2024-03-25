#!/bin/sh

#backend
cp -r ./docker/backend/* ./backend/

#geoip-data
mkdir -p ./backend/GeoIP/
wget -O ./backend/GeoIP/GeoLite2-City.mmdb https://raw.githubusercontent.com/mempool/geoip-data/master/GeoLite2-City.mmdb
wget -O ./backend/GeoIP/GeoLite2-ASN.mmdb https://raw.githubusercontent.com/mempool/geoip-data/master/GeoLite2-ASN.mmdb

#frontend
localhostIP="127.0.0.1"
cp ./docker/frontend/* ./frontend
cp ./nginx.conf ./frontend/
cp ./nginx-mempool.conf ./frontend/
sed -i"" -e "s/${localhostIP}:80/0.0.0.0:__MEMPOOL_FRONTEND_HTTP_PORT__/g" ./frontend/nginx.conf
sed -i"" -e "s/${localhostIP}/0.0.0.0/g" ./frontend/nginx.conf
sed -i"" -e "s/user nobody;//g" ./frontend/nginx.conf
sed -i"" -e "s!/etc/nginx/nginx-mempool.conf!/etc/nginx/conf.d/nginx-mempool.conf!g" ./frontend/nginx.conf
sed -i"" -e "s/${localhostIP}:8999/__MEMPOOL_BACKEND_MAINNET_HTTP_HOST__:__MEMPOOL_BACKEND_MAINNET_HTTP_PORT__/g" ./frontend/nginx-mempool.conf
