const builtInRooms = [
  {
    "icon": "☕",
    "name": "The Lounge",
    "desc": "Good company. No particular agenda.",
    "cat": "Hangouts",
    "tags": "Text · Voice · Webcam",
    "color": "#fdf0df"
  },
  {
    "icon": "♫",
    "name": "Music after midnight",
    "desc": "One good song leads to another.",
    "cat": "Music",
    "tags": "Text · Voice",
    "color": "#eeeafa"
  },
  {
    "icon": "◈",
    "name": "One more round",
    "desc": "Games, new teammates, and post-match chatter.",
    "cat": "Gaming",
    "tags": "Text · Voice",
    "color": "#e5f2ef"
  },
  {
    "icon": "✧",
    "name": "The quiet corner",
    "desc": "Slow conversations. Stay a while.",
    "cat": "Hangouts",
    "tags": "Text",
    "color": "#e9f1fb"
  }
];
function previewRooms() {
  try { return [...builtInRooms, ...JSON.parse(localStorage.getItem('ys-previewRooms') || '[]')]; }
  catch { return builtInRooms; }
}

function renderFeaturedRooms(container, currentRoom) {
  const rooms = [
    { name: 'Lobby', icon: '☕', desc: 'Pull up a chair and say hi.' },
    { name: 'Late Night', icon: '☾', desc: 'For the night owls.' },
    builtInRooms.find(room => room.name === 'The Lounge')
  ];
  container.innerHTML = '<p class="label">FEATURED ROOMS</p>' + rooms.map((room, index) =>
    `<a class="featured-room"${room.name === currentRoom ? ' aria-current="page"' : ''} href="rooms.html?guest=1&amp;room=${encodeURIComponent(room.name)}"><span class="topic t${index + 1}" aria-hidden="true">${room.icon}</span><span>${esc(room.name)}<small>${esc(room.desc)}</small></span></a>`
  ).join('');
}
