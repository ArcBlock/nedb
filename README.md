![nedb](https://www.arcblock.io/.netlify/functions/badge?text=NEDB)

## Table of Contents

- [Table of Contents](#Table-of-Contents)
- [Introduction](#Introduction)
- [Packages](#Packages)
- [License](#License)

## Introduction

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)
[![docs](https://img.shields.io/badge/powered%20by-arcblock-green.svg)](https://docs.arcblock.io)
[![Gitter](https://badges.gitter.im/ArcBlock/community.svg)](https://gitter.im/ArcBlock/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

> Last updated at 8/18/2022, 9:04:42 AM

This repo contains a [NEDB](https://github.com/louischatriot/nedb) fork used by ArcBlock products.

Along with the NEDB core, we have updated several related packages to improve performance, security and compatibility:

- Most dependencies are upgraded to latest to get better security and performance
- Use @nedb/multi to read and write to the same database in different node.js processes
- Use @nedb/mongoose-driver as a drop-in replacement for mongoose + mongodb to make apps lightweight

Limitations: if you want to use nedb in browser, please use the original version.

## Getting Started

Checkout instructions [here](./docs/contribute.md) on how to contribute.

## Packages

- [@nedb/binary-search-tree <img src="https://img.shields.io/npm/v/@nedb/binary-search-tree.svg" alt="Version">](https://www.npmjs.com/package/@nedb/binary-search-tree)
- [@nedb/core <img src="https://img.shields.io/npm/v/@nedb/core.svg" alt="Version">](https://www.npmjs.com/package/@nedb/core)
- [@nedb/mongoose-driver <img src="https://img.shields.io/npm/v/@nedb/mongoose-driver.svg" alt="Version">](https://www.npmjs.com/package/@nedb/mongoose-driver)
- [@nedb/multi <img src="https://img.shields.io/npm/v/@nedb/multi.svg" alt="Version">](https://www.npmjs.com/package/@nedb/multi)

## Credits

- [NEDB Core](https://github.com/louischatriot/nedb)
- [NEDB Multi](https://github.com/vangelov/nedb-multi)

