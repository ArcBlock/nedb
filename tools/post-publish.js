/* eslint-disable no-console */
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');
const { execSync } = require('child_process');

const { getPackages, sleep } = require('./util');

getPackages({ publicOnly: true }).forEach(async (x, i) => {
  await sleep(i * 200);
  try {
    const res = await axios.put(`https://npm.taobao.org/sync/${x.name}?sync_upstream=true`);
    console.log('trigger cnpm sync success', x.name, res.data);
  } catch (err) {
    console.error('trigger cnpm sync failed', x.name, err);
  }
  if (process.env.SLACK_WEBHOOK) {
    try {
      // eslint-disable-next-line max-len
      const command = `curl -s -X POST --data-urlencode "payload={\\"text\\": \\"${x.name} v${x.version} is published\\"}" ${process.env.SLACK_WEBHOOK}`;
      const result = execSync(command);
      console.log('send slack notification', result.toString('utf8'));
    } catch (err) {
      console.error('send slack notification failed', x.name, err);
    }
  }
});
