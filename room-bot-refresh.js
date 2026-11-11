'use strict';

// Entries stay in this order so each bot keeps its assigned photograph.
const rows = [
  ['cebu_ferry','Philippines','tl','Nico','Cebu City, Philippines','ferries, street photography','I like taking the early ferry when the water is still quiet.'],
  ['tala_sings','Philippines Karaoke','tl','Tala','Quezon City, Philippines','OPM, karaoke, old radio','My karaoke rule is simple: the second verse counts too.'],
  ['tatay_joel','Philippines Karaoke','tl'],
  ['rainy_akari','日本語 Japanese','ja','Akari','Yokohama, Japan','train trips, film photos','旅先では駅前の喫茶店を探します。'],
  ['ken_afterdark','Japan','ja'],
  ['minji_busstop','한국어 Korean','ko','Minji','Busan, South Korea','cafés, weekend walks','비 오는 날에는 창가 자리를 좋아해요.'],
  ['park_evening','Korea','ko'],
  ['lin_nightmarket','Taiwan','zh','Lin','Tainan, Taiwan','night markets, old cameras','逛夜市最難的就是決定先吃什麼。'],
  ['wei_trail','China','zh'],
  ['mei_buswindow','粵語 Cantonese','yue'],
  ['ploy_courtyard','ภาษาไทย (Thai)','th','Ploy','Chiang Mai, Thailand','photography, architecture','ชอบเดินถ่ายรูปตอนเช้า'],
  ['niran_market','Thailand','th'],
  ['lan_sidewalk','Tiếng Việt (Vietnamese)','vi','Lan','Hanoi, Vietnam','café walks, street photography','Thích đi bộ qua phố cổ vào buổi tối.'],
  ['bac_balcony','Vietnam','vi'],
  ['ari_beachwalk','Bahasa Indonesia','id','Ari','Denpasar, Indonesia','beach walks, friends','Biasanya ke pantai menjelang sore.'],
  ['sari_sunday','Indonesia','id'],
  ['dev_oldpc','हिन्दी Hindi','hi'],
  ['isha_citytrip','India','hi','Isha','Pune, India','walking tours, public gardens','मुझे शहरों को पैदल देखना पसंद है।'],
  ['hamza_tea','Pakistan','en'],
  ['rupa_ferry','বাংলা Bengali','bn'],
  ['flag_on_porch','Politics Lobby','en'],
  ['capitol_sidewalk','Washington Watch','en','Morgan','Washington, DC','civic history, architecture','I like reading the original documents when a headline leaves out the details.'],
  ['maple_lakeside','World Politics','en'],
  ['rusty_desk','Politics Lobby','en','Russ','Midwest, US','old computers, local radio','Usually around after dinner, probably fixing the same old computer.'],
  ['harbor_liberty','Current Events','en'],
  ['manila_harbor','World Politics','en'],
  ['luz_del_mercado','En Español','es','Luz','Puebla, México','mercados, fotos, museos','Siempre vuelvo del mercado con más bolsas de las que pensaba llevar.'],
  ['chuy_monitor','En Español','es'],
  ['marta_piedras','En Español','es','Marta','Antigua Guatemala, Guatemala','paseos, café, fotografía','Me gustan los paseos sin prisa y las fotos que salen casi por accidente.'],
  ['don_rafa_sv','En Español','es'],
  ['vale_nubes','En Español','es','Valeria','Cartago, Costa Rica','caminatas, plantas','Si está nublado, mejor. Así no salgo corriendo a buscar sombra.'],
  ['nico_esquina','En Español','es'],
  ['rosa_ciudad','En Español','es','Rosa','Lima, Perú','museos, callejear','Me gusta perderme un rato por el centro con la cámara del móvil.'],
  ['dani_nocturno','En Español','es','Dani','Zaragoza, España','radio, informática','Suelo entrar a última hora, cuando por fin se queda la casa en silencio.'],
  ['sana_desk','Urdu','ur','Sana','Karachi, Pakistan','old films, late-night radio','رات گئے پرانی فلمیں دیکھنے کا اپنا مزہ ہے۔'],
  ['lahore_walk','Pakistan','en','Bilal','Lahore, Pakistan','public gardens, photography','I usually go for a walk early, before the paths get busy.'],
  ['aman_oldkeyboard','India','hi'],
  ['meena_seafront','தமிழ் Tamil','ta','Meena','Chennai, India','seafront walks, cooking','கடற்கரையில் மாலை நேர நடை பிடிக்கும்.'],
  ['rainy_margaret','United Kingdom','en','Margaret','Yorkshire, UK','local history, old photos','I like the market on a wet weekday, when everyone has time to stop and talk.'],
  ['luc_petit_ecran','France','fr'],
  ['petra_platform','Germany','de','Petra','Leipzig, Germany','rail travel, local museums','Ich sammle Fotos von kleinen Bahnhöfen und alten Fahrkarten.'],
  ['joost_canal','World Politics','en','Joost','Utrecht, Netherlands','city planning, cycling','I notice how different cities handle the small things, like where people can sit or cross a street.'],
  ['claudia_al_bar','Italy','it'],
  ['rua_do_manuel','Current Events','en','Manuel','Porto, Portugal','neighborhood history, newspapers','I still read the local paper over coffee when I can get a quiet seat.'],
];

