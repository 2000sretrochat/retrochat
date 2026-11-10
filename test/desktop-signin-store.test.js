const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { createSigninStore } = require('../desktop/signin-store');

// Stand-in for Electron safeStorage: reversible but not plain text.
const fakeCrypto = (on = true) => ({
  isEncryptionAvailable: () => on,
  encryptString: s => Buffer.from('ENC:' + Buffer.from(s).toString('hex')),
  decryptString: b => { const t = b.toString(); assert.ok(t.startsWith('ENC:')); return Buffer.from(t.slice(4), 'hex').toString(); }
});
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'rzn-')), 'signin-names.json');

test('names are remembered by default, most recent first, case-insensitive', () => {
  let t = 1000; const file = tmp(); const s = createSigninStore({ file, crypto: fakeCrypto(), now: () => t });
  s.record('Zainy'); t = 2000; s.record('tony'); t = 3000; s.record('ZAINY');
  assert.deepEqual(s.list(), [{ name: 'ZAINY', saved: false, invisible: false }, { name: 'tony', saved: false, invisible: false }]);
  const again = createSigninStore({ file, crypto: fakeCrypto(), now: () => t });
  assert.deepEqual(again.list().map(e => e.name), ['ZAINY', 'tony']);
});

test('save password stores it encrypted only, and unticking forgets it', () => {
  const file = tmp(); const s = createSigninStore({ file, crypto: fakeCrypto() });
  s.record('razzle', { password: 'hunter22', save: true });
  assert.equal(s.password('razzle'), 'hunter22');
  assert.equal(fs.readFileSync(file, 'utf8').includes('hunter22'), false, 'never plain text on disk');
  assert.deepEqual(s.list(), [{ name: 'razzle', saved: true, invisible: false }]);
  assert.equal(JSON.stringify(s.list()).includes('hunter22'), false);
  // signing in with the saved password (password null) keeps it
  s.record('razzle', { password: null, save: true });
  assert.equal(s.password('razzle'), 'hunter22');
  s.record('razzle', { password: 'x', save: false });
  assert.equal(s.password('razzle'), null);
  assert.deepEqual(s.list(), [{ name: 'razzle', saved: false, invisible: false }]);
});

test('no password is saved when OS encryption is unavailable', () => {
  const s = createSigninStore({ file: tmp(), crypto: fakeCrypto(false) });
  assert.equal(s.canSavePasswords(), false);
  s.record('bigtony', { password: 'secretpw', save: true });
  assert.equal(s.password('bigtony'), null);
  assert.deepEqual(s.list(), [{ name: 'bigtony', saved: false, invisible: false }]);
});

test('remove deletes the name and its saved password; invalid names are ignored', () => {
  const file = tmp(); const s = createSigninStore({ file, crypto: fakeCrypto() });
  s.record('tony', { password: 'pw123456', save: true }); s.record('zainy');
  assert.equal(s.remove('TONY'), true);
  assert.deepEqual(s.list().map(e => e.name), ['zainy']);
  assert.equal(s.password('tony'), null);
  assert.equal(fs.readFileSync(file, 'utf8').includes('tony'), false);
  assert.equal(s.record('<script>'), false);
  assert.equal(s.record('ab'), false);
  assert.equal(s.remove('nobody'), false);
});

test('a corrupt file starts empty instead of crashing', () => {
  const file = tmp(); fs.writeFileSync(file, '{not json');
  const s = createSigninStore({ file, crypto: fakeCrypto() });
  assert.deepEqual(s.list(), []);
});

test('"Sign in as invisible" is remembered per screen name', () => {
  const file = tmp(); const s = createSigninStore({ file, crypto: fakeCrypto() });
  s.record('zainy', { invisible: true }); s.record('tony', { invisible: false });
  assert.deepEqual(s.list().map(e => [e.name, e.invisible]), [['tony', false], ['zainy', true]]);
  s.record('zainy', { password: 'pw123456', save: true }); // invisible left undefined: keep the earlier choice
  assert.equal(s.list().find(e => e.name === 'zainy').invisible, true);
  s.record('zainy', { invisible: false });
  assert.equal(s.list().find(e => e.name === 'zainy').invisible, false);
  assert.equal(createSigninStore({ file, crypto: fakeCrypto() }).list().find(e => e.name === 'zainy').invisible, false);
});
