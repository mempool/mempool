#/bin/sh
set -e

# Cleaning up inside the node_modules folder
cd package/node_modules
rm -r \
  typescript \
  @typescript-eslint \
  @napi-rs \
  ./rust-gbt/src \
  ./rust-gbt/Cargo.toml \
  ./rust-gbt/build.rs
