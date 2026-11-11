(function(root){
  'use strict';
  const groups={
    'Chat & community':['Chat Rooms','Voice Chat','Webcam Chat','Late Night','Retro Chat','Karaoke','Trivia','Debates','Language Exchange','Making Friends','Music Rooms','Current Events','Politics'],
    'Music & entertainment':['Music','Live Music','Rock','Heavy Metal','Pop Music','Hip Hop','Country Music','Jazz','Classical Music','Electronic Music','Movies','TV','Anime','Comedy','Podcasts','Gaming','Board Games','Dancing','Singing'],
    'Life & hobbies':['Travel','Photography','Books','Writing','Art','Crafts','DIY','Cooking','Baking','Coffee','Food','Gardening','Pets','Dogs','Cats','Family','Volunteering','Education','Spirituality','Fashion','Collecting'],
    'Outdoors & discovery':['Nature','Hiking','Camping','Fishing','Cycling','Fitness','Sports','Football','Soccer','Basketball','Swimming','Cars','Motorcycles','Technology','Science','Astronomy','History','Languages','Geography']
  };
  const choices=Object.values(groups).flat(),known=new Map(choices.map(x=>[x.toLowerCase(),x]));
  function clean(value){
    const raw=Array.isArray(value)?value:typeof value==='string'?value.split(','):[];
    if(raw.length>30)throw Error('Choose up to 30 interests.');
    return [...new Set(raw.map(item=>{
      if(typeof item!=='string')throw Error('Enter a valid interest.');
      const s=item.normalize('NFKC').trim().replace(/\s+/g,' ');
      if(!s)return '';
      if(known.has(s.toLowerCase()))return known.get(s.toLowerCase());
      if(s.length>40||s.split(' ').length>2||!/^[\p{L}\p{M}]+(?:[ '-][\p{L}\p{M}]+)*$/u.test(s))throw Error('Custom interests must be one or two words, using letters.');
      const folded=s.toLowerCase().normalize('NFD').replace(/\p{M}/gu,'');
      const compact=folded.replace(/[^a-z]/g,'');
      const vulgar=/\b(sex(?:ual|y|ting)?|porn(?:ography)?|fuck\w*|shit\w*|bitch\w*|asshole\w*|cunt\w*|cock\w*|dick\w*|pussy|nude\w*|naked|fetish\w*|hentai|blowjob\w*|handjob\w*|masturb\w*|orgasm\w*|erotic\w*|nsfw|xxx)\b/i;
      if(vulgar.test(folded)||vulgar.test(compact))throw Error('Please choose an interest without sexual or vulgar wording.');
      return s;
    }).filter(Boolean))].join(', ');
  }
  function mount(input){
    if(!input||input.dataset.interestPicker)return;
    input.dataset.interestPicker='true';input.type='hidden';input.maxLength=1500;
    const label=input.closest('label');if(label)label.hidden=true;
    const box=document.createElement('section');box.className='razzle-interest-picker';
    const title=document.createElement('h3');title.textContent='Choose your interests';box.append(title);
    const selected=new Map(input.value.split(',').map(s=>s.trim()).filter(Boolean).map(s=>[s.toLowerCase(),s]));
    const chips=document.createElement('div');chips.className='interest-selected';box.append(chips);
    const error=document.createElement('p');error.className='interest-error';error.setAttribute('role','status');
    const buttons=[];
    function sync(){input.value=[...selected.values()].join(', ');chips.replaceChildren();
      for(const [key,value]of selected){const b=document.createElement('button');b.type='button';b.textContent=value+' ×';b.setAttribute('aria-label','Remove '+value);b.onclick=()=>{selected.delete(key);sync();};chips.append(b);}
      buttons.forEach(b=>b.setAttribute('aria-pressed',String(selected.has(b.textContent.toLowerCase()))));
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    function add(value){try{const next=clean([...selected.values(),value]);selected.clear();next.split(', ').filter(Boolean).forEach(s=>selected.set(s.toLowerCase(),s));error.textContent='';sync();return true;}catch(e){error.textContent=e.message;return false;}}
    for(const [name,items]of Object.entries(groups)){const details=document.createElement('details');details.open=name==='Chat & community';const summary=document.createElement('summary');summary.textContent=name;details.append(summary);const list=document.createElement('div');list.className='interest-pills';for(const value of items){const b=document.createElement('button');b.type='button';b.textContent=value;b.onclick=()=>{if(selected.has(value.toLowerCase())){selected.delete(value.toLowerCase());sync();}else add(value);};buttons.push(b);list.append(b);}details.append(list);box.append(details);}
    const custom=document.createElement('div');custom.className='interest-custom';const customLabel=document.createElement('label');customLabel.textContent='Custom interest · 1–2 words';const field=document.createElement('input');field.type='text';field.maxLength=40;field.placeholder='For example, Bird Watching';customLabel.append(field);const button=document.createElement('button');button.type='button';button.textContent='Add';const submit=()=>{if(field.value.trim()&&add(field.value))field.value='';};button.onclick=submit;field.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit();}};custom.append(customLabel,button);box.append(custom,error);(label||input).after(box);sync();
  }
  const api={groups,choices,clean,mount};if(typeof module==='object'&&module.exports)module.exports=api;else root.RazzleInterests=api;
})(typeof window==='object'?window:globalThis);
