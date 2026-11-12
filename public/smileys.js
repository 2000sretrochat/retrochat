// Original illustrated Razzle smileys with classic chat shortcuts.
(function(){
// [code, title, eyes, mouth, extra, anim]
const L=[
[':)','happy','dot','smile','',''],[':(','sad','dot','frown','',''],[';)','winking','wink','smile','','winkA'],[':D','big grin','dot','grin','','bob'],
[';;)','batting eyelashes','lash','smile','','flutter'],['>:D<','big hug','closed','smile','hug','pulse'],[':-/','confused','dot','slant','',''],[':x','love struck','heart','smallo','','pulse'],
[':">','blushing','dot','smile','blush',''],[':P','tongue','dot','tongue','','wag'],[':-*','kiss','dot','kiss','kisses','pulse'],['=((','broken heart','dot','frown','broken','shake'],
[':-O','surprise','big','o','','pulse'],['X(','angry','x','frown','red','shake'],[':>','smug','dot','smirk','',''],['B-)','cool','shades','smile','',''],
[':-S','worried','dot','wave','','shake'],['#:-S','whew!','dot','wave','sweat','shake'],['>:)','devil','dot','grin','horns','bob'],[':((','crying','dot','frown','tears','shake'],
[':))','laughing','squint','grin','','bob'],[':|','straight face','dot','flat','',''],['/:)','raised eyebrow','brow','smile','',''],['=))','rolling on the floor','squint','grin','','spin'],
['O:-)','angel','dot','smile','halo','bob'],[':-B','nerd','glasses','teeth','',''],['=;','talk to the hand','dot','flat','hand','wag'],[':-c','call me','dot','smile','phone','wag'],
[':)]','on the phone','dot','smile','phone',''],['~X(','at wits\' end','x','wave','steam','shake'],[':-h','wave','dot','smile','hand','wag'],[':-t','time out','dot','flat','tee',''],
['8->','daydreaming','up','smile','dream','bob'],['I-)','sleepy','closed','flat','zzz','bob'],['8-|','rolling eyes','up','flat','','spin2'],['L-)','loser','dot','smile','L','wag'],
[':-&','sick','queasy','puke','green','retch'],[':-$','don\'t tell anyone','dot','zip','',''],['[-(','not talking','dot','flat','arms',''],[':O)','clown','dot','grin','nose','bob'],
['8-}','silly','up','wave','','wag'],['<:-P','party','dot','tongue','hat','bob'],['(:|','yawn','closed','o','',''],['=P~','drooling','dot','tongue','drool',''],
[':-?','thinking','dot','slant','q','bob'],['#-o','d\'oh','closed','o','hand','shake'],['=D>','applause','dot','grin','clap','pulse'],[':-SS','nail biting','dot','teeth','sweat','shake'],
['@-)','hypnotized','spiral','flat','','spin2'],[':^o','liar','dot','o','nose',''],[':-w','waiting','dot','flat','clock','wag'],[':-<','sigh','closed','frown','',''],
['>:P','phbbbbt','dot','tongue','red','wag'],['<):)','cowboy','dot','smile','cowboy',''],['X_X','I don\'t want to see','x','flat','',''],[':!!','hurry up!','dot','o','sweat','shake'],
['\\m/','rock on!','dot','grin','horns2','bob'],[':-q','thumbs down','dot','frown','thumbd',''],[':-bd','thumbs up','dot','smile','thumbu','bob'],['^#(^','it wasn\'t me','dot','slant','',''],
[':ar!','pirate','patch','grin','',''],[':o3','puppy dog eyes','big','smallo','',''],[':-??','I don\'t know','dot','slant','q','wag'],['%-(','not listening','closed','flat','hand',''],
[':@)','pig','dot','smile','nose','bob'],['3:-O','cow','big','o','horns2',''],[':(|)','monkey','dot','grin','ears','bob'],['~:>','chicken','dot','smirk','',''],
['@};-','rose','','','rose','wag'],['%%-','good luck','','','clover','spin2'],['**==','flag','','','flag','wag'],['(~~)','pumpkin','dot','grin','pumpkin',''],
['~O)','coffee','','','coffee','bob'],['*-:)','idea','dot','smile','bulb','pulse'],['8-X','skull','skull','teeth','',''],['=:)','bug','dot','smile','antenna','wag'],
['>-)','alien','big','smallo','green',''],[':-L','frustrated','dot','wave','red','shake'],['[-O<','praying','closed','flat','',''],['$-)','money eyes','money','grin','','pulse'],
[':-"','whistling','dot','kiss','note','bob'],['b-(','feeling beat up','x','frown','bruise','shake'],[':)>-','peace sign','dot','smile','peace','wag'],['[-X','shame on you','dot','frown','',''],
[':D/','dancing','dot','grin','','spin2'],['>:/','bring it on','dot','slant','red',''],[';))','hee hee','wink','grin','','winkA'],[':-@','chatterbox','dot','o','','pulse'],
['^:)^','not worthy','closed','smile','',''],[':-j','oh go on','dot','smirk','',''],['(*)','star','','','star','pulse'],[':)|','eyes','dot','flat','',''],
['o->','hiro','dot','smile','',''],['o=>','billy','dot','grin','',''],['o-+','april','dot','smile','',''],['(%)','yin yang','','','yinyang','spin2'],
[':bz','bee','dot','smile','antenna','wag'],['[..]','transformer','dot','flat','',''],
[':-)','happy','dot','smile','',''],[':-(','sad','dot','frown','',''],[';-)','winking','wink','smile','','winkA'],[':-D','big grin','dot','grin','','bob'],
[':-P','tongue','dot','tongue','','wag'],[':-x','love struck','heart','smallo','','pulse'],[':O','surprise','big','o','','pulse'],[':*','kiss','dot','kiss','kisses','pulse'],
['|-)','sleepy','closed','flat','zzz','bob'],['\\:D/','dancing','dot','grin','','spin2'],['O:)','angel','dot','smile','halo','bob'],['0-+','april','dot','smile','',''],['🤮','sick','queasy','puke','green','retch'],
];
L.push(['💋','blown kiss','','','lips',''],['💓','beating heart','','','beat','pulse'],['💤','sleeping Zs','','','zzz','']);
const ORDER=L.map(r=>r[0]).filter(code=>code!=='🤮');L.sort((a,b)=>b[0].length-a[0].length);
const OV=(x)=>`<ellipse cx="${x}" cy="8.6" rx="1.3" ry="2"/><circle cx="${x-.4}" cy="7.8" r=".45" fill="#fff"/>`;
const eye={queasy:'<path d="M5 8l4 1.8-4 1M17 8l-4 1.8 4 1" fill="none" stroke="#234321" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>',dot:OV(7.5)+OV(14.5),wink:'<g class="wo">'+OV(7.5)+'</g><path class="wc" d="M5.6 9.2q1.9-1.6 3.8 0" stroke="#000" fill="none" stroke-width="1.4" stroke-linecap="round"/>'+OV(14.5),
lash:'<g>'+OV(7.5)+OV(14.5)+'<path d="M5.6 7.2L3.6 5.2M6.6 6.5L5.6 4M7.9 6.3L7.9 3.7M16.4 7.2l2-2M15.4 6.5l1-2.5M14.1 6.3v-2.6" stroke="#000" stroke-width=".9" stroke-linecap="round"/></g>',
heart:'<path d="M5.5 8.5a1.2 1.2 0 0 1 2-1 1.2 1.2 0 0 1 2 1L7.5 11zM12.5 8.5a1.2 1.2 0 0 1 2-1 1.2 1.2 0 0 1 2 1l-2 2.5z" fill="#e00"/>',
big:'<circle cx="7.5" cy="9" r="2.4" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="14.5" cy="9" r="2.4" fill="#fff" stroke="#000" stroke-width=".7"/><circle cx="7.5" cy="9" r="1"/><circle cx="14.5" cy="9" r="1"/>',
x:'<path d="M6 7.5l3 3M9 7.5l-3 3M13 7.5l3 3M16 7.5l-3 3" stroke="#000" stroke-width="1.1"/>',squint:'<path d="M5.8 9.5l1.7-1.5 1.7 1.5M12.8 9.5l1.7-1.5 1.7 1.5" stroke="#000" fill="none" stroke-width="1.1"/>',
closed:'<path d="M6 9.5q1.5 1 3 0M13 9.5q1.5 1 3 0" stroke="#000" fill="none" stroke-width="1.1"/>',up:'<circle cx="7.5" cy="8" r="2" fill="#fff" stroke="#000" stroke-width=".6"/><circle cx="14.5" cy="8" r="2" fill="#fff" stroke="#000" stroke-width=".6"/><circle cx="7.5" cy="7" r=".9"/><circle cx="14.5" cy="7" r=".9"/>',
shades:'<path d="M4 7.5h14v1.2l-1 2.3h-4l-1-2h-2l-1 2H5l-1-2.3z"/>',glasses:'<circle cx="7.5" cy="9" r="2.4" fill="none" stroke="#000"/><circle cx="14.5" cy="9" r="2.4" fill="none" stroke="#000"/><path d="M9.9 9h2.2" stroke="#000"/><circle cx="7.5" cy="9" r=".9"/><circle cx="14.5" cy="9" r=".9"/>',
brow:'<circle cx="7.5" cy="9" r="1.4"/><circle cx="14.5" cy="9" r="1.4"/><path d="M12.5 5.8q2-1.3 4 0" stroke="#000" fill="none"/>',spiral:'<path d="M7.5 9m-2 0a2 2 0 1 0 2-2a1.2 1.2 0 1 0 1 1.5M14.5 9m-2 0a2 2 0 1 0 2-2a1.2 1.2 0 1 0 1 1.5" stroke="#000" fill="none" stroke-width=".7"/>',
patch:'<circle cx="14.5" cy="9" r="1.4"/><path d="M3 6l16 1" stroke="#000" stroke-width=".7"/><ellipse cx="7.5" cy="9" rx="2.3" ry="2"/>',skull:'<circle cx="7.5" cy="9" r="2"/><circle cx="14.5" cy="9" r="2"/>',
money:'<text x="5.5" y="11" font-size="5" font-weight="bold" fill="#080">$</text><text x="12.5" y="11" font-size="5" font-weight="bold" fill="#080">$</text>'};
const mouth={puke:'<ellipse cx="11" cy="14.6" rx="3.5" ry="2.6" fill="#29421a"/><g class="rc-vomit"><path d="M8.7 14.8q2.2 1 4.7 0c-.2 2 1.9 3.4 2.2 5 .4 1.6-1.5 2.2-3 1.3-1.2 1.1-3.6.3-3.2-1.1-2.5-.5-.3-3.3-.7-5.2z" fill="#81d62b" stroke="#376c1d" stroke-width=".55"/><circle cx="17.5" cy="18.3" r=".8" fill="#81d62b"/><circle cx="6.7" cy="18.8" r=".65" fill="#5eb826"/></g>',smile:'<path d="M6.5 13.5q4.5 4 9 0" stroke="#000" fill="none" stroke-width="1.4" stroke-linecap="round"/>',frown:'<path d="M7 16.5q4-3.5 8 0" stroke="#000" fill="none" stroke-width="1.4" stroke-linecap="round"/>',
grin:'<path d="M5.3 12.6h11.4q-.6 5.8-5.7 5.8t-5.7-5.8z" fill="#8a0010" stroke="#000" stroke-width="1"/><path d="M6 13h10v1.3H6z" fill="#fff"/><path d="M8.5 17.2q2.5-1.6 5 0" fill="#ff5a7a"/>',slant:'<path d="M7 15.5l8-1.5" stroke="#000" stroke-width="1.2"/>',
smallo:'<circle cx="11" cy="15" r="1.3" fill="#900"/>',tongue:'<path d="M6 13.6q5 2 10 0" stroke="#000" fill="none" stroke-width="1.3" stroke-linecap="round"/><g class="tg"><path d="M8.6 14.3h4.8v3.6a2.4 2.4 0 0 1-4.8 0z" fill="#ff4f7a" stroke="#000" stroke-width=".8"/><path d="M11 14.6v3" stroke="#c0294d" stroke-width=".6"/></g>',
kiss:'<ellipse cx="11" cy="14.8" rx="1.9" ry="1.5" fill="#e0103a" stroke="#000" stroke-width=".7"/><path d="M9.4 14.8h3.2" stroke="#800" stroke-width=".5"/>',o:'<ellipse cx="11" cy="15" rx="2" ry="2.5" fill="#900" stroke="#000" stroke-width=".7"/>',
smirk:'<path d="M7 14.5q5 1.5 8.5-1.5" stroke="#000" fill="none" stroke-width="1.4" stroke-linecap="round"/>',wave:'<path d="M6.5 15q1.2-1.5 2.4 0t2.2 0 2.2 0 2.2 0" stroke="#000" fill="none" stroke-width="1.1"/>',
flat:'<path d="M7 15h8" stroke="#000" stroke-width="1.2"/>',teeth:'<rect x="7" y="13.5" width="8" height="3" fill="#fff" stroke="#000" stroke-width=".7"/><path d="M9 13.5v3M11 13.5v3M13 13.5v3" stroke="#000" stroke-width=".5"/>',
zip:'<path d="M6.5 15h9" stroke="#000" stroke-width="1.2"/><path d="M7.5 14v2M9 14v2M10.5 14v2M12 14v2M13.5 14v2" stroke="#666" stroke-width=".6"/>'};
const ex={hug:'<path d="M2 12q-3 4 2 6 2 1 6-2M20 12q3 4-2 6-2 1-6-2" fill="none" stroke="#9d530b" stroke-width="3.5" stroke-linecap="round"/><path d="M2 12q-3 4 2 6 2 1 6-2M20 12q3 4-2 6-2 1-6-2" fill="none" stroke="#ffd248" stroke-width="2.3" stroke-linecap="round"/>',lips:'<path d="M2 12q5-7 8-2 4-4 8 2-7 10-16 0Z" fill="#e63965"/><path d="M3 12q6 2 14 0" stroke="#9f1542" fill="none"/><path class="rc-float" d="M16 5q-2-3 1-3 1 0 2 1 2-2 3 0 1 2-3 5z" fill="#ea4879"/>',beat:'<path d="M11 20C-6 10 4 0 11 6 18 0 28 10 11 20Z" fill="#e33261" stroke="#9c2145"/>',arms:'<path d="M.5 16q1.5-4 3.5-3.5M21.5 16q-1.5-4-3.5-3.5" stroke="#000" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M.5 16q1.5-4 3.5-3.5M21.5 16q-1.5-4-3.5-3.5" stroke="#ffc400" stroke-width="1.4" fill="none" stroke-linecap="round"/>',blush:'<ellipse class="bl" cx="5.3" cy="12.3" rx="2.2" ry="1.3" fill="#ff5d6c" opacity=".75"/><ellipse class="bl" cx="16.7" cy="12.3" rx="2.2" ry="1.3" fill="#ff5d6c" opacity=".75"/>',
kisses:'<path d="M17 4a.8.8 0 0 1 1.4-.6.8.8 0 0 1 1.4.6l-1.4 1.7z" fill="#e00"/>',broken:'<path d="M15 2a1.5 1.5 0 0 1 2.5-1 1.5 1.5 0 0 1 2.5 1l-2.5 3z" fill="#e00"/><path d="M17.5 1l-.6 1.6.9.8-.4 1.6" stroke="#fff" fill="none" stroke-width=".5"/>',
sweat:'<path d="M17.5 4q1.5 2 0 3t0-3z" fill="#4af"/>',horns:'<path d="M4 4l1 4 3-2zM18 4l-1 4-3-2z" fill="#c00"/>',horns2:'<path d="M4 2l2 5 2-1zM18 2l-2 5-2-1z" fill="#999"/>',
tears:'<path d="M6.5 11v4M15.5 11v4" stroke="#4af" stroke-width="1.3" class="tear"/>',halo:'<ellipse cx="11" cy="2" rx="5" ry="1.3" fill="none" stroke="#fd0" stroke-width="1.2"/>',
hand:'<path d="M17 13h3v-4h1v6h-4z" fill="#fc9" stroke="#963" stroke-width=".5"/>',phone:'<rect x="16" y="9" width="3" height="7" rx="1" fill="#333"/>',steam:'<path d="M5 3q1-2 2 0t2 0M13 3q1-2 2 0t2 0" stroke="#999" fill="none" stroke-width=".8"/>',
tee:'<path d="M15 3h5M17.5 3v4" stroke="#00c" stroke-width="1.2"/>',dream:'<circle cx="18" cy="4" r="1.5" fill="#fff" stroke="#99c" stroke-width=".5"/><circle cx="20" cy="2" r="1" fill="#fff" stroke="#99c" stroke-width=".5"/>',
zzz:'<g class="rc-float" fill="#5575d1" font-family="sans-serif" font-weight="bold"><text x="8" y="15" font-size="7">z</text><text x="13" y="10" font-size="9">z</text><text x="17" y="5" font-size="10">z</text></g>',L:'<text x="3" y="16" font-size="8" fill="#0a0" font-weight="bold">L</text>',green:'<circle cx="11" cy="11" r="9.5" fill="#9d5" opacity=".7"/>',
nose:'<circle cx="11" cy="12" r="1.8" fill="#e22"/>',hat:'<path d="M6 3l5-3 5 3z" fill="#c3f" stroke="#609" stroke-width=".5"/>',drool:'<path d="M12 17v3" stroke="#6cf" stroke-width="1"/>',
q:'<text x="16" y="6" font-size="6" fill="#00c" font-weight="bold">?</text>',clap:'<circle cx="3" cy="16" r="2" fill="#fc9"/><circle cx="19" cy="16" r="2" fill="#fc9"/>',clock:'<circle cx="18.5" cy="4" r="2.5" fill="#fff" stroke="#000" stroke-width=".5"/><path d="M18.5 4V2.5M18.5 4h1" stroke="#000" stroke-width=".5"/>',
red:'<circle cx="11" cy="11" r="9.5" fill="#f53" opacity=".45"/>',cowboy:'<path d="M2 4h18l-3-1-1-3h-10l-1 3z" fill="#963"/>',thumbd:'<path d="M17 12h3v5h-1.5v2h-1.5z" fill="#fc9" stroke="#963" stroke-width=".5"/>',
thumbu:'<path d="M17 18h3v-5h-1.5v-2h-1.5z" fill="#fc9" stroke="#963" stroke-width=".5"/>',ears:'<circle cx="2" cy="10" r="2.2" fill="#a73"/><circle cx="20" cy="10" r="2.2" fill="#a73"/>',
antenna:'<path d="M8 3L6 0M14 3l2-3" stroke="#000" stroke-width=".7"/>',bulb:'<circle cx="18" cy="4" r="2.5" fill="#ff6" stroke="#cc0" stroke-width=".5"/>',note:'<text x="16" y="7" font-size="6" fill="#00c">♪</text>',
bruise:'<circle cx="15" cy="11" r="2" fill="#86c" opacity=".7"/>',peace:'<path d="M18 17l-1-5M19 17l1.5-5" stroke="#fc9" stroke-width="1.2"/>',pumpkin:'<circle cx="11" cy="11" r="9.5" fill="#f80"/>',
rose:'<path d="M11 10v11M11 15l-3-2" stroke="#080" stroke-width="1.2"/><circle cx="11" cy="7" r="4" fill="#d02"/><path d="M9 6q2 2 4 0" stroke="#900" fill="none" stroke-width=".7"/>',
clover:'<g fill="#2a2"><circle cx="8" cy="8" r="3"/><circle cx="14" cy="8" r="3"/><circle cx="8" cy="14" r="3"/><circle cx="14" cy="14" r="3"/></g><path d="M11 11l4 9" stroke="#060"/>',
flag:'<path d="M5 2v19" stroke="#555" stroke-width="1.3"/><path d="M6 3h12l-3 4 3 4H6z" fill="#e33"/>',coffee:'<path d="M4 9h11v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill="#963"/><path d="M15 11h2a2 2 0 0 1 0 4h-2" stroke="#963" fill="none" stroke-width="1.2"/><path d="M7 7q1-2 0-4M11 7q1-2 0-4" stroke="#aaa" fill="none" stroke-width=".8"/>',
star:'<path d="M11 1l2.9 6.5 7 .6-5.3 4.6 1.6 7L11 16l-6.2 3.7 1.6-7L1.1 8.1l7-.6z" fill="#fd0" stroke="#c90" stroke-width=".6"/>',
yinyang:'<circle cx="11" cy="11" r="9" fill="#fff" stroke="#000"/><path d="M11 2a4.5 4.5 0 0 1 0 9a4.5 4.5 0 0 0 0 9a9 9 0 0 1 0-18z"/><circle cx="11" cy="6.5" r="1.2" fill="#fff"/><circle cx="11" cy="15.5" r="1.2"/>'};
const svg=([c,t,e,m,x,a])=>{const face=e?`<circle cx="11" cy="11" r="9.5" fill="url(#${x==='green'?'rcg-green':'rcg'})" stroke="${x==='green'?'#376629':'#a75910'}" stroke-width=".9"/><path d="M4.3 7.3q2.1-4.7 7.6-4.4" stroke="#fff" stroke-opacity=".65" stroke-width=".8" fill="none" stroke-linecap="round"/>`:'';
 return `<svg class="rcs ${a}" viewBox="0 0 22 22" width="22" height="22" role="img" aria-label="${t}">${face}${x&&!e?'':''}${['red','pumpkin'].includes(x)?ex[x]:''}<g class="ey">${eye[e]||''}</g>${mouth[m]||''}${['green','red','pumpkin'].includes(x)?'':(ex[x]||'')}</svg>`};
const escH=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const map=L.map(r=>({code:r[0],esc:escH(r[0]),title:r[1],html:`<span class="rcw" title="${escH(r[0])}  ${escH(r[1])}">${svg(r)}</span>`}));
const re=new RegExp(map.map(m=>m.esc.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+'|&(?:[a-z]+|#[0-9]+);','gi');
const byEsc={};map.slice().reverse().forEach(m=>byEsc[m.esc.toLowerCase()]=m.html);map.forEach(m=>{if(!(m.esc in byEsc))byEsc[m.esc]=m.html});
// input: already-HTML-escaped text; only replace outside of entities (entities are matched whole by alternation order since codes contain escaped forms)
window.RCSmileys={list:L.slice().sort((a,b)=>0),replace:t=>t.replace(re,m=>/^&(?:[a-z]+|#[0-9]+);$/i.test(m)?m:(byEsc[m]||byEsc[m.toLowerCase()]||m)),html:c=>map.find(m=>m.code==c).html,codes:map,ordered:ORDER.map(c=>map.find(m=>m.code==c))};
function prepare(doc) {
if (doc.getElementById('razzle-smiley-style')) return;
const st=doc.createElement('style');st.id='razzle-smiley-style';st.textContent=`.rcw{display:inline-block;vertical-align:middle;line-height:0}.rcs{overflow:visible}
@keyframes rcbob{50%{transform:translateY(-2px)}}@keyframes rcpulse{50%{transform:scale(1.15)}}@keyframes rcshake{25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
@keyframes rcspin{to{transform:rotate(360deg)}}@keyframes rcwag{50%{transform:rotate(12deg)}}@keyframes rcblink{0%,85%,100%{transform:scaleY(1)}90%{transform:scaleY(.1)}}
.rcs.bob{animation:rcbob .8s infinite}.rcs.pulse{animation:rcpulse 1s infinite}.rcs.shake{animation:rcshake .4s infinite}.rcs.spin{animation:rcspin 1.6s linear infinite}
.rcs.spin2 g{animation:rcspin 2.5s linear infinite;transform-origin:11px 11px}.rcs.wag{animation:rcwag 1.4s infinite;transform-origin:11px 20px}.rcs.blink .ey{animation:rcblink 2.5s infinite;transform-origin:11px 9px}
@keyframes rcflut{0%,100%{transform:scaleY(1)}10%,30%,50%{transform:scaleY(.12)}20%,40%,60%{transform:scaleY(1)}}.rcs.flutter .ey{animation:rcflut 1.4s infinite;transform-origin:11px 8.6px}
@keyframes rcwo{0%,35%,75%,100%{opacity:1}40%,70%{opacity:0}}@keyframes rcwc{0%,35%,75%,100%{opacity:0}40%,70%{opacity:1}}@keyframes rctilt{0%,30%,80%,100%{transform:rotate(0)}45%,65%{transform:rotate(-10deg)}}
.rcs .wc{opacity:0}.rcs.winkA .wo{animation:rcwo 1.6s infinite}.rcs.winkA .wc{animation:rcwc 1.6s infinite}.rcs.winkA{animation:rctilt 1.6s infinite}
@keyframes rctg{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.35) rotate(6deg)}}.rcs .tg{animation:rctg .7s infinite;transform-origin:11px 14.3px}
@keyframes rcbl{50%{opacity:1}}.rcs .bl{animation:rcbl 1s infinite}
@keyframes rcRetch{0%,28%,78%,100%{transform:scale(.92);opacity:0}36%,67%{transform:scale(1);opacity:1}}
.rcs .rc-vomit{animation:rcRetch 1.8s ease-in-out infinite;transform-origin:11px 14.8px}
@keyframes rcFloat{0%,100%{opacity:.5;transform:translateY(2px)}50%{opacity:1;transform:translateY(-2px)}}.rc-float{animation:rcFloat 1.6s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.rcs,.rcs *{animation:none!important}}
.rcs .tear{animation:rcbob .6s infinite}.rcs{transform-origin:11px 11px}`;doc.head.appendChild(st);
doc.body.insertAdjacentHTML('beforeend','<svg width="0" height="0" style="position:absolute"><defs><radialGradient id="rcg" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fffac0"/><stop offset=".48" stop-color="#ffdf43"/><stop offset=".81" stop-color="#ffb913"/><stop offset="1" stop-color="#db8209"/></radialGradient><radialGradient id="rcg-green" cx=".34" cy=".3" r=".8"><stop offset="0" stop-color="#f1ffbe"/><stop offset=".5" stop-color="#b6df61"/><stop offset="1" stop-color="#579735"/></radialGradient></defs></svg>');
}
window.RCSmileys.prepare = prepare;
})();
