/* eslint-disable max-len */
/* eslint-disable array-callback-return */
/* eslint-disable consistent-return */
/* eslint-disable import/no-dynamic-require */
/* eslint-disable global-require */
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const { getPackages } = require('./util');

const packageList = getPackages({ publicOnly: true }).map(
  (x) =>
    `- [${x.name} <img src="https://img.shields.io/npm/v/${x.name}.svg" alt="Version">](https://www.npmjs.com/package/${x.name})`
);

const readmeFile = path.join(__dirname, '../README.md');
const readmeContent = `![abt-node](https://www.arcblock.io/.netlify/functions/badge?text=ABT%20Node)

## Table of Contents

- [Table of Contents](#Table-of-Contents)
- [Introduction](#Introduction)
- [Packages](#Packages)
- [License](#License)

## Introduction

[![lerna](https://img.shields.io/badge/maintained%20with-lerna-cc00ff.svg)](https://lernajs.io/)
[![docs](https://img.shields.io/badge/powered%20by-arcblock-green.svg)](https://docs.arcblock.io)
[![Gitter](https://badges.gitter.im/ArcBlock/community.svg)](https://gitter.im/ArcBlock/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

> Last updated at ${new Date().toLocaleString()}

This repo contains ABT Node Daemon and core blocklets.

## Getting Started

Checkout instructions [here](./docs/contribute.md) on how to contribute.

## Packages

${packageList.join('\n')}
`;

fs.writeFileSync(readmeFile, readmeContent);
console.log('README.md updated');
