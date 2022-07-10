This is a basic nginx config for mempool that's also used by the `mempool/frontend`
Docker container.

### Installation
Copy the contents of this directory to the nginx config directory,
while resolving symlinks to files:
```
rsync -a --copy-links --exclude=/README.md ./ /etc/nginx
```
Then edit `/etc/nginx/nginx.conf` as needed.
