const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const express = require('express');
const attachSocialNext = require('../social-next');

test('new Social design requires the real account session and keeps each identity separate', async t => {
  const app = express();
  const accounts = {
    userFromCookie: async cookie => ({
      'test=one': { id: 21, name: 'zainy2', canon: 'zainy2' },
      'test=two': { id: 42, name: 'River', canon: 'River' },
    })[cookie],
  };
  const db = { q: async (_sql, [id]) => [{ display_name: id === 21 ? '<First>' : 'Second' }] };
  attachSocialNext(app, express, accounts, db);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + server.address().port;
  const get = (path, cookie) => fetch(base + path, {redirect: 'manual', headers: cookie ? {cookie} : {}});
  const guest = await get('/social-next/');
  assert.equal(guest.status, 200);
  assert.match(await guest.text(), /Your Razzle Social space/);
  assert.equal((await get('/social-next/session.js')).status, 401);
  const page = await get('/social-next/@zainy2', 'test=one');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /src="\/social\/messenger.html"/);
  const session = await get('/social-next/session.js', 'test=one');
  assert.equal(session.headers.get('cache-control'), 'private, no-store');
  assert.match(await session.text(), /"id":21.*"alias":"zainy2".*\\u003cFirst>/);
  const script = await get('/social-next/social-home.js', 'test=one');
  const source = await script.text();
  assert.match(source, /profile\('zainy2'\)/);
  assert.doesNotMatch(source, /zainy22/);
  assert.match(await (await get('/social-next/session.js', 'test=two')).text(), /"id":42.*"alias":"River".*Second/);
});
