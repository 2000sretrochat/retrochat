const crypto=require('node:crypto');
const {PROFILE_SEEDS}=require('../bots');
const {posts}=require('../room-bot-refresh');
function stablePostId(key){
  const hash=crypto.createHash('sha256').update(key).digest('hex');
  return hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
}
async function publishBotPost(db){
  const pending=posts.map(([bot,slug,body,link=''])=>({bot,id:stablePostId(bot+':'+slug),body,link}));
  await db.q(`insert into social_posts(id,author_id,wall_id,body,link)
    select p.id,b.user_id,b.user_id,p.body,p.link
    from unnest($1::uuid[],$2::text[],$3::text[],$4::text[]) with ordinality p(id,bot,body,link,sequence)
    join social_bot_members b on b.bot_id=p.bot join users u on u.id=b.user_id
    where not u.banned and not coalesce(u.deactivated,false)
    and not exists(select 1 from social_restrictions r where r.user_id=b.user_id and r.service='social')
    and not exists(select 1 from social_posts s where s.id=p.id)
    and not exists(select 1 from social_posts s where s.id=any($1::uuid[]) and s.created>now()-interval '90 minutes')
    order by p.sequence limit 1 on conflict(id) do nothing`,
    [pending.map(p=>p.id),pending.map(p=>p.bot),pending.map(p=>p.body),pending.map(p=>p.link)]);
}
async function seedSocialBots(db){
  let profiles=0;
  for(const [index,seed] of PROFILE_SEEDS.entries()){
    await db.q(`with new_user as (
      insert into users(name,name_lc,pw,display_name,location,bio,interests)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(name_lc) do nothing returning id
    ) insert into social_bot_members(user_id,bot_id,photo_index) select id,$8,$9 from new_user`,
      [seed.name,seed.name.toLowerCase(),'!social-bot:'+crypto.randomUUID(),seed.display_name,seed.location,seed.bio,seed.interests,seed.id,index]);
    const [bot]=await db.q('select user_id from social_bot_members where bot_id=$1',[seed.id]);
    if(!bot)continue; // A real member who already owns an alias is never converted into a bot.
    profiles++;
    if(seed.silent)continue; // Quiet visitors keep empty walls, bios and portraits.
        const originalPortrait=seed.photoIndex===undefined?'/social-next/bot-portrait/'+index+'.svg':'/bot-av/'+seed.id;
    await db.q(`insert into social_settings(user_id,value) values($1,$2)
      on conflict(user_id) do update set value =
        (case when social_settings.value->>'portrait'=$3
          then jsonb_set(social_settings.value,'{portrait}',to_jsonb($3::text || '?v=2'))
          else social_settings.value end)
        - (case when social_settings.value->>'headline' like 'Chat bot %' then 'headline' else '' end)
      where social_settings.value->>'portrait'=$3 or social_settings.value->>'headline' like 'Chat bot %'`,
      [bot.user_id,JSON.stringify({portrait:originalPortrait+'?v=2',visibility:'public'}),originalPortrait]);
    // Stable UUID: one introduction, never recreated after a moderator removes it.
    if(seed.photoIndex!==undefined)continue; // New accounts receive the curated posts gradually.
    const postId=stablePostId(seed.id);
    await db.q(`insert into social_posts(id,author_id,wall_id,body) values($1,$2,$2,$3)
      on conflict(id) do update set body=substring(social_posts.body from 24)
      where social_posts.author_id=$2 and social_posts.body like 'Chat bot introduction: %'`,
      [postId,bot.user_id,seed.bio+' Find me in #'+seed.room+'.']);
  }
  await db.q(`with accepted as (delete from requests r using social_bot_members b where r.to_id=b.user_id
    and not exists(select 1 from blocks where (owner=r.from_id and blocked=r.to_id) or (owner=r.to_id and blocked=r.from_id)) returning r.from_id,r.to_id)
    insert into contacts(owner,contact) select from_id,to_id from accepted union select to_id,from_id from accepted on conflict do nothing`);
  const [directory]=await db.q(
    `select count(*) filter (where b.user_id is null)::int as members,
       count(*) filter (where b.user_id is not null)::int as bots
       from users u left join social_bot_members b on b.user_id=u.id
       where not u.banned and not coalesce(u.deactivated,false)
       and not exists(select 1 from social_restrictions where user_id=u.id and service='social')`);
  if(directory)console.info('[social-bots] directory counts', directory);
  return profiles;
}
module.exports={seedSocialBots,publishBotPost};
