const test = require('node:test');
const assert = require('node:assert/strict');
const { createMicBump } = require('../mic-bump');

test('Mic Bump drops once when half of the other chatters ignore a speaker', () => {
  const micBump = createMicBump({});
  const member = name => ({id:name,data:{name,ign:new Set()}});
  const [alex,blaire,casey,drew,ellis] = ['Alex','Blaire','Casey','Drew','Ellis'].map(member);
  const members = [alex,blaire,casey,drew,ellis];
  let drops = 0;
  const drop = socket => { socket.data.talk = false; drops++; };
  const check = () => micBump.reconcile('Lobby',members,drop);
  alex.data.talk = true;
  blaire.data.ign.add('alex');
  assert.equal(check(),false);
  casey.data.ign.add('alex');
  assert.equal(check(),true);
  assert.deepEqual(micBump.prioritize('Lobby',['Alex','Blaire','Drew']),['Blaire','Drew','Alex']);
  alex.data.talk = true;
  assert.equal(check(),false);
  assert.equal(drops,1);
  casey.data.ign.clear();
  check();
  assert.equal(micBump.isLower('Lobby','Alex'),false);
  casey.data.ign.add('alex');
  assert.equal(check(),true);
  assert.equal(drops,2);
});
