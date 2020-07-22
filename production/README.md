# mempool.space v2 production website hosting

These instructions are for setting up a serious production mempool website for Mainnet, Testnet, and Liquid. For home users, follow the main instructions instead.

### Server Hardware

Mempool V2 is powered by electrs, which is a beast. I recommend a beefy server:

* 16C CPU (more is better)
* 64G RAM (more is better)
* 2TB SSD (NVMe is better)

### HDD vs SSD vs NVMe

If you don't have a fast SSD or NVMe backed disk, that's fine. What you do is, go online and buy some fast new NVMe drives and wait for them to arrive. After you install them, throw away your old HDDs and then proceed with the rest of this guide.

## FreeBSD 12

The mempool.space site is powered by FreeBSD with ZFS root and ARC cache for maximum performance. Linux probably works fine too, but why settle?

### Filesystem

For maximum performance, I use 2x 1TB NVMe SSDs in a RAID 0 using ZFS with lots of RAM for the ARC L2 cache.
```
# zpool list -v nvmraid
NAME         SIZE  ALLOC   FREE  CKPOINT  EXPANDSZ   FRAG    CAP  DEDUP  HEALTH  ALTROOT
nvmraid     1.81T  1.04T   787G        -         -     0%    57%  1.00x  ONLINE  -
  nvd0       928G   535G   393G        -         -     0%    57%
  nvd1       928G   534G   394G        -         -     0%    57%
```

For maximum flexibility of configuration, I configure the partitions separately for each data folder:
```
Filesystem                             Size    Used   Avail Capacity  Mounted on
nvmraid/mempool                        732G    3.0G    729G     0%    /mempool
nvmraid/mysql                          730G    618M    729G     0%    /mysql
nvmraid/bisq                           729G     88K    729G     0%    /bisq
nvmraid/elements                       731G    1.8G    729G     0%    /elements
nvmraid/elements/liquidv1              737G    7.2G    729G     1%    /elements/liquidv1
nvmraid/elements/electrs               730G    434M    729G     0%    /elements/electrs
nvmraid/bitcoin                        730G    694M    729G     0%    /bitcoin
nvmraid/bitcoin/chainstate             733G    3.9G    729G     1%    /bitcoin/chainstate
nvmraid/bitcoin/indexes                757G     27G    729G     4%    /bitcoin/indexes
nvmraid/bitcoin/electrs                730G    853M    729G     0%    /bitcoin/electrs
nvmraid/bitcoin/blocks                 1.0T    306G    729G    30%    /bitcoin/blocks
nvmraid/bitcoin/testnet3               729G     13M    729G     0%    /bitcoin/testnet3
nvmraid/bitcoin/testnet3/blocks        756G     26G    729G     3%    /bitcoin/testnet3/blocks
nvmraid/bitcoin/testnet3/chainstate    731G    1.3G    729G     0%    /bitcoin/testnet3/chainstate
nvmraid/bitcoin/testnet3/indexes       733G    3.8G    729G     1%    /bitcoin/testnet3/indexes
nvmraid/electrs/liquid/cache           729G     39M    729G     0%    /electrs/liquid/newindex/cache
nvmraid/electrs/liquid/history         730G    737M    729G     0%    /electrs/liquid/newindex/history
nvmraid/electrs/liquid/txstore         736G    6.2G    729G     1%    /electrs/liquid/newindex/txstore
nvmraid/electrs/mainnet/cache          729G     44M    729G     0%    /electrs/mainnet/newindex/cache
nvmraid/electrs/mainnet/history        964G    234G    729G    24%    /electrs/mainnet/newindex/history
nvmraid/electrs/mainnet/txstore        1.1T    392G    729G    35%    /electrs/mainnet/newindex/txstore
nvmraid/electrs/testnet/cache          729G     40M    729G     0%    /electrs/testnet/newindex/cache
nvmraid/electrs/testnet/history        747G     18G    729G     2%    /electrs/testnet/newindex/history
nvmraid/electrs/testnet/txstore        764G     34G    729G     4%    /electrs/testnet/newindex/txstore
```

