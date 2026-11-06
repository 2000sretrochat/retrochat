const liveMessenger = 'https://retrochat-izzg.onrender.com/';
const liveRooms = liveMessenger + 'rooms.html';
// Set to a public HTTPS installer URL when the release is ready.
const messengerInstallerUrl = 'https://github.com/2000sretrochat/retrochat/releases/latest/download/YappChat-Setup.exe';
const joinSocialUrl = liveMessenger + '?chat=1&signup=1&social=1';
const welcomePreview = new URLSearchParams(location.search).get('view') === 'welcome';
let previewSignedIn = !welcomePreview && read('previewSignedIn', true);
const renderExistingView = show;
const renderExistingProfile = profile;
const renderExistingCard = card;
const composeExistingPost = compose;

function renderAccountMenu() {
  $('#account-menu').innerHTML = previewSignedIn
    ? '<button onclick="profile(\'yappchat\')" class="account-name"><span class="avatar z" aria-hidden="true">Z</span><strong>yappchat</strong></button><button class="account-logout" onclick="logoutPreview()">Log out of preview</button>'
    : `<button type="button" class="text-action" onclick="showSocialHome();document.querySelector('#welcome-screen-name').focus()">Sign in</button>`;
  document.querySelectorAll('[data-member-only]').forEach(item => { item.hidden = !previewSignedIn; });
  $('.left .identity').hidden = !previewSignedIn;
  document.body.classList.toggle('signed-out', !previewSignedIn);
  $('.left > .primary').hidden = !previewSignedIn;
}

function logoutPreview() {
  previewSignedIn = false;
  save('previewSignedIn', false);
  renderAccountMenu();
  location.assign('./');
}

function openPreviewAccount() {
  previewSignedIn = true;
  save('previewSignedIn', true);
  renderAccountMenu();
  show('feed');
}

const interestChoices = [
  'Government', 'Politics', 'Republicans', 'Trump', 'Christianity', 'Islam',
  'Cars', 'Food', 'Travel', 'Music', 'Photography', 'Gaming', 'Movies', 'Books',
];
const samplePeopleDetails = {
  NightOwl: { sex: 'Female', age: 29, location: 'Portland, Oregon, United States', interests: ['Music', 'Travel'] },
  RetroFan: { sex: 'Male', age: 38, location: 'Columbus, Ohio, United States', interests: ['Politics', 'Government', 'Cars'] },
  MiaLuvs: { sex: 'Female', age: 26, location: 'Austin, Texas, United States', interests: ['Photography', 'Food', 'Travel'] },
  Moonlight: { sex: 'Male', age: 34, location: 'Toronto, Ontario, Canada', interests: ['Books', 'Movies'] },
};

function renderPeopleDirectory() {
  $('#heading').textContent = 'Find your people';
  $('#subheading').textContent = 'Look for a shared interest or discover someone nearby.';
  $('#content').innerHTML = `<section class="directory"><h2>Profiles</h2>
    <form class="people-filters" id="people-filters">
      <label>Screen name<input name="screenName" placeholder="Any screen name"></label>
      <label>Age<select name="age"><option value="">Any age</option><option value="18-24">18–24</option><option value="25-34">25–34</option><option value="35-44">35–44</option><option value="45-120">45 and up</option></select></label>
      <label>Sex<select name="sex"><option value="">Any</option><option>Male</option><option>Female</option></select></label>
      <label>Location<input name="location" placeholder="City, state, or country"></label>
      <label>Interest<select name="interest"><option value="">Any interest</option>${interestChoices.map(interest => `<option>${esc(interest)}</option>`).join('')}</select></label>
    </form>
    <div id="people-matches" aria-live="polite"></div>
  </section>`;
  const form = $('#people-filters');
  function updateResults() {
    const { screenName, age, sex, location, interest } = form.elements;
    const [min, max] = age.value.split('-').map(Number);
    const matches = users.filter(user => {
      const data = samplePeopleDetails[user.name];
      return user.name.toLowerCase().includes(screenName.value.trim().toLowerCase())
        && (!age.value || (data.age >= min && data.age <= max))
        && (!sex.value || data.sex === sex.value)
        && (!location.value.trim() || (!sampleBotProfiles[user.name]?.private && data.location.toLowerCase().includes(location.value.trim().toLowerCase())))
        && (!interest.value || (!sampleBotProfiles[user.name]?.private && data.interests.includes(interest.value)));
    });
    $('#people-matches').innerHTML = matches.map(user => {
      const data = samplePeopleDetails[user.name];
      return `<div class="suggestion">${profileAvatar(user.name)}<a href="${profilePath(user.name)}" data-profile-link="${esc(user.name)}"><strong>${esc(user.name)}</strong><small>${sampleBotProfiles[user.name]?.private ? 'Private profile' : esc(data.location)}</small></a></div>`;
    }).join('') || '<p>No sample profiles match these filters.</p>';
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', updateResults);
  updateResults();
}

const editProfileBeforeInterests = editProfile;
editProfile = function () {
  editProfileBeforeInterests();
  const input = $('#edit-form').elements.interests;
  const fieldset = document.createElement('fieldset');
  fieldset.className = 'interest-options';
  const selected = () => input.value.split(',').map(value => value.trim()).filter(Boolean);
  fieldset.innerHTML = '<legend>Choose your interests</legend>' + interestChoices.map(interest =>
    `<label><input type="checkbox" value="${esc(interest)}"> ${esc(interest)}</label>`
  ).join('');
  function syncChoices() {
    const values = selected().map(value => value.toLowerCase());
    fieldset.querySelectorAll('input').forEach(box => { box.checked = values.includes(box.value.toLowerCase()); });
  }
  syncChoices();
  input.addEventListener('input', syncChoices);
  fieldset.addEventListener('change', event => {
    const choice = event.target;
    const values = selected().filter(value => value.toLowerCase() !== choice.value.toLowerCase());
    if (choice.checked) values.push(choice.value);
    input.value = values.join(', ');
  });
  input.closest('label').after(fieldset);
};


const sampleBotProfiles = {
  NightOwl: { photo: 0, photoCaption: 'Headphones on for another late night.', postedAt: '2026-11-05T05:18:00Z', alt: 'Generated webcam-style portrait with headphones', note: 'The rest of the house is asleep and I just made coffee.', room: 'Late Night', post: 'Bored, hanging out in', replies: ['RetroFan: Save me a seat.'] },
  RetroFan: { photo: 1, photoCaption: 'The lake right after sunset.', postedAt: '2026-11-04T23:42:00Z', alt: 'Generated photo of a mountain lake at dusk', note: 'I miss the sound of signing on.', room: 'Lobby', post: 'Anyone up for a little nostalgia in', replies: ['NightOwl: I remember that sound.'] },
  MiaLuvs: { photo: 3, photoCaption: 'Caught the soft light on my walk.', postedAt: '2026-11-05T00:26:00Z', alt: 'Generated outdoor phone selfie', note: 'Always looking for a good photo spot.', room: 'Chit Chat', post: 'Talking about favorite photo spots in', replies: ['NightOwl: Golden hour gets my vote.'] },
  Moonlight: { photo: 2, alt: 'Generated phone selfie with glasses and a playful star filter', note: 'Taking a quiet minute outside.', room: 'The Lounge', private: true },
};

function profilePath(name) {
  return '/@' + encodeURIComponent(name.toLowerCase());
}

function profileRouteName() {
  const route = location.pathname.match(/^\/@([^/]+)\/?$/);
  if (!route) return null;
  try {
    const handle = decodeURIComponent(route[1]).toLowerCase();
    return ['yappchat', ...users.map(user => user.name)].find(name => name.toLowerCase() === handle) || '';
  } catch { return ''; }
}

function clearProfileRoute() {
  if (profileRouteName() !== null) history.pushState(null, '', '/');
}

function botPhoto(bot, kind) {
  return '<span class="bot-photo ' + kind + ' bot-photo-' + bot.photo + '" role="img" aria-label="' + esc(bot.alt) + '"></span>';
}

function profileAvatar(name) {
  const bot = sampleBotProfiles[name];
  return bot ? botPhoto(bot, 'avatar') : av(name);
}

function botRoomLink(name) {
  return '<a class="profile-room-mention" data-live-room="' + esc(name) + '" href="/?room=' + encodeURIComponent(name) + '#chat">#' + esc(name.replace(/[^a-z0-9]/gi, '')) + '</a>';
}

function profileUserLink(name) {
  return '<a href="' + profilePath(name) + '" data-profile-link="' + esc(name) + '">' + esc(name) + '</a>';
}

function profileTimestamp(value) {
  return '<time datetime="' + esc(value) + '">' + esc(new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})) + '</time>';
}

