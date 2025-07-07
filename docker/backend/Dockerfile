FROM rust:1.84-bookworm AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build

RUN apt-get update && \
    apt-get install -y curl ca-certificates

COPY . .

ADD --chmod=750 https://deb.nodesource.com/setup_22.x setup_node.sh
RUN ./setup_node.sh

RUN apt-get update && \
    apt-get install -y nodejs=22.14.0-1nodesource1 build-essential python3 pkg-config

COPY --from=backend . .
COPY --from=rustgbt . ../rust/

ENV FD=/build/rust-gbt

RUN npm install --omit=dev --omit=optional
RUN npm run package

#TODO: strip binary

FROM rust:1.84-bookworm
#TODO use a smaller base image. alpine? (has slower libc)

WORKDIR /backend

COPY ./mempool-config.json           ./
COPY --from=builder /usr/bin/node    /usr/bin/node
COPY --from=builder /build/package   ./package/
COPY --from=builder /build/GeoIP     ./GeoIP/
COPY --chmod=750    ./start.sh       ./

RUN chown 1000:1000 -R ./ && \
    chown 1000:1000 /usr/bin/node

USER 1000
EXPOSE 8999

CMD ["./start.sh"]