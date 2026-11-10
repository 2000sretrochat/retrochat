const crypto=require('node:crypto');
const {PROFILE_SEEDS}=require('../bots');
// The preview characters have their original portraits and introductions.
const previewSeeds = [
  {id:'preview-nightowl',name:'NightOwl',display_name:'NightOwl',location:'Portland, Oregon',interests:'Music, Travel',bio:'The rest of the house is asleep and I just made coffee.',room:'Late Night'},
  {id:'preview-retrofan',name:'RetroFan',display_name:'RetroFan',location:'Columbus, Ohio',interests:'Politics, Cars',bio:'I miss the sound of signing on.',room:'Lobby'},
  {id:'preview-mialuvs',name:'MiaLuvs',display_name:'MiaLuvs',location:'Austin, Texas',interests:'Photography, Food, Travel',bio:'Always looking for a good photo spot.',room:'Chit Chat'}
];
async function seedSocialBots(db){
  let profiles=0;
  for(const [index,seed] of [...PROFILE_SEEDS,...previewSeeds].entries()){
    await db.q(`with new_user as (
      insert into users(name,name_lc,pw,display_name,location,bio,interests)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(name_lc) do nothing returning id
    ) insert into social_bot_members(user_id,bot_id,photo_index) select id,$8,$9 from new_user`,
      [seed.name,seed.name.toLowerCase(),'!social-bot:'+crypto.randomUUID(),seed.display_name,seed.location,seed.bio,seed.interests,seed.id,index]);
    const [bot]=await db.q('select user_id from social_bot_members where bot_id=$1',[seed.id]);
    if(!bot)continue; // A real member who already owns an alias is never converted into a bot.
    profiles++;
    const originalPortrait='/social-next/bot-portrait/'+index+'.svg';
    await db.q(`insert into social_settings(user_id,value) values($1,$2)
      on conflict(user_id) do update set value =
        (case when social_settings.value->>'portrait'=$3
          then jsonb_set(social_settings.value,'{portrait}',to_jsonb($3::text || '?v=2'))
          else social_settings.value end)
        - (case when social_settings.value->>'headline' like 'Chat bot %' then 'headline' else '' end)
      where social_settings.value->>'portrait'=$3 or social_settings.value->>'headline' like 'Chat bot %'`,
      [bot.user_id,JSON.stringify({portrait:originalPortrait+'?v=2',visibility:'public'}),originalPortrait]);
    // Stable UUID: one introduction, never recreated after a moderator removes it.
    const hash=crypto.createHash('sha256').update(seed.id).digest('hex');
    const postId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
    await db.q(`insert into social_posts(id,author_id,wall_id,body) values($1,$2,$2,$3)
      on conflict(id) do update set body=substring(social_posts.body from 24)
      where social_posts.author_id=$2 and social_posts.body like 'Chat bot introduction: %'`,
      [postId,bot.user_id,seed.bio+' Find me in #'+seed.room+'.']);
  }
  await db.q(`with accepted as (delete from requests r using social_bot_members b where r.to_id=b.user_id
    and not exists(select 1 from blocks where (owner=r.from_id and blocked=r.to_id) or (owner=r.to_id and blocked=r.from_id)) returning r.from_id,r.to_id)
    insert into contacts(owner,contact) select from_id,to_id from accepted union select to_id,from_id from accepted on conflict do nothing`);
  return profiles;
}
module.exports={seedSocialBots};
