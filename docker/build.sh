#!/bin/sh

VERSION=$(cat mempool-version)

cd mempool

cd ./backend
docker buildx build --platform linux/amd64,linux/arm64 -t $1/mempool-backend:$2 --push .

cd ../frontend
docker buildx build --platform linux/amd64,linux/arm64 -t $1/mempool-frontend:$2 --push .

cd ../mysql
docker buildx build --platform linux/amd64,linux/arm64 -t $1/mempool-db:$2 --push .
