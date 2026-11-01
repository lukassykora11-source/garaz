/* Google enforces file access. Optional device memory stores only a short-lived access token, never a password or refresh token. */
window.GarazGoogle = (() => {
  const key = 'garaz.settings.v1:' + location.pathname;
  let saved={}; try { saved=JSON.parse(localStorage.getItem(key)||'{}'); } catch {}
  let config={...(window.GARAZ_CONFIG||{}),...saved}, token='', expires=0, profile=null, calendarGranted=false;
  const sessionKey='garaz.session.v1:'+location.pathname, rememberKey='garaz.remember.v1:'+location.pathname;
  let remember=false;
  try{remember=localStorage.getItem(rememberKey)==='yes';}catch{}
  function forgetSession(){try{localStorage.removeItem(sessionKey);}catch{}}
  function storedSession(){
    try{
      if(!remember){forgetSession();return null;}
      const value=JSON.parse(localStorage.getItem(sessionKey)||'null');
      if(!value)return null;
      if(value.clientId!==config.clientId||typeof value.token!=='string'||!value.token||!Number.isFinite(value.expires)||value.expires<=Date.now()||value.expires>Date.now()+3600000){forgetSession();return null;}
      return value;
    }catch{forgetSession();return null;}
  }
  function saveSession(){
    if(!remember||!ready()||!profile){forgetSession();return;}
    try{localStorage.setItem(sessionKey,JSON.stringify({clientId:config.clientId,token,expires,calendarGranted}));}
    catch{forgetSession();throw new Error('Prohlížeč nepovolil zapamatování přihlášení. Aktuální přihlášení dál funguje.');}
  }
  function setRemember(value){
    const enabled=!!value;
    try{localStorage.setItem(rememberKey,enabled?'yes':'no');}
    catch{throw new Error('Prohlížeč nepovolil uložení této volby.');}
    remember=enabled;
    saveSession();
  }
  async function resume(){
    const value=storedSession();if(!value)return null;
    token=value.token;expires=value.expires;calendarGranted=value.calendarGranted===true;
    try{profile=await request('https://www.googleapis.com/oauth2/v3/userinfo');return profile;}
    catch(error){logout();throw error;}
  }
  const BASE_SCOPES='https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';
  const CALENDAR_SCOPE='https://www.googleapis.com/auth/calendar.app.created';
  const headers=['event_id','entity','record_id','parents_json','at','author','data_json'];
  let capabilities={canEdit:false}, folderWritable=false;
  const scripts=new Map();
  function script(src) {
    if(scripts.has(src)) return scripts.get(src);
    const p=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{scripts.delete(src);reject(new Error('Nepodařilo se načíst přihlášení Google. Zkontroluj připojení a blokování skriptů.'));};document.head.append(s);});
    scripts.set(src,p);return p;
  }
  async function connect(withCalendar=false) {
    if(!config.clientId) throw new Error('Nejdřív v Nastavení vyplň Google Client ID, API key a číslo projektu.');
    if(!withCalendar)logout();
    await script('https://accounts.google.com/gsi/client');
    const response=await new Promise((resolve,reject)=>{
      const client=google.accounts.oauth2.initTokenClient({client_id:config.clientId,scope:BASE_SCOPES+(withCalendar?' '+CALENDAR_SCOPE:''),include_granted_scopes:true,...(withCalendar&&profile?.email?{hint:profile.email}:{}),callback:r=>r.error?reject(new Error(r.error_description||r.error)):resolve(r),error_callback:()=>reject(new Error('Přihlášení nebylo dokončeno. Povol přihlašovací okno a zkus to znovu.'))});
      client.requestAccessToken({prompt:withCalendar?'':'select_account'});
    });
    if(!google.accounts.oauth2.hasGrantedAllScopes(response,'https://www.googleapis.com/auth/drive.file')) throw new Error('Pro práci s daty je potřeba povolit přístup k vybraným souborům.');
    token=response.access_token;expires=Date.now()+Math.min(Number(response.expires_in)||0,3600)*1000-30000;
    calendarGranted=google.accounts.oauth2.hasGrantedAllScopes(response,CALENDAR_SCOPE);
    try{profile=await request('https://www.googleapis.com/oauth2/v3/userinfo');}
    catch(error){logout();throw error;}
    saveSession();
    return profile;
  }
  function ready() { return !!token && Date.now()<expires; }
  async function request(url,options={}) {
    if(!ready()) { logout();throw new Error('Přihlášení vypršelo. Přihlas se znovu přes Google; otevřený formulář můžeš zkopírovat před zavřením.'); }
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),45000);
    let r;
    try {r=await fetch(url,{...options,headers:{Authorization:'Bearer '+token,...options.headers},signal:controller.signal});}
    catch(e){throw new Error(e.name==='AbortError'?'Google neodpověděl včas. Obnov data a ověř, zda se změna uložila.':'Spojení s Googlem selhalo. Obnov data a ověř poslední změnu.');}
    finally {clearTimeout(timer);}
    if(!r.ok){let error={};try{error=await r.json();}catch{}let message=error.error?.message||'Google vrátil chybu '+r.status;if(r.status===401){logout();message='Přihlášení vypršelo. Přihlas se znovu.';}else if((r.status===403||r.status===404)&&!url.startsWith('https://www.googleapis.com/calendar/'))message='K souboru chybí oprávnění, výběr pro aplikaci nebo zapnuté API. V Nastavení jej vyber přes Google a ověř sdílení. ('+r.status+')';const failure=new Error(message);failure.status=r.status;failure.reasons=error.error?.errors||[];throw failure;}
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
  async function authorizeCalendar(){
    if(!ready()||!profile)throw new Error('Nejdřív se přihlas ke společné tabulce.');
    const previous=profile.sub||profile.email;
    await connect(true);
    if((profile.sub||profile.email)!==previous){logout();throw new Error('Pro kalendář vyber stejný účet jako pro Garáž. Přihlas se znovu.');}
    if(!calendarGranted)throw new Error('Přístup ke kalendáři nebyl povolen. Evidence aut může dál fungovat bez kalendáře.');
  }
  async function calendarApi(path,options={}){
    if(!calendarGranted)throw new Error('Nejdřív povol Google Kalendář tlačítkem v Nastavení.');
    if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//'))throw new Error('Neplatná adresa kalendáře.');
    return request('https://www.googleapis.com/calendar/v3'+path,options);
  }
  async function loadCalendarConfig(){
    if(!config.spreadsheetId)return null;
    const meta=await request(sheetBase()+'?fields=sheets(properties(title))');
    if(!meta.sheets?.some(s=>s.properties?.title==='Kalendar'))return null;
    const rows=await request(sheetBase()+'/values/'+encodeURIComponent('Kalendar!A:A'));
    if(!rows.values?.length)return null;
    if(rows.values[0][0]!=='garaz_calendar_v1')throw new Error('List Kalendar není nastavení Garáže. Přejmenuj vlastní list, aby aplikace nepřepsala tvá data.');
    const history=(rows.values||[]).slice(1).filter(r=>r[0]).map((r,i)=>{try{const v=JSON.parse(r[0]);if(!v.revision||!Array.isArray(v.parents)||!v.calendarId||!v.ownerEmail)throw Error();return v;}catch{throw new Error('Neplatné nastavení kalendáře na řádku '+(i+2)+'.');}});
    const superseded=new Set(history.flatMap(v=>v.parents)),heads=history.filter(v=>!superseded.has(v.revision));
    if(!heads.length)return null;
    const latest=heads[heads.length-1];
    return {...latest,_heads:heads.map(v=>v.revision),_conflict:heads.length>1};
  }
  async function saveCalendarConfig(value,expectedHeads=[]){
    if(!capabilities.canEdit)throw new Error('Nastavení kalendáře může uložit pouze editor společné tabulky.');
    const existing=await loadCalendarConfig();
    if(JSON.stringify([...(existing?._heads||[])].sort())!==JSON.stringify([...expectedHeads].sort()))throw new Error('Nastavení kalendáře se mezitím změnilo. Obnov stránku Nastavení.');
    if(existing&&existing.ownerEmail.toLowerCase()!==profile.email.toLowerCase())throw new Error('Nastavení mění účet, který kalendář propojil: '+existing.ownerEmail);
    if(!existing){
      const meta=await request(sheetBase()+'?fields=sheets(properties(title))');
      if(!meta.sheets?.some(s=>s.properties?.title==='Kalendar')){
        try{await request(sheetBase()+':batchUpdate',json('POST',{requests:[{addSheet:{properties:{title:'Kalendar'}}}]}));}
        catch(error){const check=await request(sheetBase()+'?fields=sheets(properties(title))');if(!check.sheets?.some(s=>s.properties?.title==='Kalendar'))throw error;}
      }
      const first=await request(sheetBase()+'/values/'+encodeURIComponent('Kalendar!A1'));
      if(first.values?.[0]?.[0]&&first.values[0][0]!=='garaz_calendar_v1')throw new Error('Existující list Kalendar má jiný obsah. Data nebudou přepsána.');
      if(!first.values?.[0]?.[0])await request(sheetBase()+'/values/'+encodeURIComponent('Kalendar!A1')+'?valueInputOption=RAW',json('PUT',{values:[['garaz_calendar_v1']]}));
    }
    const revision=crypto.randomUUID(),payload={...value,ownerEmail:profile.email,revision,parents:expectedHeads,updatedAt:new Date().toISOString()};
    delete payload._heads;delete payload._conflict;
    await request(sheetBase()+'/values/'+encodeURIComponent('Kalendar!A:A')+':append?valueInputOption=RAW&insertDataOption=INSERT_ROWS',json('POST',{values:[[JSON.stringify(payload)]]}));
    return {...payload,_heads:[revision],_conflict:false};
  }
  function logout(){forgetSession();token='';expires=0;profile=null;calendarGranted=false;capabilities={canEdit:false};}
  return {connect,resume,setRemember,get remember(){return remember;},hasRememberedSession:()=>!!storedSession(),ready,load,append,pick,createSheet,createFolder,upload,photo,persist,logout,authorizeCalendar,calendarApi,loadCalendarConfig,saveCalendarConfig,get calendarGranted(){return calendarGranted&&ready();},get config(){return {...config};},get profile(){return profile;},get canEdit(){return !!capabilities.canEdit;}};
})();
