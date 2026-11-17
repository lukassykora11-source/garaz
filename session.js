window.GarazGoogle = (() => {
  'use strict';
  const key = 'garaz.firebase.session.v1';
  let profile = null, token = '', refresh = '', expires = 0, pendingRefresh = null;
  let config = {}, authConfig = null, generation = 0;

  function stored() {
    try { return localStorage.getItem(key) || sessionStorage.getItem(key) || ''; }
    catch { return ''; }
  }

  function saveSession(remember) {
    for (const storage of [localStorage,sessionStorage]) storage.removeItem(key);
    if (refresh) (remember ? localStorage : sessionStorage).setItem(key,refresh);
  }

  function logout() {
    generation++;
    try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch {}
    token = refresh = '';
    expires = 0;
    profile = null;
    config = {};
    pendingRefresh = null;
  }

  async function settings() {
    authConfig ||= await fetch('/api/config',{cache:'no-store'}).then(r=>r.json());
    if (!authConfig.configured) throw new Error('Správce ještě nedokončil nastavení přihlášení.');
    return authConfig;
  }

  async function firebase(url, data, asForm=false) {
    const {apiKey} = await settings();
    const r = await fetch(url+'?key='+encodeURIComponent(apiKey), {
      method:'POST',
      headers:{'Content-Type':asForm?'application/x-www-form-urlencoded':'application/json'},
      body:asForm?new URLSearchParams(data):JSON.stringify(data),
      referrerPolicy:'no-referrer'
    });
    const result = await r.json();
    if (!r.ok) {
      const code = result.error?.message || '';
      const error = new Error(code.startsWith('TOO_MANY_ATTEMPTS')?'Příliš mnoho pokusů. Zkus to později.':
        code==='OPERATION_NOT_ALLOWED'?'Správce ještě nepovolil přihlášení heslem.':
        asForm?'Přihlášení vypršelo. Přihlas se znovu.':'E-mail nebo heslo nesouhlasí.');
      error.status = r.status;
      throw error;
    }
    return result;
  }

  async function refreshToken() {
    if (token && Date.now() < expires - 60000) return token;
    if (!refresh) throw new Error('Nejdřív se přihlas.');
    if (!pendingRefresh) {
      const session = generation;
      pendingRefresh = (async()=>{
        const result = await firebase('https://securetoken.googleapis.com/v1/token',{grant_type:'refresh_token',refresh_token:refresh},true);
        if (session !== generation) throw new Error('Přihlášení se mezitím změnilo.');
        token = result.id_token;
        refresh = result.refresh_token;
        expires = Date.now()+Number(result.expires_in)*1000;
        saveSession(Boolean(localStorage.getItem(key)));
        return token;
      })().catch(error=>{
        if (session===generation && [400,401,403].includes(error.status)) logout();
        throw error;
      }).finally(()=>{if(session===generation)pendingRefresh=null;});
    }
    return pendingRefresh;
  }

  async function rpc(action,payload) {
    const session = generation;
    const credential = await refreshToken();
    const r = await fetch('/api/garage',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},body:JSON.stringify({action,payload})
    });
    const result = await r.json();
    if (session!==generation) throw new Error('Přihlášení se mezitím změnilo.');
    if (!r.ok) {
      if (r.status===401) logout();
      const error = new Error(result.error || 'Garáž požadavek nedokončila.');
      error.status = r.status;
      throw error;
    }
    return result.value;
  }

  async function lookup() {
    const result = await rpc('profile');
    config = {spreadsheetId:result.spreadsheetId};
    profile = result;
    return profile;
  }

  async function connect(email,password,remember) {
    logout();
    const session = generation;
    try {
      const result = await firebase('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',{email,password,returnSecureToken:true});
      if (session!==generation) throw new Error('Přihlášení se mezitím změnilo.');
      token = result.idToken;
      refresh = result.refreshToken;
      expires = Date.now()+Number(result.expiresIn)*1000;
      const user = await lookup();
      saveSession(remember);
      return user;
    } catch (error) {
      if(session===generation)logout();
      throw error;
    }
  }

  async function resume() {
    refresh = stored();
    return refresh ? lookup() : null;
  }

  async function photo(id) {
    const result = await rpc('file',{id});
    const mime = /^(image\/(jpeg|png|webp|heic|heif)|application\/pdf)$/.test(result.mime) ? result.mime : 'application/octet-stream';
    return new Blob([Uint8Array.from(atob(result.base64),value=>value.charCodeAt(0))],{type:mime});
  }

  async function upload(file) {
    const dataUrl = await new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = ()=>resolve(reader.result);
      reader.onerror = ()=>reject(new Error('Soubor se nepodařilo přečíst.'));
      reader.readAsDataURL(file);
    });
    return rpc('upload',{name:file.name,mime:file.type,base64:dataUrl.slice(dataUrl.indexOf(',')+1)});
  }

  return {
    connect,resume,logout,ready:()=>Boolean(profile),hasRememberedSession:()=>Boolean(stored()),
    get config(){return config;},get profile(){return profile;},get canEdit(){return profile?.canEdit===true;},
    get calendarGranted(){return Boolean(profile);},
    load:()=>rpc('load'),append:event=>rpc('append',event),upload,photo,
    loadCalendarConfig:()=>rpc('calendar-config'),
    saveCalendarConfig:(value,heads)=>rpc('calendar-save',{value,heads}),
    calendarApi:(path,options={})=>rpc('calendar-api',{path,method:options.method,etag:options.headers?.['If-Match'],body:options.body})
  };
})();
