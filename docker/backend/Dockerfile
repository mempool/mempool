FROM node:12-buster-slim AS builder

WORKDIR /build
COPY . .

RUN apt-get update
RUN apt-get install -y build-essential python3 pkg-config
RUN npm ci --production
RUN npm i typescript
RUN npm run build

FROM node:12-buster-slim

ENV TINI_VERSION v0.19.0
ADD https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini
RUN chmod +x /tini
ENTRYPOINT ["/tini", "--"]

WORKDIR /backend

COPY --from=builder /build/ .

RUN chmod +x /backend/start.sh
RUN chmod +x /backend/wait-for-it.sh

RUN chown -R 1000:1000 /backend && chmod -R 755 /backend

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]
