// Saved screen names for the Razzle Messenger sign-in screen.
// Names are remembered by default (most recent first). A password is kept only when the user
// ticks "Save password", and only encrypted with Electron safeStorage (DPAPI on Windows).
// Passwords never leave this module except to the main process's own sign-in request.
const fs = require('fs');
const MAX = 50, NAME_RE = /^[A-Za-z][A-Za-z0-9_.]{2,19}$/;
const key = n => String(n || '').trim().toLowerCase();

function createSigninStore({ file, crypto, now = () => Date.now() }) {
  // crypto: { isEncryptionAvailable(), encryptString(s) -> Buffer, decryptString(Buffer) -> string }
  let data = { names: [] };
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (raw && Array.isArray(raw.names)) data.names = raw.names.filter(e => e && NAME_RE.test(e.name || ''));
  } catch {}
  const write = () => {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
    fs.renameSync(tmp, file);
  };
  const find = n => data.names.find(e => key(e.name) === key(n));
  const canSave = () => { try { return !!crypto.isEncryptionAvailable(); } catch { return false; } };
  const sorted = () => data.names.slice().sort((a, b) => (b.used || 0) - (a.used || 0));

  return {
    canSavePasswords: canSave,
    // Safe to hand to the page: names and whether a password is saved, never the password.
    list: () => sorted().map(e => ({ name: e.name, saved: !!e.pw, invisible: !!e.inv })),
    // Record a successful sign-in. save=true stores the password encrypted; save=false forgets it.
    // password=null with save=true keeps whatever is already saved. invisible (true/false) is remembered per name;
    // leave it undefined to keep the previous choice.
    record(name, { password = null, save = false, invisible } = {}) {
      name = String(name || '').trim();
      if (!NAME_RE.test(name)) return false;
      let e = find(name);
      if (!e) { e = { name }; data.names.push(e); }
      e.name = name; e.used = Math.max(now(), ...data.names.map(x => (x.used || 0) + 1));
      if (invisible === true) e.inv = true; else if (invisible === false) delete e.inv;
      if (!save) delete e.pw;
      else if (password != null && canSave()) e.pw = crypto.encryptString(String(password)).toString('base64');
      else if (!canSave()) delete e.pw;
      data.names = sorted().slice(0, MAX);
      write();
      return true;
    },
    remove(name) {
      const before = data.names.length;
      data.names = data.names.filter(e => key(e.name) !== key(name));
      if (data.names.length !== before) write();
      return data.names.length !== before;
    },
    hasPassword: name => !!find(name)?.pw,
    // Main process only.
    password(name) {
      const e = find(name);
      if (!e?.pw || !canSave()) return null;
      try { return crypto.decryptString(Buffer.from(e.pw, 'base64')); } catch { return null; }
    }
  };
}
module.exports = { createSigninStore, NAME_RE, MAX };
