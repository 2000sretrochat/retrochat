const crypto = require('node:crypto');
const geo = require('../geo');
const bots = require('../bots');
const {createOfflineMessages,registerOfflineRoutes} = require('../offline-messages');

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const feelings = new Set(['','Happy','Excited','Grateful','Relaxed','Hopeful','Loved','Proud','Curious','Tired','Bored','Sad','Worried','Frustrated','Lonely']);
const text = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
function photo(value, maximum = 700000) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > maximum || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) throw Object.assign(Error('Choose a smaller JPG, PNG, or WebP.'), {status:400});
  return value;
}
function link(value) {
  if (!value) return '';
  let url;
  try { url = new URL(value); } catch { throw Object.assign(Error('Use an http or https link.'),{status:400}); }
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.href.length > 2000) throw Object.assign(Error('Use an http or https link.'), {status:400});
  return url.href;
}
const audienceModes = ['profile','public','friends','private','selected'];
function audience(value, photo = false) {
  const mode = value?.mode;
  const names = items => Array.isArray(items) ? [...new Set(items.filter(name => typeof name === 'string')
    .map(name => name.trim().toLowerCase().replace(/^@/,'')).filter(name => /^[a-z][a-z0-9_.-]{2,19}$/.test(name)))].slice(0,50) : [];
  if (photo && (!mode || mode === 'post')) return {mode:'post'};
  if (!audienceModes.includes(mode)) throw Object.assign(Error('Choose who can see this.'),{status:400});
  const include = names(value.include), exclude = names(value.exclude);
  if (mode === 'selected' && !include.length) throw Object.assign(Error('Enter at least one screen name.'),{status:400});
  return {mode,include,exclude};
}
function galleryPhotos(settings, {owner, master, friend, restricted}) {
  if (owner || master) return settings.profileGallery || [];
  if (restricted) return (settings.profileGallery || []).filter(item => item.mode === 'public');
  return (settings.profileGallery || []).filter(item => item.mode === 'public' || item.mode === 'friends' && friend);
}
function publicSettings(value = {}) {
  return {portrait:value.portrait || '', headline:value.headline || '', appearance:value.appearance || null,
    visibility:value.visibility === 'private' ? 'private' : 'public', favoriteRooms:value.favoriteRooms || [],
    musicService:value.musicService || null,details:value.details?.enabled ? value.details : null,cover:value.cover || '#d9e9fa',socialLinks:value.socialLinks || {}};
}
function settingsPatch(value) {
  const allowed = new Set(['portrait','headline','cover','appearance','visibility','favoriteRooms','musicService','details','defaultPresence','socialLinks']);
  if (!value || Array.isArray(value) || typeof value !== 'object') throw Object.assign(Error('Invalid settings.'), {status:400});
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (!allowed.has(key)) continue;
    if (key === 'socialLinks') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(Error('Invalid social links.'),{status:400});
      result.socialLinks={};
      for (const domain of ['youtube.com','instagram.com','x.com']) {
        const raw=item[domain];if(!raw)continue;
        if(typeof raw!=='string'||raw.length>500)throw Object.assign(Error('Enter a valid '+domain+' link.'),{status:400});
        let url;try{url=new URL(/^https?:\/\//i.test(raw)?raw:'https://'+raw);}catch{throw Object.assign(Error('Enter a valid '+domain+' link.'),{status:400});}
        if(!['http:','https:'].includes(url.protocol)||!([domain,'www.'+domain].includes(url.hostname))||url.username||url.password||url.port||url.pathname==='/'||url.hash)
          throw Object.assign(Error('Use a '+domain+' profile link.'),{status:400});
        const validPath=domain==='youtube.com' ? /^\/(?:@[\w.%-]{1,100}|(?:channel|c|user)\/[\w.-]{1,100})\/?$/.test(url.pathname)
          : domain==='instagram.com' ? /^\/[a-z0-9_.]{1,30}\/?$/i.test(url.pathname) : /^\/[a-z0-9_]{1,15}\/?$/i.test(url.pathname);
        if(!validPath)throw Object.assign(Error('Use a '+domain+' channel or profile link.'),{status:400});
        url.protocol='https:';url.hostname=domain;url.search='';result.socialLinks[domain]=url.href;
      }
    } else if (key === 'portrait') result[key] = photo(item);
    else if (key === 'headline') result[key] = text(item,100);
    else if (key === 'cover') result[key] = /^#[0-9a-f]{6}$/i.test(item) ? item : '#d9e9fa';
    else if (key === 'visibility') result[key] = item === 'private' ? 'private' : 'public';
    else if (key === 'defaultPresence') {
      if (['available','away','dnd','invisible'].includes(item)) result[key] = item;
    } else if (key === 'favoriteRooms') result[key] = Array.isArray(item) ? item.slice(0,30).map(x => text(x,100)).filter(Boolean) : [];
    else if (key === 'appearance' && item && typeof item === 'object') {
      result[key] = {palette:text(item.palette,20),background:/^#[0-9a-f]{6}$/i.test(item.background) ? item.background : '#ffffff',
        texture:['plain','dots','lines'].includes(item.texture) ? item.texture : 'plain', image:photo(item.image,1250000),
        custom:Array.isArray(item.custom) ? item.custom.slice(0,3).map(c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#004990') : []};
    } else if (key === 'musicService' && item && typeof item === 'object') result[key] = {brand:text(item.brand,20),url:link(item.url)};
    else if (key === 'details' && item && typeof item === 'object') result[key] = {orientation:text(item.orientation,70),zodiac:text(item.zodiac,30),enabled:!!item.enabled};
  }
  return result;
}
function registerApi(router, express, db, accounts, io, botChat) {
  const writes=new Map();
  const run = handler => async (req,res) => {
    try { await handler(req,res); }
    catch(error) {
      if (!error.status) console.error('[social]', error.message);
      res.status(error.status || 500).json({error:error.status ? error.message : 'Social could not complete that request. Please retry.'});
    }
  };
  const fail = (message,status=400) => { throw Object.assign(Error(message),{status}); };
  const admin = req => { if (!req.socialAccount.master) fail('Administrator access required.',403); };
  const audit = (req,action,target,detail='') => db.q(
    'insert into master_audit(by_name,action,target,detail) values($1,$2,$3,$4)',
    [req.socialAccount.alias,action,String(target),text(detail,500)]);
  const isFriend = (owner, viewer) => `exists(select 1 from contacts where owner=${owner} and contact=${viewer})`;
  const isBlocked = (owner, viewer) => `exists(select 1 from blocks where (owner=${owner} and blocked=${viewer}) or (owner=${viewer} and blocked=${owner}))`;
  const profileAccess = (owner, viewer) => `(coalesce((select value->>'visibility' from social_settings where user_id=${owner}),'public') <> 'private' or ${isFriend(owner,viewer)})`;
  const audienceAccess = (post, viewer, policy) => {
    const name = `(select name_lc from users where id=${viewer})`;
    return `(not coalesce((${policy}->'exclude') ? ${name},false)
      and case coalesce(${policy}->>'mode','profile')
        when 'private' then false when 'friends' then ${isFriend(post+'.author_id',viewer)}
        when 'selected' then coalesce((${policy}->'include') ? ${name},false)
        when 'profile' then (${post}.wall_id=${viewer} or ${profileAccess(post+'.wall_id',viewer)})
        when 'public' then true when 'post' then true else false end)`;
  };
  const imageAccess = (post, viewer, master) => `(${master ? 'true' : 'false'} or ${post}.author_id=${viewer}
    or ${audienceAccess(post,viewer,`coalesce(${post}.audience->'photo','{"mode":"post"}'::jsonb)`)})`;
  const access = (post, viewer, master = false) => `(${master ? 'true' : 'false'} or ${post}.author_id=${viewer} or (
    not ${isBlocked(post+'.author_id',viewer)} and not ${isBlocked(post+'.wall_id',viewer)}
    and (${post}.wall_id=${post}.author_id or ${post}.wall_id=${viewer} or ${profileAccess(post+'.wall_id',viewer)})
    and ${audienceAccess(post,viewer,post+".audience->'post'")}
    and (${post}.body<>'' or ${post}.link<>'' or (${post}.image<>'' and ${imageAccess(post,viewer,master)}))))`;
  async function visiblePost(req, id) {
    if (!uuid.test(id)) fail('Invalid post.');
    const [post] = await db.q(`select p.* from social_posts p join users u on u.id=p.author_id
      join users w on w.id=p.wall_id where p.id=$1 and not p.removed and not u.banned
      and not coalesce(u.deactivated,false) and not w.banned and not coalesce(w.deactivated,false)
      and ${access('p','$2',req.socialAccount.master)}`,[id,req.socialAccount.id]);
    if (!post) fail('Post unavailable.',404);
    return post;
  }
  async function originInfo(req) {
    const ip = geo.clientIp(req.headers,req.socket.remoteAddress);
    return {ip, location:await geo.lookup(ip)};
  }
  const postFields = master => `p.id,p.author_id,p.wall_id,p.pinned,p.body,p.link,case when ${imageAccess('p','$1',master)} then p.image else '' end as image,
    case when p.author_id=$1 then p.audience else '{}'::jsonb end as audience,p.feeling,p.place,p.created,p.updated,p.event_room,p.event_at,
    (select count(*)::int from social_event_rsvps r where r.post_id=p.id) as attendees,
    exists(select 1 from social_event_rsvps r where r.post_id=p.id and r.user_id=$1) as attending,
    u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,
    coalesce(s.value->>'portrait','') as portrait,
    (select count(*)::int from social_likes where post_id=p.id) as likes,
    exists(select 1 from social_likes where post_id=p.id and user_id=$1) as liked`;
  router.use('/api', express.json({limit:'3mb'}), (req,res,next) => {
    if (req.method !== 'GET') {
      if (!req.is('application/json')) return res.status(415).json({error:'JSON required.'});
      const origin = req.get('origin');
      if (origin) {
        try { if (new URL(origin).host !== req.get('host')) return res.status(403).json({error:'Invalid origin.'}); }
        catch { return res.sendStatus(403); }
      }
      const id=req.socialAccount.id, now=Date.now();
      if(writes.size>10000)for(const [key,value] of writes)if(now-value.start>600000)writes.delete(key);
      let bucket=writes.get(id);
      if(!bucket || now-bucket.start>600000){bucket={start:now,count:0};writes.set(id,bucket);}
      if(++bucket.count>120)return res.status(429).json({error:'Please wait a little before making more changes.'});
    }
    next();
  });
  const offline=createOfflineMessages({db,isOnline:name=>!!accounts.isOnline?.(name),toUser:(...args)=>accounts.toUser?.(...args)});
  registerOfflineRoutes(router,offline,run);
  router.get('/api/settings',run(async(req,res) => {
    const [row] = await db.q('select value from social_settings where user_id=$1',[req.socialAccount.id]);
    res.json(row?.value || {});
  }));
  router.get('/api/navigation',run(async(req,res)=>{
    const [row]=await db.q(`select u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,coalesce(s.value->>'portrait','') as portrait,
      (select count(*)::int from contacts where owner=u.id and contact<>owner) as friends from users u left join social_settings s on s.user_id=u.id where u.id=$1`,[req.socialAccount.id]);
    res.json({...row,master:req.socialAccount.master});
  }));
  router.get('/api/portraits',run(async(req,res)=>{
    const names=String(req.query.names||'').split(',').map(x=>x.toLowerCase()).filter(x=>/^[a-z][a-z0-9_.-]{2,19}$/.test(x)).slice(0,100);
    const rows=await db.q(`select u.name,case when u.avatar like 'bot:%' then '/bot-av/'||substring(u.avatar from 5) else '/av/'||u.name||'?v='||coalesce(u.avatar,'0') end as portrait from users u left join social_settings s on s.user_id=u.id where u.name_lc=any($1::text[])`,[names]);res.json(rows);
  }));
  router.patch('/api/settings',run(async(req,res) => {
    const value = settingsPatch(req.body);
    const [row] = await db.q(`insert into social_settings(user_id,value) values($1,$2)
      on conflict(user_id) do update set value=social_settings.value || excluded.value returning value`,
      [req.socialAccount.id,JSON.stringify(value)]);
    if(value.defaultPresence)await db.q('update users set status=$2 where id=$1',
      [req.socialAccount.id,value.defaultPresence==='dnd'?'busy':value.defaultPresence]);
    res.json(row.value);
  }));
  router.get('/api/people',run(async(req,res) => {
    const search = text(req.query.q,80);
    const rows = await db.q(`select u.id,u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,
      coalesce(s.value->>'portrait','') as portrait,u.age,u.sex,${req.socialAccount.master?'exists(select 1 from social_bot_members where user_id=u.id)':'false'} as bot,
      case when coalesce(s.value->>'visibility','public')='private' and u.id<>$1 and ${req.socialAccount.master?'false':'true'} then '' else u.location end as location
      from users u left join social_settings s on s.user_id=u.id where not u.banned and not coalesce(u.deactivated,false)
      and not exists(select 1 from social_restrictions where user_id=u.id and service='social')
      and ($2='' or u.name ilike '%'||$2||'%' or u.display_name ilike '%'||$2||'%')
      order by u.created desc limit 300`,[req.socialAccount.id,search]);
    res.json(rows);
  }));
  router.get('/api/profile/:name',run(async(req,res) => {
    const [row] = await db.q(`select u.id,u.name,u.display_name,u.age,u.sex,u.location,u.bio,u.interests,u.profile_status,u.created,exists(select 1 from social_bot_members where user_id=u.id) as bot,
      coalesce(s.value,'{}') as settings,exists(select 1 from contacts where owner=u.id and contact=$1) as friend,
      ${isBlocked('u.id','$1')} as either_blocked,
      exists(select 1 from requests where from_id=$1 and to_id=u.id) as request_pending,
      exists(select 1 from blocks where owner=$1 and blocked=u.id) as blocked
      from users u left join social_settings s on s.user_id=u.id where u.name_lc=$2
      and not u.banned and not coalesce(u.deactivated,false)`,[req.socialAccount.id,String(req.params.name).toLowerCase()]);
    if (!row) fail('Profile unavailable.',404);
    const owner = row.id === req.socialAccount.id;
    const restricted = !owner && !req.socialAccount.master && (row.either_blocked || row.settings.visibility === 'private' && !row.friend);
    const result = {id:row.id,name:row.name,displayName:row.display_name || row.name,private:restricted,
      owner,friend:row.friend,blocked:!!row.blocked,canRequest:!row.either_blocked,requestPending:row.request_pending,bot:!!(req.socialAccount.master&&row.bot),
      settings:restricted ? {portrait:row.settings.portrait || '',visibility:'private'} : publicSettings(row.settings)};
    if (!restricted) Object.assign(result,{age:row.age,sex:row.sex,status:row.profile_status,memberSince:row.created,
      location:row.location,bio:row.bio,interests:row.interests,
      });
    if(!row.either_blocked || owner || req.socialAccount.master) result.gallery=galleryPhotos(row.settings,{owner,master:req.socialAccount.master,friend:row.friend,restricted});
    if (owner) Object.assign(result,{galleryRevision:row.settings.galleryRevision || '',galleryDefault:row.settings.galleryDefault || ''});
    res.json(result);
  }));
  router.put('/api/profile-gallery',run(async(req,res) => {
    const {photos, defaultId, revision, publishAll} = req.body || {};
    if (!Array.isArray(photos) || photos.length > 5) fail('Add up to five profile photos.');
    const gallery = photos.map(item => {
      if (typeof item?.id !== 'string' || !uuid.test(item.id) || !['public','friends','private'].includes(item.mode)) fail('Invalid profile photo.');
      const image = photo(item.image,450000);
      if (!image) fail('Choose a photo.');
      return {id:item.id,mode:item.mode,image};
    });
    const primary = gallery.find(item => item.id === defaultId);
    if (new Set(gallery.map(item => item.id)).size !== gallery.length || gallery.length && !primary) fail('Choose one default photo.');
    const [prior] = await db.q('select value from social_settings where user_id=$1',[req.socialAccount.id]);
    const previous = prior?.value || {};
    if ((previous.galleryRevision || '') !== revision) fail('Your photos changed. Reopen the editor and try again.',409);
    // Older nonpublic photos stay private until the owner explicitly republishes them.
    for(const item of gallery){
      const old=previous.profileGallery?.find(p=>p.id===item.id&&p.image===item.image);
      if(publishAll===true)item.mode='public';
      else if(!old && item.mode!=='public')fail('New Messenger profile photos are public.');
      else if(old && item.mode!==old.mode && item.mode!=='public')fail('Messenger profile photos are public.');
    }
    const unchanged = primary && primary.id === previous.galleryDefault &&
      primary.image === previous.profileGallery?.find(item => item.id === primary.id)?.image;
    const socialSnapshot=previous.portrait && previous.portrait===previous.galleryAvatarUrl
      ? previous.profileGallery?.find(item=>item.id===previous.galleryDefault)?.image : null;
    const next = {
      profileGallery:gallery,galleryDefault:primary?.id || '',galleryRevision:crypto.randomUUID()
    };
    const avatar = primary ? 'c'+crypto.randomBytes(8).toString('hex') : '';
    const avatarUrl = '/av/'+encodeURIComponent(req.socialAccount.alias)+'?v='+avatar;
    const [_,mime,bytes] = primary ? primary.image.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/) : [];
    if (primary && !unchanged) Object.assign(next,{galleryAvatarUrl:avatarUrl,galleryAvatar:avatar});
    else if (!primary && previous.galleryAvatar) Object.assign(next,{galleryAvatarUrl:'',galleryAvatar:''});
    const [saved] = await db.q(`with saved as (
      insert into social_settings(user_id,value) values($1,$2::jsonb)
      on conflict(user_id) do update set value=
        (case when social_settings.value->>'portrait'=social_settings.value->>'galleryAvatarUrl' and $10::text is not null
          then jsonb_set(social_settings.value,'{portrait}',to_jsonb($10::text)) else social_settings.value end) || excluded.value
      where coalesce(social_settings.value->>'galleryRevision','')=$3 returning user_id
    ), updated as (
      update users set avatar=$5 from saved where users.id=saved.user_id
        and ($6 or ($4 and users.avatar=$7)) returning users.id,users.avatar
    ), uploaded as (
      insert into avatars(user_id,mime,data) select id,$8,$9 from updated where $6
      on conflict(user_id) do update set mime=excluded.mime,data=excluded.data,updated=now()
    ), removed as (
      delete from avatars where user_id in (select id from updated) and not $6
    ) select saved.user_id,(select avatar from updated) as avatar from saved`,
      [req.socialAccount.id,JSON.stringify(next),revision,!primary && !!previous.galleryAvatar,avatar || 'a1',!!primary && !unchanged,
        previous.galleryAvatar || '',mime ? 'image/'+mime : '',bytes ? Buffer.from(bytes,'base64') : null,socialSnapshot || null]);
    if (!saved) fail('Your photos changed. Reopen the editor and try again.',409);
    if (saved.avatar) {
      await accounts.setAvatar?.(req.socialAccount.id,saved.avatar);
      for (const socket of io?.sockets?.sockets?.values() || []) {
        if (socket.data.acct?.id === req.socialAccount.id) socket.data.av=saved.avatar;
      }
      io?.emit('avatar',{name:req.socialAccount.alias,av:saved.avatar});
    }
    res.json({ok:true});
  }));
  router.put('/api/block/:name',run(async(req,res) => {
    const result=await accounts.blockAccount(req.socialAccount.id,req.socialAccount.alias,req.params.name,req.body?.blocked!==false);
    if(result.error)fail(result.error,404);
    res.json(result);
  }));
  router.get('/api/events/rooms',run(async(_req,res)=>res.json(botChat?.rooms() || [])));
  router.put('/api/events/:id/rsvp',run(async(req,res) => {
    const post=await visiblePost(req,req.params.id);
    if(!post.event_at || new Date(post.event_at)<=new Date())fail('This event is no longer taking RSVPs.');
    const params=[post.id,req.socialAccount.id];
    if(req.body?.going===true)await db.q('insert into social_event_rsvps(post_id,user_id) values($1,$2) on conflict do nothing',params);
    else await db.q('delete from social_event_rsvps where post_id=$1 and user_id=$2',params);
    const [count]=await db.q('select count(*)::int as attendees from social_event_rsvps where post_id=$1',[post.id]);
    res.json({attending:req.body?.going===true,attendees:count.attendees});
  }));
  router.get('/api/photos',run(async(req,res)=>{
    const name=text(req.query.name,20).toLowerCase(),before=req.query.before?new Date(req.query.before):null;
    if(!/^[a-z][a-z0-9_.-]{2,19}$/.test(name)||before&&!Number.isFinite(+before)||req.query.cursorId&&!uuid.test(req.query.cursorId))fail('Invalid photo page.');
    const viewer=req.query.public==='1'?'-1':'$1',master=req.query.public==='1'?false:req.socialAccount.master;
    const rows=await db.q(`select ${postFields(master)} from social_posts p join users u on u.id=p.author_id
      join users w on w.id=p.wall_id left join social_settings s on s.user_id=u.id
      where u.name_lc=$2 and p.author_id=p.wall_id and p.image<>'' and not p.removed
      and not u.banned and not coalesce(u.deactivated,false)
      and ${access('p',viewer,master)} and ${imageAccess('p',viewer,master)}
      and ($3::timestamptz is null or (p.created,p.id)<($3,$4::uuid))
      order by p.created desc,p.id desc limit 40`,[req.socialAccount.id,name,before,req.query.cursorId||'00000000-0000-4000-8000-000000000000']);
    res.json(rows);
  }));
  router.get('/api/posts',run(async(req,res) => {
    const wall = text(req.query.wall,20).toLowerCase();
    const rows = await db.q(`select ${postFields(req.socialAccount.master)} from social_posts p join users u on u.id=p.author_id
      join users w on w.id=p.wall_id left join social_settings s on s.user_id=u.id
      where not p.removed and not u.banned and not coalesce(u.deactivated,false)
      and not w.banned and not coalesce(w.deactivated,false)
      and ($2='' or w.name_lc=$2)
      and ($2<>'' or p.author_id=$1 or p.wall_id=$1 or exists(select 1 from contacts where owner=$1 and contact=p.author_id))
      and ${access('p','$1',req.socialAccount.master)}
      order by case when $2<>'' then p.pinned else false end desc,p.created desc limit 40`,[req.socialAccount.id,wall]);
    const comments = rows.length ? await db.q(`select c.id,c.post_id,c.author_id,c.body,c.created,u.name,
      coalesce(nullif(u.display_name,''),u.name) as display_name,coalesce(s.value->>'portrait','') as portrait
      from social_comments c join users u on u.id=c.author_id left join social_settings s on s.user_id=u.id
      where c.post_id=any($1::uuid[]) and not c.removed and not u.banned and not coalesce(u.deactivated,false)
      order by c.created limit 600`,[rows.map(p=>p.id)]) : [];
    res.json(rows.map(row=>({...row,comments:comments.filter(c=>c.post_id===row.id)})));
  }));
  router.post('/api/posts',run(async(req,res) => {
    const b=req.body || {}, id=b.id || crypto.randomUUID();
    if (!uuid.test(id)) fail('Invalid post.');
    const body=text(b.body,3000), image=photo(b.image), url=link(b.link);
    if (!body && !image && !url) fail('Add a thought, photo, or link.');
    let eventRoom=null,eventAt=null;
    if(b.event){
      eventRoom=text(b.event.room,150);
      eventAt=new Date(b.event.starts);
      if(!body || !botChat?.rooms().includes(eventRoom) || !Number.isFinite(+eventAt) || +eventAt<=Date.now() || +eventAt>Date.now()+365*86400000)
        fail('Choose a room and a future start time within one year, and enter an event title.');
    }
    const [wall] = await db.q('select id from users where name_lc=$1 and not banned and not coalesce(deactivated,false)',
      [String(b.wall || req.socialAccount.alias).toLowerCase()]);
    if (!wall) fail('Profile unavailable.',404);
    if (wall.id !== req.socialAccount.id) {
      if(eventRoom)fail('Share events from your own feed.',403);
      const [friend] = await db.q('select 1 from contacts where owner=$1 and contact=$2',[wall.id,req.socialAccount.id]);
      if (!friend) fail('Only friends can post on this wall.',403);
    }
    const policy = {post:audience(b.audience?.post || {mode:'profile'}),photo:audience(b.audience?.photo,true)};
    const info=await originInfo(req);
    await db.q(`with added as (
      insert into social_posts(id,author_id,wall_id,body,link,image,feeling,place,ip,approximate_location,event_room,event_at,audience)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) on conflict(id) do nothing returning id,wall_id
    ) insert into social_notifications(recipient_id,actor_id,kind,post_id,reference_id)
      select wall_id,$2,'post',id,id::text from added where wall_id<>$2 on conflict do nothing`,
      [id,req.socialAccount.id,wall.id,body,url,image,feelings.has(b.feeling)?b.feeling:'',text(b.location,120),info.ip,info.location,eventRoom,eventAt,JSON.stringify(policy)]);
    res.status(201).json({id});
  }));
  router.put('/api/posts/:id/pin',run(async(req,res)=>{
    const post=await visiblePost(req,req.params.id);
    if(post.author_id!==req.socialAccount.id || post.wall_id!==req.socialAccount.id)fail('Pin your own posts on your own profile.',403);
    if(typeof req.body?.pinned!=='boolean')fail('Choose pin or unpin.');
    await db.q('update social_posts set pinned=$2,updated=now() where id=$1',[post.id,req.body.pinned]);
    res.json({ok:true});
  }));
  router.patch('/api/posts/:id',run(async(req,res) => {
    const post=await visiblePost(req,req.params.id);
    if (post.author_id!==req.socialAccount.id && !req.socialAccount.master) fail('Only the author can edit this post.',403);
    const b=req.body || {};
    const body=b.body===undefined?post.body:text(b.body,3000), url=b.link===undefined?post.link:link(b.link), image=b.removeImage ? '' : post.image;
    const policy = b.audience ? {post:audience(b.audience.post),photo:audience(b.audience.photo,true)} : null;
    if (!body && !url && !image) fail('Keep a thought, link, or photo.');
    await db.q('update social_posts set body=$2,link=$3,image=$4,feeling=$5,place=$6,audience=coalesce($7::jsonb,audience),updated=now() where id=$1',
      [post.id,body,url,image,b.feeling===undefined?post.feeling:feelings.has(b.feeling)?b.feeling:'',b.location===undefined?post.place:text(b.location,120),policy && JSON.stringify(policy)]);
    res.json({ok:true});
  }));
  router.delete('/api/posts/:id',run(async(req,res) => {
    const post=await visiblePost(req,req.params.id);
    if (![post.author_id,post.wall_id].includes(req.socialAccount.id) && !req.socialAccount.master) fail('You cannot remove this post.',403);
    await db.q('update social_posts set removed=true,updated=now() where id=$1',[post.id]);
    res.json({ok:true});
  }));
  router.post('/api/posts/:id/comments',run(async(req,res) => {
    const post=await visiblePost(req,req.params.id), body=text(req.body?.body,1500), id=req.body?.id || crypto.randomUUID();
    if (!body || !uuid.test(id)) fail('Enter a comment.');
    const info=await originInfo(req);
    await db.q(`with added as (
      insert into social_comments(id,post_id,author_id,body,ip,approximate_location) values($1,$2,$3,$4,$5,$6)
      on conflict(id) do nothing returning id
    ) insert into social_notifications(recipient_id,actor_id,kind,post_id,reference_id)
      select $7,$3,'comment',$2,id::text from added where $7<>$3 on conflict do nothing`,
      [id,post.id,req.socialAccount.id,body,info.ip,info.location,post.author_id]);
    res.status(201).json({id});
  }));
  router.delete('/api/comments/:id',run(async(req,res) => {
    if (!uuid.test(req.params.id)) fail('Invalid comment.');
    const [comment]=await db.q('select c.*,p.wall_id from social_comments c join social_posts p on p.id=c.post_id where c.id=$1',[req.params.id]);
    if (!comment) fail('Comment unavailable.',404);
    if (![comment.author_id,comment.wall_id].includes(req.socialAccount.id) && !req.socialAccount.master) fail('You cannot remove this comment.',403);
    await db.q('update social_comments set removed=true where id=$1',[comment.id]);
    res.json({ok:true});
  }));
  router.put('/api/posts/:id/like',run(async(req,res) => {
    const post=await visiblePost(req,req.params.id);
    if (req.body?.liked === true) await db.q(`with added as (
      insert into social_likes(post_id,user_id) values($1,$2) on conflict do nothing returning post_id
    ) insert into social_notifications(recipient_id,actor_id,kind,post_id,reference_id)
      select $3,$2,'like',post_id,post_id::text from added where $3<>$2 on conflict do nothing`,[post.id,req.socialAccount.id,post.author_id]);
    else await db.q(`with gone as (delete from social_likes where post_id=$1 and user_id=$2 returning post_id)
      delete from social_notifications where post_id=$1 and actor_id=$2 and kind='like'`,[post.id,req.socialAccount.id]);
    res.json({ok:true});
  }));
  router.get('/api/notifications',run(async(req,res) => {
    const notifications=await db.q(`select n.id,n.kind,n.post_id,n.created,n.seen,u.name,
      coalesce(nullif(u.display_name,''),u.name) as display_name
      from social_notifications n join users u on u.id=n.actor_id join social_posts p on p.id=n.post_id
      where n.recipient_id=$1 and not p.removed and ${access('p','$1',req.socialAccount.master)}
      and (n.kind<>'comment' or exists(select 1 from social_comments where id::text=n.reference_id and not removed))
      order by n.created desc limit 100`,[req.socialAccount.id]);
    const requests=await db.q(`select u.id,u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,
      coalesce(s.value->>'portrait','') as portrait from requests r join users u on u.id=r.from_id
      left join social_settings s on s.user_id=u.id where r.to_id=$1 order by r.created desc`,[req.socialAccount.id]);
    // Offline messages show up as Social notifications (UI renders them; see offlineMessages[]).
    const offlineMessages=await offline.list(req.socialAccount.id);
    res.json({notifications,requests,offlineMessages});
  }));
  router.post('/api/friends/:name',run(async(req,res) => {
    const actor=req.socialAccount.id, action=req.body?.action;
    const [target]=await db.q('select id,name,avatar,status,status_msg,exists(select 1 from social_bot_members where user_id=users.id) as bot from users where name_lc=$1 and not banned and not coalesce(deactivated,false)',[req.params.name.toLowerCase()]);
    if (!target || target.id===actor) fail('Account unavailable.',404);
    if (action==='accept') {
      const added=await db.q(`with pending as (delete from requests where from_id=$1 and to_id=$2 returning from_id,to_id)
        insert into contacts(owner,contact) select to_id,from_id from pending union select from_id,to_id from pending
        on conflict do nothing returning owner`,[target.id,actor]);
      if (!added.length) fail('Request is no longer pending.',409);
      accounts.contactsChanged?.(actor,target.id);
    } else if (action==='decline') {
      await db.q('delete from requests where from_id=$1 and to_id=$2',[target.id,actor]);
      accounts.contactsChanged?.(actor);
    } else if (action==='remove') {
      await db.q('delete from contacts where (owner=$1 and contact=$2) or (owner=$2 and contact=$1)',[actor,target.id]);
      accounts.contactsChanged?.(actor,target.id);
    }
    else if (action==='request') {
      const [blocked]=await db.q('select 1 from blocks where (owner=$1 and blocked=$2) or (owner=$2 and blocked=$1)',[actor,target.id]);
      if (blocked) fail('This request cannot be sent.',403);
      if(target.bot){
        await db.q('insert into contacts(owner,contact) values($1,$2),($2,$1) on conflict do nothing',[actor,target.id]);
        await db.q('delete from requests where (from_id=$1 and to_id=$2) or (from_id=$2 and to_id=$1)',[actor,target.id]);
        accounts.contactsChanged?.(actor);
      }else {
        // They already asked me: sending my own request accepts theirs, so we become friends both ways.
        const mutual=await db.q(`with pending as (delete from requests where from_id=$2 and to_id=$1 returning from_id,to_id)
          insert into contacts(owner,contact) select to_id,from_id from pending union select from_id,to_id from pending
          on conflict do nothing returning owner`,[actor,target.id]);
        if(mutual.length){
          await db.q('delete from requests where from_id=$1 and to_id=$2',[actor,target.id]);
          accounts.contactsChanged?.(actor,target.id);
          return res.json({ok:true,accepted:true});
        }
        await db.q('insert into requests(from_id,to_id) values($1,$2) on conflict do nothing',[actor,target.id]);
        accounts.contactsChanged?.(target.id);
      }
    } else fail('Unknown friend action.');
    res.json({ok:true,accepted:action==='request'&&!!target.bot});
  }));
  router.get('/api/friends',run(async(req,res) => {
    const rows=await db.q(`select u.id,u.name,coalesce(nullif(u.display_name,''),u.name) as display_name,
      coalesce(s.value->>'portrait','') as portrait from contacts c join users u on u.id=c.contact
      left join social_settings s on s.user_id=u.id where c.owner=$1 and c.contact<>c.owner and not u.banned and not coalesce(u.deactivated,false)`,[req.socialAccount.id]);
    res.json(rows);
  }));
  router.post('/api/notifications/read',run(async(req,res) => {
    const ids=Array.isArray(req.body?.ids)?req.body.ids.filter(id=>/^\d+$/.test(String(id))).slice(0,100):[];
    await db.q('update social_notifications set seen=true where recipient_id=$1 and id=any($2::bigint[])',[req.socialAccount.id,ids]);
    res.json({ok:true});
  }));
  if(botChat?.musicLobby){
    router.get('/api/admin/music',run(async(req,res)=>{admin(req);res.json(await botChat.musicLobby.list());}));
    router.delete('/api/admin/music/:id',run(async(req,res)=>{
      admin(req);if(!uuid.test(req.params.id))fail('Invalid track.');
      if(!await botChat.musicLobby.remove(req.params.id))fail('Track unavailable.',404);
      res.json({ok:true});
    }));
  }
  if (botChat) {
    router.get('/api/admin/bot-chat',run(async(req,res) => {
      admin(req);
      const rows=await db.q(`select b.bot_id from social_bot_members b join users u on u.id=b.user_id
        where not u.banned and not coalesce(u.deactivated,false)`);
      const allowed=new Set(rows.map(row=>row.bot_id));
      res.json({bots:bots.BOTS.filter(bot=>allowed.has(bot.id)).map(({id,name})=>({id,name})),rooms:botChat.rooms()});
    }));
    router.post('/api/admin/bot-chat',run(async(req,res) => {
      admin(req);
      const bot=bots.byId(text(req.body?.botId,40));
      const room=text(req.body?.room,150), message=text(req.body?.message,300);
      if(!bot || !botChat.rooms().includes(room) || !message) fail('Choose a bot and a room, and enter a message.');
      const [active]=await db.q(`select 1 from social_bot_members b join users u on u.id=b.user_id
        where b.bot_id=$1 and not u.banned and not coalesce(u.deactivated,false)`,[bot.id]);
      if(!active)fail('That bot is unavailable.',404);
      await audit(req,'bot-chat',bot.name,room);
      botChat.say(room,bot,message);
      res.json({ok:true});
    }));
  }
  router.get('/api/admin',run(async(req,res) => {
    admin(req);
    const users=await db.q(`select u.id,u.name,u.display_name,u.is_master,u.deactivated,u.banned,u.last_ip,u.last_loc,
      exists(select 1 from social_bot_members where user_id=u.id) as bot,
      coalesce((select json_agg(json_build_object('service',r.service,'reason',r.reason)) from social_restrictions r where r.user_id=u.id),'[]') as restrictions
      from users u order by u.created desc limit 200`);
    const posts=await db.q(`select p.id,p.body,p.image<>' ' and p.image<>'' as has_image,p.author_id,p.created,p.removed,
      p.ip,p.approximate_location,u.name from social_posts p join users u on u.id=p.author_id order by p.created desc limit 100`);
    const comments=await db.q(`select c.id,c.post_id,c.body,c.created,c.removed,c.ip,c.approximate_location,u.name
      from social_comments c join users u on u.id=c.author_id order by c.created desc limit 100`);
    res.json({users,posts,comments});
  }));
  router.post('/api/admin',run(async(req,res) => {
    admin(req);
    const b=req.body || {}, action=String(b.action);
    if (['restrict','unrestrict','deactivate','reactivate'].includes(action)) {
      const [target]=await db.q('select id,name,is_master from users where id=$1',[Number(b.userId)]);
      if (!target) fail('Account unavailable.',404);
      if (target.id===req.socialAccount.id || target.is_master) fail('Master accounts must be managed through the master console.',403);
      if (action==='restrict' || action==='unrestrict') {
        if (!['social','messenger'].includes(b.service)) fail('Choose Social or Messenger.');
        if (action==='restrict') await db.q(`insert into social_restrictions(user_id,service,reason,by_user) values($1,$2,$3,$4)
          on conflict(user_id,service) do update set reason=excluded.reason,by_user=excluded.by_user,created=now()`,
          [target.id,b.service,text(b.reason,300),req.socialAccount.id]);
        else await db.q('delete from social_restrictions where user_id=$1 and service=$2',[target.id,b.service]);
        if (action==='restrict' && b.service==='messenger' && io) for (const socket of io.sockets.sockets.values()) {
          if (socket.data.acct?.id===target.id && socket.data.mess) socket.disconnect(true);
        }
      } else {
        await db.q('update users set deactivated=$2 where id=$1',[target.id,action==='deactivate']);
        if (action==='deactivate') {
          await db.q('delete from sessions where user_id=$1',[target.id]);
          if (io) for(const socket of io.sockets.sockets.values()) if(socket.data.acct?.id===target.id) socket.disconnect(true);
        }
      }
      await audit(req,'social-'+action,target.name,b.service || '');
    } else if (['remove-post','restore-post','remove-image','remove-comment','restore-comment','clear-portrait'].includes(action)) {
      if (action==='clear-portrait') {
        await db.q(`insert into social_settings(user_id,value) values($1,'{"portrait":""}')
          on conflict(user_id) do update set value=social_settings.value || '{"portrait":""}'::jsonb`,[Number(b.userId)]);
      } else {
        if (!uuid.test(b.id || '')) fail('Invalid content.');
        if (action==='remove-image') await db.q("update social_posts set image='',updated=now() where id=$1",[b.id]);
        else if (action.endsWith('comment')) await db.q('update social_comments set removed=$2 where id=$1',[b.id,action==='remove-comment']);
        else await db.q('update social_posts set removed=$2,updated=now() where id=$1',[b.id,action==='remove-post']);
      }
      await audit(req,'social-'+action,b.id || b.userId);
    } else fail('Unknown action.');
    res.json({ok:true});
  }));
}
module.exports = {registerApi, settingsPatch, publicSettings};
