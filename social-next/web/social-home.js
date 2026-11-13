const liveMessenger = location.origin + '/';
seeds.splice(0, seeds.length);
const liveRooms = liveMessenger + 'rooms.html';
// Set to a public HTTPS installer URL when the release is ready.
const messengerInstallerUrl = 'https://github.com/2000sretrochat/retrochat/releases/latest/download/RazzleMessenger-Setup.exe';
const joinSocialUrl = liveMessenger + '?chat=1&signup=1&social=1';
const welcomePreview = false;
const liveEntry = false;
let previewSignedIn = true;
const renderExistingView = show;
const renderExistingProfile = profile;
const renderExistingCard = card;
const composeExistingPost = compose;

function renderAccountMenu() {
  $('#account-menu').innerHTML = previewSignedIn
    ? '<button onclick="profile(\'Zainy\')" class="account-name"><span class="avatar z" aria-hidden="true">Z</span><strong>Zainy</strong></button><button class="account-logout" onclick="logoutPreview()">Sign out</button>'
    : liveEntry
      ? '<a class="text-action" href="' + liveMessenger + 'social/">Sign in</a>'
      : `<button type="button" class="text-action" onclick="showSocialHome();document.querySelector('#welcome-screen-name').focus()">Sign in</button>`;
  document.querySelectorAll('[data-member-only]').forEach(item => { item.hidden = !previewSignedIn; });
  $('.left .identity').hidden = !previewSignedIn;
  document.body.classList.toggle('signed-out', !previewSignedIn);
  $('.left > .primary').hidden = !previewSignedIn;
  suggestions();
  updateProfilePortraits();
}

function logoutPreview() {
  previewSignedIn = false;
  save('previewSignedIn', false);
  renderAccountMenu();
  fetch('/api/logout', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'}).then(response => {
    if (!response.ok) throw Error();
    location.assign('/?chat=1&social=1');
  }).catch(() => { previewSignedIn = true; renderAccountMenu(); toast('Sign-out did not complete.'); });
}

function openPreviewAccount() {
  previewSignedIn = true;
  save('previewSignedIn', true);
  $('#status').value = read('defaultPresence', 'available');
  renderAccountMenu();
  show('feed');
}

const interestChoices = window.RazzleInterests.choices;
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
    const matches = directoryPeople.filter(user => {
      const data = samplePeopleDetails[user.name];
      return user.name.toLowerCase().includes(screenName.value.trim().toLowerCase())
        && (!age.value || (data.age >= min && data.age <= max))
        && (!sex.value || data.sex === sex.value)
        && (!location.value.trim() || (!sampleBotProfiles[user.name]?.private && data.location.toLowerCase().includes(location.value.trim().toLowerCase())))
        && (!interest.value || (!sampleBotProfiles[user.name]?.private && data.interests.includes(interest.value)));
    });
    $('#people-matches').innerHTML = matches.map(user => {
      const data = samplePeopleDetails[user.name];
      return `<div class="suggestion">${profileAvatar(user.name)}<a href="${profilePath(user.name)}" data-profile-link="${esc(user.name)}"><strong>${esc(user.name)}</strong> <span class="bot-badge">Bot</span><small>${sampleBotProfiles[user.name]?.private ? 'Private profile' : esc(data.location)}</small></a></div>`;
    }).join('') || '<p>No bot profiles match these filters.</p>';
  }
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', updateResults);
  updateResults();
}

const editProfileBeforeInterests = editProfile;
editProfile = function () {
  editProfileBeforeInterests();
  const form = $('#edit-form');
  const nameLabel = form.elements.displayAlias.closest('label');
  nameLabel.firstChild.textContent = 'Profile name';
  nameLabel.querySelector('small').textContent = 'This name appears on your profile. Your @username stays the same.';
  const input = form.elements.interests;
  window.RazzleInterests.mount(input);
};


const sampleBotProfiles = {
  NightOwl: { photo: 0, photoCaption: 'Headphones on for another late night.', postedAt: '2026-11-05T05:18:00Z', alt: 'Generated webcam-style portrait with headphones', note: 'The rest of the house is asleep and I just made coffee.', room: 'Late Night', post: 'Bored, hanging out in', replies: ['RetroFan: Save me a seat.'] },
  RetroFan: { photo: 1, photoCaption: 'The lake right after sunset.', postedAt: '2026-11-04T23:42:00Z', alt: 'Generated photo of a mountain lake at dusk', note: 'I miss the sound of signing on.', room: 'Lobby', post: 'Anyone up for a little nostalgia in', replies: ['NightOwl: I remember that sound.'] },
  MiaLuvs: { photo: 3, photoCaption: 'Caught the soft light on my walk.', postedAt: '2026-11-05T00:26:00Z', alt: 'Generated outdoor phone selfie', note: 'Always looking for a good photo spot.', room: 'Chit Chat', post: 'Talking about favorite photo spots in', replies: ['NightOwl: Golden hour gets my vote.'] },
  Moonlight: { tile: 63, alt: 'A city skyline after dark', note: 'Taking a quiet minute outside.', room: 'The Lounge', private: true },
};

const chatCharacterProfiles = new Map([["sk8rboi_1987",{"name":"sk8rboi_1987","room":"Late Night"}],["xxmoonchildxx",{"name":"xXmoonchildXx","room":"Late Night"}],["dreamgurl_04",{"name":"dreamgurl_04","room":"Lobby"}],["surferdude_99",{"name":"surferdude_99","room":"Chit Chat"}],["kewl_kat2001",{"name":"kewl_kat2001","room":"Chit Chat"}],["punkrawk_kid",{"name":"punkrawk_kid","room":"Music Lobby"}],["glitterbabe_03",{"name":"glitterbabe_03","room":"Friends"}],["mixtape_mike",{"name":"mixtape_mike","room":"Friends"}],["angelface_x0",{"name":"angelface_x0","room":"Lobby"}],["dj_spinz2k",{"name":"dj_spinz2k","room":"Lobby"}],["nightowl_jen",{"name":"nightowl_jen","room":"Late Night"}],["emo_kid_4ever",{"name":"emo_kid_4ever","room":"Music Lobby"}],["butterfly_kisses88",{"name":"butterfly_kisses88","room":"Chit Chat"}],["xiaolong_88",{"name":"xiaolong_88","room":"中文 Chinese (Mandarin)"}],["meimei1999",{"name":"meimei1999","room":"中文 Chinese (Mandarin)"}],["tianshi_2002",{"name":"tianshi_2002","room":"中文 Chinese (Mandarin)"}],["beijing_boy01",{"name":"beijing_boy01","room":"China"}],["panda_qq",{"name":"panda_qq","room":"China"}],["hk_kitty97",{"name":"hk_kitty97","room":"粵語 Cantonese"}],["mongkok_ah_ming",{"name":"mongkok_ah_ming","room":"China"}],["sakura_chan_98",{"name":"sakura_chan_98","room":"日本語 Japanese"}],["tokyo_ninja01",{"name":"tokyo_ninja01","room":"日本語 Japanese"}],["kawaii_yumi",{"name":"kawaii_yumi","room":"日本語 Japanese"}],["ramen_otaku",{"name":"ramen_otaku","room":"Japan"}],["seoul_star_99",{"name":"seoul_star_99","room":"한국어 Korean"}],["kimchi_love01",{"name":"kimchi_love01","room":"한국어 Korean"}],["minji_2002",{"name":"minji_2002","room":"한국어 Korean"}],["busan_boy88",{"name":"busan_boy88","room":"Korea"}],["pinay_angel_02",{"name":"pinay_angel_02","room":"Tagalog"}],["batang_manila",{"name":"batang_manila","room":"Tagalog"}],["jolibee_lover",{"name":"jolibee_lover","room":"Tagalog"}],["kuya_jun98",{"name":"kuya_jun98","room":"Philippines"}],["cebuana_cutie",{"name":"cebuana_cutie","room":"Philippines"}],["saigon_girl99",{"name":"saigon_girl99","room":"Tiếng Việt (Vietnamese)"}],["pho_king01",{"name":"pho_king01","room":"Tiếng Việt (Vietnamese)"}],["hanoi_boy2000",{"name":"hanoi_boy2000","room":"Vietnam"}],["bangkok_bee",{"name":"bangkok_bee","room":"ภาษาไทย (Thai)"}],["nong_mai99",{"name":"nong_mai99","room":"ภาษาไทย (Thai)"}],["anak_jakarta",{"name":"anak_jakarta","room":"Bahasa Indonesia"}],["cewek_bandung01",{"name":"cewek_bandung01","room":"Bahasa Indonesia"}],["bali_surfer88",{"name":"bali_surfer88","room":"Bahasa Indonesia"}],["desi_munda_99",{"name":"desi_munda_99","room":"हिन्दी Hindi"}],["priya_cutie01",{"name":"priya_cutie01","room":"हिन्दी Hindi"}],["bollywood_fan88",{"name":"bollywood_fan88","room":"हिन्दी Hindi"}],["mumbai_masti",{"name":"mumbai_masti","room":"India"}],["delhi_boy2001",{"name":"delhi_boy2001","room":"India"}],["bandra_babe",{"name":"bandra_babe","room":"India"}],["chennai_kanna",{"name":"chennai_kanna","room":"தமிழ் Tamil"}],["tamil_ponnu99",{"name":"tamil_ponnu99","room":"தமிழ் Tamil"}],["hyd_raja01",{"name":"hyd_raja01","room":"తెలుగు Telugu"}],["telugu_ammayi",{"name":"telugu_ammayi","room":"తెలుగు Telugu"}],["jatt_boy_007",{"name":"jatt_boy_007","room":"ਪੰਜਾਬੀ Punjabi"}],["punjabi_kudi99",{"name":"punjabi_kudi99","room":"ਪੰਜਾਬੀ Punjabi"}],["kolkata_dada",{"name":"kolkata_dada","room":"বাংলা Bengali"}],["rosogolla_girl",{"name":"rosogolla_girl","room":"বাংলা Bengali"}],["chica_loca_01",{"name":"chica_loca_01","room":"En Español"}],["masha_99",{"name":"masha_99","room":"Русский (Russian)"}]]);

