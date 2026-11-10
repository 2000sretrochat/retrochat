(() => {
  const win=document.getElementById('mwin');
  if(!win || parent!==window || window.YD)return;
  document.documentElement.classList.add('standalone-messenger');
  const key='razzleMessengerWidth';
  let saved=400;
  try{saved=Number(localStorage.getItem(key)) || 400;}catch{}
  win.style.setProperty('--messenger-width',Math.max(340,saved)+'px');
  // Native CSS resizing writes an inline width. Capture it without changing viewport-sized phone layouts.
  const observer=new MutationObserver(() => {
    const width=parseFloat(win.style.width);
    if(!Number.isFinite(width))return;
    const next=Math.max(340,width)+'px';
    if(win.style.getPropertyValue('--messenger-resized-width')===next)return;
    win.style.setProperty('--messenger-resized-width',next);
    try{localStorage.setItem(key,String(Math.max(340,width)));}catch{}
  });
  observer.observe(win,{attributes:true,attributeFilter:['style']});
})();
