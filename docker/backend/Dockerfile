FROM node:20.15.0-buster-slim AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build
COPY . .

RUN apt-get update
RUN apt-get install -y build-essential python3 pkg-config curl ca-certificates

# Install Rust via rustup
RUN CPU_ARCH=$(uname -m); if [ "$CPU_ARCH" = "armv7l" ]; then c_rehash; fi
#RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable
#Workaround to run on github actions from https://github.com/rust-lang/rustup/issues/2700#issuecomment-1367488985
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sed 's#/proc/self/exe#\/bin\/sh#g' | sh -s -- -y --default-toolchain stable
ENV PATH="/root/.cargo/bin:$PATH"

COPY --from=backend . .
COPY --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt
RUN npm install --omit=dev --omit=optional

WORKDIR /build
RUN npm run package

FROM node:20.15.0-buster-slim

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/package ./package/
COPY --from=builder --chown=1000:1000 /build/GeoIP ./GeoIP/
COPY --from=builder --chown=1000:1000 /build/mempool-config.json /build/start.sh /build/wait-for-it.sh ./

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]
