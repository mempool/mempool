# Build environment for Anthropic's OSS Scanner (https://github.com/anthropics/oss-scanner).
# The scanner runs:  docker build -f <this file> <checkout root>   (no --build-arg, no --build-context)
# and then analyses the image offline. So unlike docker/backend and docker/frontend this is a single
# stage that keeps the sources, dev dependencies and build outputs together under /src.
# The Rust version comes from rust/gbt/rust-toolchain (rustup installs it during npm ci); this tag is
# only the starting toolchain.
FROM rust:1.84-bookworm

# Node.js version from .nvmrc, so it follows the version used by CI and docker/backend
COPY .nvmrc /tmp/.nvmrc
RUN NODE_VERSION=$(sed 's/^v//' /tmp/.nvmrc | tr -d '[:space:]') && \
    apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION%%.*}.x | bash - && \
    apt-get install -y --no-install-recommends nodejs=${NODE_VERSION}-1nodesource1 build-essential python3 pkg-config rsync git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Same npm as .github/workflows/ci.yml. The npm bundled with Node 24.13 (11.6.2) rejects the frontend
# lockfile on a full `npm ci` ("Missing: readdirp@4.1.2 from lock file").
RUN npm install -g npm@11.12.0

# Cypress is an optional frontend dependency; keep the package, skip its browser binary download
ENV CYPRESS_INSTALL_BINARY=0

# Scanner contract: the checkout lives at /src
COPY . /src

# rust/gbt + backend. The backend preinstall hook builds rust/gbt (release) and copies it to
# backend/rust-gbt. No --omit=dev: jest, eslint and friends must be present for offline use.
WORKDIR /src/backend
RUN bash meta/scripts/check-install-scripts.sh && npm ci
# package/ is what the production image ships; dist/ is what `npm start` runs
RUN npm run package && npm run build
# Fetch every crate in Cargo.lock (including dev-dependencies) so cargo works offline
RUN cd /src/rust/gbt && cargo fetch --locked

# frontend
WORKDIR /src/frontend
RUN cp mempool-frontend-config.sample.json mempool-frontend-config.json && \
    bash meta/scripts/check-install-scripts.sh && npm ci
# Same steps as `npm run build`, except that the asset sync (mining pool logos etc. from the
# unauthenticated GitHub API, which rate-limits shared IPs) may fail without failing the build.
RUN npm run generate-themes && npm run generate-config && \
    npm run ng -- build --configuration production --localize && \
    ( (npm run sync-assets-dev && npm run sync-assets) || \
      (echo "WARNING: asset sync failed, continuing without downloaded assets" && SKIP_SYNC=1 npm run sync-assets) )

WORKDIR /src

# Cheap tests, to show the image works. A failing test must not abort the build, and neither may a
# hanging one: jest passes but can fail to exit on its own (open handles), hence --forceExit + timeout.
RUN (cd /src/rust/gbt && timeout 600 cargo test --locked) || echo "WARNING: cargo test reported failures"
RUN (cd /src/backend && timeout 600 npm run test:ci -- --forceExit) || echo "WARNING: backend tests reported failures"
