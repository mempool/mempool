ARG UID=1000
ARG GID=1000

FROM node:16.16.0-buster-slim AS builder

ARG commitHash
ENV DOCKER_COMMIT_HASH=${commitHash}

WORKDIR /build
COPY . .

RUN apt-get update
RUN apt-get install -y build-essential python3 pkg-config
RUN npm install --omit=dev --omit=optional
RUN npm run build

FROM node:16.16.0-buster-slim
ARG UID
ARG GID

WORKDIR /backend

COPY --from=builder /build/ .

RUN chmod +x /backend/start.sh
RUN chmod +x /backend/wait-for-it.sh

RUN chown -R $UID:$GID /backend && chmod -R 755 /backend

RUN usermod -u $UID -o node && groupmod -g $GID -o node
USER $UID

EXPOSE 8999

CMD ["/backend/start.sh"]