const characterLocations = ['Portland, Oregon','Toronto, Ontario','San Diego, California','Columbus, Ohio','Seattle, Washington','Austin, Texas','Boise, Idaho','Detroit, Michigan','Vancouver, British Columbia','Chicago, Illinois','Tucson, Arizona','Baltimore, Maryland','Madison, Wisconsin','Taipei, Taiwan','Shanghai, China','Chengdu, China','Beijing, China','Guangzhou, China','Hong Kong','Hong Kong','Kyoto, Japan','Tokyo, Japan','Yokohama, Japan','Osaka, Japan','Seoul, South Korea','Incheon, South Korea','Daegu, South Korea','Busan, South Korea','Quezon City, Philippines','Manila, Philippines','Makati, Philippines','Davao, Philippines','Cebu, Philippines','Ho Chi Minh City, Vietnam','Da Nang, Vietnam','Hanoi, Vietnam','Bangkok, Thailand','Chiang Mai, Thailand','Jakarta, Indonesia','Bandung, Indonesia','Denpasar, Indonesia','Chandigarh, India','Lucknow, India','Pune, India','Mumbai, India','Delhi, India','Mumbai, India','Chennai, India','Madurai, India','Hyderabad, India','Visakhapatnam, India','Ludhiana, India','Amritsar, India','Kolkata, India','Kolkata, India','Valencia, Spain','Kazan, Russia'];
const portraitAges = [18,22,34,39,67,33,20,70,23,69,49,26,19,22,58,70,21,52,30,66,45,41,25,65,51,23,55,64,25,28,53,37,24,24,65,25,48,23,65,22,42,55,24,68,58,25,54,41,70,22,53,28,19,70,51,22,34];
const characterInterests = ['Music', 'Books', 'Travel', 'Cars', 'Photography', 'Food', 'Politics', 'Gaming', 'Movies'];
const characterCaptions = ['From my webcam after work.', 'Took this on my evening walk near home.', 'A quick selfie before heading out for coffee.', 'Tried the front camera outdoors for once.', 'A quiet afternoon and an excuse to take the camera out.', 'A selfie from home on a day off.', 'Just signed on after checking the local election results.', 'This was just before I headed back home.', 'Took this right before hopping into chat.'];
const candidPhotoCaptions = {
  "2": "First contact, from my couch.",
  "3": "Someone took this outside the apartment after the party.",
  "5": "Finally got the Harley back together. Here it is in my garage.",
  "7": "My old webcam still works. Barely.",
  "9": "The flash went off while we were walking back to the car.",
  "10": "That’s us under the streetlight outside the bar.",
  "14": "This headset is older than the laptop I’m using.",
  "19": "Late-night webcam check-in. The purple light is from my monitor.",
  "20": "Waiting in the driveway for everyone else to come out.",
  "22": "Grave Relay has been on repeat all week.",
  "26": "Found one last beer in the fridge.",
  "32": "We stood outside talking long after dinner was over.",
  "45": "A few of us hanging around outside after the show.",
  "46": "Coffee, my old webcam, and barely enough light.",
  "50": "I should probably clean this webcam. Anyway, hello.",
  "55": "My friends outside the party. The flash caught us by surprise."
};
const alternatePhotoDescriptions = {
  2: 'Selfie with a green alien-face filter',
  5: 'A man showing off his Harley motorcycle in his garage',
  22: 'Fictional Grave Relay heavy metal album cover',
  26: 'A brown beer bottle on a kitchen counter',
};
const directoryPeople = [...users, ...Array.from(chatCharacterProfiles.values(), ({name, room}, index) => {
  const city = characterLocations[index];
  const interest = characterInterests[index % characterInterests.length];
  const otherInterest = characterInterests[(index * 2 + 3) % characterInterests.length];
  const about = 'Based in ' + city + '. Usually in ' + room + ', especially when the conversation turns to ' + interest.toLowerCase() + '.';
  samplePeopleDetails[name] = {
    age: portraitAges[index],
    sex: /gurl|girl|babe|kitty|cewek|ponnu|ammayi|kudi|priya|meimei|yumi|minji|pinay|cebuana|masha|chica|angel|sakura|jen|glitter|butterfly/.test(name) ? 'Female' : 'Male',
    location: city,
    interests: [...new Set([interest, otherInterest])],
  };
  sampleBotProfiles[name] = {
    tile: index === 56 ? 58 : index, extraTile: index % 5 === 0 ? 56 + index % 8 : null,
    photoCaption: candidPhotoCaptions[index] || characterCaptions[index % characterCaptions.length],
    alt: alternatePhotoDescriptions[index] || (index === 56 ? 'Fictional profile picture of a dog for ' : 'Fictional profile photo for ') + name,
    postedAt: new Date(Date.UTC(2026, 10, 5, 12, index)).toISOString(),
    note: about, room, post: 'Usually around in',
  };
  return { name, about };
})];

function profilePath(name) {
  return '/social-next/@' + encodeURIComponent(name.toLowerCase());
}

function profileRouteName() {
  const route = location.pathname.match(/^\/social-next\/@([^/]+)\/?$/);
  if (!route) return null;
  try {
    const handle = decodeURIComponent(route[1]).toLowerCase();
    if (!/^[a-z][a-z0-9_.-]{2,19}$/.test(handle)) return '';
    return ['Zainy', ...users.map(user => user.name)].find(name => name.toLowerCase() === handle) || chatCharacterProfiles.get(handle)?.name || handle;
  } catch { return ''; }
}

