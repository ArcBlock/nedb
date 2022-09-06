TOP_DIR=.
README=$(TOP_DIR)/README.md

VERSION=$(strip $(shell cat version))

init: install dep
	@echo "Initializing the repo..."

github-init: dep
	@echo "Initialize software required for github (normally ubuntu software)"

install:
	@echo "Install software required for this repo..."
	@npm install -g lerna yarn

dep:
	@echo "Install dependencies required for this repo..."
	@lerna bootstrap
	@lerna link
	@npm run build

include .makefiles/*.mk

.PHONY: build init travis-init install dep pre-build post-build all test doc travis clean watch run bump-version create-pr
