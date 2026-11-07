const articlePublishers = new Set([
  'apnews.com', 'arstechnica.com', 'bbc.com', 'bbc.co.uk', 'cnn.com', 'cnbc.com',
  'forbes.com', 'npr.org', 'nytimes.com', 'reuters.com', 'theguardian.com', 'theverge.com',
  'usatoday.com', 'washingtonpost.com', 'wired.com', 'yahoo.com', 'news.yahoo.com',
  'azcentral.com', 'abcnews.go.com', 'nbcnews.com', 'cbsnews.com',
]);

function publisherUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
        !articlePublishers.has(url.hostname.replace(/^www\./, ''))) return null;
    url.protocol = 'https:';
    url.hash = '';
    return url;
  } catch { return null; }
}

function articleImage(html, base) {
  for (const tag of html.matchAll(/<meta\s+([^<>]*)>/gi)) {
    const attributes = Object.fromEntries(Array.from(tag[1].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>]+))/g),
      ([, key, quoted, single, unquoted]) => [key.toLowerCase(), quoted ?? single ?? unquoted]));
    if (!['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(attributes.property || attributes.name)) continue;
    if (!attributes.content) continue;
    try {
      const image = new URL(attributes.content.replace(/&amp;|&#38;/gi, '&'), base);
      if (image.protocol === 'https:' && !image.username && !image.password && !image.port &&
          /^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(image.hostname) && !/\.(?:local|localhost|internal|test|lan)$/i.test(image.hostname)) return image.href;
    } catch { /* Try the next preview tag. */ }
  }
  return null;
}

async function articlePreview(value) {
  let url = publisherUrl(value);
  const result = image => Response.json({ image }, { headers: { 'Cache-Control': 'public, max-age=900' } });
  if (!url || value.length > 2000) return result(null);
  try {
    const signal = AbortSignal.timeout(5000);
    for (let hop = 0; hop < 3; hop++) {
      const response = await fetch(url, { redirect: 'manual', signal, headers: { Accept: 'text/html' } });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const redirect = response.headers.get('Location');
        await response.body?.cancel();
        if (!redirect) break;
        url = publisherUrl(new URL(redirect, url));
        if (!url) break;
        continue;
      }
      if (!response.ok || !response.headers.get('Content-Type')?.includes('text/html') || !response.body) {
        await response.body?.cancel();
        break;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let html = '';
      let bytes = 0;
      try {
        while (bytes < 128 * 1024 && !/<\/head\s*>/i.test(html)) {
          const { value: chunk, done } = await reader.read();
          if (done) break;
          html += decoder.decode(chunk.subarray(0, 128 * 1024 - bytes), { stream: true });
          bytes += chunk.length;
        }
      } finally { await reader.cancel(); }
      return result(articleImage(html, url));
    }
  } catch { /* Keep the original link when preview lookup fails. */ }
  return result(null);
}



module.exports = articlePreview;
