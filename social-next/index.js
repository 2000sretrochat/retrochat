const fs = require('node:fs');
const path = require('node:path');
const articlePreview = require('./article-preview');

const mount = '/social-next/';
const assets = path.join(__dirname, 'web');
const accountScripts = new Set(['chatbabble.js', 'space.js', 'profile-extras.js', 'space-refinements.js', 'community.js', 'social-home.js']);
const accountName = /^[a-z][a-z0-9_.-]{2,19}$/i;

function withAccountAlias(content, alias) {
  return content.replace(/Zainy|zainy/g, original => original === 'Zainy' ? alias : alias.toLowerCase());
}

function attachSocialNext(app, express, accounts, db) {
  const router = express.Router();
  router.use(async (req, res, next) => {
    const account = await accounts.userFromCookie(req.headers.cookie).catch(() => null);
    const alias = account?.canon || account?.name;
    if (!accountName.test(alias || '')) {
      if (req.path === '/' || req.path.startsWith('/@')) return res.redirect(303, '/?chat=1&social=1');
      return res.sendStatus(401);
    }
    const csp = res.get('Content-Security-Policy');
    if (csp) res.set('Content-Security-Policy', csp
      .replace("img-src 'self' data: blob:", "img-src 'self' data: blob: https:")
      + "; frame-src 'self' https://www.youtube-nocookie.com https://open.spotify.com https://w.soundcloud.com https://embed.music.apple.com");
    res.set({'Cache-Control': 'private, no-store', 'Cross-Origin-Resource-Policy': 'same-origin'});
    req.socialAccount = { id: account.id, alias };
    next();
  });
  router.get('/country', (_req, res) => res.json({country: null}));
  router.get('/article-preview', async (req, res) => {
    const response = await articlePreview(typeof req.query.url === 'string' ? req.query.url : '');
    res.json(await response.json());
  });
  router.get('/session.js', async (req, res) => {
    const { id, alias } = req.socialAccount;
    const [profile] = await db.q('select display_name, age, location, bio, interests, sex, profile_status from users where id=$1', [id]);
    if (!profile) return res.sendStatus(401);
    const value = JSON.stringify({ id, alias, profile }).replace(/</g, '\\u003c');
    res.type('application/javascript').send('window.socialSession = ' + value + ';');
  });
  router.get(['/','/index.html', /^\/@[a-z][a-z0-9_.-]{2,19}\/?$/i], async (req, res) => {
    const html = await fs.promises.readFile(path.join(assets, 'index.html'), 'utf8');
    res.type('html').send(withAccountAlias(html, req.socialAccount.alias));
  });
  router.use(async (req, res, next) => {
    const name = req.path.slice(1);
    if (!accountScripts.has(name)) return next();
    const script = await fs.promises.readFile(path.join(assets, name), 'utf8');
    res.type('application/javascript').send(withAccountAlias(script, req.socialAccount.alias));
  });
  router.use(express.static(assets, { index: false, redirect: false }));
  app.use(mount, router);
}

module.exports = attachSocialNext;
