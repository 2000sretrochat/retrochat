// Classic Yahoo! Chat directory as a tree: category -> subfolders -> rooms (modeled on the original chat.yahoo.com list).
// A node is either an array of rooms or an object of { subfolder: node }; an object's '' key holds rooms at that level.
// Rooms in ADULT_ROOMS are rated R (18+). Room names must be unique across the whole directory.
const DIR_TREE = {
  'Business & Finance': { 'Investing': ['Asian Markets', 'Bond Market', 'Stock Watch', 'FinanceVision', 'Real Estate'], 'Business & Careers': ['Career Development', 'Small & Medium Business', 'Work From Home', 'Biotechnology'] },
  'Computers & Internet': { 'Operating Systems': ['Windows', 'Macintosh', 'Linux, FreeBSD, Solaris'], 'Internet & Web': ['Surfing the Web', 'Web Design', 'Auctions Chat'], 'General': ['Computers Lobby', 'Electronics', "Hacker's Lounge", 'Programming', 'Chat Help'] },
  'Cultures & Community': {
    'General': ['Lobby', 'Friends', 'Chit Chat', 'Late Night', 'The Lounge', 'Advice Central', 'Cultures and Community Lobby', 'Holiday Happenings'],
    'Hangouts': ['Chat Central', "Jerry's Diner", 'The Hot Tub', 'The Ranch', 'The Tiki Lounge'],
    'Countries & Cultures': { 'Africa & Caribbean': ['African-American Chat', 'Afro-Caribbean'], 'Asia': ['Asian American Chat', 'Asian Chat', 'Korean Chat', 'Philippines Karaoke'], 'Middle East': ['Arab American Chat', 'Arab Chat', 'Persian Chat'], 'Americas': ['Hispanic and Latino Chat', 'Indigenous Peoples', 'Native American Chat'] },
    'Groups': ["30's", "40's", "50's", 'Seniors 60+', 'Older and Wiser', 'Generation X', 'Disabled Chat', 'Special Needs Families', 'Expats Everywhere', 'Geek and Proud', 'Ravers and Clubbers', 'The Graveyard', "Women's Room"],
    'Crime': ['Crime Fighters', 'Police and Fire'], 'Food & Drink': ['Beer Lovers', 'The Kitchen', 'Wine Lovers'], 'Issues & Causes': ['Breaking News', 'Race Relations'],
  },
  'Entertainment & Arts': { 'Arts & Culture': ['Art Chat', 'Body Art', 'Books & Literature', 'Poetry Corner', 'Broadway', 'The Comic Shop', 'The Darkroom', 'Fashion', 'Models'], 'Celebrities': ['Actors & Actresses', 'Celebrity Scoop', 'Entertainment Lobby', 'Trivia Madness', 'Amusement & Theme Parks', 'Japanese Anime'],
    'Movies': ['Movies', 'Bollywood', 'Star Wars', 'Lord of the Rings'], 'Television': ['TV Lobby', 'American Idol', 'Sci-fi & Fantasy TV', 'The Simpsons', 'Soap Operas', 'Survivor', 'Reality TV', 'Late Night TV'] },
  'Family & Home': { 'Family': ['Parenting', 'Moms', 'Dads', 'Adoption', 'Genealogy', 'Weddings'], 'Home': ['Do-It-Yourself', 'Home & Gardening'] },
  'Games': { 'Video Games': ['Computer Games', 'Multiplayer Net Games', 'PlayStation', 'Xbox', 'Nintendo', 'Fighter Arena'], 'Tabletop': ['Board Games', 'Card Games', 'Role Playing Games', 'Game Room'] },
  'Government & Politics': { 'Politics': ['Politics Lobby', 'Washington Watch', 'World Politics', 'Current Events'], 'Issues': ['The Death Penalty', 'The Abortion Debate', 'Law & Courts'], 'Military': ['Military Room'] },
  'Health & Wellness': { 'Support & Recovery': ['Support and Recovery', 'Friends of Bill W', 'NA Chat and Fellowship', 'Depression Support', 'ADD Support', 'Quit Smoking'], 'Conditions': ['Back Chat', 'Cancer Chat', 'Diabetes', 'HIV/AIDS', 'Scoliosis Chat', 'Infertility Support', 'Pregnancy'], 'Fitness & Wellness': ['Health Tips', 'Alternative Medicine', 'Weight Loss', 'Yoga'] },
  'Hobbies & Crafts': { 'Crafts & Collecting': ["Collector's Corner", 'General Crafts', 'Hobby Lobby', 'Model Builders', 'Textiles', 'Photography'], 'Automotive': ['Automotive', 'Car Audio', 'Classic Cars', 'Import Cars', 'Lowriders', 'Motorcycles', 'Muscle Cars', 'RV Park', 'SUVs, Trucks, and Vans'] },
  'Languages': {
    'Asian': ['中文 Chinese (Mandarin)', '粵語 Cantonese', '日本語 Japanese', '한국어 Korean', 'Tagalog', 'Tiếng Việt (Vietnamese)', 'ภาษาไทย (Thai)', 'Bahasa Indonesia', 'Bahasa Melayu'],
    'Indian & South Asian': ['हिन्दी Hindi', 'தமிழ் Tamil', 'తెలుగు Telugu', 'ਪੰਜਾਬੀ Punjabi', 'বাংলা Bengali', 'Gujarati', 'Marathi', 'Urdu', 'Nepali'],
    'European': ['Auf Deutsch', 'En Español', 'En Français', 'In Italiano', 'Em Português', 'Русский (Russian)', 'Polski', 'Nederlands', 'Ελληνικά (Greek)', 'Türkçe'],
    'Middle Eastern': ['العربية Arabic', 'עברית (Hebrew)', 'Farsi'],
  },
  'Music': { 'Rock & Alternative': ['Rock', 'Alternative', 'Metal', "Punk'n Ska'n Thrash", 'Oldies', '80s Music'], 'Pop & Dance': ['Pop', 'Boy Band Chat', 'Electronica', 'Groovespace', 'Latin Music', 'Karaoke'], 'Hip Hop & Soul': ['Rap & Hip Hop', 'Soul and R&B'], 'Classic Sounds': ['Classical', 'Country', 'Jazz', 'Blues'], 'General': ['Music Lobby'] },
  'Recreation & Sports': {
    'General': ['Recreation and Sports Lobby', 'The Casino', 'The Hangar', 'The Toy Box', "Traveler's Room", 'Sailing', 'Runners Room', 'Hanging Ten'],
    'Sports': { '': ['The Locker Room', 'Sports Trivia', 'The Olympic Games', 'College Sports', 'Extreme Sports'], 'Football (American)': ['NFL Football', 'College Football', 'Fantasy Football', 'CFL'], 'Baseball': ['MLB', 'College Baseball', 'Fantasy Baseball'], 'Basketball': ['NBA'], 'Hockey': ['NHL', 'Minor League Hockey'],
      'Soccer & Rugby': ['Soccer', 'UK Football'], 'Combat Sports': ['Wrestling', 'Boxing & MMA', 'In The Ring'], 'Racing': ['Auto Racing'], 'Other Sports': ['Cricket', 'Curling', 'Golf', 'Tennis'] },
  },
  'Regional': ['Regional Lobby', 'United States', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Venezuela', 'Cuba', 'Puerto Rico', 'Jamaica', 'United Kingdom', 'Ireland', 'France', 'Germany', 'Italy', 'Spain', 'Portugal', 'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Denmark', 'Norway', 'Sweden', 'Finland', 'Poland', 'Greece', 'Russia', 'Ukraine', 'Turkey', 'Israel', 'Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Iran', 'Iraq', 'Lebanon', 'Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Ethiopia', 'Morocco', 'India', 'Pakistan', 'Bangladesh', 'Sri Lanka', 'Nepal', 'China', 'Taiwan', 'Japan', 'Korea', 'Philippines', 'Vietnam', 'Thailand', 'Indonesia', 'Malaysia', 'Singapore', 'Brunei', 'East Timor', 'Australia', 'New Zealand'],
  'Religion & Beliefs': { 'Christianity': ['Christian Chat', 'Catholic Chat', 'Bible Study'], 'World Religions': ['Buddhism Chat', 'Hinduism', 'Islam Chat', 'Jewish Chat', 'Sikhism'], 'Spirituality': ['Spirituality', 'Paganism', 'Astrology', 'Religion', 'Atheism & Agnosticism'] },
  'Romance': { 'By Age': ["20's Love", "30's Love", "40's Love", "50's Love", "60's Love"], 'Singles & Dating': ['Romance', 'Singles', 'Single Parents', 'Flirting', 'Pickup Bar', 'Disco Inferno', 'Moonlight Way', 'Love Stinks', 'Asian Connections', 'Interracial Dating', 'BBW and Admirers'], 'Adult (18+)': ['Married & Flirting', 'Adult Romance'] },
  'Schools & Education': ["Professors' Chat", 'Study Group', 'The University Years', 'Homework Help', 'High School', 'Teachers', 'Violence in Schools'],
  'Science': { 'Science': ['Beyond Planet Earth', 'Biology', 'Physics', 'Chemistry', 'Astronomy', 'Extraterrestrial Life', 'Paranormal'], 'Animals & Pets': ['Cat Chat', 'Dog Chat', 'Pets'] },
};
const DIR = {}, PATH = {};
for (const [c, n] of Object.entries(DIR_TREE)) (function walk(node, path) { if (Array.isArray(node)) { for (const r of node) { (DIR[c] = DIR[c] || []).push(r); PATH[r] = path; } return; } for (const [k, v] of Object.entries(node)) walk(v, k ? [...path, k] : path); })(n, []);
const ADULT_ROOMS = new Set(['Married & Flirting', 'Adult Romance']);
const CAT_ORDER = [...Object.keys(DIR)];
{ const all = Object.values(DIR).flat(); if (new Set(all).size !== all.length) throw new Error('duplicate room in rooms-dir: ' + all.filter((r, i) => all.indexOf(r) !== i)); }
module.exports = { DIR, PATH, ADULT_ROOMS, CAT_ORDER };
