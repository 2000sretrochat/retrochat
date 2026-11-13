// Outbound email for password reset, verify, and welcome mail. Two free options:
//  - Resend HTTP when RESEND_API_KEY + MAIL_FROM are set (preferred — works on Render)
//  - Gmail SMTP when GMAIL_USER + GMAIL_APP_PASSWORD are set (smtp.gmail.com:465, an app password, never the account password)
// Resend is used first when both are configured. Credentials are read from the environment only and never logged.
const gmailOn = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
const resendOn = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const enabled = () => resendOn() || gmailOn();
const provider = () => (resendOn() ? 'resend' : gmailOn() ? 'gmail' : null);
const appName = () => { const n = String(process.env.APP_NAME || 'Razzle').trim(); return !n || /^yappchat$/i.test(n) ? 'Razzle' : n; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const gmailFrom = () => 'Razzle Social <' + String(process.env.GMAIL_USER).trim() + '>';

let transport = null, transportKey = '';
// Tests swap in a fake transport; production builds one nodemailer transport per credential set.
function gmailTransport() {
  if (module.exports._transport) return module.exports._transport;
  const key = process.env.GMAIL_USER + '\0' + process.env.GMAIL_APP_PASSWORD;
  if (!transport || transportKey !== key) {
    transport = require('nodemailer').createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: String(process.env.GMAIL_USER).trim(), pass: String(process.env.GMAIL_APP_PASSWORD).replace(/\s+/g, '') },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
    transportKey = key;
  }
  return transport;
}

async function sendMail({ to, subject, text, html }) {
  // Prefer Resend (HTTP API) — reliable on Render
  if (resendOn()) {
    const body = { from: process.env.MAIL_FROM, to: [to], subject, text };
    if (html) body.html = html;
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!r.ok) {
      let detail = '';
      try { detail = (await r.text()).slice(0, 300); } catch { }
      throw new Error('mail resend ' + r.status + (detail ? ' ' + detail : ''));
    }
    return;
  }
  // Fall back to Gmail SMTP
  if (!gmailOn()) throw new Error('mail not configured');
  try {
    await gmailTransport().sendMail({ from: gmailFrom(), to, subject, text, ...(html ? { html } : {}) });
  } catch (e) {
    throw new Error('mail gmail ' + (e && (e.responseCode || e.code) || 'error'));
  }
}

function welcomeContent(name, siteUrl) {
  const app = appName();
  const safe = String(name || '').slice(0, 30);
  const url = String(siteUrl || process.env.PUBLIC_URL || '').replace(/\/$/, '') || 'https://retrochat-izzg.onrender.com';
  const subject = 'Welcome to ' + app + '!';
  const text =
    'Hi ' + safe + ',\n\n' +
    'Welcome to ' + app + '! Your screen name is ready.\n\n' +
    'Here is how to get started:\n' +
    '1. Sign in at ' + url + ' with your screen name and password.\n' +
    '2. Open Browse Rooms, join a chat room, or create your own.\n' +
    '3. Add friends and send private messages (PMs) from Messenger.\n\n' +
    'If you did not create this account, you can ignore this email.\n\n' +
    '- The ' + app + ' team';
  const html =
    '<div style="font:15px/1.5 Arial,sans-serif;color:#1a1a1a;max-width:560px">' +
    '<p>Hi <b>' + esc(safe) + '</b>,</p>' +
    '<p>Welcome to <b>' + esc(app) + '</b>! Your screen name is ready.</p>' +
    '<p>Here is how to get started:</p>' +
    '<ol>' +
    '<li>Sign in at <a href="' + esc(url) + '">' + esc(url) + '</a> with your screen name and password.</li>' +
    '<li>Open <b>Browse Rooms</b>, join a chat room, or create your own.</li>' +
    '<li>Add friends and send private messages (PMs) from Messenger.</li>' +
    '</ol>' +
    '<p style="color:#666;font-size:13px">If you did not create this account, you can ignore this email.</p>' +
    '<p>- The ' + esc(app) + ' team</p>' +
    '</div>';
  return { subject, text, html };
}

async function sendWelcome(to, name, siteUrl) {
  const { subject, text, html } = welcomeContent(name, siteUrl);
  await sendMail({ to, subject, text, html });
}

module.exports = { enabled, provider, appName, sendMail, sendWelcome, welcomeContent, _transport: null };
