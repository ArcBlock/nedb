TOP_DIR=.
README=$(TOP_DIR)/README.md

VERSION=$(strip $(shell cat version))

build:
	@echo "Building the software..."
	@lerna bootstrap

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

pre-build: install dep
	@echo "Running scripts before the build..."

post-build:
	@echo "Running scripts after the build is done..."

all: pre-build build post-build

test:
	@echo "Running test suites..."
	@lerna run precommit

doc:
	@echo "Building the documenation..."

travis: dotenv test

travis-deploy: release
	@echo "Deploy the software by travis"

dotenv:
	@echo "Fix dot env file..."

clean:
	@echo "Cleaning the build..."

watch:
	@make build
	@echo "Watching templates and slides changes..."
	@fswatch -o src/ | xargs -n1 -I{} make build

run:
	@echo "Running the software..."

include .makefiles/*.mk

.PHONY: build init travis-init install dep pre-build post-build all test doc travis clean watch run bump-version create-pr