function clearProfileRoute() {
  if (profileRouteName() !== null) history.pushState(null, '', '/social-next/');
}

function botPhoto(bot, kind) {
  if (bot.tile != null) {
    const x = (bot.tile % 8) * 100 / 7;
    const y = Math.floor(bot.tile / 8) * 100 / 7;
    return '<span class="bot-photo ' + kind + ' character-photo" style="background-position:' + x + '% ' + y + '%" role="img" aria-label="' + esc(bot.alt) + '"></span>';
  }
  return '<span class="bot-photo ' + kind + ' bot-photo-' + bot.photo + '" role="img" aria-label="' + esc(bot.alt) + '"></span>';
}

function profileAvatar(name) {
  if (name === 'Zainy') return '<span class="avatar member-thumbnail"><img src="' + esc(portrait || 'colorful-leaf.svg') + '" alt=""></span>';
  const bot = sampleBotProfiles[name];
  return bot ? botPhoto(bot, 'avatar') : av(name);
}

function botRoomLink(name) {
  return '<a class="profile-room-mention" data-live-room="' + esc(name) + '" href="/?room=' + encodeURIComponent(name) + '#chat">#' + esc(name.replace(/[^a-z0-9]/gi, '')) + '</a>';
}

function profileUserLink(name) {
  return '<a href="' + profilePath(name) + '" data-profile-link="' + esc(name) + '">' + esc(name === 'Zainy' ? displayAlias : name) + '</a>';
}

function profileTimestamp(value) {
  return '<time datetime="' + esc(value) + '">' + esc(new Date(value).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})) + '</time>';
}

const profileCommentTimes = read('profileCommentTimes', {});

function profilePostComments(id, replies = []) {
  const rows = [...replies, ...(comments[id] || []).map((text, index) => ({ name:'Zainy', text, date:profileCommentTimes[id]?.[index] }))];
  return '<div class="profile-post-comments"><h4>Comments</h4>' + (rows.map(reply =>
    '<p>' + profileAvatar(reply.name) + ' <strong>' + profileUserLink(reply.name) + '</strong>' +
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
  if (!post || (post.name === 'Zainy' && publicPreview && visibility === 'private')) return;
  const date = post.createdAt || (/^own-\d+$/.test(post.id) ? new Date(Number(post.id.slice(4))).toISOString() : '');
  modal('<article class="bot-profile-post"><strong class="post-author">' + profileAvatar(post.name) + profileUserLink(post.name) + '</strong>' +
    (date ? profileTimestamp(date) : '') + '<p>' + esc(post.text || '') + '</p><img class="profile-photo-detail" src="' +
    esc(post.image) + '" alt="Shared photo">' + profilePostComments(id) + '</article>');
}

function botPhotoPost(name, bot, expanded = false) {
  const id = 'bot-photo-' + name;
  const date = new Date(Date.parse(bot.postedAt) - 86400000).toISOString();
  const photo = botPhoto(bot, 'bot-photo-large');
  return '<article class="space-card bot-profile-post"><strong class="post-author">' + profileAvatar(name) + profileUserLink(name) + '</strong>' +
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
    if (!owned.length) {
      if (name === 'Zainy' && previewSignedIn && !publicPreview) {
        target.hidden = false;
        target.innerHTML = '<h3>My rooms</h3><p>You haven’t created a room yet.</p><a class="text-action" href="' +
          liveRooms + '?create=1">Create a Room</a>';
      }
      return;
    }
    target.hidden = false;
    target.innerHTML = '<h3>Rooms owned</h3>' + owned.map(room => '<p>' + botRoomLink(room.name) + '</p>' +
      (room.topic ? '<p>' + esc(room.topic) + '</p>' : '')).join('');
  }).catch(() => {});
}

function renderPublicPerson(name) {
  const user = directoryPeople.find(person => person.name === name);
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
    : '<section class="profile-post-stream"><h3>Posts</h3><article class="space-card bot-profile-post"><strong class="post-author">' + profileAvatar(name) + profileUserLink(name) + '</strong>' +
      profileTimestamp(bot.postedAt) + '<p>' + esc(bot.post) + ' ' + room + '.</p>' +
      profilePostComments('bot-post-' + name, replies) + '</article>' + botPhotoPost(name, bot) +
    (bot.extraTile == null ? '' : '<article class="space-card bot-profile-post"><strong class="post-author">' +
      profileAvatar(name) + profileUserLink(name) + '</strong><p>' + esc(bot.extraTile === 62 ? 'Saw this local election pin while I was out.' : 'A snapshot from a day away from chat.') +
      '</p>' + botPhoto({ ...bot, tile: bot.extraTile, alt: 'A fictional snapshot shared by ' + name }, 'bot-photo-large') + '</article>') + '</section>';
  const controls = previewSignedIn && !bot.private
    ? '<div class="space-actions"><button class="primary" onclick="follow(\'' + name + '\')">' + (friendActionLabel(name)) +
      '</button><button class="secondary" onclick="request(\'' + name + '\')">Messenger</button><button class="text-action" onclick="blockAlias(\'' + name + '\')">Block alias</button></div>'
    : '';
  $('#content').innerHTML = '<div class="space-layout bot-space"><aside class="space-about"><section class="space-card">' +
    botPhoto(bot, 'bot-photo-portrait') + '<h2>' + esc(name) + ' <span class="bot-badge">Bot</span></h2><span class="handle">@' + esc(name.toLowerCase()) +
    '</span><div class="profile-basics">' + info.age + ' years old · ' + esc(info.sex) +
    '</div><blockquote class="profile-thought">' + esc(bot.note) + '</blockquote>' + controls + '</section>' + publicInfo +
    '</aside><section class="space-posts">' + shared + '</section></div>';
  showOwnedRooms(name);
}

function renderChatIdentity(name) {
  current = 'profile';
  window.profileName = name;
  $('.write').hidden = true;
  $('.feed-nav').hidden = true;
  $('#content').classList.remove('custom-space');
  $('#content').removeAttribute('style');
  $('#playlist-dock')?.remove();
  document.querySelectorAll('.menu .selected').forEach(item => item.classList.remove('selected'));
  $('#heading').textContent = '@' + name.toLowerCase();
  $('#subheading').textContent = 'Chat profile';
  const view = document.createElement('section');
  view.className = 'space-card';
  $('#content').replaceChildren(view);
  const character = chatCharacterProfiles.get(name.toLowerCase());
  if (character) {
    view.innerHTML = '<span class="avatar">' + esc(character.name[0].toUpperCase()) + '</span><h2>About</h2><p>Usually found in ' +
      botRoomLink(character.room) + '.</p>';
    return;
  }
  view.textContent = 'Looking up this screen name…';
  fetch('/api/profile/' + encodeURIComponent(name)).then(async response => {
    if (response.status === 404) { view.textContent = 'No registered chat profile was found for this screen name.'; return; }
    if (!response.ok) throw Error();
    const identity = await response.json();
    if (view.isConnected) {
      view.innerHTML = '<span class="avatar">' + esc(identity.name[0].toUpperCase()) + '</span><h2>About</h2><p>Registered Razzle Chat member.</p>';
    }
  }).catch(() => { view.textContent = 'The chat profile directory is temporarily unavailable.'; });
}

function postOnOwnWall() {
  if (!previewSignedIn) return;
  publicPreview = false;
  profile('Zainy');
  $('#wall-text')?.focus();
}

