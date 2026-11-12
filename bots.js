// Idle ambience bots: per-room screen names + harmless small-talk lines in each room's language.
// Bots never answer IMs, don't count against IP/session limits, and are toggled in Master Control.
const {profiles:refreshProfiles,languageLines}=require('./room-bot-refresh');
const P = {
  en: ['anyone else still up?', 'lol', 'brb getting a snack', 'this song on winamp is stuck in my head', 'so bored rn', 'my dial-up keeps disconnecting ugh', 'who likes blink-182', 'cant sleep again', 'haha nice', 'its so quiet in here tonight', 'back', 'hey all :)', 'anyone watch TRL today', 'gonna update my away message brb', 'whats everyone up to?', 'nice weather today finally'],
  zh: ['大家好！', '今天天气不错啊', '有人在吗？', '刚吃完饭，好饱', '晚上好～', '有北京的朋友吗？', '你们周末做什么？', '哈哈哈', '我去泡杯茶，马上回来', '最近在听周杰伦的歌'],
  yue: ['大家好呀！', '今日好熱呀', '有冇香港嘅朋友？', '食咗飯未呀？', '哈哈，好好笑', '我去飲杯奶茶先', '早晨！'],
  ja: ['こんばんは〜', 'みなさん元気？', '今日は暑いですね', '東京の人いますか？', 'ラーメン食べたい', 'ちょっと休憩します', 'よろしくお願いします！', 'www', '週末なにするの？'],
  ko: ['안녕하세요~', '다들 뭐 하세요?', '오늘 날씨 좋네요', '서울 분 계세요?', '배고파요 ㅠㅠ', 'ㅋㅋㅋ', '저녁 드셨어요?', '잠깐 다녀올게요'],
  tl: ['Kumusta kayo?', 'Magandang gabi po!', 'May taga-Cebu ba dito?', 'Kain na tayo!', 'Ang init ngayon grabe', 'hehe', 'Sino gising pa?', 'Brb, mag-merienda lang', 'Musta ang araw niyo?'],
  vi: ['Chào cả nhà!', 'Hôm nay trời đẹp quá', 'Có ai ở Sài Gòn không?', 'Mọi người ăn cơm chưa?', 'hihi', 'Mình đi uống cà phê chút nhé', 'Buổi tối vui vẻ nha'],
  th: ['สวัสดีครับทุกคน', 'วันนี้ร้อนมากเลย', 'มีใครอยู่กรุงเทพบ้าง?', 'กินข้าวกันหรือยัง?', '555', 'ไปหาอะไรกินก่อนนะ', 'ฝันดีนะทุกคน'],
  id: ['Halo semua!', 'Apa kabar?', 'Ada yang dari Jakarta?', 'Udah makan belum?', 'Hujan terus nih', 'wkwkwk', 'Lagi pada ngapain?', 'Bentar ya, ngopi dulu'],
  hi: ['नमस्ते सब लोग!', 'कैसे हो सब?', 'कोई मुंबई से है?', 'आज बहुत गर्मी है', 'खाना खा लिया?', 'चाय पीने जा रहा हूँ, अभी आया', 'हाहा मज़ेदार', 'शुभ रात्रि दोस्तों'],
  ta: ['வணக்கம் நண்பர்களே!', 'எல்லோரும் எப்படி இருக்கீங்க?', 'சென்னையில யாராவது இருக்கீங்களா?', 'சாப்பிட்டீங்களா?', 'இன்னைக்கு ரொம்ப வெயில்', 'ஹாஹா', 'காபி குடிச்சிட்டு வரேன்'],
  te: ['నమస్కారం అందరికీ!', 'ఎలా ఉన్నారు?', 'హైదరాబాద్ నుండి ఎవరైనా ఉన్నారా?', 'భోజనం చేశారా?', 'ఈరోజు చాలా వేడిగా ఉంది', 'హహ', 'టీ తాగి వస్తాను'],
  pa: ['ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ!', 'ਕੀ ਹਾਲ ਹੈ ਸਭ ਦਾ?', 'ਕੋਈ ਲੁਧਿਆਣੇ ਤੋਂ ਹੈ?', 'ਰੋਟੀ ਖਾ ਲਈ?', 'ਅੱਜ ਬਹੁਤ ਗਰਮੀ ਹੈ', 'ਹਾਹਾ', 'ਚਾਹ ਪੀ ਕੇ ਆਇਆ'],
  bn: ['নমস্কার সবাইকে!', 'কেমন আছেন সবাই?', 'কলকাতা থেকে কেউ আছেন?', 'খাওয়া দাওয়া হলো?', 'আজ খুব গরম', 'হাহা', 'চা খেয়ে আসছি'],
  es: ['¡Hola a todos!', '¿Qué tal?', '¿Alguien de México?', 'Hace mucho calor hoy', 'jajaja', 'Voy por un café, ya vuelvo'],
  ru: ['Всем привет!', 'Как дела?', 'Кто из Москвы?', 'Сегодня холодно', 'хаха', 'Пойду чай попью'],
};
for(const [language,lines] of Object.entries(languageLines))P[language]=[...(P[language]||[]),...lines];
const B = (room, lang, names) => names.map(n => ({ name: n, room, lang }));
const BOTS = [
  ...B('Late Night', 'en', ['sk8rboi_1987', 'xXmoonchildXx']),
  ...B('Lobby', 'en', ['dreamgurl_04']), ...B('Chit Chat', 'en', ['surferdude_99', 'kewl_kat2001']), ...B('Music Lobby', 'en', ['punkrawk_kid']), ...B('Friends', 'en', ['glitterbabe_03', 'mixtape_mike']), ...B('Lobby', 'en', ['angelface_x0', 'dj_spinz2k']), ...B('Late Night', 'en', ['nightowl_jen']), ...B('Music Lobby', 'en', ['emo_kid_4ever']), ...B('Chit Chat', 'en', ['butterfly_kisses88']),
  ...B('中文 Chinese (Mandarin)', 'zh', ['xiaolong_88', 'meimei1999', 'tianshi_2002']), ...B('China', 'zh', ['beijing_boy01', 'panda_qq']),
  ...B('粵語 Cantonese', 'yue', ['hk_kitty97']), ...B('China', 'yue', ['mongkok_ah_ming']),
  ...B('日本語 Japanese', 'ja', ['sakura_chan_98', 'tokyo_ninja01', 'kawaii_yumi']), ...B('Japan', 'ja', ['ramen_otaku']),
  ...B('한국어 Korean', 'ko', ['seoul_star_99', 'kimchi_love01', 'minji_2002']), ...B('Korea', 'ko', ['busan_boy88']),
  ...B('Tagalog', 'tl', ['pinay_angel_02', 'batang_manila', 'jolibee_lover']), ...B('Philippines', 'tl', ['kuya_jun98', 'cebuana_cutie']),
  ...B('Tiếng Việt (Vietnamese)', 'vi', ['saigon_girl99', 'pho_king01']), ...B('Vietnam', 'vi', ['hanoi_boy2000']),
  ...B('ภาษาไทย (Thai)', 'th', ['bangkok_bee', 'nong_mai99']), ...B('Bahasa Indonesia', 'id', ['anak_jakarta', 'cewek_bandung01', 'bali_surfer88']),
  ...B('हिन्दी Hindi', 'hi', ['desi_munda_99', 'priya_cutie01', 'bollywood_fan88']), ...B('India', 'hi', ['mumbai_masti', 'delhi_boy2001']), ...B('India', 'hi', ['bandra_babe']),
  ...B('தமிழ் Tamil', 'ta', ['chennai_kanna', 'tamil_ponnu99']), ...B('తెలుగు Telugu', 'te', ['hyd_raja01', 'telugu_ammayi']),
  ...B('ਪੰਜਾਬੀ Punjabi', 'pa', ['jatt_boy_007', 'punjabi_kudi99']), ...B('বাংলা Bengali', 'bn', ['kolkata_dada', 'rosogolla_girl']),
  ...B('En Español', 'es', ['chica_loca_01']), ...B('Русский (Russian)', 'ru', ['masha_99']),
];

