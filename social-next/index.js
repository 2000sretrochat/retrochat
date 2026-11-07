const fs = require('node:fs');
const path = require('node:path');
const articlePreview = require('./article-preview');
const {registerApi} = require('./api');

const mount = '/social-next/';
const assets = path.join(__dirname, 'web');
const accountScripts = new Set(['chatbabble.js', 'space.js', 'profile-extras.js', 'space-refinements.js', 'community.js', 'social-home.js']);
const accountName = /^[a-z][a-z0-9_.-]{2,19}$/i;

function withAccountAlias(content, alias) {
  return content.replace(/Zainy|zainy/g, original => original === 'Zainy' ? alias : alias.toLowerCase());
}

function attachSocialNext(app, express, accounts, db, io) {
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
    const [permission] = await db.q(`select is_master,exists(select 1 from social_restrictions
      where user_id=users.id and service='social') as social_blocked from users where id=$1`,[account.id]);
    if (permission?.social_blocked && !permission.is_master) {
      return res.status(403).type('html').send('<h1>Social access restricted</h1><p>Your Messenger account is available separately.</p><a href="/">Open Messenger</a>');
    }
    req.socialAccount = { id: account.id, alias, master:!!permission?.is_master };
    next();
  });
  registerApi(router, express, db, accounts, io);
  router.get('/bot-portrait/:index.svg',async(req,res)=>{
    const index=Number(req.params.index);if(!Number.isInteger(index)||index<0||index>=61)return res.sendStatus(404);
    const image=await fs.promises.readFile(path.join(assets,'directory-bot-photos.jpg'));
    res.type('image/svg+xml').set('Cache-Control','private,max-age=86400').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${index%8*160} ${Math.floor(index/8)*160} 160 160"><image width="1280" height="1280" href="data:image/jpeg;base64,${image.toString('base64')}"/></svg>`);
  });
  router.get('/rooms.html',(_req,res)=>res.redirect(302,'/rooms.html'));
  router.get('/country', (_req, res) => res.json({country: null}));
  router.get('/article-preview', async (req, res) => {
    const response = await articlePreview(typeof req.query.url === 'string' ? req.query.url : '');
    res.json(await response.json());
  });
  router.get('/session.js', async (req, res) => {
    const { id, alias } = req.socialAccount;
    const [profile] = await db.q('select display_name, age, location, bio, interests, sex, profile_status from users where id=$1', [id]);
    if (!profile) return res.sendStatus(401);
    const [settings] = await db.q('select value from social_settings where user_id=$1',[id]);
    const value = JSON.stringify({ id, alias, profile, settings:settings?.value || {}, master:req.socialAccount.master }).replace(/</g, '\\u003c');
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