function updateProfilePortraits() {
  for (const avatar of document.querySelectorAll('.left .identity .avatar, #account-menu .account-name .avatar, #quick-post > .avatar, #messenger .presence .avatar')) {
    avatar.classList.add('member-thumbnail');
    avatar.innerHTML = '<img src="' + esc(portrait || 'colorful-leaf.svg') + '" alt="">';
  }
  for (const name of document.querySelectorAll('.left .identity strong, #account-menu .account-name strong, #messenger .presence strong')) {
    name.textContent = displayAlias;
  }
}

function updateOwnerProfile() {
  const card = $('.space-about > .space-card');
  if (!card) return;
  const portraitImage = card.querySelector(':scope > .profile-portrait');
  if (portraitImage && !publicPreview && previewSignedIn) {
    const frame = document.createElement('div');
    frame.className = 'editable-profile-portrait';
    portraitImage.before(frame);
    frame.append(portraitImage);
    frame.insertAdjacentHTML('beforeend', '<button type="button" class="portrait-edit" data-edit-portrait aria-label="Edit profile image" title="Edit profile image">&#9998;</button>');
  }
  if (!publicPreview && previewSignedIn) mountOwnerWallComposer();
  if (publicPreview) {
    $('.profile-wall form')?.remove();
    if (visibility === 'private') $('.profile-wall')?.remove();
  }
  card.querySelector('.space-actions')?.remove();
  if (!publicPreview && previewSignedIn) card.insertAdjacentHTML('beforeend',
    '<div class="profile-edit-row"><button type="button" class="text-action" onclick="editProfile()">Edit</button></div>');
  $('.space-posts > .empty')?.remove();
  const toolbar = $('.profile-toolbar');
  if (toolbar && !publicPreview) {
    toolbar.querySelectorAll('span').forEach(item => item.remove());
    if (previewSignedIn) card.querySelector('.handle')?.insertAdjacentHTML('afterend',
      '<p class="owner-privacy-note">' + (visibility === 'private' ? 'Private profile' : 'Public profile') + '</p>');
  }
  const image = portrait || 'colorful-leaf.svg';
  const photoBox = Array.from(document.querySelectorAll('.space-about > .space-card')).find(item => item.querySelector('h3')?.textContent.startsWith('My photos'));
  if (photoBox) {
    const count = own.filter(post => post.image).length + 1;
    photoBox.querySelector('h3').innerHTML = 'My photos <small>(' + count + ')</small>';
    photoBox.querySelector(':scope > p')?.remove();
    photoBox.querySelector('.photo-grid')?.insertAdjacentHTML('afterbegin',
      '<button type="button" data-owner-portrait aria-label="View profile picture"><img src="' + esc(image) + '" alt="Profile picture"></button>');
  }
  if (!publicPreview && previewSignedIn) {
    photoBox?.insertAdjacentHTML('beforeend','<div class="profile-edit-row"><button type="button" class="text-action" data-edit-photos>Edit photos</button></div>');
    const friends = Array.from(document.querySelectorAll('.space-about > .space-card')).find(item => item.querySelector('h3')?.textContent === 'Friends');
    friends?.insertAdjacentHTML('beforeend','<button type="button" class="secondary" onclick="show(&quot;following&quot;)">See all friends</button>');
  }
  updateProfilePortraits();
  updateNotificationBadge();
}

function editOwnerPhotos() {
  const photos = own.filter(post => post.image);
  modal('<h2>Edit photos</h2><div class="directory-actions"><button class="secondary" data-photo-activity="portrait">Change or remove profile picture</button><button class="primary" data-photo-activity="add">Add a photo</button></div>' +
    photos.map(post => '<div class="photo-editor-row"><img src="' + esc(post.image) + '" alt="Posted photo"><button class="secondary" data-remove-photo="' + esc(post.id) + '">Remove photo</button></div>').join(''));
}

function showMessengerDownload() {
  if (messengerInstallerUrl) { location.assign(messengerInstallerUrl); return; }
  modal(`<h2>Download Messenger</h2><p>The desktop download is coming soon. You can open Messenger in your browser today.</p><a class="text-action" href="${liveMessenger}">Open Messenger in your browser →</a>`);
}

function renderSignedOutHome() {
  document.body.classList.add('guest-home');
  document.body.classList.toggle('live-entry', liveEntry);
  if (liveEntry) {
    $('#content').innerHTML = `<div class="welcome-grid">
      <div class="welcome-main">
        <section class="welcome-hero">
          <p class="welcome-eyebrow">CHAT ROOMS · SOCIAL PROFILES · MESSENGER</p>
          <h1>Talk live. Be yourself.</h1>
          <p>Pick a screen name, edit your profile, and join the conversation.</p>
          <div class="welcome-hero-actions">
            <a class="primary home-cta welcome-join" href="${joinSocialUrl}">Create an account</a>
            <a class="home-cta welcome-guest-live" href="${liveRooms}">Browse live chat rooms</a>
          </div>
          <div class="welcome-privacy"><strong>Start with a screen name.</strong> You choose how much of your offline life to share.</div>
        </section>
      </div>
      <aside class="welcome-side">
        <section class="welcome-account" aria-labelledby="live-account-title">
          <h2 id="live-account-title" class="welcome-panel-title">Already have an account?</h2>
          <div class="welcome-panel-body">
            <div class="live-entry-links">
              <a class="primary home-cta" href="${liveMessenger}social/">Sign in to Razzle Social</a>
              <a class="text-action" href="${liveMessenger}index.html">Open Browser Messenger</a>
              <a class="text-action" href="${liveMessenger}reset.html">Reset your password</a>
            </div>
          </div>
        </section>
      </aside>
    </div>
    <p class="home-demo"><a href="/?view=welcome">Open the design preview</a></p>`;
    return;
  }
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
            <input id="welcome-screen-name" placeholder="Zainy" aria-describedby="welcome-preview-hint" required maxlength="20">
            <label for="welcome-password">Password</label>
            <input id="welcome-password" type="password" aria-describedby="welcome-preview-hint" required maxlength="100">
            <p id="welcome-preview-hint">Demo only. Use <strong>Zainy</strong> and <strong>razzle-demo</strong>.</p>
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
    if (name.value.trim().toLowerCase() === 'zainy' && password.value === 'razzle-demo') {
      openPreviewAccount();
      return;
    }
    form.querySelector('.welcome-form-error').textContent = 'Use the demo screen name and password shown above.';
    password.value = '';
    password.focus();
  });
}