const COLS = ['#000080', '#8b0000', '#006400', '#4b0082', '#b8860b', '#008080', '#c71585'], FNTS = ['Arial', 'Verdana', 'Comic Sans MS', 'Tahoma'];
// extra English variety: templates with fill-ins so lines don't repeat as often
const EN2 = ['just got back from {place}', 'anyone here into {thing}?', 'omg {thing} is the best', 'listening to {song} rn', 'what is everyone eating tonight? im having {food}', 'rate my away msg: "{away}"', 'who else is from {city}?', '{greet} everyone', 'cant believe its already {time}', 'my mom keeps yelling at me to get off the computer lol', 'brb phone', 'a/s/l? jk jk', 'i need a new screen name ideas pls', 'its raining here, perfect chat weather', 'anyone want to trade buddy icons', 'lmao', 'hahaha same', 'ok im back', 'thats so random', 'i love this room', 'who has a webcam on?', 'turn up the music!!', 'whats the best movie ever? i say {movie}', 'gonna make some {food} brb', 'quiz time: favorite cereal?', 'sooo sleepy', 'this chat is my fav place on the internet', 'happy {day} everybody!'];
const FILL = { place: ['the mall', 'school', 'work', 'the gym', 'blockbuster', 'my cousins house'], thing: ['tamagotchis', 'skateboarding', 'the sims', 'pokemon', 'harry potter', 'nsync', 'gel pens', 'myspace layouts'], song: ['Hey Ya', 'Mr. Brightside', 'Toxic', 'In Da Club', 'Complicated', 'Yellow', 'Bye Bye Bye'], food: ['pizza rolls', 'mac n cheese', 'tacos', 'ramen', 'hot pockets', 'cereal'], away: ['out livin la vida loca', 'brb, dont touch my stuff', 'gone to the movies ~*~', 'sleeping... or am i'], city: ['NYC', 'LA', 'Chicago', 'Texas', 'Florida', 'Phoenix', 'Seattle', 'Atlanta'], greet: ['heyyy', 'hi', 'sup', 'hello hello', 'yo'], time: ['this late', 'friday', 'november', 'the weekend'], movie: ['Mean Girls', 'The Matrix', 'Titanic', 'Napoleon Dynamite', 'Shrek'], day: ['monday', 'friday', 'weekend'] };
const pick = a => a[Math.floor(Math.random() * a.length)];
function line(b, room, last) { if (b.lines) return pick(b.lines.filter(text => text !== last)); for (let k = 0; k < 4; k++) { const L = P[b.lang] || P.en; let t = b.lang === 'en' && Math.random() < 0.6 ? pick(EN2).replace(/\{(\w+)\}/g, (_, f) => pick(FILL[f] || [''])) : pick(L); if (t !== last) return t; } return pick(P[b.lang] || P.en); }
const RE = { en: ['lol {n}', 'haha true', 'omg same {n}', 'no way!', 'for real?', 'agreed', '{n} ur funny', 'lmao', 'totally', 'hmm idk about that'], es: ['jaja {n}', 'sí, verdad', '¡qué bueno!'], ru: ['ха-ха {n}', 'точно'] };
function reply(b, n) { const L = RE[b.lang]; return L ? pick(L).replace('{n}', n) : line(b); }
function greet(b, n) { if (b.lines) return line(b); const G = { en: ['hey {n}!', 'hi {n} :)', 'welcome {n}', 'sup {n}', 'heyyy {n} whats up'], es: ['¡Hola {n}!'], ru: ['Привет, {n}!'], ja: ['{n}さん、こんにちは！'], ko: ['{n}님 안녕하세요!'], zh: ['{n} 你好！'] }; return pick(G[b.lang] || ['hi {n} :)']).replace('{n}', n); }
const byRoom = {};
// ---- Interactive hosts: natural screen names, no "[bot]" suffix. Stable ids keep old DB rows/avatars. ----
const HOSTS = [
  { id: 'razzleguide', name: 'RazzleGuide', room: 'Lobby', legacy: ['RazzleGuide [bot]'], aliases: ['razzleguide', 'guide', 'razzle_guide'] },
  { id: 'triviatime', name: 'Jenna_Q', room: 'Lobby', trivia: true, legacy: ['TriviaTime [bot]'], aliases: ['jenna_q', 'jenna', 'jennaq', 'trivia', 'triviatime'] },
  { id: 'gamenight', name: 'MarcusT', room: 'Chit Chat', trivia: true, games: true, legacy: ['GameNight [bot]'], aliases: ['marcust', 'marcus', 'gamenight', 'game'] },
  { id: 'mixtapebot', name: 'mel_mixtapes', room: 'Music Lobby', music: true, legacy: ['MixtapeBot [bot]'], aliases: ['mel_mixtapes', 'mel', 'mixtape', 'mixtapebot', 'music'] },
];
for (const h of HOSTS) BOTS.push(Object.assign({ lang: 'en', interactive: true, av: '' }, h));
// Keep these ids and their order to preserve the preview profiles and portraits.
BOTS.push(
  { id: 'bart-simpson', name: 'Patch_Pigeon', room: 'Lobby', lang: 'en', interactive: true,
    aliases: ['patch', 'patch_pigeon'], avatar_key: 'patch_pigeon',
    replacedProfile: { name: 'Bart_Simpson', bio: "Springfield’s resident skateboarder and chalkboard regular." },
    lines: ["I hid a fake weather report in the room topic. Expect scattered cheese.","My rooftop station has one listener. It’s also me.","If the snack cabinet asks, the crumbs were already there."] },
  { id: 'sideshow-bob', name: 'Velvet_Vox', room: 'Lobby', lang: 'en', interactive: true,
    aliases: ['velvet', 'velvet_vox'], avatar_key: 'velvet_vox',
    replacedProfile: { name: 'Sideshow_Bob', bio: "Former television sidekick with theatrical plans." },
    lines: ["I prepared a dramatic pause. It’s available in three lengths.","Patch, your weather report needs a sound effect. I brought a kazoo.","My keyboard has a theme song. It plays whenever I misplace the space bar."] },
  { id: 'ralph-wiggum', name: 'Mochi_Modem', room: 'Chit Chat', lang: 'en', interactive: true,
    aliases: ['mochi', 'mochi_modem'], avatar_key: 'mochi_modem',
    replacedProfile: { name: 'Ralph_Wiggum', bio: "A Springfield chatter with a very literal take on things." },
    lines: ["I put my keyboard in time-out because it keeps saying escape.","I tried to clear my cache. Now my snack drawer is empty.","If my battery gets low, please tell it to think positive."] }
);
const PREVIEW_BOTS = [
  {id:'preview-nightowl',name:'NightOwl',room:'Late Night'},
  {id:'preview-retrofan',name:'RetroFan',room:'Lobby'},
  {id:'preview-mialuvs',name:'MiaLuvs',room:'Chit Chat'},
];
BOTS.push(...PREVIEW_BOTS.map(b=>({...b,lang:'en'})));
for(const [room,names] of [
  ['Lobby',['cablekid77','quiet_circuit']],
  ['Chit Chat',['afterhours_lee','bluejacket42']],
  ['Late Night',['static_river','nightbus_81']],
  ['Music Lobby',['sideb_radio','tape_deck73']],
]) BOTS.push(...B(room,'en',names).map(b=>({...b,silent:true})));
BOTS.push(...refreshProfiles);
const slug = n => String(n).toLowerCase().replace(/\s*\[bot\]\s*$/, '').replace(/[^a-z0-9_]/g, '');
BOTS.forEach((b, i) => { if (!b.id) b.id = slug(b.name); b.color = b.color || COLS[i % COLS.length]; b.font = b.font || FNTS[(i * 3) % FNTS.length]; b.av = b.silent ? '' : 'bot:' + b.id; });
for (const b of BOTS) (byRoom[b.room] = byRoom[b.room] || []).push(b);
for (const b of BOTS) if (b.interactive) b.greet = 'hey! mention me if you need anything';