const profileCommentTimes = read('profileCommentTimes', {});

function profilePostComments(id, replies = []) {
  const rows = [...replies, ...(comments[id] || []).map((text, index) => ({ name:'yappchat', text, date:profileCommentTimes[id]?.[index] }))];
  return '<div class="profile-post-comments"><h4>Comments</h4>' + (rows.map(reply =>
    '<p><strong>' + profileUserLink(reply.name) + '</strong>' +
    (reply.date ? ' ' + profileTimestamp(reply.date) : '') + '<br>' + esc(reply.text) + '</p>'
  ).join('') || '<p>No comments yet.</p>') +
    (previewSignedIn ? '<button class="secondary" data-profile-comment="' + esc(id) + '">Add a comment</button>' : '') + '</div>';
}

function addProfileComment(id) {
  modal('<h2>Add a comment</h2><form id="profile-comment-form"><textarea required maxlength="1500" aria-label="Comment"></textarea><button class="primary">Post comment</button></form>');
  $('#profile-comment-form').onsubmit = event => {
    event.preventDefault();
    const text = event.target.querySelector('textarea').value.trim();
    if (!text) return;
    const rows = comments[id] ??= [];
    (profileCommentTimes[id] ??= [])[rows.length] = new Date().toISOString();
    rows.push(text);
    save('comments', comments);
    save('profileCommentTimes', profileCommentTimes);
    $('#dialog').close();
    if (current === 'profile') profile(window.profileName);
    else render();
  };
}

function openProfilePhoto(id) {
  const post = [...own, ...seeds].find(item => item.id === id && item.image);
  if (!post || (post.name === 'yappchat' && publicPreview && visibility === 'private')) return;
  const date = post.createdAt || (/^own-\d+$/.test(post.id) ? new Date(Number(post.id.slice(4))).toISOString() : '');
  modal('<article class="bot-profile-post"><strong>' + profileUserLink(post.name) + '</strong>' +
    (date ? profileTimestamp(date) : '') + '<p>' + esc(post.text || '') + '</p><img class="profile-photo-detail" src="' +
    esc(post.image) + '" alt="Shared photo">' + profilePostComments(id) + '</article>');
}

function botPhotoPost(name, bot, expanded = false) {
  const id = 'bot-photo-' + name;
  const date = new Date(Date.parse(bot.postedAt) - 86400000).toISOString();
  const photo = botPhoto(bot, 'bot-photo-large');
  return '<article class="space-card bot-profile-post"><strong>' + profileUserLink(name) + '</strong>' +
    profileTimestamp(date) + '<p>' + esc(bot.photoCaption) + '</p><figure class="bot-profile-figure">' +
    (expanded ? photo : '<button type="button" class="profile-photo-open" data-bot-photo="' + esc(name) + '" aria-label="Open photo and comments">' + photo + '</button>') +
    '</figure>' + profilePostComments(id) + '</article>';
}