function showSocialHome() {
  clearProfileRoute();
  $('#heading').classList.remove('chat-wordmark');
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
      <section><span class="home-card-icon" aria-hidden="true">◈</span><h2>Your space</h2><p>Make your profile yours and share something with your circle.</p><button class="text-action" onclick="profile('Zainy')">Open your space →</button></section>
      <section><span class="home-card-icon" aria-hidden="true"><img src="bubbles.svg" alt=""></span><h2>Messenger</h2><p>Keep the conversation going with familiar screen names.</p><a class="text-action" href="${liveMessenger}index.html">Open Browser Messenger →</a><button type="button" class="messenger-download" onclick="showMessengerDownload()">Download Messenger</button></section>
    </div>
    
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
    <div class="room-links"><a class="secondary" href="rooms.html?guest=1&amp;room=${encodeURIComponent(room.name)}">Explore room ↗</a>${previewSignedIn && room.owner === 'Zainy' ? `<button class="text-action" data-room-id="${esc(room.id)}">Edit topics</button>` : ''}</div>
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
  return '/social-next/?room=' + encodeURIComponent(name) + '#chat';
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
  $('#heading').innerHTML = 'Razzle Chat<span>.</span>';
  $('#heading').classList.add('chat-wordmark');
  $('#subheading').textContent = 'Find a live room and join the conversation.';
  $('#content').innerHTML = `<div id="live-chat-view" class="live-chat-view">
    <section class="directory">${previewSignedIn && !selectedLiveRoom ? `<div class="personal-room-sections">
      <section><h2>My Room</h2><div data-owned-live-rooms aria-live="polite"><p>Checking for your rooms.</p></div></section>
      <section><h2>Followed Rooms</h2>${favoriteRooms.length ? favoriteRooms.map(name => '<p>' + botRoomLink(name) + '</p>').join('') : '<p>No followed rooms yet.</p>'}</section>
    </div>` : ''}<h2 class="live-directory-title"${selectedLiveRoom ? ' hidden' : ''}>Live Chat Rooms</h2>
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
    const ownedList = view.querySelector('[data-owned-live-rooms]');
    if (ownedList) {
      const owned = rooms.filter(room => room.owner.toLowerCase() === 'zainy');
      ownedList.innerHTML = owned.map(room => '<p>' + botRoomLink(room.name) + '</p>').join('') || '<p>You haven’t created a room yet.</p><a class="text-action" href="' + liveRooms + '?create=1">Create a Room</a>';
    }
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
    const ownedList = view.querySelector('[data-owned-live-rooms]');
    if (ownedList) ownedList.textContent = 'Could not check for your rooms.';
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
    if (selectedLiveRoom || new URLSearchParams(location.search).has('interest')) history.pushState(null, '', '/social-next/#chat');
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
  const members = (previewSignedIn ? [{name:'Zainy', interest:interests}, ...users] : users).filter(user => {
    if (sampleBotProfiles[user.name]?.private) return user.name.toLowerCase().includes(query);
    const tags = samplePeopleDetails[user.name]?.interests || [];
    return [user.name, user.name === 'Zainy' ? displayAlias : '', user.interest, ...tags].join(' ').toLowerCase().includes(query);
  });
  $('#heading').textContent = 'Search Razzle Social';
  $('#subheading').textContent = 'Find preview aliases, chatrooms, room topics, and interests.';
  $('#content').innerHTML = `<section class="directory"><h2>Members</h2>
    ${members.map(user => `<div class="suggestion">${profileAvatar(user.name)}<a href="${profilePath(user.name)}" data-profile-link="${esc(user.name)}"><strong>${esc(user.name === 'Zainy' ? displayAlias : user.name)}</strong><small>@${esc(user.name.toLowerCase())}</small></a></div>`).join('') || '<p>No matching members.</p>'}
    <h2>Rooms and topics</h2>${roomList(roomResults(query))}</section>`;
};

function editRoomTopics(id) {
  if (!previewSignedIn) return;
  const owned = read('previewRooms', []);
  const room = id ? owned.find(item => item.id === id && item.owner === 'Zainy') : null;
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
    const updated = room ? {...room, topics} : {id:crypto.randomUUID(), name, owner:'Zainy', desc:'A community preview room.', cat:'Hangouts', tags:'Text', icon:'▦', color:'#e5eef8', topics};
    save('previewRooms', room ? owned.map(item => item.id === id ? updated : item) : [...owned, updated]);
    $('#dialog').close();
    show('rooms');
  };
}

show = function (view) {
  clearProfileRoute();
  $('#heading').classList.remove('chat-wordmark');
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
  $('#heading').classList.remove('chat-wordmark');
  if (!/^[a-z][a-z0-9_.-]{2,19}$/i.test(name)) return;
  const path = profilePath(name);
  if (location.pathname !== path) history.pushState(null, '', path);
  document.querySelectorAll('[data-live-room]').forEach(link => link.removeAttribute('aria-current'));
  $('.menu a[href="rooms.html"]').classList.remove('selected');
  $('.menu a[href="rooms.html"]').removeAttribute('aria-current');
  document.body.classList.remove('guest-home');
  if (name === 'Zainy' || (previewSignedIn && blocked.includes(name))) {
    if (!previewSignedIn) publicPreview = true;
    renderExistingProfile(name);
    $('#heading').textContent = '@' + name.toLowerCase();
    if (name === 'Zainy') {
      updateOwnerProfile();
      const info = $('.space-about > .space-card');
      const handle = info?.querySelector('.handle');
      if (handle) handle.textContent = '@zainy';
      $('.space-layout')?.classList.add('owner-profile-view');
      if (info && !publicPreview && previewSignedIn) {
        const rows = [['Age',details.age],['Sex',details.sex],['Location',details.location || (details.country ? countryName(details.country) : '')],['Status',details.status]];
        const basics = info.querySelector('.profile-basics');
        if (basics) basics.innerHTML = '<dl class="owner-details">' + rows.map(([label,value]) =>
          '<div><dt>' + label + '</dt><dd>' + esc(value || 'Not set') + '</dd></div>').join('') + '</dl>';
        info.querySelector('.profile-location')?.remove();
      }
    }
    if (name === 'Zainy' && !(publicPreview && visibility === 'private')) {
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
  if (Object.hasOwn(sampleBotProfiles, name)) renderPublicPerson(name);
  else renderChatIdentity(name);
};
const postFeelings = new Map([
  ['Happy', '😊'], ['Excited', '🤩'], ['Grateful', '🥹'], ['Relaxed', '😌'],
  ['Hopeful', '🙂'], ['Loved', '🥰'], ['Proud', '😎'], ['Curious', '🤔'],
  ['Tired', '😴'], ['Bored', '😐'], ['Sad', '😢'], ['Worried', '😟'],
  ['Frustrated', '😤'], ['Lonely', '😔'],
]);

function mountPostDetails(form, post = {}) {
  mountPostStyle(form, post);
  const details = document.createElement('details');
  details.className = 'post-details';
  details.open = Boolean(post.feeling || post.location);
  details.innerHTML = '<summary>Feeling or location</summary><div class="post-detail-fields">' +
    '<label>Feeling<select name="feeling"><option value="">Select a feeling</option>' +
    Array.from(postFeelings, ([feeling, emoji]) => '<option value="' + feeling + '">' + emoji + ' ' + feeling + '</option>').join('') + '</select></label>' +
    '<div class="post-location"><label>Location<input name="postLocation" maxlength="120" placeholder="Enter a place"></label>' +
    '<button type="button" data-use-gps aria-label="Use GPS for approximate location" title="Use GPS">' +
    '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M19 10c0 5-7 10-7 10s-7-5-7-10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/></svg></button></div>' +
    '<p class="post-gps-status" role="status">Location is shared with this post only if you leave it filled in.</p></div>';
  form.append(details);
  form.elements.feeling.value = postFeelings.has(post.feeling) ? post.feeling : '';
  const input = form.elements.postLocation;
  input.value = post.location || '';
  const gps = details.querySelector('[data-use-gps]');
  const status = details.querySelector('[role="status"]');
  let request = 0;
  input.addEventListener('input', () => { request++; gps.disabled = false; });
  form.addEventListener('reset', () => { request++; gps.disabled = false; details.open = false; });
  gps.addEventListener('click', () => {
    if (!navigator.geolocation) { status.textContent = 'GPS is unavailable. Enter a place manually.'; return; }
    const attempt = ++request;
    gps.disabled = true;
    status.textContent = 'Finding your approximate location…';
    function finish(message, value) {
      if (attempt !== request || !form.isConnected) return;
      if (value) input.value = value;
      status.textContent = message;
      gps.disabled = false;
    }
    navigator.geolocation.getCurrentPosition(({coords}) => {
      const point = (value, positive, negative) => Math.abs(value).toFixed(1) + '° ' + (value < 0 ? negative : positive);
      const approximate = point(coords.latitude, 'N', 'S') + ', ' + point(coords.longitude, 'E', 'W');
      finish('Approximate area added. Edit or clear it before posting.', approximate);
    }, () => finish('Could not get your location. You can enter it manually.'), {
      enableHighAccuracy: false, timeout: 10000, maximumAge: 60000,
    });
  });
}

function readPostDetails(form) {
  const feeling = form.elements.feeling?.value || '';
  const details = {
    feeling: postFeelings.has(feeling) ? feeling : '',
    location: (form.elements.postLocation?.value || '').trim().slice(0, 120),
  };
  // Font is only sent by forms that have the style row, so editing an older post never clears its font.
  if (form.elements.postFont) details.font = POST_FONTS.includes(form.elements.postFont.value) ? form.elements.postFont.value : '';
  return details;
}

// Owner request (Nov 13, 2026): every post box (your own timeline and a friend's) gets an emoji picker and a font choice.
const POST_FONTS = ['', 'Arial', 'Verdana', 'Tahoma', 'Georgia', 'Trebuchet MS', 'Comic Sans MS', 'Times New Roman', 'Courier New'];
const POST_EMOJI = ['😀','😂','🥰','😍','😎','😉','😊','🙂','🤗','🤔','😴','😢','😭','😡','😱','🥳','👍','👎','👏','🙌','🙏','💪','👋','✌️','❤️','💔','💯','🔥','✨','🎉','🎂','🎵','🎶','☕','🍕','🌙','⭐','🌈','🌹','😇'];
const postFontStyle = font => POST_FONTS.includes(font) && font ? ' style="font-family:\'' + font + '\',sans-serif"' : '';
function mountPostStyle(form, post = {}) {
  form.querySelectorAll(':scope > .post-style').forEach(row => row.remove());
  const row = document.createElement('div');
  row.className = 'post-style';
  row.innerHTML = '<button type="button" class="secondary post-emoji-button" data-post-emoji aria-haspopup="true" aria-expanded="false" title="Add an emoji">🙂 Emoji</button>' +
    '<label>Font<select name="postFont">' + POST_FONTS.map(font => '<option value="' + font + '"' + (font ? ' style="font-family:\'' + font + '\'"' : '') + '>' + (font || 'Default') + '</option>').join('') + '</select></label>';
  form.append(row);
  const select = form.elements.postFont;
  select.value = POST_FONTS.includes(post.font) ? post.font : '';
  const text = () => form.elements.thought || form.querySelector('textarea');
  const preview = () => { const field = text(); if (field) field.style.fontFamily = select.value ? "'" + select.value + "',sans-serif" : ''; };
  select.addEventListener('change', preview);
  form.addEventListener('reset', () => setTimeout(preview));
  preview();
}
document.addEventListener('click', event => {
  const open = document.querySelector('.post-emoji-pop');
  const pick = event.target.closest('.post-emoji-pop [data-emoji]');
  if (pick) {
    const form = open._form, field = form && (form.elements.thought || form.querySelector('textarea'));
    if (field) {
      const start = field.selectionStart ?? field.value.length, end = field.selectionEnd ?? start, add = pick.dataset.emoji;
      if (field.maxLength > 0 && field.value.length - (end - start) + add.length > field.maxLength) return;
      field.value = field.value.slice(0, start) + add + field.value.slice(end);
      field.focus(); field.selectionStart = field.selectionEnd = start + add.length;
    }
    return;
  }
  const button = event.target.closest('[data-post-emoji]');
  if (open && (!button || open._button === button)) { open._button?.setAttribute('aria-expanded', 'false'); open.remove(); if (button) return; }
  if (!button || event.target.closest('.post-emoji-pop')) return;
  const pop = document.createElement('div');
  pop.className = 'post-emoji-pop';
  pop.setAttribute('role', 'dialog');
  pop.setAttribute('aria-label', 'Emoji');
  pop.innerHTML = POST_EMOJI.map(emoji => '<button type="button" data-emoji="' + emoji + '" aria-label="' + emoji + '">' + emoji + '</button>').join('');
  pop._form = button.form || button.closest('form'); pop._button = button;
  button.setAttribute('aria-expanded', 'true');
  button.closest('.post-style').append(pop);
});

function postDetailsMarkup(post) {
  const parts = [];
  if (postFeelings.has(post.feeling)) parts.push(postFeelings.get(post.feeling) + ' Feeling ' + esc(post.feeling.toLowerCase()));
  if (post.location) parts.push('Location: ' + esc(post.location));
  return parts.length ? '<p class="post-detail-line">' + parts.join(' · ') + '</p>' : '';
}

compose = function () {
  if (!previewSignedIn) { showSocialHome(); return; }
  composeExistingPost();
  mountPostDetails($('#post-form'));
};
card = function (post) {
  let html = renderExistingCard(post);
  const preview = postLinkMedia(post.url);
  if (preview) html = html.replace('<div class="link-preview">', '<div class="link-preview">' + preview);
  if (post.feeling || post.location) html = html.replace('</div><p>', '</div>' + postDetailsMarkup(post) + '<p>');
  if (post.name === 'Zainy') html = html.replace('<strong>Zainy</strong>', '<strong>' + esc(displayAlias) + '</strong>');
  html = html.replace('<article class="post">', '<article class="post" data-post-id="' + esc(post.id) + '">');
  html = html.replace(/(<div class="post-top">\s*<button[^>]*>)<span class="avatar[^>]*>[^<]*<\/span>/, (_, start) => start + profileAvatar(post.name));
  html = html.replace(/(<p class="comment">)<strong>([^<]+)<\/strong>/g, (_, start, name) => start + profileAvatar(name) + ' <strong>' + esc(name === 'Zainy' ? displayAlias : name) + '</strong>');
  if (post.image) html = html.replace(/<img src="[^"]*" alt="Photo shared in your demo post">/, image => '<button class="profile-photo-open" data-profile-photo="' + esc(post.id) + '" aria-label="Open photo and comments">' + image + '</button>');
  if (!previewSignedIn || publicPreview || !own.some(item => item.id === post.id)) return html;
  return html.replace('<div class="post-actions">', `<div class="post-actions"><button type="button" data-edit-post="${esc(post.id)}">Edit</button><button type="button" data-delete-post="${esc(post.id)}">Delete</button>`);
};

function postLinkMedia(value) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { return ''; }
  if (!['http:', 'https:'].includes(url.protocol)) return '';
  const video = youtubeId(url.href);
  if (video) return '<button type="button" class="post-video-preview" data-play-post-video="' + video +
    '" aria-label="Play YouTube video"><img src="https://i.ytimg.com/vi/' + video +
    '/hqdefault.jpg" alt="" loading="lazy"><span aria-hidden="true">▶</span></button>';
  return '<div class="article-media" data-article-preview="' + esc(url.href) + '" hidden></div>';
}

const articlePreviewRequests = new Map();
function loadArticlePreviews() {
  for (const target of document.querySelectorAll('[data-article-preview]')) {
    const url = target.dataset.articlePreview;
    target.removeAttribute('data-article-preview');
    if (!articlePreviewRequests.has(url)) {
      articlePreviewRequests.set(url, fetch('/social-next/article-preview?url=' + encodeURIComponent(url))
        .then(response => response.ok ? response.json() : {}).catch(() => ({})));
    }
    articlePreviewRequests.get(url).then(({ image }) => {
      if (!image || !target.isConnected) return;
      const photo = document.createElement('img');
      photo.alt = 'Article preview';
      photo.referrerPolicy = 'no-referrer';
      photo.addEventListener('load', () => { target.hidden = false; }, { once: true });
      photo.addEventListener('error', () => target.remove(), { once: true });
      target.append(photo);
      photo.src = image;
    });
  }
}

new MutationObserver(loadArticlePreviews).observe($('#content'), {childList: true, subtree: true});
$('#content').addEventListener('click', event => {
  const button = event.target.closest('[data-play-post-video]');
  if (!button) return;
  const frame = document.createElement('iframe');
  frame.className = 'post-video-player';
  frame.title = 'YouTube video player';
  frame.src = 'https://www.youtube-nocookie.com/embed/' + button.dataset.playPostVideo + '?autoplay=1';
  frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
  frame.allowFullscreen = true;
  button.replaceWith(frame);
});

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
  mountPostDetails($('#edit-own-post'), post);
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
    const next = {...post, ...readPostDetails(event.target), text, url, image, link:hostname, title:url ? text || 'A link from Zainy' : '', publicPhoto:!!image && !!post.publicPhoto};
    commitOwnPosts(own.map(item => item.id === id ? next : item), 'Post updated.');
  };
}

function commitOwnPosts(posts, message) {
  if (!persistProfile('posts', posts)) return;
  own = posts;
  $('#dialog').close();
  profile('Zainy');
  toast(message);
}

$('#content').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.hasAttribute('data-edit-portrait') && previewSignedIn && !publicPreview) {
    editProfile();
    $('#edit-form').elements.portrait.focus();
    return;
  }
  if (button.hasAttribute('data-edit-photos') && previewSignedIn && !publicPreview) { editOwnerPhotos(); return; }
  if (button.dataset.friendAction) {
    if (button.dataset.friendAction === 'Block') blockAlias(button.dataset.friendName);
    else if (button.dataset.friendAction === 'Unblock') unblockAlias(button.dataset.friendName);
    else updateFriend(button.dataset.friendName, button.dataset.friendAction === 'Accept');
    return;
  }
  if (button.hasAttribute('data-owner-portrait')) { modal('<h2>Profile picture</h2><img class="profile-photo-detail" src="' + esc(portrait || 'colorful-leaf.svg') + '" alt="Profile picture">'); return; }
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
  const photoControl = event.target.closest('[data-photo-activity], [data-remove-photo]');
  if (photoControl && previewSignedIn && !publicPreview) {
    if (photoControl.dataset.removePhoto) {
      const id = photoControl.dataset.removePhoto;
      if (!confirm('Remove this photo?')) return;
      const next = own.flatMap(post => post.id !== id ? [post] : post.text || post.url ? [{...post, image:null, publicPhoto:false}] : []);
      commitOwnPosts(next, 'Photo removed.');
      return;
    }
    $('#dialog').close();
    if (photoControl.dataset.photoActivity === 'portrait') editProfile();
    else { compose(); $('#photo')?.focus(); }
    return;
  }
  const button = event.target.closest('[data-profile-comment]');
  if (button && previewSignedIn) {
    $('#dialog').close();
    addProfileComment(button.dataset.profileComment);
  }
});
const savedFriends = read('friends', []);
const previewFriends = new Set((savedFriends || names).filter(name => !blocked.includes(name)));
if (!savedFriends) {
  for (const name of following) if (!previewFriends.has(name) && !requests.includes(name)) requests.push(name);
  save('requests', requests);
  save('friends', [...previewFriends]);
}
following = [...previewFriends];

function friendActionLabel(name) {
  return previewFriends.has(name) ? 'Friends' : requests.includes(name) ? 'Request pending' : '+ Add friend';
}

function syncPreviewFriends() {
  following = [...previewFriends].filter(name => !blocked.includes(name));
  save('friends', following);
  save('following', following);
  const ownerAvatar = $('#messenger .presence .avatar');
  if (ownerAvatar) ownerAvatar.outerHTML = profileAvatar('Zainy');
  updateProfilePortraits();
  $('#buddies').innerHTML = following.map(name => '<button class="buddy" onclick="privateChat(\'' +
    esc(name) + '\')">' + profileAvatar(name) + '<span><strong>' + esc(name) + '</strong></span><i></i></button>').join('');
  suggestions();
}

function updateFriend(name, accept, navigate = true) {
  if (!previewSignedIn || !directoryPeople.some(user => user.name === name)) return;
  if (followers.includes(name) && !blocked.includes(name)) {
    if (accept) previewFriends.add(name);
    followers = followers.filter(user => user !== name);
    requests = requests.filter(user => user !== name);
    save('followers', followers);
    save('requests', requests);
    save('seenFriendRequests', read('seenFriendRequests', []).filter(item => item !== name));
  } else if (!accept) previewFriends.delete(name);
  syncPreviewFriends();
  if (navigate) relationshipPanel();
}

follow = function (name) {
  if (!previewSignedIn || blocked.includes(name) || !users.some(user => user.name === name)) return;
  if (previewFriends.has(name)) { show('following'); return; }
  if (followers.includes(name)) { updateFriend(name, true); return; }
  if (requests.includes(name)) { toast('Friend request is waiting for approval.'); return; }
  requests.push(name);
  save('requests', requests);
  suggestions();
  if (current === 'profile') profile(name);
  toast('Friend request saved in this preview.');
};
request = function (name) { if (previewFriends.has(name)) privateChat(name); else follow(name); };
const blockPreviewFriend = blockAlias;
blockAlias = function (name) {
  previewFriends.delete(name);
  requests = requests.filter(user => user !== name);
  save('requests', requests);
  blockPreviewFriend(name);
  syncPreviewFriends();
};

relationshipPanel = function () {
  current = 'following';
  $('.write').hidden = true;
  $('.feed-nav').hidden = true;
  $('#content').classList.remove('custom-space');
  $('#content').removeAttribute('style');
  $('#heading').textContent = 'Friends';
  $('#subheading').textContent = 'Friend requests need approval.';
  document.querySelectorAll('.menu button').forEach((button, index) => button.classList.toggle('selected', index === 4));
  const rows = (list, action) => list.map(name => '<div class="suggestion">' + profileAvatar(name) + profileUserLink(name) +
    (action ? '<button class="secondary" data-friend-action="' + action + '" data-friend-name="' + esc(name) + '">' + (action === 'Accept' ? 'Accept and add back' : action) + '</button>' : '') + (action === 'Remove' ? '<button class="secondary" data-friend-action="Block" data-friend-name="' + esc(name) + '">Block</button>' : '') + '</div>').join('') || '<p>None yet.</p>';
  $('#content').innerHTML = '<section class="directory"><h2>Friends</h2>' + rows(following, 'Remove') +
    '<h2>Incoming requests</h2>' + rows(followers.filter(name => !following.includes(name) && !blocked.includes(name)), 'Accept') +
    '<h2>Sent requests</h2>' + rows(requests.filter(name => !following.includes(name))) +
    '<h2>Blocked chatters</h2>' + rows(blocked, 'Unblock') +
    '<p class="preview-limit">Friends and requests are saved in this browser for the preview.</p></section>';
};

function mountOwnerWallComposer() {
  const wall = $('#wall-form');
  if (!wall) return;
  const form = $('#quick-post').cloneNode(true);
  form.querySelector('#plan-room-event')?.remove();
  form.id = 'wall-post-composer';
  form.hidden = false;
  form.querySelectorAll('.post-details').forEach(field=>field.remove());
  const thought = document.createElement('textarea');
  thought.id = 'wall-text';
  thought.name = 'thought';
  thought.rows = 3;
  thought.maxLength = 3000;
  thought.placeholder = 'Share something on your profile…';
  thought.setAttribute('aria-label', 'Write a post');
  form.elements.thought.replaceWith(thought);
  const send = form.querySelector('.quick-submit');
  send.className = 'wall-send';
  send.setAttribute('aria-label', 'Post');
  send.title = 'Post';
  form.querySelector('.post-attachments').open = false;
  form.querySelector('.post-attachments input[type=file]').value = '';
  form.elements.attachmentUrl.value = '';
  send.replaceChildren(send.querySelector('.wall-note-icon'));
  form.querySelector('.avatar').outerHTML = profileAvatar('Zainy');
  wall.replaceWith(form);
  mountPostDetails(form);
  form.addEventListener('submit', submitQuickPost);
  $('.profile-wall .wall-note').textContent = 'Your posts appear in Your feed and in Posts on your profile.';
}

mountPostDetails($('#quick-post'));
$('#quick-post').addEventListener('submit', submitQuickPost);
function submitQuickPost(event) {
  event.preventDefault();
  if (!previewSignedIn) return;
  const text = event.currentTarget.elements.thought.value.trim();
  if (!text) return;
  const now = new Date();
  const posts = [{ id: 'own-' + now.getTime(), name:'Zainy', topic:'Your space', ...readPostDetails(event.currentTarget), text, createdAt:now.toISOString() }, ...own];
  if (!persistProfile('posts', posts)) return;
  own = posts;
  event.currentTarget.reset();
  toast('Posted to your space.');
  spaceTab = 'posts';
  profile('Zainy');
}

const renderPreviewFeed = render;
render = function () {
  if (current !== 'feed' || !previewSignedIn) { renderPreviewFeed(); return; }
  const now = Date.now();
  const cutoff = now - 7 * 86400000;
  const stories = Object.entries(sampleBotProfiles).filter(([name, bot]) => following.includes(name) && !bot.private && !blocked.includes(name)).flatMap(([name, bot]) => [
    { date: Date.parse(bot.postedAt), html: () => '<article class="space-card bot-profile-post"><strong class="post-author">' + profileAvatar(name) + profileUserLink(name) +
      '</strong>' + profileTimestamp(bot.postedAt) + '<p>' + esc(bot.post) + ' ' + botRoomLink(bot.room) + '.</p>' +
      profilePostComments('bot-post-' + name) + '</article>' },
    { date: Date.parse(bot.postedAt) - 86400000, html: () => botPhotoPost(name, bot) },
  ]);
  const posts = [...own, ...seeds].filter(post => (post.name === 'Zainy' || following.includes(post.name)) && !blocked.includes(post.name)).map(post => ({
    date: Date.parse(post.createdAt) || (/^own-\d+$/.test(post.id) ? Number(post.id.slice(4)) : NaN),
    html: () => card(post),
  }));
  const visible = [...stories, ...posts].filter(post => post.date >= cutoff && post.date <= now).sort((a,b) => b.date - a.date);
  $('#content').innerHTML = visible.map(post => post.html()).join('') ||
    '<div class="empty">' + (following.length ? 'No posts from friends in the last seven days.' : 'Add friends in Find your people to start your feed.') + '</div>';
};

suggestions = function () {
  $('#follow-count').textContent = following.length;
  const section = $('.familiar');
  section.hidden = !previewSignedIn;
  if (!previewSignedIn) return;
  const candidates = directoryPeople.filter(({name}) =>
    !previewFriends.has(name) && !requests.includes(name) && !followers.includes(name) && !blocked.includes(name));
  $('#suggestions').innerHTML = candidates.slice(0, 3).map(({name}) =>
    '<div class="suggestion">' + profileAvatar(name) + profileUserLink(name) +
    '<span class="bot-badge">Bot</span></div>'
  ).join('') || '<p>No new suggestions right now.</p>';
  updateNotificationBadge();
};

const bell = $('#notification-bell');
const unseenRequests = () => followers.filter(name => !previewFriends.has(name) && !blocked.includes(name));
function notificationActivity() {
  return own.flatMap(post => {
    const replies = comments[post.id]?.length || 0;
    const liked = likes.includes(post.id);
    if (!replies && !liked) return [];
    return [{ id: post.id, replies, liked, text: post.text || 'Photo or link' }];
  });
}

function updateNotificationBadge() {
  const seen = read('seenPostActivity', {});
  const seenRequests = new Set(read('seenFriendRequests', []));
  const unread = notificationActivity().reduce((total, item) => {
    const [replies = '0', liked = 'false'] = String(seen[item.id] || '').split(':');
    return total + Math.max(0, item.replies - Number(replies)) + Number(item.liked && liked !== 'true');
  }, 0);
  const count = unseenRequests().filter(name => !seenRequests.has(name)).length + unread;
  const badge = $('#notification-count');
  bell.classList.toggle('has-unread', count > 0);
  badge.hidden = !count;
  badge.textContent = count ? String(count) : '';
  bell.setAttribute('aria-label', count ? 'Notifications, ' + count + ' new' : 'Notifications');
}

function openNotifications() {
  const pending = unseenRequests();
  persistProfile('seenFriendRequests', pending);
  const activity = notificationActivity();
  persistProfile('seenPostActivity', Object.fromEntries(activity.map(item => [item.id, item.replies + ':' + item.liked])));
  updateNotificationBadge();
  modal('<h2>Notifications</h2><h3>Friend requests</h3>' + (pending.map(name =>
    '<div class="notification-row">' + profileAvatar(name) + profileUserLink(name) +
    '<button type="button" class="secondary" data-notification-request="accept" data-name="' + esc(name) + '">Accept and add back</button>' +
    '<button type="button" class="text-action" data-notification-request="decline" data-name="' + esc(name) + '">Decline</button></div>'
  ).join('') || '<p>No pending requests.</p>') + '<h3>Post activity</h3>' + (activity.map(item =>
    '<button type="button" class="text-action notification-post" data-notification-post="' + esc(item.id) + '">' +
    esc(item.text.slice(0, 70)) + ' · ' + (item.replies ? item.replies + (item.replies === 1 ? ' comment' : ' comments') : '') +
    (item.replies && item.liked ? ', ' : '') + (item.liked ? '1 like' : '') + '</button>'
  ).join('') || '<p>No post activity yet.</p>') + '<p class="preview-limit">Activity shown here is stored in this browser.</p>');
}

bell.addEventListener('click', openNotifications);
$('#suggestions').addEventListener('click', event => {
  const control = event.target.closest('[data-suggest-friend]');
  if (control) follow(control.dataset.suggestFriend);
});
$('#dialog').addEventListener('click', event => {
  if (event.target.closest('.notification-row [data-profile-link]')) $('#dialog').close();
  const request = event.target.closest('[data-notification-request]');
  if (request && previewSignedIn) {
    updateFriend(request.dataset.name, request.dataset.notificationRequest === 'accept', false);
    openNotifications();
  }
  const post = event.target.closest('[data-notification-post]');
  if (post && previewSignedIn) {
    $('#dialog').close();
    spaceTab = 'posts';
    profile('Zainy');
    document.querySelector('[data-post-id="' + CSS.escape(post.dataset.notificationPost) + '"]')?.scrollIntoView({block:'center'});
  }
});

const presence = $('#status');
presence.value = read('defaultPresence', 'available');
if (!presence.value) presence.value = 'available';
presence.onchange = () => toast('Preview status: ' + presence.selectedOptions[0].textContent);
$('#presence-settings').addEventListener('click', () => {
  modal('<h2>Sign-in status</h2><p>Choose the status the Social preview starts with on this browser.</p>' +
    '<form id="default-presence-form"><label>Default status<select name="presence">' + presence.innerHTML +
    '</select></label><button class="primary">Save</button></form>');
  const form = $('#default-presence-form');
  form.elements.presence.value = read('defaultPresence', 'available');
  form.onsubmit = event => {
    event.preventDefault();
    const value = form.elements.presence.value;
    if (!persistProfile('defaultPresence', value)) return;
    presence.value = value;
    $('#dialog').close();
    toast('Default status saved.');
  };
});
syncPreviewFriends();
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
  if (liveEntry) {
    location.assign(liveRoomUrl(link.dataset.liveRoom));
    return;
  }
  const view = $('#live-chat-view');
  if (view && link.dataset.liveRoom) {
    view.selectRoom(link.dataset.liveRoom);
    return;
  }
  selectedLiveRoom = link.dataset.liveRoom || null;
  if (selectedLiveRoom) rememberRoomProfile(selectedLiveRoom);
  else if (location.hash === '#chat' && location.search) history.pushState(null, '', '/social-next/#chat');
  show('rooms');
});