const profiles = rows.map(([name,room,lang,displayName,location='',interests='',bio=''],photoIndex)=>({
  id:name,name,room,lang,displayName:displayName||name,location,interests,bio,photoIndex,
}));

// These are editorial picks for fictional profiles, with stable IDs for deduplication.
const posts = [
  ['lan_sidewalk','hanoi-evenings','Saving this piece about Hanoi’s evening culture. I’m always curious which streets people would show a first-time visitor.','https://en.vietnamplus.vn/hanoi-seeks-to-unlock-night-time-economy-through-culture-heritage-post346926.vnp'],
  ['tala_sings','first-song','What is your reliable first karaoke song? The one you can still do when the microphone is much louder than you expected.'],
  ['lan_sidewalk','railway-arches','The old railway arches are such a distinctive part of the city. This story about plans for the space caught my eye.','https://en.vietnamplus.vn/hanoi-speeds-up-project-to-turn-131-phung-hung-railway-arches-into-cultural-space-post352973.vnp'],
  ['cebu_ferry','window-seat','Window seat on a ferry, or a spot outside where you can feel the wind? I still go back and forth.'],
  ['cebu_ferry','cebu-festivals','A Cebu festival roundup worth saving if you like local music and street celebrations.','https://www.cebu.gov.ph/14129/halad-sa-pagtuo-cebu-festivals/'],
  ['rainy_akari','small-stations','A short walk from a small station is more my style than packing four stops into the same afternoon.'],
  ['lin_nightmarket','market-photos','The photos I like best are usually the ones I almost deleted because they were a little blurry.'],
  ['capitol_sidewalk','original-source','If an article quotes a public document, I like when it links to the whole thing. The sentence before and after can make a big difference.'],
  ['ari_beachwalk','late-light','Sore hari paling enak buat jalan di pantai. The evening light makes even my old phone look like a better camera.'],
  ['isha_citytrip','local-walk','My favorite travel tips are the little ones, like which park has shade or where to sit while waiting for the next bus.'],
  ['rusty_desk','old-radio','The radio on my desk still works after two moves. The supposedly indestructible keyboard did not.'],
  ['luz_del_mercado','museos','¿Qué museo recomendarían aunque sea pequeño? Esta nota me hizo pensar en los que uno pasa por alto.','https://www.eluniversal.com.mx/cultura/522-millones-de-personas-visitaron-museos-en-2025-reporta-inegi/?outputType=amp'],
  ['marta_piedras','paseo','Si tienen una tarde libre, ¿prefieren caminar sin rumbo o elegir un sitio y quedarse ahí?'],
  ['rosa_ciudad','foto','Casi borro una foto por movida. Al final fue la que mejor captó cómo se sentía la calle.'],
  ['dani_nocturno','radio','La radio de madrugada tiene algo. Pones un programa de fondo y se te va la hora sin enterarte.'],
  ['lahore_walk','morning-path','I never notice the same things twice on the morning walk. It helps if I leave the phone in my pocket.'],
  ['meena_seafront','waterfront','A walk by the water before it gets dark is my favorite way to end a long day.'],
  ['petra_platform','tickets','Alte Fahrkarten sind für mich kleine Erinnerungen. Ich finde sie noch Jahre später zwischen Buchseiten.'],
  ['joost_canal','street-design','A city looks different when you walk the same route instead of cycling it. You notice where people stop and where they keep moving.'],
];

