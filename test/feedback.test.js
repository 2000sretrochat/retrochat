'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), express = require('express');
const FB = require('../feedback');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('feedback input is validated and cleaned', () => {
  assert.equal(FB.parse({ category: 'nope', message: 'hello there!' }).error, 'Choose a category.');
  assert.match(FB.parse({ category: 'other', message: 'short' }).error, /at least 10/);
  assert.match(FB.parse({ category: 'other', message: 'x'.repeat(2001) }).error, /under 2000/);
  const f = FB.parse({ category: 'broken', message: '  The PM window\u0000 froze\u202e when I clicked BUZZ  ', page: '/rooms.html?room=Lobby<script>', app: 'Desktop app 13.10.10\n' });
  assert.equal(f.message, 'The PM window froze when I clicked BUZZ'); assert.equal(f.label, "Something's not working");
  assert.equal(f.page, '/rooms.html?room=Lobbyscript'); assert.equal(f.app, 'Desktop app 13.10.10');
  const m = FB.compose({ name: 'zainy\r\nBcc: x@y', ...f, when: new Date('2026-11-13T09:00:00Z') });
  assert.equal(m.subject, "Razzle feedback: Something's not working from zainy Bcc xy");
  assert.match(m.text, /Screen name: zainy Bcc xy\nCategory: Something's not working\nPage: \/rooms\.html\?room=Lobbyscript\nApp: Desktop app 13\.10\.10\nTime: Nov 13, 2026, 2:00 AM MST\n\nThe PM window/);
});

test('limiter allows 5 an hour, then blocks until the hour passes', () => {
  const allow = FB.limiter(), t = 1e12;
  for (let i = 0; i < 5; i++) assert.equal(allow('u:1', 5, t + i), true);
  assert.equal(allow('u:1', 5, t + 10), false);
  assert.equal(allow('u:1', 5, t + 3600e3 + 10), true);
});

async function server({ user = null, mailOn = true, sent = [], stored = [], failMail = false } = {}) {
  const app = express(); app.set('trust proxy', 1);
  const db = { status: () => ({ ready: true }), q: async (sql, p) => { if (/^insert into feedback/.test(sql)) { stored.push(p); return [{ id: stored.length }]; } return []; } };
  const mail = { enabled: () => mailOn, sendMail: async m => { if (failMail) throw new Error('mail gmail EAUTH'); sent.push(m); } };
  const logs = [];
  FB.register(app, express, { db, userFromReq: async () => user, clientIp: () => '203.0.113.9', mail, log: { log: (...a) => logs.push(a.join(' ')), error: (...a) => logs.push(a.join(' ')) } });
  const s = app.listen(0); await new Promise(r => s.on('listening', r));
  const post = body => fetch('http://127.0.0.1:' + s.address().port + '/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { s, post, sent, stored, logs };
}

test('signed-in feedback is stored, emailed to GMAIL_USER, and limited to 5 an hour', async () => {
  const prev = process.env.GMAIL_USER; process.env.GMAIL_USER = 'team@example.com';
  const x = await server({ user: { id: 7, name: 'zainy' } });
  try {
    const r = await x.post({ category: 'suggestion', message: 'Please add more smileys!', page: '/', app: 'Web' });
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
    await new Promise(r => setTimeout(r, 20));
    assert.equal(x.stored[0][1], 'zainy'); assert.equal(x.stored[0][2], 'suggestion');
    assert.equal(x.sent[0].to, 'team@example.com'); assert.equal(x.sent[0].subject, 'Razzle feedback: Suggestion from zainy');
    assert.ok(x.logs.every(l => !/team@example|smileys/.test(l)), 'no addresses or message text in logs');
    for (let i = 0; i < 4; i++) assert.equal((await x.post({ category: 'other', message: 'another note ' + i })).status, 200);
    assert.equal((await x.post({ category: 'other', message: 'one too many notes' })).status, 429);
    assert.equal((await x.post({ category: 'other', message: 'tiny' })).status, 400);
  } finally { x.s.close(); if (prev === undefined) delete process.env.GMAIL_USER; else process.env.GMAIL_USER = prev; }
});

test('guests get 2 an hour; the fallback address is razzlesocialbeta@gmail.com; mail failures still keep the DB copy', async () => {
  const prev = process.env.GMAIL_USER; delete process.env.GMAIL_USER;
  const x = await server({});
  try {
    assert.equal((await x.post({ category: 'broken', message: 'Room list will not load' })).status, 200);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(x.sent[0].to, 'razzlesocialbeta@gmail.com'); assert.match(x.sent[0].subject, /from Guest$/);
    assert.equal((await x.post({ category: 'broken', message: 'Room list will not load 2' })).status, 200);
    assert.equal((await x.post({ category: 'broken', message: 'Room list will not load 3' })).status, 429);
  } finally { x.s.close(); if (prev !== undefined) process.env.GMAIL_USER = prev; }
  const y = await server({ user: { id: 1, name: 'tony' }, failMail: true });
  try {
    assert.equal((await y.post({ category: 'other', message: 'Mail is down but save me' })).status, 200);
    await new Promise(r => setTimeout(r, 20));
    assert.equal(y.stored.length, 1); assert.ok(y.logs.some(l => /email failed mail gmail EAUTH/.test(l)));
  } finally { y.s.close(); }
});

test('Feedback is in every Help menu and the Social footer; server and table are wired', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html', 'public/rooms.html']) {
    const s = read(f); assert.match(s, /<div id="mFeedback">Feedback<\/div>/, f); assert.match(s, /<script src="\/feedback\.js"><\/script>/, f);
  }
  const social = read('social-next/web/index.html');
  assert.match(social, /<a href="#feedback" data-feedback>Feedback<\/a>/); assert.match(social, /<script src="\/feedback\.js"><\/script>/);
  const js = read('public/feedback.js');
  assert.match(js, /If you have any suggestions to make Razzle better, or notice something isn't working, write us\. We appreciate your feedback!/);
  assert.match(js, /\['suggestion', 'Suggestion'\], \['broken', 'Something\\u2019s not working'\], \['other', 'Other'\]/);
  assert.match(read('server.js'), /require\('\.\/feedback'\)\.register\(app, express, \{ db, userFromReq,/);
  assert.match(read('db.js'), /create table if not exists feedback\(/);
});
