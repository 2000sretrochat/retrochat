(() => {
  const requests = new Map();
  const smileyPattern = new RegExp("&gt;:D&lt;|#:-S|O:-\\)|&lt;:-P|:-SS|&lt;\\):\\)|:-bd|\\^#\\(\\^|:ar!|:-\\?\\?|3:-O|:\\(\\|\\)|@\\};-|\\*\\*==|\\(~~\\)|\\*-:\\)|\\[-O&lt;|:\\)&gt;-|\\^:\\)\\^|\\[\\.\\.\\]|\\\\:D/|;;\\)|:-/|:&quot;&gt;|:-\\*|=\\(\\(|:-O|B-\\)|:-S|&gt;:\\)|:\\(\\(|:\\)\\)|/:\\)|=\\)\\)|:-B|:-c|:\\)\\]|~X\\(|:-h|:-t|8-&gt;|I-\\)|8-\\||L-\\)|:-&amp;|:-\\$|\\[-\\(|:O\\)|8-\\}|\\(:\\||=P~|:-\\?|#-o|=D&gt;|@-\\)|:\\^o|:-w|:-&lt;|&gt;:P|X_X|:!!|\\\\m/|:-q|:o3|%-\\(|:@\\)|~:&gt;|%%-|~O\\)|8-X|=:\\)|&gt;-\\)|:-L|\\$-\\)|:-&quot;|b-\\(|\\[-X|:D/|&gt;:/|;\\)\\)|:-@|:-j|\\(\\*\\)|:\\)\\||o-&gt;|o=&gt;|o-\\+|\\(%\\)|:bz|:-\\)|:-\\(|;-\\)|:-D|:-P|:-x|\\|-\\)|O:\\)|0-\\+|:\\)|:\\(|;\\)|:D|:x|:P|X\\(|:&gt;|:\\||=;|:O|:\\*|🤮|💋|💓|💤|&(?:[a-z]+|#[0-9]+);", 'gi');

  function load(src, globalName) {
    if (window[globalName]) return Promise.resolve(window[globalName]);
    if (!requests.has(src)) {
      const request = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = () => window[globalName] ? resolve(window[globalName]) : reject(new Error(src));
        script.onerror = () => reject(new Error(src));
        document.head.append(script);
      }).catch(error => {
        requests.delete(src);
        throw error;
      });
      requests.set(src, request);
    }
    return requests.get(src);
  }

  const smileys = () => load('/smileys.js?v=8', 'RCSmileys');
  const pendingDocuments = new Set();
  let hydrating = false;

  function hydrate(doc) {
    pendingDocuments.add(doc);
    if (hydrating) return;
    hydrating = true;
    smileys().then(art => {
      for (const owner of pendingDocuments) {
        art.prepare(owner);
        for (const node of owner.querySelectorAll('[data-razzle-smiley]')) {
          node.outerHTML = art.replace(node.innerHTML);
        }
      }
    }).catch(() => {}).finally(() => {
      pendingDocuments.clear();
      hydrating = false;
    });
  }

  // The chat server already HTML-escapes these strings. Preserve entities as units.
  function renderSmileys(text, doc = document) {
    if (window.RCSmileys) {
      RCSmileys.prepare(doc);
      return RCSmileys.replace(text);
    }
    return text.replace(smileyPattern, token => {
      if (/^&(?:[a-z]+|#[0-9]+);$/i.test(token)) return token;
      hydrate(doc);
      return '<span data-razzle-smiley>' + token + '</span>';
    });
  }

  // Fills a smiley picker (once) and adds the smiley art styles to the picker's document.
  // Every button that opens a picker must go through this: a picker opened without it is an empty box.
  async function fillSmileys(picker, doc = picker.ownerDocument) {
    const art = await smileys();
    art.prepare(doc);
    if (picker.ownerDocument !== doc) art.prepare(picker.ownerDocument);
    if (!picker.querySelector('[data-k]')) {
      picker.innerHTML = art.ordered.map(item => `<span data-k="${item.esc}">${item.html}</span>`).join('');
    }
    return picker;
  }

  function bindSmileys(button, picker, input) {
    let opening = false;
    button.onclick = async event => {
      event.stopPropagation();
      if (picker.classList.contains('open')) {
        picker.classList.remove('open');
        return;
      }
      if (opening) return;
      opening = true;
      try {
        await fillSmileys(picker);
        if (!picker.isConnected) return;
        picker.classList.add('open');
      } catch {
        button.title = 'Could not load smileys. Click to try again.';
      } finally {
        opening = false;
      }
    };
    button.onkeydown = event => {
      if (button.tagName !== 'BUTTON' && ['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        button.click();
      }
    };
    picker.onclick = event => {
      const item = event.target.closest('[data-k]');
      if (!item) return;
      input.value += ' ' + item.dataset.k + ' ';
      input.dispatchEvent(new (input.ownerDocument.defaultView || window).Event('input', { bubbles: true }));
      picker.classList.remove('open');
      input.focus();
    };
  }

  window.RazzleAssets = {
    renderSmileys, bindSmileys, fillSmileys,
    qrCode: () => load('/qrcode.js', 'qrcode')
  };
})();
