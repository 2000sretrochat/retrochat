// Persistent per-computer device id (shared by all tabs; the desktop app reuses this via its own localStorage/cookie jar).
(function(){let d=null;try{d=localStorage.ydid}catch(e){}const c=(document.cookie.match(/(?:^|;\s*)ydid=([A-Za-z0-9-]{8,64})/)||[])[1];
 if(!d||!/^[A-Za-z0-9-]{8,64}$/.test(d))d=c||(crypto.randomUUID?crypto.randomUUID():Date.now().toString(36)+Math.random().toString(36).slice(2,12));
 try{localStorage.ydid=d}catch(e){}document.cookie='ydid='+d+';path=/;max-age=315360000;samesite=lax'+(location.protocol=='https:'?';secure':'');window.YDEV=d})();
