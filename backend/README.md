# Setup backend watchers

The backend is static. Typescript scripts are compiled into the `dist` folder and served through a node web server.

You can avoid the manual shutdown/recompile/restart command line cycle by using a watcher.

Make sure you are in the `backend` directory `cd backend`.

1. Install nodemon and ts-node

```
sudo npm install -g ts-node nodemon
```

2. Run the watcher

> Note: You can find your npm global binary folder using `npm -g bin`, where nodemon will be installed.

```
nodemon src/index.ts --ignore cache/ --ignore pools.json
```

