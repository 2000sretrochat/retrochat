const LIVE_ROOM_DIRECTORY = 'https://retrochat-izzg.onrender.com/api/rooms';

const ENGLISH_ROOMS = new Set(["Lobby","Late Night","The Lounge","Friends","Chit Chat","Advice Central","Cultures and Community Lobby","Holiday Happenings"]);

async function liveRoomDirectory() {
  const response = await fetch(LIVE_ROOM_DIRECTORY, {
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) throw Error('Room directory unavailable');
  const rooms = await response.json();
  if (!Array.isArray(rooms)) throw Error('Invalid room directory');
  return rooms.filter(room => room && ['G', 'PG', 'PG-13'].includes(room.rating)
    && typeof room.name === 'string' && room.name.trim()
    && Number.isSafeInteger(room.count) && room.count >= 0).map(room => ({
      name: room.name,
      topic: typeof room.topic === 'string' ? room.topic : '',
      category: typeof room.cat === 'string' ? room.cat : '',
      icon: typeof room.icon === 'string' ? room.icon.slice(0, 24) : '',
      owner: typeof room.owner === 'string' ? room.owner : '',
      createdAt: typeof room.createdAt === 'string' ? room.createdAt : '',
      likes: Number.isSafeInteger(room.likes) && room.likes >= 0 ? room.likes : null,
      rating: room.rating,
      mics: Number.isSafeInteger(room.mics) ? room.mics : null,
      count: room.count,
      english: ENGLISH_ROOMS.has(room.name),
    })).sort((a, b) => Number(b.english) - Number(a.english) || b.count - a.count || a.name.localeCompare(b.name));
}

async function roomResponse(featuredOnly) {
  const headers = { 'Cache-Control': 'no-store' };
  try {
    const rooms = await liveRoomDirectory();
    const featured = rooms.filter(room => room.english && room.count > 0).slice(0, 5);
    return Response.json(featuredOnly ? { room: featured[0] || null } : { rooms, featured }, { headers });
  } catch (error) {
    console.warn('Live room directory lookup failed:', error.name, error.message);
    return Response.json(featuredOnly ? { room: null } : { rooms: [], featured: [] }, { status: 503, headers });
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (['/api/featured-room', '/api/live-rooms'].includes(url.pathname)) {
      if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
      return roomResponse(url.pathname === '/api/featured-room');
    }
    if (url.pathname === '/api/chat-profile') {
      const name = url.searchParams.get('name') || '';
      if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
      if (!/^[a-z][a-z0-9_.-]{2,19}$/i.test(name)) return Response.json({}, { status: 404 });
      try {
        const result = await fetch('https://retrochat-izzg.onrender.com/api/profile/' + encodeURIComponent(name), {
          redirect: 'error', signal: AbortSignal.timeout(10000),
        });
        if (result.status === 404) return Response.json({}, { status: 404 });
        if (!result.ok) throw Error();
        const profile = await result.json();
        if (profile.guest || typeof profile.name !== 'string' || profile.name.toLowerCase() !== name.toLowerCase()) return Response.json({}, { status: 404 });
        return Response.json({ name: profile.name }, { headers: { 'Cache-Control': 'no-store' } });
      } catch { return Response.json({}, { status: 503 }); }
    }
    if(url.pathname === '/api/country') {
      const country = /^[A-Z]{2}$/.test(request.cf?.country || '') ? request.cf.country : null;
      return Response.json({ country }, {headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});
    }
    if (url.pathname === '/rooms.html') {
      url.pathname = '/';
      url.hash = 'chat';
      return Response.redirect(url.href, 302);
    }
    if (/^\/@[^/]+\/$/.test(url.pathname)) {
      url.pathname = url.pathname.slice(0, -1);
      return Response.redirect(url.href, 302);
    }
    let path = url.pathname === '/' || /^\/@[^/]+\/?$/.test(url.pathname) ? '/index.html' : url.pathname;
    const asset = ASSETS[path];
    if(!asset) return new Response('Not found',{status:404});
    const headers={'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'};
    const body = request.method === 'HEAD' ? null : asset.binary ? Uint8Array.from(atob(asset.content), char => char.charCodeAt(0)) : asset.content;
    return new Response(body,{headers});
  }
};
