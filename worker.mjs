import assets from './assets.generated.mjs';

const types = {
  html:'text/html; charset=utf-8', js:'text/javascript; charset=utf-8',
  css:'text/css; charset=utf-8', webp:'image/webp', svg:'image/svg+xml'
};
const maxRequest = 36 * 1024 * 1024;
const scriptUrl = /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/;
const json = (body, status=200) => Response.json(body, {status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const configured = Boolean(env.FIREBASE_API_KEY && scriptUrl.test(env.GARAZ_SCRIPT_URL || ''));
    if (url.pathname === '/api/config' && request.method === 'GET') {
      return json({configured,apiKey:configured ? env.FIREBASE_API_KEY : ''});
    }
    if (url.pathname === '/api/garage') {
      if (request.method !== 'POST' || request.headers.get('Origin') !== url.origin ||
          !request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'Požadavek není povolen.'},403);
      if (!configured) return json({error:'Správce ještě nedokončil připojení Garáže.'},503);
      if (!/^Bearer [\w.-]{1,8192}$/.test(request.headers.get('Authorization') || '')) return json({error:'Nejdřív se přihlas.'},401);
      if (Number(request.headers.get('Content-Length')) > maxRequest) return json({error:'Soubor je příliš velký.'},413);
      const chunks = [];
      let size = 0;
      try {
        for await (const chunk of request.body) {
          size += chunk.byteLength;
          if (size > maxRequest) return json({error:'Soubor je příliš velký.'},413);
          chunks.push(chunk);
        }
        const wrapper = JSON.parse(await new Blob(chunks).text());
        const idToken = request.headers.get('Authorization').slice(7);
        const upstream = await fetch(env.GARAZ_SCRIPT_URL,{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken,action:wrapper.action,payload:wrapper.payload})
        });
        if (!upstream.ok || !upstream.headers.get('Content-Type')?.includes('application/json')) {
          return json({error:'Apps Script není dostupný. Správce musí ověřit nasazení.'},502);
        }
        const result = await upstream.json();
        if (result.error) {
          const status = Number.isInteger(result.status) && result.status >= 400 && result.status <= 599 ? result.status : 502;
          return json({error:result.error},status);
        }
        return json({value:result.value});
      } catch (error) {
        if (error instanceof SyntaxError) return json({error:'Požadavek nebo odpověď nemá očekávaný formát.'},400);
        console.error(JSON.stringify({message:'Apps Script request failed',type:error.name}));
        return json({error:'Spojení s Google úložištěm selhalo.'},502);
      }
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null,{status:405});
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (!Object.hasOwn(assets,name)) return new Response('Nenalezeno',{status:404});
    const mime = types[name.split('.').pop()] || 'application/octet-stream';
    return new Response(request.method === 'HEAD' ? null : Uint8Array.from(atob(assets[name]),c=>c.charCodeAt(0)),{headers:{
      'Content-Type':mime,
      'Cache-Control':'no-cache',
      'X-Content-Type-Options':'nosniff',
      'Referrer-Policy':'no-referrer',
      'X-Frame-Options':'DENY',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' blob: data:; connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
    }});
  }
};