function showOwnedRooms(name) {
  const target = $('#profile-owned-rooms');
  if (!target) return;
  getLiveDirectory().then(({ rooms }) => {
    if (!target.isConnected) return;
    const owned = rooms.filter(room => room.owner.toLowerCase() === name.toLowerCase());
    if (!owned.length) return;
    target.hidden = false;
    target.innerHTML = '<h3>Rooms owned</h3>' + owned.map(room => '<p>' + botRoomLink(room.name) + '</p>' +
      (room.topic ? '<p>' + esc(room.topic) + '</p>' : '')).join('');
  }).catch(() => {});
}

function renderPublicPerson(name) {
  const user = users.find(person => person.name === name);
  const bot = sampleBotProfiles[name];
  if (!user || !bot) return;
  current = 'profile';
  window.profileName = name;
  $('#content').classList.remove('custom-space');
  $('#content').removeAttribute('style');
  $('.write').hidden = true;
  $('.feed-nav').hidden = true;
  document.querySelectorAll('.menu .selected').forEach(item => item.classList.remove('selected'));
  $('#playlist-dock')?.remove();
  $('#heading').textContent = '@' + name.toLowerCase();
  $('#subheading').textContent = 'Profile';
  const info = samplePeopleDetails[name];
  const room = botRoomLink(bot.room);
  const publicInfo = bot.private ? '' :
    '<section class="space-card"><h3>About</h3><p>' + esc(user.about) + '</p>' + memberSince(name) + '</section>' +
    '<section class="space-card"><h3>Interests</h3><div class="profile-interest-links">' + info.interests.map(interest =>
      '<a href="/?interest=' + encodeURIComponent(interest) + '#chat" data-room-interest="' + esc(interest) + '">' + esc(interest) + '</a>'
    ).join('') + '</div></section><section class="space-card"><h3>Favorite rooms</h3><p>' + room + '</p></section>' +
    '<section class="space-card" id="profile-owned-rooms" hidden></section>';
  const replies = (bot.replies || []).map(reply => {
    const split = reply.indexOf(':');
    return { name: reply.slice(0, split), text: reply.slice(split + 1).trim(), date: new Date(Date.parse(bot.postedAt) + 8 * 60000).toISOString() };
  });
  const shared = bot.private
    ? '<section class="space-card private-notice"><h3>Private profile</h3><p>Only the profile picture, basic details, and status are shared.</p></section>'
    : '<section class="profile-post-stream"><h3>Posts</h3><article class="space-card bot-profile-post"><strong>' + profileUserLink(name) + '</strong>' +
      profileTimestamp(bot.postedAt) + '<p>' + esc(bot.post) + ' ' + room + '.</p>' +
      profilePostComments('bot-post-' + name, replies) + '</article>' + botPhotoPost(name, bot) + '</section>';
  const controls = previewSignedIn && !bot.private
    ? '<div class="space-actions"><button class="primary" onclick="follow(\'' + name + '\')">' + (following.includes(name) ? 'Following' : '+ Follow') +
      '</button><button class="secondary" onclick="request(\'' + name + '\')">Messenger</button><button class="text-action" onclick="blockAlias(\'' + name + '\')">Block alias</button></div>'
    : '';
  $('#content').innerHTML = '<div class="space-layout bot-space"><aside class="space-about"><section class="space-card">' +
    botPhoto(bot, 'bot-photo-portrait') + '<h2>' + esc(name) + '</h2><span class="handle">@' + esc(name.toLowerCase()) +
    '</span><div class="profile-basics">' + info.age + ' years old · ' + esc(info.sex) +
    '</div><blockquote class="profile-thought">' + esc(bot.note) + '</blockquote>' + controls + '</section>' + publicInfo +
    '</aside><section class="space-posts">' + shared + '</section></div>';
  showOwnedRooms(name);
}

function showMessengerDownload() {
  if (messengerInstallerUrl) { location.assign(messengerInstallerUrl); return; }
  modal(`<h2>Download Messenger</h2><p>The desktop download is coming soon. You can open Messenger in your browser today.</p><a class="text-action" href="${liveMessenger}">Open Messenger in your browser →</a>`);
}

