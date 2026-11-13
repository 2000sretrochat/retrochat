// "Profile pictures" album on Social profiles (Nov 13, 2026). Lists the Messenger/profile pictures kept for the account;
// the owner can upload, delete (not the current default) and "Set as default" (changes the Messenger picture everywhere).
window.SocialProfilePictures = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');
  // Square crop, resized to fit the 32 KB Messenger picture limit.
  function shrink(file) {
    return new Promise((resolve, reject) => {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return reject(Error('Choose a JPEG, PNG, WebP or GIF picture.'));
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const side = Math.min(img.naturalWidth, img.naturalHeight), canvas = document.createElement('canvas');
        for (const [size, q] of [[160, .86], [128, .8], [112, .7], [96, .6]]) {
          canvas.width = canvas.height = size;
          const g = canvas.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, size, size);
          g.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
          const data = canvas.toDataURL('image/jpeg', q);
          if (data.length * 3 / 4 < 31 * 1024) return resolve(data);
        }
        reject(Error('That picture is too detailed to shrink. Try another.'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(Error('That file is not a picture.')); };
      img.src = url;
    });
  }
  async function load(section, { api, toast }) {
    if (!section || !section.isConnected) return;
    const name = section.dataset.ppOwner, manage = section.dataset.ppManage === '1';
    const album = section.querySelector('.pp-album'), gallery = section.querySelector('.social-profile-gallery');
    let data;
    try { data = await api('/profile-pictures/' + encodeURIComponent(name)); } catch { return; } // keep the old gallery view
    if (!section.isConnected) return;
    const pics = data.pictures || [];
    if (!pics.length && !manage) return; // nothing kept yet: the older Messenger photo set stays visible
    if (gallery) gallery.hidden = true;
    section.querySelectorAll(':scope > p:not(.pp-note)').forEach(p => { if (/No Messenger profile pictures yet/.test(p.textContent)) p.hidden = true; });
    album.hidden = false;
    album.innerHTML = '<div class="pp-grid">' + pics.map((p, i) =>
      '<figure class="pp-item' + (p.current ? ' is-default' : '') + '"><img src="' + esc(p.src) + '" alt="Profile picture ' + (i + 1) + '" loading="lazy">' +
      '<figcaption>' + (p.current ? '<strong>Default</strong>' : '<small>' + esc(new Date(p.created).toLocaleDateString()) + '</small>') +
      (manage && !p.current ? '<span class="pp-actions"><button type="button" class="text-action" data-pp-default="' + esc(p.id) + '">Set as default</button>' +
        '<button type="button" class="text-action" data-pp-delete="' + esc(p.id) + '">Delete</button></span>' : '') +
      '</figcaption></figure>').join('') + '</div>' +
      (!pics.length ? '<p>No profile pictures yet.</p>' : '') +
      (manage ? '<div class="pp-tools"><label class="secondary pp-upload">Upload a picture<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden></label>' +
        '<label class="checkbox-label"><input type="checkbox" class="pp-make-default" checked> Make it my default</label></div>' +
        (data.note ? '<p class="pp-note">' + esc(data.note) + '</p>' : '') : '');
    if (!manage) return;
    const reload = () => load(section, { api, toast });
    album.onclick = async ev => {
      const def = ev.target.closest('[data-pp-default]'), del = ev.target.closest('[data-pp-delete]');
      if (!def && !del) return;
      ev.preventDefault();
      try {
        if (def) { def.disabled = true; await api('/profile-pictures/' + def.dataset.ppDefault + '/default', 'POST', {}); toast('Default picture updated.'); }
        else { if (!confirm('Delete this picture?')) return; del.disabled = true; await api('/profile-pictures/' + del.dataset.ppDelete, 'DELETE', {}); toast('Picture deleted.'); }
        reload();
      } catch (e) { toast(e.message); reload(); }
    };
    const input = album.querySelector('.pp-upload input');
    input.onchange = async () => {
      const file = input.files && input.files[0]; input.value = ''; if (!file) return;
      try {
        const image = await shrink(file);
        await api('/profile-pictures', 'POST', { image, makeDefault: !!album.querySelector('.pp-make-default')?.checked });
        toast('Picture added.'); reload();
      } catch (e) { toast(e.message); }
    };
  }
  const css = document.createElement('style');
  css.textContent = '.pp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px;margin:8px 0}.pp-item{margin:0;display:flex;flex-direction:column;gap:4px}' +
    '.pp-item img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;border:1px solid #c8d6e5;background:#f1f5f8}.pp-item.is-default img{outline:3px solid #ff9900;outline-offset:-1px}' +
    '.pp-item figcaption{display:flex;flex-direction:column;gap:2px;font-size:12px}.pp-actions{display:flex;flex-wrap:wrap;gap:2px 8px}.pp-tools{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-top:6px}' +
    '.pp-upload{cursor:pointer;display:inline-flex;align-items:center}.pp-note{font-size:12px;color:#5b6f8c;margin:6px 0 0}';
  document.head.appendChild(css);
  return { load, shrink };
})();
