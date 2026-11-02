// Classic Yahoo! Chat style directory: category -> rooms. Rooms in ADULT_ROOMS are rated R (18+).
const DIR = {
  'Business & Finance': ['Business', 'Investing', 'Stocks & Trading', 'Real Estate', 'Entrepreneurs', 'Jobs & Careers', 'Work From Home'],
  'Computers & Internet': ['Computer Help', 'Programming', 'Linux', 'Mac Users', 'Windows', 'Web Design', 'Gaming PCs', 'Internet Chat'],
  'Cultures & Community': ['Lobby', 'Friends', 'Chit Chat', 'Late Night', 'Teens', '20s', '30s', '40s', '50s & Over', 'Seniors', 'African American', 'Asian Pacific', 'Latino', 'LGBT Friends', 'Military Families', 'Native American'],
  'Entertainment & Arts': ['Movies', 'TV Shows', 'Soap Operas', 'Reality TV', 'Celebrities', 'Books', 'Poetry', 'Anime & Manga', 'Comics', 'Writers'],
  'Family & Home': ['Parenting', 'Moms', 'Dads', 'Single Parents', 'Pets', 'Cooking', 'Home & Garden', 'Weddings'],
  'Government & Politics': ['Politics', 'Current Events', 'Debate', 'Military', 'Law'],
  'Health & Wellness': ['Fitness', 'Weight Loss', 'Recovery', 'Support Groups', 'Diabetes', 'Mental Health', 'Nutrition'],
  'Hobbies & Crafts': ['Crafts', 'Collecting', 'Photography', 'Cars & Trucks', 'Motorcycles', 'Genealogy', 'Gardening', 'Trivia', 'Games'],
  'Music': ['Rock', 'Alternative', 'Hip Hop', 'R&B & Soul', 'Pop', 'Country', 'Jazz', 'Blues', 'Heavy Metal', 'Classical', 'Oldies', '80s Music', 'Dance & Electronic', 'Latin Music', 'Karaoke'],
  'Recreation & Sports': ['Football', 'Baseball', 'Basketball', 'Hockey', 'Soccer', 'Wrestling', 'Boxing & MMA', 'Golf', 'Auto Racing', 'Fantasy Sports', 'Outdoors', 'Travel'],
  'Regional': ['Arizona', 'California', 'Texas', 'New York', 'Florida', 'Midwest', 'Southern USA', 'Canada', 'United Kingdom', 'Australia', 'Philippines', 'India', 'Mexico', 'Europe', 'Russia', 'Middle East'],
  'Religion & Beliefs': ['Christian', 'Bible Study', 'Catholic', 'Islam', 'Judaism', 'Spirituality', 'Paganism', 'Atheism & Agnosticism'],
  'Romance': ['Romance', 'Singles', 'Love & Relationships', 'Single & Looking', 'Married & Flirting', 'Adult Romance'],
  'Schools & Education': ['Homework Help', 'High School', 'College Life', 'Teachers', 'Languages', 'Study Hall'],
  'Science': ['Astronomy', 'Biology', 'Physics', 'Chemistry', 'Paranormal', 'Space'],
};
const ADULT_ROOMS = new Set(['Married & Flirting', 'Adult Romance']);
const CAT_ORDER = [...Object.keys(DIR), 'User Rooms'];
module.exports = { DIR, ADULT_ROOMS, CAT_ORDER };
