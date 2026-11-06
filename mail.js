// Outbound email via Resend HTTP when RESEND_API_KEY + MAIL_FROM are set.
// No SMTP dependency. Used for password reset, verify, and welcome mail.
const enabled = () => !!(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
const appName = () => { const n = String(process.env.APP_NAME || 'Razzle').trim(); return n || 'Razzle'; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendMail({ to, subject, text, html }) {
  if (!enabled()) throw new Error('mail not configured');
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
    throw new Error('mail ' + r.status + (detail ? ' ' + detail : ''));
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

module.exports = { enabled, appName, sendMail, sendWelcome, welcomeContent };
