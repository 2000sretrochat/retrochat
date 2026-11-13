'use strict';
// Gmail SMTP (app password) as a free mail option next to Resend; /api/reset/config reports email when either is set.
const test = require('node:test'), assert = require('node:assert/strict');
const KEYS = ['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'RESEND_API_KEY', 'MAIL_FROM'];
function withEnv(env, fn) {
  const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  const restore = () => { for (const k of KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; } };
  return Promise.resolve().then(fn).finally(restore);
}
const mail = require('../mail');

test('mail is off with no provider, on with Gmail or Resend, and Gmail wins when both are set', () => withEnv({}, () => {
  assert.equal(mail.enabled(), false); assert.equal(mail.provider(), null);
  process.env.GMAIL_USER = 'razzlesocialbeta@gmail.com';
  assert.equal(mail.enabled(), false, 'needs the app password too');
  process.env.GMAIL_APP_PASSWORD = 'test-app-password';
  assert.equal(mail.provider(), 'gmail');
  delete process.env.GMAIL_APP_PASSWORD; process.env.RESEND_API_KEY = 'k'; process.env.MAIL_FROM = 'a@b.c';
  assert.equal(mail.provider(), 'resend');
  process.env.GMAIL_APP_PASSWORD = 'test-app-password';
  assert.equal(mail.provider(), 'gmail');
}));

test('Gmail sends from "Razzle Social <razzlesocialbeta@gmail.com>" through the SMTP transport', () =>
  withEnv({ GMAIL_USER: 'razzlesocialbeta@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }, async () => {
    const sent = [];
    mail._transport = { sendMail: async m => { sent.push(m); return { messageId: 'x' }; } };
    try {
      await mail.sendMail({ to: 'amy@example.com', subject: 'Reset your Razzle Social password', text: 'link', html: '<b>link</b>' });
      assert.deepEqual(sent, [{ from: 'Razzle Social <razzlesocialbeta@gmail.com>', to: 'amy@example.com', subject: 'Reset your Razzle Social password', text: 'link', html: '<b>link</b>' }]);
    } finally { mail._transport = null; }
  }));

test('a Gmail failure reports only a code, never the server text or credentials', () =>
  withEnv({ GMAIL_USER: 'razzlesocialbeta@gmail.com', GMAIL_APP_PASSWORD: 'secret-pass' }, async () => {
    mail._transport = { sendMail: async () => { const e = new Error('535 Username and Password not accepted secret-pass'); e.responseCode = 535; throw e; } };
    try {
      await assert.rejects(mail.sendMail({ to: 'a@b.c', subject: 's', text: 't' }), e => e.message === 'mail gmail 535' && !/secret/.test(e.message));
    } finally { mail._transport = null; }
  }));

test('the real transport is nodemailer on smtp.gmail.com:465 with TLS and the app password without spaces', () =>
  withEnv({ GMAIL_USER: 'razzlesocialbeta@gmail.com', GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop' }, async () => {
    const nm = require('nodemailer'), orig = nm.createTransport; let opts;
    nm.createTransport = o => { opts = o; return { sendMail: async () => ({}) }; };
    try { await mail.sendMail({ to: 'a@b.c', subject: 's', text: 't' }); }
    finally { nm.createTransport = orig; }
    assert.deepEqual(opts, { host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'razzlesocialbeta@gmail.com', pass: 'abcdefghijklmnop' } });
  }));

test('/api/reset/config reports email:true when Gmail is configured', () =>
  withEnv({ GMAIL_USER: 'razzlesocialbeta@gmail.com', GMAIL_APP_PASSWORD: 'x' }, async () => {
    const express = require('express'), app = express();
    require('../reset')(app, express);
    const srv = await new Promise(ok => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
    try {
      const r = await fetch('http://127.0.0.1:' + srv.address().port + '/api/reset/config').then(x => x.json());
      assert.deepEqual(r, { email: true });
      delete process.env.GMAIL_APP_PASSWORD;
      const off = await fetch('http://127.0.0.1:' + srv.address().port + '/api/reset/config').then(x => x.json());
      assert.deepEqual(off, { email: false });
    } finally { await new Promise(ok => srv.close(ok)); }
  }));