function renderSignedOutHome() {
  document.body.classList.add('guest-home');
  $('#content').innerHTML = `<div class="welcome-grid">
    <div class="welcome-main">
    <section class="welcome-hero">
      <p class="welcome-eyebrow">CHAT ROOMS · SOCIAL PROFILES · MESSENGER</p>
      <h1>Talk live. Be yourself.</h1>
      <p>Talk with real people in live chat rooms. Stay in touch through profiles, posts, and Messenger.</p>
      <div class="welcome-hero-actions">
        <a class="primary home-cta welcome-join" href="${joinSocialUrl}">Join</a>
        <a class="home-cta welcome-guest" href="rooms.html">Browse chat rooms</a>
      </div>

      <button type="button" class="messenger-download" onclick="showMessengerDownload()">Download Messenger</button>
      <div class="welcome-privacy"><strong>Start with a screen name.</strong> You choose how much of your offline life to share.</div>
    </section>
  <div class="welcome-features">
    <section><h2>Talk in real time</h2><p>Pull up a chair in a voice room. Listen first or jump into the conversation.</p></section>
    <section><h2>Make a space of your own</h2><p>Share photos, links, and thoughts with the people you meet.</p></section>
    <section><h2>Stay in touch</h2><p>Keep familiar screen names close with Messenger.</p></section>
  </div>
    </div>
    <aside class="welcome-side">
      <section class="welcome-account" aria-labelledby="welcome-signin">
        <h2 id="welcome-signin" class="welcome-panel-title">Sign in to the preview</h2>
        <div class="welcome-panel-body">
          <form id="welcome-preview-form" class="welcome-preview-form" method="post" autocomplete="off">
            <label for="welcome-screen-name">Screen name</label>
            <input id="welcome-screen-name" placeholder="yappchat" aria-describedby="welcome-preview-hint" required maxlength="20">
            <label for="welcome-password">Password</label>
            <input id="welcome-password" type="password" aria-describedby="welcome-preview-hint" required maxlength="100">
            <p id="welcome-preview-hint">Use your real Razzle account. Demo passwords are disabled.</p>
            <p class="welcome-form-error" role="status"></p>
            <button class="secondary home-cta welcome-signin" type="submit">Sign in to preview</button>
          </form>
          <div class="welcome-account-actions">
            <a class="text-action" href="${joinSocialUrl}">New here? Create an account</a>
          </div>
          <a class="welcome-reset" href="${liveMessenger}reset.html">Forgot your password?</a>
        </div>
      </section>
      <section class="welcome-people" aria-labelledby="welcome-people-title">
        <h2 id="welcome-people-title" class="welcome-panel-title">Meet the Community</h2>
        <div class="welcome-panel-body">
          <div class="welcome-people-grid">
            ${users.map(user => `<a href="${profilePath(user.name)}" data-profile-link="${esc(user.name)}">${profileAvatar(user.name)}<strong>${esc(user.name)}</strong></a>`).join('')}
          </div>
          <p class="welcome-people-note">Fictional profiles and posts for this preview</p><button type="button" class="text-action" onclick="show('people')">See more people →</button>
        </div>
      </section>
    </aside>
  </div>

  <p class="home-demo">Profiles and feeds in this preview are saved in this browser.</p>`;
  $('#welcome-preview-form').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.querySelector('#welcome-screen-name');
    const password = form.querySelector('#welcome-password');
    if (false && name.value.trim().toLowerCase() === 'yappchat' && password.value === 'razzle-demo') { // disabled: use live Render auth
      openPreviewAccount();
      return;
    }
    form.querySelector('.welcome-form-error').textContent = 'Use your real Razzle screen name and password at retrochat-izzg.onrender.com';
    password.value = '';
    password.focus();
  });
}

function showSocialHome() {
  clearProfileRoute();
  if (location.hash === '#chat') history.replaceState(null, '', location.pathname);
  document.querySelectorAll('[data-live-room]').forEach(link => link.removeAttribute('aria-current'));
  $('.menu a[href="rooms.html"]').classList.remove('selected');
  $('.menu a[href="rooms.html"]').removeAttribute('aria-current');
  renderExistingView('home');
  $('#search').value = '';
  q = '';
  $('.menu [data-view="home"]').classList.add('selected');
  $('#heading').textContent = 'Welcome to Razzle Social';
  $('#subheading').textContent = 'A place to meet by screen name and keep the conversation going.';
  if (!previewSignedIn) { renderSignedOutHome(); return; }
  document.body.classList.remove('guest-home');
  $('#content').innerHTML = `<div class="home-dashboard">
    <section class="home-intro">
      <span class="home-kicker">CHAT ROOMS · SOCIAL PROFILES · MESSENGER</span>
      <h2>Find your people.<br>Keep talking.</h2>
      <p>Drop into a voice room, see what your friends are sharing, or make a space of your own.</p>
      <button class="primary home-cta" onclick="show('rooms')">Explore chat rooms</button>
    </section>
    <div class="home-actions">
      <section><span class="home-card-icon" aria-hidden="true">☷</span><h2>Your feed</h2><p>Catch up on photos, links, and thoughts from people you follow.</p><button class="text-action" onclick="show('feed')">Open your feed →</button></section>
      <section><span class="home-card-icon" aria-hidden="true">◈</span><h2>Your space</h2><p>Make your profile yours and share something with your circle.</p><button class="text-action" onclick="profile('yappchat')">Open your space →</button></section>
      <section><span class="home-card-icon" aria-hidden="true"><img src="bubbles.svg" alt=""></span><h2>Messenger</h2><p>Keep the conversation going with familiar screen names.</p><a class="text-action" href="${liveMessenger}">Open Messenger →</a><button type="button" class="messenger-download" onclick="showMessengerDownload()">Download Messenger</button></section>
    </div>
    <p class="home-demo">You’re exploring the Social preview. <a href="?view=welcome">View the welcome page →</a></p>
  </div>`;
}

function roomResults(query) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return previewRooms().filter(room => {
    const searchable = [room.name, room.cat, room.desc, ...(room.topics || [])].join(' ').toLowerCase();
    return terms.every(term => searchable.includes(term));
  });
}

function roomList(rooms) {
  return rooms.map(room => `<article class="room-result">
    <div><strong>${esc(room.name)}</strong><p>${esc(room.desc)}</p>
    <div class="room-tags">${(room.topics || []).map(tag => `<span>${esc(tag)}</span>`).join('')}</div></div>
    <div class="room-links"><a class="secondary" href="rooms.html?guest=1&amp;room=${encodeURIComponent(room.name)}">Explore room ↗</a>${previewSignedIn && room.owner === 'yappchat' ? `<button class="text-action" data-room-id="${esc(room.id)}">Edit topics</button>` : ''}</div>
  </article>`).join('') || '<p>No matching rooms or topics.</p>';
}

let liveDirectory;
let liveDirectoryAt = 0;
let selectedLiveRoom = new URLSearchParams(location.search).get('room');

const roomShortcuts = [
  { name: 'Lobby', topic: 'Pull up a chair and say hi.', icon: '☕' },
  { name: 'Late Night', topic: 'For the night owls.', icon: '☾' },
  { name: 'The Lounge', topic: 'Good company. No particular agenda.', icon: '✧' },
];
const englishRoomNames = new Set(["Lobby","Late Night","The Lounge","Friends","Chit Chat","Advice Central","Cultures and Community Lobby","Holiday Happenings"]);

