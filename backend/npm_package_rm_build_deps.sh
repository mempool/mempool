#/bin/sh
set -e

# Cleaning up inside the node_modules folder
cd package/node_modules
rm -rf \
  typescript \
  @typescript-eslint \
  @napi-rs