// ---- Profile seeds for EVERY bot: hand-written persona [display name, location, interests, bio] ----
const PERSONA = {
  'bart-simpson': ["Patch Pigeon","Portland, Oregon","radio, practical jokes","A rooftop radio host who leaves ridiculous clues around the lobby."],
  'sideshow-bob': ["Velvet Vox","Cleveland, Ohio","radio theater, sound effects","A radio drama host who gives minor inconveniences their own theme music."],
  'ralph-wiggum': ["Mochi Modem","Mesa, Arizona","gadgets, snacks","A tiny repair robot that takes computer instructions very literally."],
  'preview-nightowl': ['NightOwl', 'Portland, Oregon', 'Music, Travel', 'The rest of the house is asleep and I just made coffee.'],
  'preview-retrofan': ['RetroFan', 'Columbus, Ohio', 'Politics, Cars', 'I miss the sound of signing on.'],
  'preview-mialuvs': ['MiaLuvs', 'Austin, Texas', 'Photography, Food, Travel', 'Always have time for a good photo spot.'],
  sk8rboi_1987: ['Kyle', 'San Diego, CA', 'skateboarding, Tony Hawk, pop punk', 'Night shift skater. If the park lights are off I am in here talking about kickflips and Blink-182.'],
  xxmoonchildxx: ['Luna', 'Portland, OR', 'astrology, poetry, tarot', 'Moon kid. Writes bad poetry at 2am and reads everyone\'s horoscope whether they ask or not.'],
  dreamgurl_04: ['Brittany', 'Tampa, FL', 'boy bands, glitter gel pens, The Sims', 'Lobby regular since forever. Ask me about the best away messages.'],
  surferdude_99: ['Jake', 'Huntington Beach, CA', 'surfing, reggae, tacos', 'Checks the surf report, then checks this chat. Totally chill, dude.'],
  kewl_kat2001: ['Katie', 'Austin, TX', 'cats, Lisa Frank, Hey Arnold', 'Cat mom of three. Will send you a cat picture unprompted.'],
  punkrawk_kid: ['Danny', 'Philadelphia, PA', 'punk shows, guitar, Green Day', 'Plays three chords really loud. Mixtape trades welcome.'],
  glitterbabe_03: ['Ashley', 'Columbus, OH', 'makeup, Britney, scrapbooking', 'Glitter on everything. Friends room hype girl.'],
  mixtape_mike: ['Mike', 'Chicago, IL', 'burning CDs, hip-hop, Winamp skins', 'Still has a binder of 200 burned CDs. Name a song, I probably have it.'],
  angelface_x0: ['Angela', 'Atlanta, GA', 'R&B, dance, nail art', 'Sweet until you diss Destiny\'s Child.'],
  dj_spinz2k: ['Marco', 'Miami, FL', 'DJing, house music, turntables', 'Bedroom DJ with two turntables and zero sleep schedule.'],
  nightowl_jen: ['Jen', 'Seattle, WA', 'coffee, mystery novels, X-Files', 'Can\'t sleep, won\'t sleep. Bring snacks to Late Night.'],
  emo_kid_4ever: ['Alex', 'Omaha, NE', 'emo bands, sketching, eyeliner', 'Sad songs and happy people. Taking Back Sunday on repeat.'],
  butterfly_kisses88: ['Megan', 'Nashville, TN', 'country music, butterflies, baking', 'Southern sweetheart who bakes too many cookies.'],
  xiaolong_88: ['Xiao Long', 'Shanghai, China', '篮球, 周杰伦, 电脑游戏', '上海人，喜欢打篮球和听周杰伦。Shanghai guy into basketball and Jay Chou.'],
  meimei1999: ['Meimei', 'Chengdu, China', '火锅, 追剧, 熊猫', '成都妹子，爱吃火锅。Hot pot lover from Chengdu.'],
  tianshi_2002: ['Tianshi', 'Hangzhou, China', '画画, 喝茶, 小说', '喜欢画画和西湖边喝茶。Draws and drinks tea by West Lake.'],
  beijing_boy01: ['Wei', 'Beijing, China', '足球, 摇滚, 烤鸭', '北京大学生，周末踢足球。Beijing student, football on weekends.'],
  panda_qq: ['Lin', 'Chongqing, China', 'QQ宠物, 动漫, 奶茶', '一直挂QQ的熊猫迷。Panda fan, always online on QQ.'],
  hk_kitty97: ['Kitty', 'Hong Kong', '廣東歌, 奶茶, 行街', '香港女仔，最鍾意陳奕迅。HK girl, Eason Chan forever.'],
  mongkok_ah_ming: ['Ah Ming', 'Mong Kok, Hong Kong', '打機, 港漫, 茶餐廳', '旺角長大，日日去茶餐廳。Grew up in Mong Kok, cha chaan teng daily.'],
  sakura_chan_98: ['Sakura', 'Kyoto, Japan', 'お花見, J-pop, 抹茶', '京都出身。桜と抹茶が大好き。Kyoto girl who loves sakura and matcha.'],
  tokyo_ninja01: ['Kenji', 'Tokyo, Japan', 'ゲーム, 秋葉原, アニメ', '秋葉原によくいるゲーマー。Gamer who lives in Akihabara.'],
  kawaii_yumi: ['Yumi', 'Osaka, Japan', 'プリクラ, ハローキティ, カラオケ', '大阪のカラオケ好き。Osaka karaoke queen.'],
  ramen_otaku: ['Taro', 'Sapporo, Japan', 'ラーメン, 漫画, スノボ', '札幌の味噌ラーメン研究家。Sapporo miso ramen expert.'],
  seoul_star_99: ['Jisoo', 'Seoul, Korea', 'K-pop, 노래방, 패션', '서울 사는 K-pop 팬. Seoul K-pop fan, noraebang every Friday.'],
  kimchi_love01: ['Hyun', 'Incheon, Korea', '요리, 김치찌개, 드라마', '엄마 김치찌개가 최고. Thinks mom\'s kimchi stew is the best.'],
  minji_2002: ['Minji', 'Daegu, Korea', '싸이월드, 사진, 떡볶이', '싸이월드 꾸미기 장인. Cyworld decorating pro.'],
  busan_boy88: ['Dong-hyun', 'Busan, Korea', '야구, 바다, 회', '부산 사나이, 롯데 자이언츠 팬. Busan guy, Lotte Giants fan.'],
  pinay_angel_02: ['Angel', 'Quezon City, Philippines', 'karaoke, teleserye, halo-halo', 'Videoke champion ng barangay. Neighborhood karaoke champ.'],
  batang_manila: ['Paolo', 'Manila, Philippines', 'basketball, jeepney rides, OPM', 'Batang Maynila, PBA fan. Manila kid who lives for basketball.'],
  jolibee_lover: ['Rina', 'Pasig, Philippines', 'Chickenjoy, K-drama, malls', 'Jollibee every Sunday. Chickenjoy is life.'],
  kuya_jun98: ['Jun', 'Davao, Philippines', 'guitar, durian, Eraserheads', 'Kuya ng barkada. Big brother of the group, plays guitar.'],
  cebuana_cutie: ['Chloe', 'Cebu City, Philippines', 'beaches, lechon, dancing', 'Proud Cebuana. Ask me about Sinulog.'],
  saigon_girl99: ['Linh', 'Ho Chi Minh City, Vietnam', 'cà phê sữa đá, thời trang, nhạc', 'Cô gái Sài Gòn mê cà phê. Saigon girl, iced coffee addict.'],
  pho_king01: ['Minh', 'Hue, Vietnam', 'phở, bóng đá, chơi game', 'Nấu phở ngon nhất xóm. Makes the best pho on the block.'],
  hanoi_boy2000: ['Tuan', 'Hanoi, Vietnam', 'xe máy, guitar, Hồ Gươm', 'Trai Hà Nội, thích đi dạo Hồ Gươm. Hanoi guy, evening walks by the lake.'],
  bangkok_bee: ['Ploy', 'Bangkok, Thailand', 'ส้มตำ, ช้อปปิ้ง, ละคร', 'สาวกรุงเทพ ชอบช้อปปิ้งที่สยาม. Bangkok girl, shopping at Siam.'],
  nong_mai99: ['Mai', 'Chiang Mai, Thailand', 'ดนตรี, ดอกไม้, กาแฟ', 'น้องใหม่จากเชียงใหม่. Chiang Mai local, flowers and coffee.'],
  anak_jakarta: ['Budi', 'Jakarta, Indonesia', 'futsal, nasi goreng, band', 'Anak Jakarta asli, main futsal tiap Sabtu. Jakarta native, futsal Saturdays.'],
  cewek_bandung01: ['Sari', 'Bandung, Indonesia', 'fashion, batagor, musik indie', 'Cewek Bandung suka musik indie. Bandung girl into indie music.'],
  bali_surfer88: ['Wayan', 'Denpasar, Bali', 'surfing, gamelan, sunsets', 'Surfing di Kuta tiap pagi. Surfs Kuta every morning.'],
  desi_munda_99: ['Rohit', 'Jaipur, India', 'क्रिकेट, बॉलीवुड, गाने', 'क्रिकेट का दीवाना। Cricket crazy, Sachin fan forever.'],
  priya_cutie01: ['Priya', 'Pune, India', 'डांस, किताबें, चाय', 'चाय और किताबें। Classical dancer who reads a lot.'],
  bollywood_fan88: ['Neha', 'Lucknow, India', 'Shah Rukh Khan, फ़िल्में, गाने', 'SRK की सबसे बड़ी फैन। Biggest SRK fan in the room.'],
  mumbai_masti: ['Arjun', 'Mumbai, India', 'वड़ा पाव, लोकल ट्रेन, समंदर', 'मुंबई का लड़का, मरीन ड्राइव पर शाम। Mumbai kid, evenings at Marine Drive.'],
  delhi_boy2001: ['Karan', 'New Delhi, India', 'गेमिंग, छोले भटूरे, कंप्यूटर', 'दिल्ली वाला गेमर। Delhi gamer, chole bhature fan.'],
  bandra_babe: ['Simran', 'Bandra, Mumbai', 'फैशन, कैफ़े, गाना', 'बांद्रा की कैफ़े क्वीन। Bandra cafe hopper.'],
  chennai_kanna: ['Karthik', 'Chennai, India', 'கிரிக்கெட், ரஜினி, பில்டர் காபி', 'சென்னை பையன், ரஜினி ரசிகன். Chennai guy, Rajini fan.'],
  tamil_ponnu99: ['Divya', 'Madurai, India', 'பரதநாட்டியம், இளையராஜா, கோலம்', 'இளையராஜா பாடல்கள் பிடிக்கும். Loves Ilaiyaraaja songs.'],
  hyd_raja01: ['Ravi', 'Hyderabad, India', 'బిర్యానీ, క్రికెట్, సినిమాలు', 'హైదరాబాద్ బిర్యానీ ప్రియుడు. Hyderabad biryani lover.'],
  telugu_ammayi: ['Sravani', 'Vijayawada, India', 'సంగీతం, సినిమాలు, వంట', 'తెలుగు పాటలు ఇష్టం. Telugu music and cooking.'],
  jatt_boy_007: ['Gurpreet', 'Amritsar, India', 'ਭੰਗੜਾ, ਕਬੱਡੀ, ਲੱਸੀ', 'ਅੰਮ੍ਰਿਤਸਰ ਦਾ ਜੱਟ। Amritsar guy, bhangra at every wedding.'],
  punjabi_kudi99: ['Harleen', 'Ludhiana, India', 'ਗਿੱਧਾ, ਗੀਤ, ਫੁਲਕਾਰੀ', 'ਲੁਧਿਆਣੇ ਦੀ ਕੁੜੀ। Ludhiana girl, giddha and Punjabi songs.'],
  kolkata_dada: ['Sourav', 'Kolkata, India', 'ফুটবল, রবীন্দ্রসংগীত, আড্ডা', 'কলকাতার আড্ডাবাজ। Kolkata adda expert, football fan.'],
  rosogolla_girl: ['Rupa', 'Howrah, India', 'মিষ্টি, গান, বই', 'রসগোল্লা ছাড়া চলে না। Can\'t live without rosogolla.'],
  chica_loca_01: ['Valeria', 'Guadalajara, México', 'música, baile, telenovelas', 'Tapatía que ama bailar. Guadalajara girl who loves to dance.'],
  masha_99: ['Masha', 'St. Petersburg, Russia', 'музыка, книги, чай', 'Питерская девушка, люблю книги и чай. Petersburg girl, books and tea.'],
  razzleguide: ['RazzleGuide', 'Razzle Social', 'rooms, contacts, helping people find their way', 'I hang out in the Lobby and help people find rooms and use Contacts. Mention @RazzleGuide help anytime.'],
  triviatime: ['Jenna', 'Denver, CO', 'trivia nights, 2000s pop culture, crosswords', 'Pub-trivia captain by night. Say "@Jenna trivia" and I will throw you a question, with up to two hints.'],
  gamenight: ['Marcus', 'Baltimore, MD', 'board games, trivia, dice, retro consoles', 'Game night every night. "@Marcus trivia" for a question, or try roll / 8ball.'],
  mixtapebot: ['Mel', 'Minneapolis, MN', 'mixtapes, indie rock, record stores', 'Record store clerk with opinions. Ask "@Mel recommend" for songs.'],
};
const LEGACY_DEFAULT_DISPLAY = { triviatime: 'TriviaTime', gamenight: 'GameNight', mixtapebot: 'MixtapeBot', razzleguide: 'RazzleGuide' };
const LEGACY_DEFAULT_BIO = {
  razzleguide: 'Helpful guide for rooms, Contacts, and other bots. Say @RazzleGuide help.',
  triviatime: 'Nostalgia trivia host. Say @TriviaTime trivia to start a round.',
  gamenight: 'Quick games in chat. Try @GameNight roll or @GameNight 8ball.',
  mixtapebot: 'Playlist tips and song picks. Say @MixtapeBot recommend.',
};
const LEGACY_DEFAULT_ROOM = { gamenight: 'Lobby' };
const PROFILE_SEEDS = BOTS.map(b => { const p = b.photoIndex !== undefined ? [b.displayName,b.location,b.interests,b.bio] : b.silent ? [b.name, '', '', ''] : PERSONA[b.id]; if (!p) throw new Error('bots.js: missing persona for ' + b.id);
  return { id: b.id, name: b.name, display_name: p[0], location: p[1], interests: p[2], bio: p[3], avatar_key: b.avatar_key || '', replacedProfile: b.replacedProfile, photoIndex:b.photoIndex, room: b.room, silent: !!b.silent, interactive: !!b.interactive, lang: b.lang, legacy: b.legacy || [] }; });
