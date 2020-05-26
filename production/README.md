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

### Build Dependencies

You'll probably need these:
```
pkg install -y zsh sudo git screen vim-console curl wget calc neovim  rsync
pkg install -y openssl openssh-portable open-vm-tools-nox11 py27-pip py37-pip
pkg install -y boost-libs autoconf automake gmake gcc libevent libtool pkgconf
pkg install -y mariadb55-server mariadb55-client nginx py37-certbot-nginx
```

### Rust

I recommend to build rust from latest source:
```
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
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
uacomment=@wiz

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
