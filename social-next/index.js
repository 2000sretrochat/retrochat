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

function attachSocialNext(app, express, accounts, db, io, botChat) {
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
  registerApi(router, express, db, accounts, io, botChat);
  if(botChat?.musicLobby){
    router.post('/music/upload',(req,res,next)=>{
      if(!req.socialAccount.master)return res.sendStatus(403);
      if(req.get('origin')!==req.protocol+'://'+req.get('host'))return res.sendStatus(403);
      if(!req.is('audio/mpeg') || req.query.rights!=='yes')return res.status(400).json({error:'Confirm that you can stream this MP3.'});
      next();
    },express.raw({type:'audio/mpeg',limit:'8mb'}),async(req,res)=>{
      const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
      const result=await botChat.musicLobby.add({title:clean(req.query.title,100),artist:clean(req.query.artist,100),duration:Number(req.query.duration),audio:req.body});
      res.status(result.error?400:201).json(result);
    });
  }
  router.get('/bot-portrait/:index.svg',async(req,res)=>{
    const index=Number(req.params.index);
    if(!Number.isInteger(index)||index<0||index>=64)return res.sendStatus(404);
    const preview=index>=61;
    const canvas=preview?1254:1280;
    const tile=[0,1,3][index-61];
    // The photo sheet's row edges vary. Keep the crop inside each photograph.
    const rowTop=[0,172,340,518,691,852,1012,1164];
    const overlays={19:320,20:320,22:320,26:480,32:640,45:800,46:800,50:960,55:960};
    const size=preview?627:[24,37,38,42,47].includes(index)?104:index>=56?112:136;
    const x=preview?tile%2*627:index%8*160+(160-size)/2;
    const y=preview?Math.floor(tile/2)*627:(overlays[index]??rowTop[Math.floor(index/8)])+2;
    const image=await fs.promises.readFile(path.join(assets,preview?'bot-profile-photos.jpg':'directory-bot-photos.jpg'));
    res.type('image/svg+xml').set('Cache-Control','private,max-age=86400').send(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${size} ${size}"><image width="${canvas}" height="${canvas}" href="data:image/jpeg;base64,${image.toString('base64')}"/></svg>`);
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