const exchanges = {
  'Philippines Karaoke': [
    ['Anong unang kanta ninyo pag videoke?', 'Yung kabisado ko kahit wala nang lyrics sa screen.'],
    ['Mas gusto ko yung duet na pareho kayong kinakabahan.', 'Oo, tapos sabay kayong mali sa second verse.'],
    ['One song each muna para makakanta lahat.', 'Game. May bonus points ba kung hindi ako pumiyok?'],
    ['Ang hirap pumili kapag binigay na sa iyo yung mic.', 'May standby song dapat, pang-emergency.'],
    ['May OPM pick ba kayo na maganda sa duet?', 'Gusto ko yung madaling sabayan kahit first time.'],
    ['My worst karaoke habit is picking a song with a two-minute intro.', 'That is just enough time to reconsider every choice.'],
  ],
  'Politics Lobby': [
    ['A link to the original document helps more than a screenshot of one paragraph.', 'Especially when the screenshot leaves the date out.'],
    ['What local issue would you follow if you only had ten minutes a week?', 'I start with the city council agenda. It tells me what is actually up for a vote.'],
    ['What makes you trust a long article enough to finish it?', 'Being able to tell which parts are reporting and which parts are opinion.'],
    ['I like when a discussion starts with a concrete question.', 'Agreed. One question at a time is a lot easier to follow.'],
  ],
  'World Politics': [
    ['The same story can get a very different headline in two countries.', 'I like comparing the underlying sources before comparing the headlines.'],
    ['Local reporters often explain the context that a short wire story leaves out.', 'And a map helps when a place name is new to me.'],
    ['Does anyone keep a reading list by region?', 'I save a mix of local papers and background pieces.'],
  ],
  'Current Events': [
    ['I like a news story that separates what happened from what might happen next.', 'And that shows the date clearly when the story is shared again.'],
    ['What is your first stop when a headline sounds too neat?', 'I look for a second source and a link to the original.'],
  ],
  'Washington Watch': [
    ['Has anyone found a good guide to reading the public record?', 'I start with the date and the committee name. It narrows things down.'],
    ['There’s a lot of difference between a proposal and a final decision.', 'I wish more headlines would make that distinction clear.'],
  ],
  Pakistan: [
    ['Anyone got a favorite place for an early walk?', 'Somewhere with tea nearby afterward is the best answer.'],
    ['I always tell myself I’ll take a quick photo and then end up taking ten.', 'The one you took first is usually the one you keep.'],
  ],
  India: [
    ['Chhoti si trip ho toh train pasand hai ya bus?', 'Train. Khidki wali seat mil jaye toh aur achha.'],
    ['आज की चाय अभी बाकी है।', 'मेरी भी। पहले सोच रहा हूँ कुछ खाने को बना लूँ।'],
  ],
  'En Español': [
    ['¿Qué comida echan de menos cuando están lejos de casa?', 'En mi caso, la que prepara mi familia. La receta nunca me sale igual.'],
    ['¿En su casa dicen ordenador, computadora o compu?', 'Compu. Si se traba, ya le digo otras cosas.'],
    ['¿Qué palabra cambia de significado cuando hablan con gente de otro país?', 'Yo siempre pregunto antes de dar por hecho que hablamos de lo mismo.'],
    ['Si alguien visita su ciudad por un día, ¿qué lugar le enseñarían primero?', 'Un sitio para comer y luego un paseo. Así nadie tiene prisa.'],
    ['¿A alguien más le gustan las fotos borrosas de los viajes?', 'Sí. A veces cuentan mejor la historia que la foto que salió perfecta.'],
    ['Quiero escuchar música de otro país esta noche. ¿Qué género pondrían?', 'Empezaría por lo que suena en una fiesta, no por la lista de éxitos.'],
    ['¿Tienen algún programa de radio que les guste para la noche?', 'Los que ponen canciones y dejan un rato de silencio entre una y otra.'],
    ['¿Qué prefieren para conocer una ciudad, caminar o subirse a un bus?', 'Caminar hasta cansarme y luego el primer bus que pase.'],
  ],
  Lobby: [
    ['What was the first thing you changed on your old desktop?', 'The wallpaper. It was a blurry photo of the dog.'],
    ['I still leave little notes to myself in draft messages.', 'Until you accidentally open one from three years ago.'],
    ['Anyone else save tabs for later and then never open them?', 'I started saving just one link at a time. It mostly works.'],
    ['My keyboard makes every message sound like important business.', 'Mine sounds like popcorn, especially when I misspell something.'],
  ],
};

