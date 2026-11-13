// Each chat room opens in its own window/tab, so joining one room never leaves another (up to 4 rooms at once;
// the server politely refuses a 5th). Re-opening a room that is already open just brings its window forward.
(function(){
  const wins = new Map();
  const roomOf = path => { try { return new URL(path, location.origin).searchParams.get('room') || ''; } catch { return ''; } };
  const nameFor = room => room ? 'yroom_' + room.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 60) : 'yapprooms';
  function openRoomWindow(path) {
    path = String(path || '/rooms.html');
    const room = roomOf(path), key = nameFor(room), old = wins.get(key);
    if (room && old && !old.closed) { try { old.focus(); return old; } catch {} }
    const w = window.open(path, key);
    if (w) wins.set(key, w);
    return w;
  }
  window.openRoomWindow = openRoomWindow;
  window.RazzleRoomWindows = { open: openRoomWindow, nameFor, roomOf };
})();
