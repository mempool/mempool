# Mempool Link Unfurler Service

This is a standalone nodejs service which implements the [Open Graph protocol](https://ogp.me/) for Mempool instances. It performs two main tasks:

1. Serving Open Graph html meta tags to social media link crawler bots.
2. Rendering link preview images for social media sharing.

Some additional server configuration is required to properly route requests (see section 4 below).

## Setup

### 0. Install deps

For Linux, in addition to NodeJS/npm you'll need at least:
* nginx
* cups
* chromium-bsu
* libatk1.0
* libatk-bridge2.0
* libxkbcommon-dev
* libxcomposite-dev
* libxdamage-dev
* libxrandr-dev
* libgbm-dev
* libpango1.0-dev
* libasound-dev

### 1. Clone Mempool Repository

Get the latest Mempool code:

```
git clone https://github.com/mempool/mempool
cd mempool
```

Check out the latest release:

```
latestrelease=$(curl -s https://api.github.com/repos/mempool/mempool/releases/latest|grep tag_name|head -1|cut -d '"' -f4)
git checkout $latestrelease
```

### 2. Prepare the Mempool Unfurler

#### Install

Install dependencies with `npm` and build the backend:

```
cd unfurler
npm install
```

The npm install may fail if your system does not support automatic installation of Chromium for Puppeteer. In that case, manually install Puppeteer without Chromium first:
```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer
npm install
```

#### Configure

In the `unfurler` folder, make a copy of the sample config file:

```
cp config.sample.json config.json
```

Edit `config.json` as needed:

| variable | usage |
|---|---|
| SERVER.HOST | the host where **this** service will be served |
| SERVER.HTTP_PORT | the port on which **this** service should run |
| MEMPOOL.HTTP_HOST | the host where **the Mempool frontend** is being served |
| MEMPOOL.HTTP_PORT | the port on which **the Mempool frontend** is running (or `null`) |
| PUPPETEER.CLUSTER_SIZE | the maximum number of Chromium browser instances to run in parallel, for rendering link previews |
| PUPPETEER.EXEC_PATH | (optional) an absolute path to the Chromium browser executable, e.g. `/usr/local/bin/chrome`. Only required when using a manual installation of Chromium |

#### Build

```
npm run build
```

### 3. Run the Mempool Unfurler

```
npm run start
```

### 4. Server configuration

To enable social media link previews, the system serving the Mempool frontend should detect requests from social media crawler bots and proxy those requests to this service instead.

Precise implementation is left as an exercise to the reader, but the following snippet may be of some help for Nginx users:
```Nginx
map $http_user_agent $crawler {
    default 0;
    ~*facebookexternalhit 1;
    ~*twitterbot 1;
    ~*slackbot 1;
    ~*redditbot 1;
    ~*linkedinbot 1;
    ~*pinterestbot 1;
}
```
