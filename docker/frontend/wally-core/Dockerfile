# Build libwally wasm files. Used for client-side blinding verification on Elements-based chains

FROM greenaddress/wallycore@sha256:d63d222be12f6b2535e1548aa7f21cf649e2230d6c9e01bd518c23eb0bccd46f AS libwally-wasm
ARG NO_LIQUID
ENV EXPORTED_FUNCTIONS="['_malloc', '_free', '_wally_init','_wally_asset_value_commitment','_wally_asset_generator_from_bytes']"
ENV EXTRA_EXPORTED_RUNTIME_METHODS="['getValue', 'ccall']"
ENV EMCC_OPTIONS="-s MODULARIZE=1 -s EXPORT_NAME=InitWally"
RUN sh -c '[ -n "$NO_LIQUID" ] && mkdir -p /wally/wally_dist || ( \
    cd /opt/emsdk && . ./emsdk_env.sh \
    && git clone --no-checkout https://github.com/elementsproject/libwally-core /wally \
    && cd /wally && git checkout ea984fc07f4f450b33d4eb78756f25f553e60b44 \
    && git submodule sync --recursive && git submodule update --init --recursive \
    && ./tools/build_wasm.sh --enable-elements)'

FROM debian:buster@sha256:1092695e843ad975267131f27a2b523128c4e03d2d96574bbdd7cf949ed51475
SHELL ["/bin/bash", "-c"]

RUN mkdir -p /srv/explorer \
 && apt-get -yqq update \
 && apt-get -yqq upgrade \
 && apt-get -yqq install clang cmake curl git tor

RUN git clone --quiet --depth 1 --single-branch --branch v0.33.11 https://github.com/creationix/nvm.git /root/.nvm \
 && rm -rf /root/.nvm/.git \
 && source /root/.nvm/nvm.sh \
 && nvm install v12.16.1

ENV SHA256SUM_BITCOINCORE=376194f06596ecfa40331167c39bc70c355f960280bd2a645fdbf18f66527397
RUN curl -sL -o bitcoin.tar.gz https://bitcoincore.org/bin/bitcoin-core-0.20.1/bitcoin-0.20.1-x86_64-linux-gnu.tar.gz \
 && echo "${SHA256SUM_BITCOINCORE}  bitcoin.tar.gz" | sha256sum --check \
 && tar xzf bitcoin.tar.gz -C /srv/explorer \
 && ln -s /srv/explorer/bitcoin-0.20.1 /srv/explorer/bitcoin \
 && rm bitcoin.tar.gz

ENV SHA256SUM_ELEMENTS=d6c94c323b9c586f46b10ab79aa643342b950fd0f01916a47d8051036e6a2288
RUN curl -sL -o elements.tar.gz https://github.com/ElementsProject/elements/releases/download/elements-0.18.1.11/elements-0.18.1.11-x86_64-linux-gnu.tar.gz \
 && echo "${SHA256SUM_ELEMENTS}  elements.tar.gz" | sha256sum --check \
 && tar xzf elements.tar.gz -C /srv/explorer \
 && ln -s /srv/explorer/elements-0.18.1.11 /srv/explorer/liquid \
 && mv /srv/explorer/liquid/bin/{elementsd,liquidd} \
 && mv /srv/explorer/liquid/bin/{elements-cli,liquid-cli} \
 && rm elements.tar.gz

RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain 1.50.0
RUN source /root/.cargo/env \
 && mkdir -p /srv/explorer/electrs{,_liquid} \
 && git clone --no-checkout https://github.com/blockstream/electrs.git \
 && cd electrs \
 && git checkout bae488118de24d571042fb94e18789f0a9d1f69f \
 && cp contrib/popular-scripts.txt /srv/explorer \
 && cargo install --root /srv/explorer/electrs_bitcoin --locked --path . --features electrum-discovery \
 && cargo install --root /srv/explorer/electrs_liquid --locked --path . --features electrum-discovery,liquid \
 && cd .. \
 && rm -fr /root/.cargo electrs \
 && strip /srv/explorer/electrs_*/bin/electrs


# cleanup
RUN apt-get --auto-remove remove -yqq --purge clang cmake manpages curl git \
 && apt-get clean \
 && apt-get autoclean \
 && rm -rf /usr/share/doc* /usr/share/man /usr/share/postgresql/*/man /var/lib/apt/lists/* /var/cache/* /tmp/* /root/.cache /*.deb /root/.cargo

COPY --from=libwally-wasm /wally/wally_dist /srv/wally_wasm