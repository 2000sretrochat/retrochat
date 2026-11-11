'use strict';
// You can put your own screen name on your list: added directly (no request), shown with the public presence view.
const test = require('node:test'), assert = require('node:assert');
const fs = require('fs'), path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const acc = R('accounts.js'), api = R('social-next/api.js');

test('m:add on yourself inserts the self contact directly instead of refusing', () => {
  assert.doesNotMatch(acc, /You cannot add yourself/);
  assert.match(acc, /if \(t\.id === uid\) \{ await db\.q\("insert into contacts\(owner,contact,grp\) values\(\$1,\$1,'Friends'\) on conflict do nothing"/);
});
test('self entry uses the public presence (invisible looks offline), not raw status', () => {
  assert.match(acc, /const pres = uid => \{ const st = state\.get\(uid\), on = online\.has\(uid\) && st && st\.status !== 'invisible'/);
  assert.match(acc, /async function contactList\(uid\)[\s\S]{0,300}\.\.\.pres\(c\.id\)/);
});
test('PM / BUZZ / typing / IMVironment to yourself are refused (peer() excludes self)', () => {
  assert.match(acc, /async function peer\(name\) \{ const t = await idOf\(name\); if \(!t \|\| t\.id === uid \|\|/);
});
test('Social friend count and friends list ignore the self entry', () => {
  assert.match(api, /contacts where owner=u\.id and contact<>owner\) as friends/);
  assert.match(api, /where c\.owner=\$1 and c\.contact<>c\.owner/);
});
test('Messenger: self-entry does not open a profile on double-click; no door sound for yourself', () => {
  for (const f of ['public/index.html', 'public/social/messenger.html']) {
    const h = R(f);
    assert.match(h, /This is your own contact entry\. Right-click to view your profile/);
    assert.doesNotMatch(h,/e\.ondblclick=[^;]*YProf\.show/);
    assert.match(h, /if\(ME&&k==ME\.name\.toLowerCase\(\)\)\{/);
  }
});