async function fetchLiveDirectory() {
  const sources = [
    fetch('/api/live-rooms', { signal: AbortSignal.timeout(8500) }).then(async response => {
      if (!response.ok) throw Error('Social room feed unavailable');
      const result = await response.json();
      if (!Array.isArray(result.rooms) || !Array.isArray(result.featured)) throw Error('Invalid room feed');
      return result;
    }),
    fetch(new URL('api/rooms', liveMessenger), {
      credentials: 'omit', signal: AbortSignal.timeout(12000),
    }).then(async response => {
      if (!response.ok) throw Error('Chat room feed unavailable');
      const raw = await response.json();
      if (!Array.isArray(raw)) throw Error('Invalid room feed');
      const rooms = raw.filter(room => room && ['G', 'PG', 'PG-13'].includes(room.rating) &&
        typeof room.name === 'string' && room.name.trim() &&
        Number.isSafeInteger(room.count) && room.count >= 0).map(room => ({
          name: room.name,
          topic: typeof room.topic === 'string' ? room.topic : '',
          category: typeof room.cat === 'string' ? room.cat : '',
          icon: typeof room.icon === 'string' ? room.icon.slice(0, 24) : '',
          owner: typeof room.owner === 'string' ? room.owner : '',
          createdAt: typeof room.createdAt === 'string' ? room.createdAt : '',
          likes: Number.isSafeInteger(room.likes) && room.likes >= 0 ? room.likes : null,
          rating: room.rating,
          mics: Number.isSafeInteger(room.mics) ? room.mics : null,
          count: room.count,
          english: englishRoomNames.has(room.name),
        })).sort((a, b) => Number(b.english) - Number(a.english) ||
          b.count - a.count || a.name.localeCompare(b.name));
      return { rooms, featured: rooms.filter(room => room.english && room.count > 0).slice(0, 5) };
    }),
  ];
  return Promise.any(sources);
}

function getLiveDirectory() {
  if (!liveDirectory || Date.now() - liveDirectoryAt > 30000) {
    liveDirectoryAt = Date.now();
    liveDirectory = fetchLiveDirectory().catch(error => {
      liveDirectory = null;
      throw error;
    });
  }
  return liveDirectory;
}

function roomProfileUrl(name) {
  return '/?room=' + encodeURIComponent(name) + '#chat';
}

function rememberRoomProfile(name) {
  const next = roomProfileUrl(name);
  if (location.pathname + location.search + location.hash !== next) history.pushState(null, '', next);
}

function liveRoomUrl(name) {
  const url = new URL(liveRooms);
  if (name) url.searchParams.set('room', name);
  return url.href;
}

function loadLiveFeaturedRooms() {
  const list = $('.topic-list');
  list.innerHTML = '<p class="label">FEATURED ROOMS</p><p>Checking which rooms are active…</p>';
  getLiveDirectory().then(({ featured }) => {
    list.innerHTML = '<p class="label">FEATURED ROOMS</p>' + (featured.map(room =>
      `<a class="featured-room" data-live-room="${esc(room.name)}" href="${roomProfileUrl(room.name)}">${roomThumbnail(room, 'room-thumb-sidebar')}<span>${esc(room.name)}<small>${room.count} in room</small></span></a>`
    ).join('') || '<p>No featured rooms are active right now.</p>');
    markLiveRoom();
  }).catch(() => {
    list.innerHTML = '<p class="label">ROOM SHORTCUTS</p>' + roomShortcuts.map(room =>
      `<a class="featured-room" data-live-room="${esc(room.name)}" href="${roomProfileUrl(room.name)}">${roomThumbnail(room, 'room-thumb-sidebar')}<span>${esc(room.name)}<small>Activity unavailable</small></span></a>`
    ).join('');
    markLiveRoom();
  });
}

function markLiveRoom() {
  const onChat = Boolean($('#live-chat-view'));
  const chatLink = $('.menu a[href="rooms.html"]');
  let hasFeaturedSelection = false;
  document.querySelectorAll('[data-live-room]').forEach(link => {
    const current = onChat && link.dataset.liveRoom === selectedLiveRoom;
    if (current) {
      link.setAttribute('aria-current', 'page');
      hasFeaturedSelection = true;
    } else link.removeAttribute('aria-current');
  });
  chatLink.classList.toggle('selected', onChat && !hasFeaturedSelection);
  if (onChat && !hasFeaturedSelection) chatLink.setAttribute('aria-current', 'page');
  else chatLink.removeAttribute('aria-current');
}

function roomThumbnail(room, kind) {
  const name = room?.name || '';
  const words = [name, room?.category].join(' ').toLowerCase();
  const mark = room?.icon || (/night|moon/.test(words) ? '☾' : /lobby|lounge|coffee/.test(words) ? '☕' :
    /music|dance/.test(words) ? '♫' : /game|gaming/.test(words) ? '♟' :
    /sport/.test(words) ? '★' : /art|photo/.test(words) ? '✦' : '☏');
  const colors = Array.from(name).reduce((sum, letter) => sum + letter.codePointAt(0), 0) % 4;
  return '<span class="room-thumbnail room-thumbnail-' + colors + ' ' + kind + '" aria-hidden="true"><span>' + esc(mark) + '</span></span>';
}

function roomRating(value) {
  const key = { G:'G', PG:'G', 'PG-13':'G', R:'R', A:'A' }[value];
  const descriptions = { G:'General room. Standard chat rules apply.', R:'Restricted room. Mature topics may be discussed.', A:'Adult room. Explicit adult content may be present.' };
  return key ? '<span class="room-rating" tabindex="0" aria-label="' + key + ': ' + descriptions[key] + '" title="' +
    descriptions[key] + '" data-description="' + descriptions[key] + '">' + key + '</span>' : '';
}

