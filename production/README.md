# Deploying an Enterprise Production Instance

These instructions are for setting up a serious production Mempool website for Bitcoin (mainnet, testnet, signet), Liquid (mainnet, testnet), and Bisq.

Again, this setup is no joke—home users should use [one of the other installation methods](../#installation-methods).

### Server Hardware

Mempool v2 is powered by [blockstream/electrs](https://github.com/Blockstream/electrs), which is a beast. 

I recommend a beefy server:

* 20-core CPU (more is better)
* 64GB RAM (more is better)
* 4TB SSD (NVMe is better)

### HDD vs SSD vs NVMe

If you don't have a fast SSD or NVMe-backed disk, that's fine—go online and buy some fast new NVMe drives. When they arrive, install them, throw away your old HDDs, and then proceed with the rest of this guide.

## FreeBSD 13

The mempool.space site is powered by FreeBSD with ZFS root and ARC cache for maximum performance. Linux probably works fine too, but why settle?

### Filesystem

For maximum performance, I use 2x 2TB NVMe SSDs in a RAID 0 using ZFS with lots of RAM for the ARC L2 cache.
```
% zpool list -v
NAME        SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP    HEALTH  ALTROOT
nvm        3.62T  1.25T  2.38T        -         -     2%    34%  1.00x    ONLINE  -
  nvd0p3   1.81T   629G  1.20T        -         -     2%  33.9%      -  ONLINE
  nvd1p3   1.81T   646G  1.18T        -         -     2%  34.8%      -  ONLINE
```

For maximum flexibility of configuration, I recommend separate partitions for each data folder:
```
Filesystem                             Size    Used   Avail Capacity  Mounted on
nvm/bisq                             766G    1.1G    765G     0%    /bisq
nvm/bitcoin                          766G    648M    765G     0%    /bitcoin
nvm/bitcoin/blocks                   1.1T    375G    765G    33%    /bitcoin/blocks
nvm/bitcoin/chainstate               770G    4.5G    765G     1%    /bitcoin/chainstate
nvm/bitcoin/electrs                  772G    7.3G    765G     1%    /bitcoin/electrs
nvm/bitcoin/indexes                  799G     34G    765G     4%    /bitcoin/indexes
nvm/bitcoin/testnet3                 765G    5.0M    765G     0%    /bitcoin/testnet3
nvm/bitcoin/testnet3/blocks          786G     21G    765G     3%    /bitcoin/testnet3/blocks
nvm/bitcoin/testnet3/chainstate      766G    1.1G    765G     0%    /bitcoin/testnet3/chainstate
nvm/bitcoin/testnet3/indexes         768G    2.9G    765G     0%    /bitcoin/testnet3/indexes
nvm/electrs                          765G    128K    765G     0%    /electrs
nvm/electrs/liquid                   765G    104K    765G     0%    /electrs/liquid
nvm/electrs/liquid/cache             765G    7.8M    765G     0%    /electrs/liquid/newindex/cache
nvm/electrs/liquid/history           766G    886M    765G     0%    /electrs/liquid/newindex/history
nvm/electrs/liquid/txstore           775G     10G    765G     1%    /electrs/liquid/newindex/txstore
nvm/electrs/liquidtestnet            765G    112K    765G     0%    /electrs/liquidtestnet
nvm/electrs/liquidtestnet/cache      765G     96K    765G     0%    /electrs/liquidtestnet/newindex/cache
nvm/electrs/liquidtestnet/history    765G     96K    765G     0%    /electrs/liquidtestnet/newindex/history
nvm/electrs/liquidtestnet/txstore    765G     96K    765G     0%    /electrs/liquidtestnet/newindex/txstore
nvm/electrs/mainnet                  765G    112K    765G     0%    /electrs/mainnet
nvm/electrs/mainnet/cache            765G    4.4M    765G     0%    /electrs/mainnet/newindex/cache
nvm/electrs/mainnet/history          1.0T    300G    765G    28%    /electrs/mainnet/newindex/history
nvm/electrs/mainnet/txstore          1.3T    530G    765G    41%    /electrs/mainnet/newindex/txstore
nvm/electrs/signet                   766G    522M    765G     0%    /electrs/signet
nvm/electrs/testnet                  765G    104K    765G     0%    /electrs/testnet
nvm/electrs/testnet/cache            765G    1.6M    765G     0%    /electrs/testnet/newindex/cache
nvm/electrs/testnet/history          784G     19G    765G     2%    /electrs/testnet/newindex/history
nvm/electrs/testnet/txstore          803G     38G    765G     5%    /electrs/testnet/newindex/txstore
nvm/elements                         766G    927M    765G     0%    /elements
nvm/elements/electrs                 766G    716M    765G     0%    /elements/electrs
nvm/elements/liquidv1                777G     11G    765G     1%    /elements/liquidv1
nvm/mempool                          789G     24G    765G     3%    /mempool
nvm/mysql                            766G    648M    765G     0%    /mysql
tmpfs                                1.0G    1.3M    1.0G     0%    /var/cache/nginx
tmpfs                                3.0G    1.9G    1.1G    63%    /bisq/statsnode-data/btc_mainnet/db/json
```

### Build Dependencies

You'll probably need these:
```
pkg install -y zsh sudo git screen curl wget neovim rsync nginx openssl openssh-portable py38-pip py38-certbot-nginx boost-libs autoconf automake gmake gcc libevent libtool pkgconf mariadb105-server mariadb105-client
```

### Node.js + npm

Build Node.js v16.15 and npm v8 from source using `nvm`:
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | zsh
source $HOME/.zshrc
nvm install v16.15.0
nvm alias default node
```

### Rust

Build Rust from latest source:
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Tor

Install Tor add Bitcoin to the `_tor` group:
```
pkg install -y tor
pw user mod bitcoin -G _tor
```

Then configure `/usr/local/etc/tor/torrc` as follows:
```
RunAsDaemon 1
SOCKSPort 9050
ControlPort 9051
Log notice syslog

CookieAuthentication 1
CookieAuthFileGroupReadable 1
CookieAuthFile /var/db/tor/control_auth_cookie
DataDirectory /var/db/tor
DataDirectoryGroupReadable 1

HiddenServiceDir /var/db/tor/mempool
HiddenServicePort 80 127.0.0.1:81
HiddenServiceVersion 3

HiddenServiceDir /var/db/tor/bisq
HiddenServicePort 80 127.0.0.1:82
HiddenServiceVersion 3

HiddenServiceDir /var/db/tor/liquid
HiddenServicePort 80 127.0.0.1:83
HiddenServiceVersion 3
```

### Bitcoin

Build [Bitcoin Core](https://github.com/bitcoin/bitcoin) from source. Alternatively, install the OS packages:
```
pkg install -y bitcoin-daemon bitcoin-utils
```

Configure your `bitcoin.conf` like this:
```
datadir=/bitcoin
server=1
txindex=1
listen=1
discover=1
par=16
dbcache=4096
maxmempool=1337
mempoolexpiry=999999
maxconnections=42
onion=127.0.0.1:9050
rpcallowip=127.0.0.1
rpcuser=foo
rpcpassword=bar

[main]
bind=127.0.0.1:8333
rpcbind=127.0.0.1:8332
whitelist=bloomfilter@127.0.0.1

[test]
daemon=1
bind=127.0.0.1:18333
rpcbind=127.0.0.1:18332

[signet]
daemon=1
bind=127.0.0.1:38333
rpcbind=127.0.0.1:38332
```

### Elements

Build [Elements Core](https://github.com/ElementsProject/elements) from source:
```
./autogen.sh
MAKE=gmake CC=cc CXX=c++ CPPFLAGS=-I/usr/local/include \
  ./configure --with-gui=no --disable-wallet
gmake -j19
gmake install
```

Configure your `elements.conf` like this:
```
server=1
daemon=1
listen=1
rpcuser=foo
rpcpassword=bar
mainchainrpchost=127.0.0.1
mainchainrpcuser=foo
mainchainrpcpassword=bar
txindex=1

[liquidv1]
validatepegin=1
mainchainrpcport=8332

[liquidtestnet]
validatepegin=0
anyonecanspendaremine=0
initialfreecoins=2100000000000000
con_dyna_deploy_start=0
con_max_block_sig_size=150
checkblockindex=0
fallbackfee=0.00000100
con_has_parent_chain=0
parentgenesisblockhash=NULL
pubkeyprefix=36
scriptprefix=19
blindedprefix=23
bech32_hrp=tex
blech32_hrp=tlq
pchmessagestart=410edd62
dynamic_epoch_length=1000
signblockscript=51210217e403ddb181872c32a0cd468c710040b2f53d8cac69f18dad07985ee37e9a7151ae
evbparams=dynafed:0:::
addnode=liquid-testnet.blockstream.com:18892
addnode=liquidtestnet.com:18891
addnode=liquid.network:18444
```

Start `elementsd` and wait for it to sync the Liquid blockchain.

### Electrs

Install [Electrs](https://github.com/Blockstream/electrs) from source:
```
git clone https://github.com/Blockstream/electrs
cd electrs
git checkout new-index
```

You'll need one instance per network. Build and run them one at a time:
```
./electrs-start-mainnet
./electrs-start-testnet
./electrs-start-signet
./electrs-start-liquid
./electrs-start-liquidtestnet
```

### MariaDB

Import the historical mempool fee database snapshot:
```
mysql -u root
create database mempool;
grant all on mempool.* to 'mempool'@'localhost' identified by 'mempool';
create database mempool_testnet;
grant all on mempool_testnet.* to 'mempool_testnet'@'localhost' identified by 'mempool_testnet';
create database mempool_signet;
grant all on mempool_signet.* to 'mempool_signet'@'localhost' identified by 'mempool_signet';
create database mempool_liquid;
grant all on mempool_liquid.* to 'mempool_liquid'@'localhost' identified by 'mempool_liquid';
create database mempool_liquidtestnet;
grant all on mempool_liquidtestnet.* to 'mempool_liquidtestnet'@'localhost' identified by 'mempool_liquidtestnet';
```


### Bisq

Build bisq-statsnode normally and run using options like this:
```
./bisq-statsnode --dumpBlockchainData=true --dumpStatistics=true
```

If Bisq is happy, it should dump JSON files for Bisq Markets and BSQ data into `/bisq` for the Mempool backend to use.

### Mempool

After all 3 electrs instances are fully indexed, install your 3 Mempool nodes:
```
./mempool-install-all
./mempool-upgrade-all
```

Finally, start your 3 Mempool backends:
```
./mempool-start-all
```

### Nginx

Get an SSL certificate using `certbot`:
```
certbot --nginx -d mempool.ninja
```

Make a symlink from `/usr/local/etc/nginx/mempool` to `/mempool/mempool`, copy the `nginx.conf`, and edit as necessary. You probably only need to edit the top-level `nginx.conf` file.
```
cd /usr/local/etc/nginx
ln -s /mempool/mempool
cp /mempool/mempool/nginx.conf .
vi nginx.conf
```

Restart `nginx`:
```
service nginx restart
```

### Done

If everything went well, your site should look like the one at https://mempool.space/.
