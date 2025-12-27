FROM rust:1.92-bookworm AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build

RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs=22.14.0-1nodesource1 build-essential python3 pkg-config && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

ENV PATH="/usr/local/cargo/bin:$PATH"

COPY --from=backend . .
COPY --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt
RUN npm install --omit=dev --omit=optional

WORKDIR /build
RUN npm run package

FROM rust:1.92-bookworm AS runtime

RUN apt-get update && \
    apt-get install -y curl ca-certificates && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs=22.14.0-1nodesource1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/package ./package/
COPY --from=builder --chown=1000:1000 /build/GeoIP ./GeoIP/
COPY --from=builder --chown=1000:1000 /build/mempool-config.json /build/start.sh /build/wait-for-it.sh ./

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]
