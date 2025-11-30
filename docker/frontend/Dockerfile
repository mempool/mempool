FROM node:22.14.0-bookworm-slim AS builder

ARG commitHash
ENV DOCKER_COMMIT_HASH=${commitHash}
ENV CYPRESS_INSTALL_BINARY=0

WORKDIR /build

COPY . .

RUN apt-get update && \
    apt-get install -y build-essential rsync

COPY --from=frontend . .

RUN cp mempool-frontend-config.sample.json mempool-frontend-config.json

RUN npm install --omit=dev --omit=optional
RUN npm run build

FROM nginx:1.27.0-alpine

WORKDIR /patch

COPY --from=builder /build/entrypoint.sh      ./
COPY --from=builder /build/dist/mempool       /var/www/mempool
COPY --from=builder /build/nginx.conf         /etc/nginx/
COPY --from=builder /build/nginx-mempool.conf /etc/nginx/conf.d/

RUN chmod +x /patch/entrypoint.sh

RUN chown -R 1000:1000 /patch /var/cache/nginx /var/log/nginx /etc/nginx/nginx.conf /etc/nginx/conf.d /var/www/mempool
RUN chmod -R 755 /patch

RUN touch /var/run/nginx.pid && \
    chown -R 1000:1000 /var/run/nginx.pid

USER 1000

ENTRYPOINT ["/patch/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]