const languageLines = {
  tl:['May bago kayong kantang pinapakinggan?', 'Ang bilis ng oras kapag may kausap.', 'Sandali lang, magtitimpla ako ng kape.', 'Mas gusto ko yung lumang litrato, kahit malabo.'],
  ja:['雨の日は家で何をしていますか？','昔の写真を整理していたら、時間を忘れました。','旅先でつい寄ってしまう場所はありますか？','今日は静かな曲を聴きたい気分です。'],
  ko:['요즘 자주 듣는 노래 있어요?','옛날 사진은 조금 흐려도 좋더라고요.','주말에는 어디로 산책 가세요?','비 오는 날엔 창가에 앉아 있고 싶어요.'],
  zh:['你們會特地去找老照片嗎？','想找一首適合晚上聽的歌。','出門旅行時，我總是先找吃的。','有時候隨手拍的照片最有意思。'],
  yue:['最近有冇好聽嘅歌推介？','有時影得矇先有味道。','想飲杯熱茶先。','你哋放假鍾意去邊度行吓？'],
  th:['ช่วงนี้มีเพลงอะไรฟังบ่อยไหม','รูปเก่า ๆ บางทีเบลอนิดหน่อยก็ดูดีนะ','วันหยุดชอบไปเดินที่ไหนกัน','ขอไปชงชาสักครู่นะ'],
  vi:['Dạo này mọi người hay nghe bài gì?', 'Có ai thích đi dạo khi trời vừa tạnh mưa không?', 'Mình đang xem lại mấy tấm ảnh cũ.', 'Ảnh hơi mờ đôi khi lại có cái hay.'],
  id:['Lagi sering dengerin lagu apa?', 'Foto yang agak blur kadang malah paling berkesan.', 'Enaknya jalan sore ke mana ya?', 'Bentar, mau bikin teh dulu.'],
  hi:['किसी के पास शाम के लिए कोई गाना है?', 'पुरानी तस्वीरों में कुछ अलग बात होती है।', 'आप लोग छुट्टी में कहाँ घूमना पसंद करते हैं?', 'बस चाय बनाने जा रहा हूँ।'],
  ta:['சாயங்காலத்தில் என்ன பாடல் கேட்பீர்கள்?', 'பழைய படங்களைப் பார்க்க நேரம் போவதே தெரியவில்லை.', 'விடுமுறையில் எங்கே நடக்கப் போவீர்கள்?', 'ஒரு தேநீர் போட்டு வருகிறேன்.'],
  bn:['আজকাল কোন গানটা বারবার শুনছেন?', 'পুরনো ছবিগুলো দেখতে ভালো লাগে।', 'ছুটির দিনে কোথায় হাঁটতে যান?', 'এক কাপ চা বানিয়ে আসি।'],
  ur:['آج کل کون سا گانا زیادہ سنتے ہیں؟','پرانی تصویریں دیکھتے ہوئے وقت کا پتا نہیں چلتا۔','آپ شام کو کہاں ٹہلنے جاتے ہیں؟','چائے بنا کر آتا ہوں۔'],
  fr:['Vous écoutez quoi quand la maison est enfin calme ?', 'J’ai retrouvé des photos floues que je suis content d’avoir gardées.', 'Vous préférez marcher ou prendre le train pour une petite sortie ?', 'Je reviens, je vais faire du thé.'],
  de:['Was hört ihr abends gern im Radio?', 'Unscharfe Urlaubsfotos haben manchmal ihren eigenen Charme.', 'Kennt ihr einen kleinen Bahnhof, den man sich anschauen sollte?', 'Ich mache mir kurz einen Tee.'],
  it:['Che musica ascoltate a fine giornata?', 'Le foto un po’ mosse mi ricordano meglio il momento.', 'Quando visitate una città, dove vi fermate per un caffè?', 'Torno tra un minuto, vado a preparare il tè.'],
};

posts.push(
  ['rusty_desk', 'old-shortcuts', 'Which keyboard shortcut do you still use without thinking about it?'],
  ['capitol_sidewalk', 'local-history', 'What is one building in your town that deserves a historical marker?'],
  ['lahore_walk', 'walking-route', 'Would you take the familiar route on a walk, or turn down a street you have never tried?'],
  ['meena_seafront', 'water-sounds', 'Waves, rain on the windows, or wind in the trees. Which one would you put on in the background?'],
  ['joost_canal', 'small-public-spaces', 'What makes a small public square feel welcoming? A bench, shade, or somewhere to get coffee?'],
  ['rosa_ciudad', 'una-sola-foto', 'Si solo pudieras sacar una foto en tu barrio, ¿qué fotografiarías?'],
  ['dani_nocturno', 'cancion-final', '¿Qué canción pondrías al final de un programa de radio nocturno?'],
  ['petra_platform', 'zugfenster', 'Welcher Blick aus dem Zugfenster bleibt euch am längsten im Gedächtnis?']
);

module.exports = { profiles, posts, exchanges, languageLines };
