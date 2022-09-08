ARG UID=1000
ARG GID=1000

FROM node:16.16.0-buster-slim AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build
COPY . .

RUN apt-get update
RUN apt-get install -y build-essential python3 pkg-config
RUN npm install --omit=dev --omit=optional
RUN npm run package

FROM node:16.16.0-buster-slim
ARG UID
ARG GID

WORKDIR /backend

RUN chown $UID:$GID ./
COPY --from=builder --chown=$UID:$GID /build/package ./package/
COPY --from=builder --chown=$UID:$GID /build/mempool-config.json /build/start.sh /build/wait-for-it.sh ./


RUN usermod -u $UID -o node && groupmod -g $GID -o node
USER $UID

EXPOSE 8999

CMD ["/backend/start.sh"]
