bitcoin-cli
===========

The missing command line interface for bitcoind using RPC.

```
sudo npm install -g bitcoin-cli
```

# Usage

```
bitcoin-cli [args] method arguments
```

## Arguments:

* `--testnet` or `-t`: Use to default testnet port
* `--host` or `-h`: Define bitcoind host
* `--port` or `-p`: Define bitcoind port
* `--rpcuser`: Define rpc username
* `--rpcpassword`: Define rpc password

If `rpcuser` and `rpcpassword` are not defined, the client will try to get them from `~/Library/Application\ Support/Bitcoin/bitcoin.conf`.

# License

MIT
