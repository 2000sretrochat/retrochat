// Idle ambience bots: per-room screen names + harmless small-talk lines in each room's language.
// Bots never answer IMs, don't count against IP/session limits, and are toggled in Master Control.
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
for (const b of BOTS) b.av = '';
const COLS = ['#000080', '#8b0000', '#006400', '#4b0082', '#b8860b', '#008080', '#c71585'], FNTS = ['Arial', 'Verdana', 'Comic Sans MS', 'Tahoma'];
BOTS.forEach((b, i) => { b.color = COLS[i % COLS.length]; b.font = FNTS[(i * 3) % FNTS.length]; });
// extra English variety: templates with fill-ins so lines don't repeat as often
const EN2 = ['just got back from {place}', 'anyone here into {thing}?', 'omg {thing} is the best', 'listening to {song} rn', 'what is everyone eating tonight? im having {food}', 'rate my away msg: "{away}"', 'who else is from {city}?', '{greet} everyone', 'cant believe its already {time}', 'my mom keeps yelling at me to get off the computer lol', 'brb phone', 'a/s/l? jk jk', 'i need a new screen name ideas pls', 'its raining here, perfect chat weather', 'anyone want to trade buddy icons', 'lmao', 'hahaha same', 'ok im back', 'thats so random', 'i love this room', 'who has a webcam on?', 'turn up the music!!', 'whats the best movie ever? i say {movie}', 'gonna make some {food} brb', 'quiz time: favorite cereal?', 'sooo sleepy', 'this chat is my fav place on the internet', 'happy {day} everybody!'];
const FILL = { place: ['the mall', 'school', 'work', 'the gym', 'blockbuster', 'my cousins house'], thing: ['tamagotchis', 'skateboarding', 'the sims', 'pokemon', 'harry potter', 'nsync', 'gel pens', 'myspace layouts'], song: ['Hey Ya', 'Mr. Brightside', 'Toxic', 'In Da Club', 'Complicated', 'Yellow', 'Bye Bye Bye'], food: ['pizza rolls', 'mac n cheese', 'tacos', 'ramen', 'hot pockets', 'cereal'], away: ['out livin la vida loca', 'brb, dont touch my stuff', 'gone to the movies ~*~', 'sleeping... or am i'], city: ['NYC', 'LA', 'Chicago', 'Texas', 'Florida', 'Phoenix', 'Seattle', 'Atlanta'], greet: ['heyyy', 'hi', 'sup', 'hello hello', 'yo'], time: ['this late', 'friday', 'november', 'the weekend'], movie: ['Mean Girls', 'The Matrix', 'Titanic', 'Napoleon Dynamite', 'Shrek'], day: ['monday', 'friday', 'weekend'] };
const pick = a => a[Math.floor(Math.random() * a.length)];
function line(b, room, last) { for (let k = 0; k < 4; k++) { const L = P[b.lang] || P.en; let t = b.lang === 'en' && Math.random() < 0.6 ? pick(EN2).replace(/\{(\w+)\}/g, (_, f) => pick(FILL[f] || [''])) : pick(L); if (t !== last) return t; } return pick(P[b.lang] || P.en); }
const RE = { en: ['lol {n}', 'haha true', 'omg same {n}', 'no way!', 'for real?', 'agreed', '{n} ur funny', 'lmao', 'totally', 'hmm idk about that'], es: ['jaja {n}', 'sí, verdad', '¡qué bueno!'], ru: ['ха-ха {n}', 'точно'] };
function reply(b, n) { const L = RE[b.lang]; return L ? pick(L).replace('{n}', n) : line(b); }
function greet(b, n) { const G = { en: ['hey {n}!', 'hi {n} :)', 'welcome {n}', 'sup {n}', 'heyyy {n} whats up'], es: ['¡Hola {n}!'], ru: ['Привет, {n}!'], ja: ['{n}さん、こんにちは！'], ko: ['{n}님 안녕하세요!'], zh: ['{n} 你好！'] }; return pick(G[b.lang] || ['hi {n} :)']).replace('{n}', n); }
const byRoom = {}; for (const b of BOTS) (byRoom[b.room] = byRoom[b.room] || []).push(b);
module.exports = { BOTS, byRoom, P, line, reply, greet };
