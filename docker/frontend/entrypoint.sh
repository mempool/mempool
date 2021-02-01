#!/bin/sh
API_IP=$API_IP

sed -i "s/<API_IP>/${API_IP}/g" /etc/nginx/conf.d/nginx-mempool.conf

exec "$@"