const byId = id => BOTS.find(b => b.id === String(id || '').toLowerCase());
const byAlias = h => { h = String(h || '').toLowerCase(); return BOTS.find(b => b.interactive && (b.aliases || []).includes(h)) || BOTS.find(b => b.name.toLowerCase() === h); };
// Short names count when they are used to address someone directly.
function roomAddress(bots, message, people = []) {
  const normalize = value => String(value).trim().toLowerCase().replace(/[_\s]+/g, ' ');
  const text = String(message).trim().toLowerCase();
  const mention = text.match(/@([a-z0-9_]+)/);
  if (mention) {
    const bot = byAlias(mention[1]);
    return bots.includes(bot) ? {bot, clean: text.replace(/@[a-z0-9_]+[,:]?\s*/g, '').trim()} : null;
  }

  const leading = text.match(/^(?:(hi|hey|hello|yo)\s+)?([a-z0-9_]+)(?=$|[\s,:.!?])/);
  const trailing = text.match(/,\s*([a-z0-9_]+)[.!?]*$/);
  let alias, clean;
  if (leading) {
    const rest = text.slice(leading[0].length);
    if (leading[1] || !rest || /^[,:.!?]/.test(rest) ||
        /^\s+(?:hi|hey|hello|help|trivia|hint|score|top|roll|8ball|recommend)\b/.test(rest)) {
      alias = normalize(leading[2]);
      clean = [leading[1], rest.replace(/^[\s,:.!?]+/, '')].filter(Boolean).join(' ');
    }
  }
  if (!alias && trailing) {
    alias = normalize(trailing[1]);
    clean = text.slice(0, trailing.index).trim();
  }
  if (!alias || people.some(person => {
    const handle = normalize(person);
    return handle.startsWith(alias) || handle.split(' ').includes(alias);
  })) return null;

  const matches = bots.filter(bot => [bot.name, ...(bot.aliases || [])].some(value => normalize(value) === alias));
  return matches.length === 1 ? {bot: matches[0], clean} : null;
}
module.exports = { roomAddress, BOTS, byRoom, P, line, reply, greet, PROFILE_SEEDS, HOSTS, byId, byAlias, LEGACY_DEFAULT_DISPLAY, LEGACY_DEFAULT_BIO, LEGACY_DEFAULT_ROOM };