function renderRoomDirectory() {
  $('#heading').textContent = 'Razzle Chat';
  $('#subheading').textContent = 'Find a live room and join the conversation.';
  $('#content').innerHTML = `<div id="live-chat-view" class="live-chat-view">
    <section class="directory"><h2 class="live-directory-title"${selectedLiveRoom ? ' hidden' : ''}>Live chat rooms</h2>
      <div class="directory-actions"><button class="secondary" type="button" data-live-tab="top" aria-pressed="${!selectedLiveRoom}">Top Rooms</button>
      <button class="secondary" type="button" data-live-tab="all" aria-pressed="false">Browse Rooms</button></div>
      <div id="live-room-entry" hidden></div><div class="live-room-list" aria-live="polite"><p>Loading live rooms…</p></div>
    </section><aside>${$('#live-chat-messenger').innerHTML}</aside></div>`;
  const view = $('#live-chat-view');
  const list = view.querySelector('.live-room-list');
  const title = view.querySelector('.live-directory-title');
  let tab = $('#search').value ? 'all' : 'top';
  view.querySelector('[data-live-tab="top"]').setAttribute('aria-pressed', String(tab === 'top' && !selectedLiveRoom));
  view.querySelector('[data-live-tab="all"]').setAttribute('aria-pressed', String(tab === 'all' && !selectedLiveRoom));
  const entry = view.querySelector('#live-room-entry');
  const showEntry = (name, details) => {
    const signIn = new URL(liveMessenger);
    signIn.searchParams.set('chatRoom', name);
    const fallback = roomShortcuts.find(room => room.name === name);
    const date = details?.createdAt ? new Date(details.createdAt) : null;
    const created = date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
    const facts = [
      ['Owner', details ? details.owner || 'Razzle Chat' : 'Unavailable'],
      ['Created', created ? new Date(created + 'T12:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }) : 'Date unavailable'],
      ['Room favorites', details?.likes == null ? 'Count unavailable' : details.likes + (details.likes === 1 ? ' person' : ' people')],
      ['Category', details?.category],
      ['Rating', details?.rating],
      ['Microphones', details?.mics],
      ['In room', details?.count],
    ];
    title.hidden = true;
    entry.hidden = false;
    entry.innerHTML = `<section class="live-entry-panel room-profile" aria-labelledby="live-entry-title">
      ${roomThumbnail(details || fallback || { name }, 'room-thumb-cover')}
      <h3 id="live-entry-title" tabindex="-1">${esc(name)}</h3>
      <p>${esc(details?.topic || fallback?.topic || 'Drop in and see what’s happening.')}</p>
      <dl class="room-profile-facts">${facts.filter(([, value]) => value != null && value !== '').map(([label,value]) => '<div><dt>' + label + '</dt><dd>' + (label === 'Rating' ? roomRating(value) : esc(value)) + '</dd></div>').join('')}</dl>
      <div class="directory-actions"><a class="primary" href="${esc(signIn.href)}">Sign in to chat</a>
      <a class="secondary" href="${esc(liveRoomUrl(name))}">Continue as guest</a></div></section>`;
  };
  if (selectedLiveRoom) { showEntry(selectedLiveRoom); list.hidden = true; }

  const update = () => getLiveDirectory().then(({ rooms }) => {
    if (!view.isConnected) return;
    const query = $('#search').value.trim().toLowerCase();
    const matching = rooms.filter(room => [room.name, room.topic, room.category].some(value => value.toLowerCase().includes(query)));
    const top = matching.filter(room => room.count > 0).slice(0, 10);
    const details = rooms.find(room => room.name === selectedLiveRoom);
    if (details && entry.dataset.loadedRoom !== details.name) {
      const hadFocus = document.activeElement === entry.querySelector('h3');
      entry.dataset.loadedRoom = details.name;
      showEntry(details.name, details);
      if (hadFocus) entry.querySelector('h3').focus({ preventScroll: true });
    }
    if (selectedLiveRoom) return;
    const shown = tab === 'all' || query ? matching : top;
    list.innerHTML = shown.map(room => `<article class="live-room-row"${room.name === selectedLiveRoom ? ' data-selected' : ''}>
      ${roomThumbnail(room, 'room-thumb-row')}<div><strong>${esc(room.name)}</strong>
      ${room.topic ? '<p>' + esc(room.topic) + '</p>' : ''}<small>${room.count} in room</small></div>
      <a class="secondary" data-join-room="${esc(room.name)}" href="${esc(liveRoomUrl(room.name))}">Join room</a></article>`).join('') || '<p>No matching rooms right now.</p>';
  }).catch(() => {
    if (!view.isConnected || selectedLiveRoom) return;
    list.innerHTML = '<p>Live activity is unavailable. You can still open these rooms.</p>' +
      roomShortcuts.map(room => `<article class="live-room-row"${room.name === selectedLiveRoom ? ' data-selected' : ''}>
        ${roomThumbnail(room, 'room-thumb-row')}
        <div><strong>${esc(room.name)}</strong><p>${esc(room.topic)}</p></div>
        <a class="secondary" data-join-room="${esc(room.name)}" href="${esc(liveRoomUrl(room.name))}">Join room</a></article>`).join('') +
      '<button class="secondary" type="button" data-live-retry>Retry live rooms</button>';

  });
  view.addEventListener('click', event => {
    const join = event.target.closest('[data-join-room]');
    if (join && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      view.selectRoom(join.dataset.joinRoom);
      return;
    }
    if (event.target.closest('[data-live-retry]')) {
      list.textContent = 'Checking live rooms…';
      loadLiveFeaturedRooms();
      update();
      return;
    }
    const button = event.target.closest('[data-live-tab]');
    if (!button) return;
    tab = button.dataset.liveTab;
    if (selectedLiveRoom || new URLSearchParams(location.search).has('interest')) history.pushState(null, '', '/#chat');
    $('#search').value = '';
    selectedLiveRoom = null;
    title.hidden = false;
    entry.hidden = true;
    list.hidden = false;
    markLiveRoom();
    view.querySelectorAll('[data-live-tab]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    update();
  });
  view.selectRoom = name => {
    selectedLiveRoom = name;
    rememberRoomProfile(name);
    delete entry.dataset.loadedRoom;
    list.hidden = true;
    view.querySelectorAll('[data-live-tab]').forEach(item => item.setAttribute('aria-pressed', 'false'));
    showEntry(name);
    markLiveRoom();
    update();
    entry.querySelector('h3').focus();
  };
  view.refreshRooms = update;
  update();
}

searchPeople = function () {
  const liveView = $('#live-chat-view');
  if (liveView) { liveView.refreshRooms(); return; }
  const query = q.trim().toLowerCase();
  const members = (previewSignedIn ? [{name:'yappchat', interest:interests}, ...users] : users).filter(user => {
    if (sampleBotProfiles[user.name]?.private) return user.name.toLowerCase().includes(query);
    const tags = samplePeopleDetails[user.name]?.interests || [];
    return [user.name, user.interest, ...tags].join(' ').toLowerCase().includes(query);
  });
  $('#heading').textContent = 'Search Razzle Social';
  $('#subheading').textContent = 'Find preview aliases, chatrooms, room topics, and interests.';
  $('#content').innerHTML = `<section class="directory"><h2>Members</h2>
    ${members.map(user => `<div class="suggestion">${profileAvatar(user.name)}<a href="${profilePath(user.name)}" data-profile-link="${esc(user.name)}"><strong>${esc(user.name)}</strong><small>@${esc(user.name.toLowerCase())}</small></a></div>`).join('') || '<p>No matching members.</p>'}
    <h2>Rooms and topics</h2>${roomList(roomResults(query))}</section>`;
};

function editRoomTopics(id) {
  if (!previewSignedIn) return;
  const owned = read('previewRooms', []);
  const room = id ? owned.find(item => item.id === id && item.owner === 'yappchat') : null;
  if (id && !room) return;
  modal(`<h2>${room ? 'Edit room topics' : 'Create a preview room'}</h2><form id="room-editor" class="social-editor">
    <label>Room name<input name="roomName" required maxlength="40" pattern="[A-Za-z0-9][A-Za-z0-9 \-]*" value="${esc(room?.name || '')}" ${room ? 'readonly' : ''}></label>
    <label>Topics now being discussed<input name="topics" maxlength="140" value="${esc(room?.topics.join(', ') || '')}" placeholder="Music, movies, weekend plans"></label>
    <p>Separate topics with commas. Changes appear in preview search.</p><button class="primary">Save room</button></form>`);
  $('#room-editor').onsubmit = event => {
    event.preventDefault();
    const fields = event.target.elements;
    const name = fields.roomName.value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,39}$/.test(name)) return;
    if (!room && previewRooms().some(item => item.name.toLowerCase() === name.toLowerCase())) { toast('Choose a different room name.'); return; }
    const topics = [...new Set(fields.topics.value.split(',').map(tag => tag.trim()).filter(Boolean))].slice(0, 8);
    const updated = room ? {...room, topics} : {id:crypto.randomUUID(), name, owner:'yappchat', desc:'A community preview room.', cat:'Hangouts', tags:'Text', icon:'▦', color:'#e5eef8', topics};
    save('previewRooms', room ? owned.map(item => item.id === id ? updated : item) : [...owned, updated]);
    $('#dialog').close();
    show('rooms');
  };
}

show = function (view) {
  clearProfileRoute();
  if (view === 'home') { showSocialHome(); return; }
  if (['feed', 'following'].includes(view) && !previewSignedIn) { showSocialHome(); return; }
  document.body.classList.remove('guest-home');
  if (view === 'rooms') {
    current = 'rooms';
    $('.write').hidden = true;
    $('.feed-nav').hidden = true;
    $('#content').classList.remove('custom-space');
    $('#content').removeAttribute('style');
    $('#playlist-dock')?.remove();
    document.querySelectorAll('.menu button.selected').forEach(button => button.classList.remove('selected'));
  } else renderExistingView(view);
  const chatLink = $('.menu a[href="rooms.html"]');
  chatLink.classList.toggle('selected', view === 'rooms');
  if (view === 'rooms') {
    chatLink.setAttribute('aria-current', 'page');
    $('#search').value = new URLSearchParams(location.search).get('interest') || '';
    q = '';
    renderRoomDirectory();
  } else {
    chatLink.removeAttribute('aria-current');
  }
  if (view === 'people') renderPeopleDirectory();
  markLiveRoom();
};
profile = function (name) {
  if (!['yappchat', ...users.map(user => user.name)].includes(name)) return;
  const path = profilePath(name);
  if (location.pathname !== path) history.pushState(null, '', path);
  document.querySelectorAll('[data-live-room]').forEach(link => link.removeAttribute('aria-current'));
  $('.menu a[href="rooms.html"]').classList.remove('selected');
  $('.menu a[href="rooms.html"]').removeAttribute('aria-current');
  document.body.classList.remove('guest-home');
  if (name === 'yappchat' || (previewSignedIn && blocked.includes(name))) {
    if (!previewSignedIn) publicPreview = true;
    renderExistingProfile(name);
    $('#heading').textContent = '@' + name.toLowerCase();
    if (name === 'yappchat' && !(publicPreview && visibility === 'private')) {
      $('.space-about')?.insertAdjacentHTML('beforeend', '<section class="space-card" id="profile-owned-rooms" hidden></section>');
      showOwnedRooms(name);
    }
    if (!previewSignedIn) {
      $('.profile-toolbar')?.remove();
      $('.profile-wall form')?.remove();
    }
    return;
  }
  publicPreview = false;
  renderPublicPerson(name);
};
compose = function () {
  if (!previewSignedIn) { showSocialHome(); return; }
  composeExistingPost();
};
card = function (post) {
  let html = renderExistingCard(post);
  if (post.image) html = html.replace(/<img src="[^"]*" alt="Photo shared in your demo post">/, image => '<button class="profile-photo-open" data-profile-photo="' + esc(post.id) + '" aria-label="Open photo and comments">' + image + '</button>');
  if (!previewSignedIn || publicPreview || !own.some(item => item.id === post.id)) return html;
  return html.replace('<div class="post-actions">', `<div class="post-actions"><button type="button" data-edit-post="${esc(post.id)}">Edit</button><button type="button" data-delete-post="${esc(post.id)}">Delete</button>`);
};

function manageOwnPost(id, action) {
  if (!previewSignedIn || publicPreview) return;
  const post = own.find(item => item.id === id);
  if (!post) return;
  if (action === 'delete') {
    modal('<h2>Delete this post?</h2><p>This removes the post from your space and photo views.</p><div class="directory-actions"><button type="button" class="secondary" id="cancel-post-delete">Cancel</button><button type="button" class="primary" id="confirm-post-delete">Delete post</button></div>');
    $('#cancel-post-delete').onclick = () => $('#dialog').close();
    $('#confirm-post-delete').onclick = () => commitOwnPosts(own.filter(item => item.id !== id), 'Post deleted.');
    return;
  }
  modal(`<h2>Edit post</h2><form id="edit-own-post" class="social-editor">
    <label>Post text<textarea name="body" maxlength="3000">${esc(post.text || '')}</textarea></label>
    <label>Link<input name="url" type="url" value="${esc(post.url || '')}"></label>
    ${post.image ? '<label class="remove-post-photo"><input type="checkbox" name="removePhoto"> Remove the attached photo</label>' : ''}
    <button class="primary">Save changes</button></form>`);
  $('#edit-own-post').onsubmit = event => {
    event.preventDefault();
    const fields = event.target.elements;
    const text = fields.body.value.trim();
    const url = fields.url.value.trim();
    const image = fields.removePhoto?.checked ? null : post.image;
    let hostname = '';
    if (url) {
      try { const parsed = new URL(url); if (!['https:', 'http:'].includes(parsed.protocol)) throw Error(); hostname = parsed.hostname; }
      catch { toast('Use an http or https link.'); return; }
    }
    if (!text && !url && !image) { toast('Keep a thought, link, or photo in the post.'); return; }
    const next = {...post, text, url, image, link:hostname, title:url ? text || 'A link from yappchat' : '', publicPhoto:!!image && !!post.publicPhoto};
    commitOwnPosts(own.map(item => item.id === id ? next : item), 'Post updated.');
  };
}

function commitOwnPosts(posts, message) {
  if (!persistProfile('posts', posts)) return;
  own = posts;
  $('#dialog').close();
  profile('yappchat');
  toast(message);
}

$('#content').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.botPhoto) {
    const name = button.dataset.botPhoto;
    const bot = sampleBotProfiles[name];
    if (bot && !bot.private) modal(botPhotoPost(name, bot, true));
    return;
  }
  if (button.dataset.profilePhoto) { openProfilePhoto(button.dataset.profilePhoto); return; }
  if (button.dataset.profileComment && previewSignedIn) addProfileComment(button.dataset.profileComment);
  if (button.dataset.roomId) editRoomTopics(button.dataset.roomId);
  if (button.dataset.editPost) manageOwnPost(button.dataset.editPost, 'edit');
  if (button.dataset.deletePost) manageOwnPost(button.dataset.deletePost, 'delete');
});
$('#dialog').addEventListener('click', event => {
  const button = event.target.closest('[data-profile-comment]');
  if (button && previewSignedIn) {
    $('#dialog').close();
    addProfileComment(button.dataset.profileComment);
  }
});
const renderSuggestionsWithInitials = suggestions;
suggestions = function () {
  renderSuggestionsWithInitials();
  document.querySelectorAll('#suggestions .suggestion').forEach((row, index) => {
    const user = users[index];
    if (user && sampleBotProfiles[user.name]) row.querySelector('.avatar')?.insertAdjacentHTML('afterend', profileAvatar(user.name));
    if (user && sampleBotProfiles[user.name]) row.querySelector('.avatar:not(.bot-photo)')?.remove();
  });
};
suggestions();
loadLiveFeaturedRooms();
renderAccountMenu();
function showCurrentRoute() {
  const name = profileRouteName();
  if (name) { profile(name); return; }
  if (name === '') {
    renderExistingView('people');
    $('#heading').textContent = 'Profile unavailable';
    $('#subheading').textContent = 'This screen name has no profile in the Social preview.';
    $('#content').innerHTML = '<p><button class="secondary" onclick="show(\'people\')">Find your people</button></p>';
    return;
  }
  if (location.hash === '#chat') {
    selectedLiveRoom = new URLSearchParams(location.search).get('room');
    show('rooms');
  } else if (location.hash === '#people') show('people');
  else showSocialHome();
}
showCurrentRoute();
window.addEventListener('popstate', showCurrentRoute);

document.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (link.dataset.roomInterest) {
    event.preventDefault();
    history.pushState(null, '', link.getAttribute('href'));
    selectedLiveRoom = null;
    show('rooms');
    return;
  }
  if (link.dataset.profileLink) { event.preventDefault(); if ($('#dialog').open) $('#dialog').close(); profile(link.dataset.profileLink); return; }
  if (!link.matches('.menu a[href="rooms.html"], .welcome-guest, [data-live-room]')) return;
  event.preventDefault();
  const view = $('#live-chat-view');
  if (view && link.dataset.liveRoom) {
    view.selectRoom(link.dataset.liveRoom);
    return;
  }
  selectedLiveRoom = link.dataset.liveRoom || null;
  if (selectedLiveRoom) rememberRoomProfile(selectedLiveRoom);
  else if (location.hash === '#chat' && location.search) history.pushState(null, '', '/#chat');
  show('rooms');
});
