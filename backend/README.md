# Setup backend watchers

The backend is static. Typescript scripts are compiled into the `dist` folder and served through a node web server.

You can avoid the manual shutdown/recompile/restart command line cycle by setting up watchers.

Make sure you are in the `backend` directory `cd backend`.

1. Install nodemon 
```
sudo npm install -g nodemon
```
2. [Optional] Add the following configuration into `tsconfig.json`. You can find watch options here https://www.typescriptlang.org/docs/handbook/configuring-watch.html
```
    "watchOptions": {
      "watchFile": "useFsEvents",
      "watchDirectory": "useFsEvents",
      "fallbackPolling": "dynamicPriority",
      "synchronousWatchDirectory": true,
      "excludeDirectories": ["**/node_modules", "_build"],
      "excludeFiles": ["build/fileWhichChangesOften.ts"]
    }
```
3. In one terminal, watch typescript scripts
```
./node_modules/typescript/bin/tsc --watch
```
4. In another terminal, watch compiled javascript
```
nodemon --max-old-space-size=2048 dist/index.js
```

Everytime you save a backend `.ts` file, `tsc` will recompile it and genereate a new static `.js` file in the `dist` folder. `nodemon` will detect this new file and restart the node web server automatically.
