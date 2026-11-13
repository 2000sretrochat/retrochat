// Social features (Nov 13, 2026): reactions, polls, sharing, @mentions + #room tags, tagging friends in posts and photos,
// birthdays. live-account.js renders posts and calls these helpers; window.SocialLive (set there) gives API access.
window.SocialFeatures = (function () {
  const REACT = [['like', '👍', 'Like'], ['love', '❤️', 'Love'], ['laugh', '😂', 'Haha'], ['wow', '😮', 'Wow'], ['throwup', '🤮', 'Gross'], ['mad', '😡', 'Mad'], ['shocked', '😱', 'Shocked']];
  const GLYPH = Object.fromEntries(REACT.map(([k, g]) => [k, g]));
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = () => window.SocialLive;
  const profileHref = n => '/social-next/@' + encodeURIComponent(String(n).toLowerCase());
  const nameLink = (n, label) => '<a href="' + profileHref(n) + '" data-profile-link="' + e(n) + '">' + e(label || n) + '</a>';
  // Room names for #tags (official + member rooms), keyed without spaces/punctuation.
  let roomKeys = new Map();
  const roomKey = n => String(n).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (typeof fetch === 'function') fetch('/api/rooms', { credentials: 'same-origin' }).then(r => r.ok ? r.json() : []).then(list => {
    roomKeys = new Map((Array.isArray(list) ? list : []).map(r => [roomKey(r.name), r.name])); if (roomKeys.size) L()?.refresh?.();
  }).catch(() => {});
  function richText(text, rooms = roomKeys) {
    return e(text)
      .replace(/(^|[^\w@/.&;])@([a-z][a-z0-9_.-]{2,19})/gi, (m, pre, n) => pre + '<a class="mention" href="' + profileHref(n.replace(/\.+$/, '')) + '" data-profile-link="' + e(n.replace(/\.+$/, '')) + '">@' + e(n) + '</a>')
      .replace(/(^|[^\w&#/;])#([A-Za-z0-9][A-Za-z0-9_-]{1,40})/g, (m, pre, tag) => { const room = rooms.get(roomKey(tag)); return room ? pre + '<a class="room-tag" href="/rooms.html?room=' + encodeURIComponent(room) + '" target="_blank" rel="noopener">#' + e(tag) + '</a>' : m; });
  }
  function reactionBar(post) {
    const counts = post.reactions || {}, total = Object.values(counts).reduce((a, b) => a + b, 0), mine = post.my_reaction;
    const top = REACT.filter(([k]) => counts[k]).sort((a, b) => counts[b[0]] - counts[a[0]]).slice(0, 3).map(([, g]) => g).join('');
    const cur = REACT.find(([k]) => k === mine);
    return '<span class="react-wrap"><button type="button" class="react-main" data-react="' + post.id + '" data-r="' + (mine ? '' : 'like') + '" aria-pressed="' + !!mine + '">' +
      (cur ? cur[1] + ' ' + cur[2] : '👍 Like') + '</button><span class="react-menu" role="group" aria-label="Reactions">' +
      REACT.map(([k, g, label]) => '<button type="button" data-react="' + post.id + '" data-r="' + k + '" title="' + label + '" aria-label="' + label + '"' + (k === mine ? ' aria-pressed="true"' : '') + '>' + g + '</button>').join('') +
      '</span></span>' + (total ? '<button type="button" class="react-summary" data-react-list="' + post.id + '" title="See who reacted">' + top + ' ' + total + '</button>' : '');
  }
  function pollCard(post) {
    const poll = post.poll; if (!poll || !Array.isArray(poll.options)) return '';
    const ended = poll.ends && new Date(poll.ends) <= new Date(), results = post.poll_results;
    const when = poll.ends ? '<small>' + (ended ? 'Poll ended ' : 'Ends ') + e(new Date(poll.ends).toLocaleString()) + '</small>' : '';
    if (!results) return '<div class="post-poll-card">' + poll.options.map((o, i) => '<button type="button" class="poll-option" data-vote="' + post.id + '" data-choice="' + i + '">' + e(o) + '</button>').join('') +
      '<small>Results appear after you vote.</small>' + when + '</div>';
    const total = Object.values(results).reduce((a, b) => a + b, 0);
    return '<div class="post-poll-card">' + poll.options.map((o, i) => { const n = results[i] || 0, pct = total ? Math.round(n * 100 / total) : 0;
      return '<div class="poll-result' + (post.my_vote === i ? ' mine' : '') + '"><span class="poll-bar" style="width:' + pct + '%"></span><span class="poll-label">' + e(o) + (post.my_vote === i ? ' ✓' : '') + '</span><span class="poll-pct">' + pct + '% · ' + n + '</span></div>'; }).join('') +
      '<small>' + total + ' vote' + (total === 1 ? '' : 's') + '</small>' + when + '</div>';
  }
  function withTags(post, me) {
    const tags = post.tags || []; if (!tags.length) return '';
    const names = tags.map(t => nameLink(t.name)), list = names.length < 3 ? names.join(' and ') : names.slice(0, -1).join(', ') + ' and ' + names.at(-1);
    const tagged = me && tags.some(t => t.name.toLowerCase() === me.toLowerCase());
    return '<p class="post-with">— with ' + list + (tagged ? ' <button type="button" class="text-action" data-untag="' + post.id + '">Remove my tag</button>' : '') + '</p>';
  }
  function sharedBox(post) {
    if (!post.shared_from) return '';
    const o = post.shared;
    if (!o) return '<div class="shared-original"><em>The original post is no longer available to you.</em></div>';
    return '<div class="shared-original"><small>Originally posted by ' + nameLink(o.name, o.display_name) + ' · ' + e(new Date(o.created).toLocaleString()) + '</small>' +
      (o.body ? '<p>' + richText(o.body) + '</p>' : '') + (o.image ? '<img src="' + e(o.image) + '" alt="Shared photo">' : '') +
      (o.link ? '<div class="link-preview">' + (typeof postLinkMedia === 'function' ? postLinkMedia(o.link) : '') + '</div>' : '') + '</div>';
  }
  const shareButton = post => '<button type="button" data-share="' + post.id + '">Share</button>';
  function photoHtml(post, me) {
    const tags = post.photo_tags || [], owner = post.author_id === L()?.myId;
    const tagged = me && tags.some(t => t.name.toLowerCase() === me.toLowerCase());
    return '<div class="photo-tag-box' + (owner ? ' can-tag' : '') + '" data-photo-post="' + post.id + '"><img class="profile-photo-detail" src="' + e(post.image) + '" alt="Shared photo">' +
      tags.map(t => '<a class="photo-tag" href="' + profileHref(t.name) + '" style="left:' + (t.x * 100) + '%;top:' + (t.y * 100) + '%" title="' + e(t.name) + '"><span>' + e(t.name) + '</span></a>').join('') + '</div>' +
      (owner ? '<p class="photo-tag-help">Click a spot on the photo to tag a friend. Hover a tag to see who it is.</p>' : tags.length ? '<p class="photo-tag-help">Hover a tag to see who it is.</p>' : '') +
      (tagged ? '<button type="button" class="text-action" data-untag="' + post.id + '">Remove my tag</button>' : '');
  }
  function birthdayText(b) { return b ? MONTHS[b.month - 1] + ' ' + b.day + (b.year ? ', ' + b.year : '') : ''; }
  function birthdayMarkup(b, own) {
    if (!b) return '';
    if (own && !b.show) return '<p class="profile-birthday">🎂 ' + e(birthdayText({ month: b.month, day: b.day })) + ' <small>(only you can see this)</small></p>';
    return '<p class="profile-birthday">🎂 Birthday: ' + e(birthdayText(own ? { month: b.month, day: b.day, year: b.showYear ? b.year : null } : b)) + '</p>';
  }
  function birthdayFields(b) {
    b = b || {};
    return '<fieldset class="birthday-fields"><legend>Birthday <small>Optional</small></legend><label>Month<select name="bdayMonth"><option value="">—</option>' +
      MONTHS.map((m, i) => '<option value="' + (i + 1) + '"' + (b.month === i + 1 ? ' selected' : '') + '>' + m + '</option>').join('') + '</select></label>' +
      '<label>Day<select name="bdayDay"><option value="">—</option>' + Array.from({ length: 31 }, (_, i) => '<option' + (b.day === i + 1 ? ' selected' : '') + '>' + (i + 1) + '</option>').join('') + '</select></label>' +
      '<label>Year <small>(optional, hidden)</small><input name="bdayYear" inputmode="numeric" maxlength="4" value="' + (b.year || '') + '"></label>' +
      '<label class="checkbox-label"><input type="checkbox" name="bdayShow"' + (b.show ? ' checked' : '') + '> Show my birthday on my profile and remind friends</label>' +
      '<label class="checkbox-label"><input type="checkbox" name="bdayShowYear"' + (b.showYear ? ' checked' : '') + '> Also show the year</label></fieldset>';
  }
  function readBirthday(form) {
    const f = form.elements; if (!f.bdayMonth) return {};
    if (!f.bdayMonth.value || !f.bdayDay.value) return { birthday: null };
    return { birthday: { month: +f.bdayMonth.value, day: +f.bdayDay.value, year: f.bdayYear.value.trim() ? +f.bdayYear.value : null, show: f.bdayShow.checked, showYear: f.bdayShowYear.checked } };
  }
  let bdays = null, bdayAt = 0;
  async function birthdayNotice(container) {
    if (!container || !L()) return;
    if (!bdays || Date.now() - bdayAt > 600000) { bdayAt = Date.now(); bdays = await L().api('/birthdays').catch(() => []); }
    if (!bdays.length || !container.isConnected || container.querySelector('.birthday-notice')) return;
    const line = b => nameLink(b.name, b.display_name) + ' · ' + e(birthdayText({ month: b.birthday.month, day: b.birthday.day })) + (b.days === 0 ? ' <b>today!</b>' : b.days === 1 ? ' (tomorrow)' : ' (in ' + b.days + ' days)');
    container.insertAdjacentHTML('afterbegin', '<section class="space-card birthday-notice"><h3>🎂 Birthdays this week</h3><p>' + bdays.map(line).join('<br>') + '</p></section>');
  }
  // Composer: Tag friends + Poll (new posts only).
  function mountComposer(form) {
    if (!form || form.id === 'shared-edit-form' || form.querySelector('.post-tag-friends')) return;
    const box = document.createElement('div'); box.className = 'post-extras';
    box.innerHTML = '<details class="post-details post-tag-friends"><summary>Tag friends</summary><div class="tag-friend-list"></div></details>' +
      '<details class="post-details post-poll"><summary>Poll</summary><p class="hint">Write the question in the post, then add 2 to 6 options.</p>' +
      Array.from({ length: 6 }, (_, i) => '<input name="pollOption" maxlength="80" placeholder="Option ' + (i + 1) + (i < 2 ? '' : ' (optional)') + '">').join('') +
      '<label>Ends (optional)<input type="datetime-local" name="pollEnds"></label></details>';
    form.append(box);
    const fill = () => { const list = box.querySelector('.tag-friend-list'), fr = L()?.friends?.() || [];
      list.innerHTML = fr.length ? fr.map(f => '<label class="checkbox-label"><input type="checkbox" name="tagFriend" value="' + e(f.name) + '"> ' + e(f.display_name || f.displayName || f.name) + '</label>').join('') : '<p>Add friends to tag them.</p>'; };
    box.querySelector('.post-tag-friends').addEventListener('toggle', fill); fill();
  }
  function readComposer(form) {
    const out = {}, f = form.elements;
    if (!f.pollOption) return out;
    const tags = [...form.querySelectorAll('input[name=tagFriend]:checked')].map(x => x.value); if (tags.length) out.tags = tags;
    const options = [...form.querySelectorAll('input[name=pollOption]')].map(x => x.value.trim()).filter(Boolean);
    if (options.length) out.poll = { options, ends: f.pollEnds.value ? new Date(f.pollEnds.value).toISOString() : null };
    return out;
  }
  // @mention autocomplete in post and comment boxes (friends only).
  let pick = null;
  const closePick = () => { pick?.remove(); pick = null; };
  document.addEventListener('input', ev => {
    const ta = ev.target; if (!(ta instanceof HTMLTextAreaElement) || !ta.closest('form')) return closePick();
    const before = ta.value.slice(0, ta.selectionStart), m = /(^|\s)@([a-z0-9_.-]{0,19})$/i.exec(before);
    if (!m) return closePick();
    const q = m[2].toLowerCase(), fr = (L()?.friends?.() || []).filter(f => f.name.toLowerCase().startsWith(q) || String(f.display_name || '').toLowerCase().startsWith(q)).slice(0, 6);
    closePick(); if (!fr.length) return;
    pick = document.createElement('div'); pick.className = 'mention-pick'; pick.setAttribute('role', 'listbox');
    pick.innerHTML = fr.map(f => '<button type="button" role="option" data-mention-name="' + e(f.name) + '">@' + e(f.name) + ' <small>' + e(f.display_name || '') + '</small></button>').join('');
    ta.after(pick);
    pick.addEventListener('mousedown', x => x.preventDefault());
    pick.addEventListener('click', x => { const b = x.target.closest('[data-mention-name]'); if (!b) return; const start = before.length - m[2].length;
      ta.value = ta.value.slice(0, start) + b.dataset.mentionName + ' ' + ta.value.slice(ta.selectionStart); ta.focus(); ta.selectionStart = ta.selectionEnd = start + b.dataset.mentionName.length + 1; closePick(); });
  });
  document.addEventListener('focusout', ev => { if (pick && !pick.contains(ev.relatedTarget)) setTimeout(closePick, 150); });
  async function act(fn) { try { await fn(); await L().refresh(); } catch (x) { (window.toast || alert)(x.message); } }
  // Hover list of who reacted.
  document.addEventListener('mouseover', async ev => {
    const b = ev.target.closest?.('[data-react-list]'); if (!b || b.dataset.loaded) return; b.dataset.loaded = '1';
    const list = await L().api('/posts/' + b.dataset.reactList + '/reactions').catch(() => []);
    b.title = list.map(r => (GLYPH[r.reaction] || '') + ' ' + r.display_name).join('\n') || 'No reactions yet';
  });
  document.addEventListener('click', ev => {
    const t = ev.target.closest?.('button,img'); if (!t) return;
    const d = t.dataset;
    if (d.react) { ev.preventDefault(); ev.stopImmediatePropagation(); const post = L().post(d.react);
      const r = d.r === '' || (post && post.my_reaction === d.r && t.closest('.react-menu')) ? null : d.r || 'like';
      return act(() => L().api('/posts/' + d.react + '/react', 'PUT', { reaction: r })); }
    if (d.reactList) { ev.preventDefault(); ev.stopImmediatePropagation();
      return L().api('/posts/' + d.reactList + '/reactions').then(list => L().modal('<h2>Reactions</h2>' + (list.map(r => '<p>' + (GLYPH[r.reaction] || '') + ' ' + nameLink(r.name, r.display_name) + '</p>').join('') || '<p>No reactions yet.</p>'))); }
    if (d.vote) { ev.preventDefault(); ev.stopImmediatePropagation(); return act(() => L().api('/posts/' + d.vote + '/vote', 'POST', { choice: +d.choice })); }
    if (d.untag) { ev.preventDefault(); ev.stopImmediatePropagation(); if (!confirm('Remove your tag from this post?')) return;
      return act(async () => { await L().api('/posts/' + d.untag + '/tags/' + encodeURIComponent(L().me.toLowerCase()), 'DELETE', {}); document.querySelector('#dialog')?.close?.(); }); }
    if (d.share) { ev.preventDefault(); ev.stopImmediatePropagation(); const fr = L().friends();
      L().modal('<h2>Share post</h2><form id="share-form" data-post="' + e(d.share) + '"><label>Share to<select name="wall"><option value="">Your timeline</option>' +
        fr.map(f => '<option value="' + e(f.name) + '">' + e(f.display_name || f.name) + '’s timeline</option>').join('') + '</select></label>' +
        '<label>Say something (optional)<textarea name="body" maxlength="3000"></textarea></label><p class="hint">The original poster is credited. Only people who can see the original post will see it.</p><button class="primary">Share</button></form>');
      return; }
    if (t.matches?.('.photo-tag-box.can-tag img')) {
      const box = t.closest('.photo-tag-box'), r = t.getBoundingClientRect(), x = (ev.clientX - r.left) / r.width, y = (ev.clientY - r.top) / r.height;
      box.querySelector('.photo-tag-choose')?.remove();
      const fr = L().friends(); const c = document.createElement('div'); c.className = 'photo-tag-choose'; c.style.left = (x * 100) + '%'; c.style.top = (y * 100) + '%';
      c.innerHTML = fr.length ? '<select aria-label="Tag a friend"><option value="">Tag a friend…</option>' + fr.map(f => '<option value="' + e(f.name) + '">' + e(f.display_name || f.name) + '</option>').join('') + '</select>' : '<small>Add friends to tag them.</small>';
      box.append(c);
      c.querySelector('select')?.addEventListener('change', s => { if (!s.target.value) return; act(async () => { await L().api('/posts/' + box.dataset.photoPost + '/photo-tags', 'PUT', { name: s.target.value, x, y }); document.querySelector('#dialog')?.close?.(); }); });
    }
  }, true);
  document.addEventListener('submit', ev => {
    const form = ev.target; if (form.id !== 'share-form') return; ev.preventDefault(); ev.stopImmediatePropagation();
    act(async () => { await L().api('/posts/' + form.dataset.post + '/share', 'POST', { wall: form.elements.wall.value || L().me, body: form.elements.body.value }); document.querySelector('#dialog')?.close?.(); (window.toast || (() => {}))('Shared.'); });
  }, true);
  const NOTE = { mention: 'mentioned you', tag: 'tagged you', share: 'shared your post', birthday: 'has a birthday coming up 🎂', room: 'tagged your room in a post', like: 'reacted to your post' };
  return { REACT, richText, reactionBar, pollCard, withTags, sharedBox, shareButton, photoHtml, birthdayMarkup, birthdayFields, readBirthday, birthdayNotice, mountComposer, readComposer, NOTE, roomKey };
})();
