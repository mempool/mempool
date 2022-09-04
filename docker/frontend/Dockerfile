ARG UID=1000
ARG GID=1000

FROM node:16.16.0-buster-slim AS builder

ARG commitHash
ENV DOCKER_COMMIT_HASH=${commitHash}
ENV CYPRESS_INSTALL_BINARY=0

WORKDIR /build
COPY . .
RUN apt-get update
RUN apt-get install -y build-essential rsync
RUN npm install --omit=dev --omit=optional
RUN npm run build

FROM nginx:1.17.8
ARG UID
ARG GID

WORKDIR /patch

COPY --from=builder /build/entrypoint.sh .
COPY --from=builder /build/wait-for .
COPY --from=builder /build/dist/mempool /var/www/mempool
COPY --from=builder /build/nginx.conf /etc/nginx/
COPY --from=builder /build/nginx-mempool.conf /etc/nginx/conf.d/

RUN chmod +x /patch/entrypoint.sh
RUN chmod +x /patch/wait-for

RUN chown -R $UID:$GID /patch && chmod -R 755 /patch && \
        chown -R $UID:$GID /var/cache/nginx && \
        chown -R $UID:$GID /var/log/nginx && \
        chown -R $UID:$GID /etc/nginx/nginx.conf && \
        chown -R $UID:$GID /etc/nginx/conf.d
RUN touch /var/run/nginx.pid && \
        chown -R $UID:$GID /var/run/nginx.pid

RUN usermod -u $UID -o nginx && groupmod -g $GID -o nginx
USER $UID

ENTRYPOINT ["/patch/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
