const crypto=require('node:crypto');
const {PROFILE_SEEDS}=require('../bots');
async function seedSocialBots(db){
  for(const [index,seed] of PROFILE_SEEDS.entries()){
    const [user]=await db.q(`insert into users(name,name_lc,pw,display_name,location,bio,interests)
      values($1,$2,$3,$4,$5,$6,$7) on conflict(name_lc) do nothing returning id`,
      [seed.name,seed.name.toLowerCase(),'!social-bot:'+crypto.randomUUID(),seed.display_name,seed.location,seed.bio,seed.interests]);
    if(user)await db.q('insert into social_bot_members(user_id,bot_id,photo_index) values($1,$2,$3) on conflict do nothing',[user.id,seed.id,index]);
    const [bot]=await db.q('select user_id from social_bot_members where bot_id=$1',[seed.id]);
    if(!bot)continue; // A real member who already owns an alias is never converted into a bot.
    await db.q(`insert into social_settings(user_id,value) values($1,$2) on conflict do nothing`,
      [bot.user_id,JSON.stringify({portrait:'/social-next/bot-portrait/'+index+'.svg',visibility:'public',headline:'Chat bot · '+seed.room})]);
    // Stable UUID: one introduction, never recreated after a moderator removes it.
    const hash=crypto.createHash('sha256').update(seed.id).digest('hex');
    const postId=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
    await db.q(`insert into social_posts(id,author_id,wall_id,body) values($1,$2,$2,$3) on conflict do nothing`,
      [postId,bot.user_id,'Chat bot introduction: '+seed.bio+' Find me in #'+seed.room+'.']);
  }
  await db.q(`with accepted as (delete from requests r using social_bot_members b where r.to_id=b.user_id
    and not exists(select 1 from blocks where (owner=r.from_id and blocked=r.to_id) or (owner=r.to_id and blocked=r.from_id)) returning r.from_id,r.to_id)
    insert into contacts(owner,contact) select from_id,to_id from accepted union select to_id,from_id from accepted on conflict do nothing`);
}
module.exports={seedSocialBots};