### Build Dependencies

You'll probably need these:
```
pkg install -y zsh sudo git screen vim-console curl wget neovim rsync
pkg install -y openssl openssh-portable open-vm-tools-nox11 py37-pip
pkg install -y boost-libs autoconf automake gmake gcc libevent libtool pkgconf
pkg install -y mariadb55-server mariadb55-client nginx py37-certbot-nginx npm
```

### Rust

I recommend to build rust from latest source:
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Tor

Install tor, add Bitcoin to _tor group:
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
DataDirectoryGroupReadable 1

HiddenServiceDir /var/db/tor/mempool
HiddenServicePort 80 127.0.0.1:81
HiddenServiceVersion 3
```


### Bitcoin

Build [Bitcoin Core](https://github.com/bitcoin/bitcoin) from source. Alternatively, install the OS packages:
```
pkg install -y bitcoin-daemon bitcoin-utils
```

Configure your bitcoin.conf like this:
```
server=1
daemon=1
listen=1
discover=1
txindex=1
par=16
dbcache=3700
maxconnections=1337
timeout=30000
onion=127.0.0.1:9050
rpcallowip=127.0.0.1
rpcuser=0cd862dce678b830bd2aa36f10b9b6b2
rpcpassword=2d89d36cac4a13c87b5d19ef8f577e37
rpcworkqueue=128
rpcthreads=32
rpctimeout=60

[main]
bind=127.0.0.1:8333
rpcbind=127.0.0.1:8332

[test]
bind=127.0.0.1:18333
rpcbind=127.0.0.1:18332
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

Configure your elements.conf like this:
```
server=1
daemon=1
listen=1
chain=liquidv1
rpcuser=liquiduser
rpcpassword=liquidpass
validatepegin=1
mainchainrpchost=127.0.0.1
mainchainrpcport=8332
mainchainrpcuser=user
mainchainrpcpassword=pass
txindex=1
```

Start elementsd and wait for it to sync the Liquid blockchain.

### Electrs

Install [Electrs](https://github.com/Blockstream/electrs) from source:
```
git clone https://github.com/Blockstream/electrs
cd electrs
git checkout new-index
```

You'll need 3 instances, one for each network. Build one at a time:
```
./electrs-start-mainnet
./electrs-start-testnet
./electrs-start-liquid
```

### MariaDB

Import historical mempool fee database snapshot, or the blank mariadb structure if none:
```
mysql -u root
create database mempool;
grant all on mempool.* to 'mempool'@'localhost' identified by 'mempool';
create database tmempool;
grant all on tmempool.* to 'tmempool'@'localhost' identified by 'tmempool';
create database lmempool;
grant all on lmempool.* to 'lmempool'@'localhost' identified by 'lmempool';
```

Then import
```
mysql -u mempool -p mempool < /mempool/mempool/mariadb-structure.sql
mysql -u tmempool -p tmempool < /mempool/mempool/mariadb-structure.sql
mysql -u lmempool -p lmempool < /mempool/mempool/mariadb-structure.sql
```

### Mempool

After all 3 electrs instances are fully indexed, install your 3 mempool nodes:
```
./mempool-install-all
./mempool-upgrade-all
```

Finally, start your 3 mempool backends:
```
./mempool-start-all
```

### Nginx

Get SSL certificate using certbot:
```
certbot --nginx -d mempool.space
```

Install nginx.conf from this repo, edit as necessary:
```
cp nginx.conf /usr/local/etc/nginx/nginx.conf
vi /usr/local/etc/nginx/nginx.conf
```

Restart nginx
```
service nginx restart
```

### Done

Your site should look like https://mempool.space/
If it doesn't ask wiz on Keybase DM or Twitter for help.
