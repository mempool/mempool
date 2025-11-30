# Docker Installation

This directory contains the Dockerfiles used to build and release the official images, as well as a `docker-compose.yml` to orchestrate them, and an `.env` file to customize the configuration.

If you are looking to use these Docker images to deploy your own instance of Mempool, note that they only containerize Mempool's frontend and backend. You will still need to deploy and configure Bitcoin Core and an Electrum Server separately, along with any other utilities specific to your use case (e.g., a reverse proxy, etc). Such configuration is mostly beyond the scope of the Mempool project, so please only proceed if you know what you're doing.

See a video guide of this installation method by k3tan [on BitcoinTV.com](https://bitcointv.com/w/8fpAx6rf5CQ16mMhospwjg).

Jump to a section in this doc:
- [Configure with Bitcoin Core Only](#configure-with-bitcoin-core-only)
- [Configure with Bitcoin Core + Electrum Server](#configure-with-bitcoin-core--electrum-server)
- [Further Configuration](#further-configuration)

## Configure with Bitcoin Core Only

_Note: address lookups require an Electrum Server and will not work with this configuration. [Add an Electrum Server](#configure-with-bitcoin-core--electrum-server) to your backend for full functionality._

The default Docker configuration assumes you have the following configuration in your `bitcoin.conf` file:

```ini
txindex=1
server=1
rpcuser=mempool
rpcpassword=mempool
```

If you want to use different credentials, specify them in the `api.env` file:

```
CORE_RPC_HOST=127.27.0.1
CORE_RPC_PORT=8332
CORE_RPC_USERNAME=customuser
CORE_RPC_PASSWORD=custompassword
CORE_RPC_TIMEOUT=60000
```

The IP address in the example above refers to Docker's default gateway IP address so that the container can hit the `bitcoind` instance running on the host machine. If your setup is different, update it accordingly.

Make sure `bitcoind` is running and synced.

Now, run:

```bash
docker-compose up
```

Your Mempool instance should be running at http://localhost. The graphs will be populated as new transactions are detected.

## Configure with Bitcoin Core + Electrum Server

First, configure `bitcoind` as specified above, and make sure your Electrum Server is running and synced. See [this FAQ](https://mempool.space/docs/faq#address-lookup-issues) if you need help picking an Electrum Server implementation.

Then, set the following variables in `api.env` so Mempool can connect to your Electrum Server:

```.env
MEMPOOL_BACKEND=electrum
ELECTRUM_HOST=172.27.0.1
ELECTRUM_PORT=50002
ELECTRUM_TLS_ENABLED=false
```

Eligible values for `MEMPOOL_BACKEND`:
  - "electrum" if you're using [romanz/electrs](https://github.com/romanz/electrs) or [cculianu/Fulcrum](https://github.com/cculianu/Fulcrum)
  - "esplora" if you're using [Blockstream/electrs](https://github.com/Blockstream/electrs)
  - "none" if you're not using any Electrum Server

Of course, if your Docker host IP address is different, update accordingly.

With `bitcoind` and Electrum Server set up, run Mempool with:

```bash
docker-compose up
```

## Further Configuration

Optionally, you can override any other backend settings from `mempool-config.json` by editing the corresponding variables in the `api.env` file.