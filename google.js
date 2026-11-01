/* Google is the permission boundary: this application never stores a password or a token. */
window.GarazGoogle = (() => {
  const key = 'garaz.settings.v1:' + location.pathname;
  let saved={}; try { saved=JSON.parse(localStorage.getItem(key)||'{}'); } catch {}
  let config={...(window.GARAZ_CONFIG||{}),...saved}, token='', expires=0, profile=null;
  const headers=['event_id','entity','record_id','parents_json','at','author','data_json'];
  let capabilities={canEdit:false}, folderWritable=false;
  const scripts=new Map();
  function script(src) {
    if(scripts.has(src)) return scripts.get(src);
    const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{scripts.delete(src);reject(new Error('Nepodařilo se načíst přihlášení Google. Zkontroluj připojení a blokování skriptů.'));};document.head.append(s);});
    scripts.set(src,p);return p;
  }
  async function connect() {
    if(!config.clientId) throw new Error('Nejdřív v Nastavení vyplň Google Client ID, API key a číslo projektu.');
    await script('https://accounts.google.com/gsi/client');
    const response=await new Promise((resolve,reject)=>{
      const client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',callback:r=>r.error?reject(new Error(r.error_description||r.error)):resolve(r),error_callback:()=>reject(new Error('Přihlášení nebylo dokončeno. Povol přihlašovací okno a zkus to znovu.'))});
      client.requestAccessToken({prompt:'select_account'});
    });
    if(!google.accounts.oauth2.hasGrantedAllScopes(response,'https://www.googleapis.com/auth/drive.file')) throw new Error('Pro práci s daty je potřeba povolit přístup k vybraným souborům.');
    token=response.access_token;expires=Date.now()+Number(response.expires_in)*1000-30000;
    profile=await request('https://www.googleapis.com/oauth2/v3/userinfo');
    return profile;
  }
  function ready() { return !!token && Date.now()<expires; }
  async function request(url,options={}) {
    if(!ready()) { token='';throw new Error('Přihlášení vypršelo. Přihlas se znovu přes Google; otevřený formulář můžeš zkopírovat před zavřením.'); }
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
    let r;
    try {r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:controller.signal});}
    catch(e){throw new Error(e.name==='AbortError'?'Google neodpověděl včas. Obnov data a ověř, zda se změna uložila.':'Spojení s Googlem selhalo. Obnov data a ověř poslední změnu.');}
    finally {clearTimeout(timer);}
    if(!r.ok){let error={};try{error=await r.json();}catch{}if(r.status===401){token='';throw new Error('Přihlášení vypršelo. Přihlas se znovu.');}if(r.status===403||r.status===404)throw new Error('K souboru chybí oprávnění, výběr pro aplikaci nebo zapnuté API. V Nastavení jej vyber přes Google a ověř sdílení. ('+r.status+')');throw new Error(error.error?.message||'Google vrátil chybu '+r.status);}
    if(r.status===204)return {};
    return options.blob?r.blob():r.json();
  }
  function json(method,data){return {method,headers:{'Content-Type':'application/json'},body:JSON.stringify(data)};}
  const sheetBase=()=> 'https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(config.spreadsheetId);
  function persist(values) {config={...config,...values};localStorage.setItem(key,JSON.stringify(config));return config;}
  async function pick(kind) {
    if(!ready()) throw new Error('Nejdřív se přihlas přes Google.');
    if(!config.apiKey||!config.projectNumber)throw new Error('Pro výběr souborů vyplň API key a číslo projektu.');
    await script('https://apis.google.com/js/api.js');
    await new Promise(resolve=>gapi.load('picker',resolve));
    const view=new google.picker.DocsView(google.picker.ViewId.DOCS).setMode(google.picker.DocsViewMode.LIST);
    if(kind==='folder')view.setIncludeFolders(true).setSelectFolderEnabled(true).setMimeTypes('application/vnd.google-apps.folder');
    else view.setMimeTypes('application/vnd.google-apps.spreadsheet');
    const selected=await new Promise((resolve,reject)=>{
      const picker=new google.picker.PickerBuilder().setAppId(config.projectNumber).setDeveloperKey(config.apiKey).setOAuthToken(token).setOrigin(location.origin).setLocale('cs').setTitle(kind==='folder'?'Vyber sdílenou složku na fotky':'Vyber tabulku Garáže').addView(view).setCallback(data=>{if(data.action===google.picker.Action.PICKED)resolve(data.docs[0]);else if(data.action===google.picker.Action.CANCEL)resolve(null);}).build();picker.setVisible(true);
    });
    if(!selected)return null;
    const meta=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(selected.id)+'?fields=id,mimeType,capabilities(canEdit,canAddChildren)&supportsAllDrives=true');
    if(kind==='folder'){
      if(meta.mimeType!=='application/vnd.google-apps.folder')throw new Error('Vyber složku.');
      persist({folderId:selected.id});folderWritable=!!meta.capabilities?.canAddChildren;
    }else{
      if(meta.mimeType!=='application/vnd.google-apps.spreadsheet')throw new Error('Vyber Google tabulku.');
      // Validate before replacing the current workspace.
      const data=await request('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(selected.id)+'/values/'+encodeURIComponent('Udalosti!A1:G1'));
      if(JSON.stringify(data.values?.[0])!==JSON.stringify(headers))throw new Error('Tato tabulka nemá strukturu Garáže. Vyber tabulku vytvořenou aplikací.');
      persist({spreadsheetId:selected.id});capabilities=meta.capabilities||{};
    }
    return selected;
  }
  async function createSheet() {
    const r=await request('https://sheets.googleapis.com/v4/spreadsheets',json('POST',{properties:{title:'Garáž — evidence aut'},sheets:[{properties:{title:'Udalosti',gridProperties:{frozenRowCount:1}}}]}));
    const id=r.spreadsheetId;
    await request('https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id)+'/values/'+encodeURIComponent('Udalosti!A1:G1')+'?valueInputOption=RAW',json('PUT',{values:[headers]}));
    persist({spreadsheetId:id});capabilities={canEdit:true};return id;
  }
  async function createFolder() {
    const r=await request('https://www.googleapis.com/drive/v3/files?fields=id',json('POST',{name:'Garáž — fotky',mimeType:'application/vnd.google-apps.folder'}));
    persist({folderId:r.id});folderWritable=true;return r.id;
  }
  async function load() {
    if(!config.spreadsheetId)throw new Error('Vyber sdílenou tabulku nebo si vytvoř novou v Nastavení.');
    const meta=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(config.spreadsheetId)+'?fields=capabilities(canEdit)&supportsAllDrives=true');
    capabilities=meta.capabilities||{};
    const r=await request(sheetBase()+'/values/'+encodeURIComponent('Udalosti!A:G'));
    if(JSON.stringify(r.values?.[0])!==JSON.stringify(headers))throw new Error('Tabulka nemá očekávanou strukturu Garáže. Její záhlaví ani list Udalosti neměň.');
    return (r.values||[]).slice(1).filter(row=>row.some(Boolean)).map((row,i)=>{
      try {const e={id:row[0],entity:row[1],recordId:row[2],parents:JSON.parse(row[3]),at:row[4],author:row[5],data:JSON.parse(row[6])};if(!e.id||!e.recordId||!Array.isArray(e.parents)||!e.data||typeof e.data!=='object'||!['cars','tasks','notes','files'].includes(e.entity))throw Error();return e;}
      catch{throw new Error('Neplatný záznam v tabulce na řádku '+(i+2)+'. Obnov správnou verzi řádku v historii Google Sheets.');}
    });
  }
  async function append(e) {
    if(!capabilities.canEdit)throw new Error('Máš přístup jen ke čtení. O úpravy požádej vlastníka tabulky.');
    const payload=JSON.stringify(e.data);if(payload.length>40000)throw new Error('Záznam je příliš dlouhý; zkrať poznámku.');
    await request(sheetBase()+'/values/'+encodeURIComponent('Udalosti!A:G')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',json('POST',{values:[[e.id,e.entity,e.recordId,JSON.stringify(e.parents),e.at,e.author,payload]]}));
  }
  async function upload(file) {
    if(!config.folderId)throw new Error('Nejdřív v Nastavení vyber složku pro fotky.');
    const meta=await request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(config.folderId)+'?fields=capabilities(canAddChildren)&supportsAllDrives=true');
    if(!meta.capabilities?.canAddChildren)throw new Error('Do složky nemůžeš přidávat fotky. Ověř sdílení složky.');
    const form=new FormData();form.append('metadata',new Blob([JSON.stringify({name:file.name,parents:[config.folderId]})],{type:'application/json'}));form.append('file',file);
    return request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink&supportsAllDrives=true',{method:'POST',body:form});
  }
  async function photo(id){return request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media&supportsAllDrives=true',{blob:true});}
  function logout(){token='';expires=0;profile=null;capabilities={canEdit:false};}
  return {connect,ready,load,append,pick,createSheet,createFolder,upload,photo,persist,logout,get config(){return {...config};},get profile(){return profile;},get canEdit(){return !!capabilities.canEdit;}};
})();
