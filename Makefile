.PHONY: backend init frontend up down build
.DEFAULT_GOAL := build

compose := sudo docker-compose

tag ?= latest

init:
	docker/init.sh $(tag)

frontend backend: init
	sudo docker build -f docker/$@/Dockerfile -t mempool/$@:$(tag) $@

build: frontend backend

up:
	$(compose) up -d

down:
	$(compose) down
