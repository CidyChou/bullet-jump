.DEFAULT_GOAL := help

SG_HOST ?= sg
SG_SSH ?= ssh
SG_NAME := bullet-jump
SG_RELEASES := /srv/h5/releases/$(SG_NAME)
SG_CURRENT := /srv/h5/current/$(SG_NAME)
SG_URL := https://h5.cidychou.com/$(SG_NAME)/

.PHONY: help sg

help: ## 显示全部 Make 命令和说明
	@echo "Bullet Jump 开发命令"
	@echo "用法：make <命令>"
	@awk 'BEGIN { FS = ":.*##" } /^[a-zA-Z0-9_-]+:.*##/ { printf "  %-14s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

sg: ## 部署静态页面到新加坡（https://h5.cidychou.com/bullet-jump/，无需构建）
	@set -eu; \
	work=$$(mktemp -d); \
	trap 'rm -rf "$$work"' EXIT; \
	mkdir "$$work/site"; \
	cp -R index.html style.css favicon.svg src "$$work/site/"; \
	find "$$work/site" \( -name '.DS_Store' -o -name '._*' -o -name '*.map' \) -delete; \
	python3 tools/sg_stamp.py "$$work/site"; \
	test -s "$$work/site/style.css"; \
	test -s "$$work/site/favicon.svg"; \
	test -s "$$work/site/src/main.js"; \
	grep -q '?v=' "$$work/site/index.html"; \
	COPYFILE_DISABLE=1 tar --no-xattrs -czf "$$work/site.tar.gz" -C "$$work/site" .; \
	$(SG_SSH) -T "$(SG_HOST)" 'set -eu; \
		sudo -n mkdir -p "$(SG_RELEASES)"; \
		release=$$(sudo -n mktemp -d "$(SG_RELEASES)/$$(date -u +%Y%m%dT%H%M%SZ)-XXXXXX"); \
		sudo -n tar -xzf - --no-same-owner -C "$$release"; \
		sudo -n chmod -R u=rwX,go=rX "$$release"; \
		test -s "$$release/index.html"; \
		test -s "$$release/style.css"; \
		test -s "$$release/favicon.svg"; \
		test -s "$$release/src/main.js"; \
		test -s "$$release/src/game/Game.js"; \
		sudo -n ln -s "$$release" "$$release/.current"; \
		sudo -n mv -Tf "$$release/.current" "$(SG_CURRENT)"' < "$$work/site.tar.gz"; \
	printf '已部署 %s\n' "$(SG_URL)"
