const GARAZ_HEADERS = ['event_id','entity','record_id','parents_json','at','author','data_json'];
const GARAZ_ENTITIES = ['cars','tasks','notes','files'];
const GARAZ_FILE_LIMIT = 25 * 1024 * 1024;

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents);
    const config = PropertiesService.getScriptProperties().getProperties();
    const user = authenticate_(request.idToken, config);
    const payload = request.payload || {};
    const spreadsheet = () => SpreadsheetApp.openById(config.SPREADSHEET_ID);
    let value;
    switch (request.action) {
      case 'profile': value = { email:user.email, canEdit:true, spreadsheetId:config.SPREADSHEET_ID }; break;
      case 'load': value = eventRows_(spreadsheet()); break;
      case 'append': value = append_(spreadsheet(), payload, user); break;
      case 'upload': value = upload_(config, payload); break;
      case 'file': value = file_(config, payload.id); break;
      case 'calendar-config': value = calendarConfig_(spreadsheet()); break;
      case 'calendar-api': value = calendarRequest_(spreadsheet(), config, user, payload); break;
      case 'calendar-save': value = saveCalendar_(spreadsheet(), config, user, payload); break;
      default: fail_(400,'Neznámá operace.');
    }
    return response_({ value });
  } catch (error) {
    return response_({ status:error.garazStatus || 500, error:error.garazStatus ? error.message : 'Google úložiště požadavek nedokončilo. Zkontroluj nastavení Apps Scriptu.' });
  }
}

function response_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function fail_(status, message) {
  const error = new Error(message);
  error.garazStatus = status;
  throw error;
}

function authenticate_(token, config) {
  if (!config.FIREBASE_API_KEY || !config.FIREBASE_PROJECT_ID || !config.OWNER_UID || !config.PAVEL_UID ||
      !config.SPREADSHEET_ID || !config.FOLDER_ID) fail_(503,'Správce ještě nedokončil nastavení Garáže.');
  if (typeof token !== 'string' || token.length > 8192) fail_(401,'Přihlas se do Garáže.');
  const parts = token.split('.');
  if (parts.length !== 3) fail_(401,'Přihlas se do Garáže.');
  let claims;
  try { claims = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString()); }
  catch (error) { fail_(401,'Přihlas se do Garáže.'); }
  if (claims.aud !== config.FIREBASE_PROJECT_ID || claims.iss !== 'https://securetoken.google.com/' + config.FIREBASE_PROJECT_ID) {
    fail_(401,'Přihlas se do Garáže.');
  }
  const res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(config.FIREBASE_API_KEY), {
    method:'post', contentType:'application/json', payload:JSON.stringify({idToken:token}), muteHttpExceptions:true
  });
  if (res.getResponseCode() !== 200) fail_(401,'Přihlášení vypršelo. Přihlas se znovu.');
  const user = JSON.parse(res.getContentText()).users?.[0];
  if (!user || user.disabled || user.localId !== claims.sub || ![config.OWNER_UID,config.PAVEL_UID].includes(user.localId)) {
    fail_(403,'Tento účet nemá přístup do Garáže.');
  }
  return user;
}

function eventSheet_(ss) {
  const sheet = ss.getSheetByName('Udalosti');
  if (!sheet || JSON.stringify(sheet.getRange(1,1,1,7).getValues()[0]) !== JSON.stringify(GARAZ_HEADERS)) {
    fail_(409,'Tabulka nemá očekávanou strukturu Garáže.');
  }
  return sheet;
}

function eventRows_(ss) {
  const sheet = eventSheet_(ss);
  const last = sheet.getLastRow();
  if (last < 2) return [];
  return sheet.getRange(2,1,last-1,7).getValues().filter(row => row.some(Boolean)).map(row => ({
    id:String(row[0]), entity:row[1], recordId:String(row[2]), parents:JSON.parse(row[3]),
    at:row[4] instanceof Date ? row[4].toISOString() : row[4], author:row[5], data:JSON.parse(row[6])
  }));
}

function append_(ss, event, user) {
  const validId = value => typeof value === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value);
  if (!validId(event.id) || !validId(event.recordId) || !GARAZ_ENTITIES.includes(event.entity) ||
      !Array.isArray(event.parents) || !event.parents.every(validId) || !event.data ||
      typeof event.data !== 'object' || Array.isArray(event.data)) fail_(400,'Neplatný záznam.');
  const data = JSON.stringify(event.data);
  if (data.length > 40000) fail_(400,'Záznam je příliš dlouhý.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rows = eventRows_(ss);
    if (rows.some(row => row.id === event.id)) return true;
    const history = rows.filter(row => row.entity === event.entity && row.recordId === event.recordId);
    const superseded = new Set(history.flatMap(row => row.parents));
    const heads = history.filter(row => !superseded.has(row.id)).map(row => row.id).sort();
    if (JSON.stringify(heads) !== JSON.stringify([...event.parents].sort())) fail_(409,'Záznam se mezitím změnil. Obnov data a otevři jej znovu.');
    const email = String(user.email || '');
    eventSheet_(ss).appendRow([event.id,event.entity,event.recordId,JSON.stringify(event.parents),new Date().toISOString(),/^[=+\-@]/.test(email) ? "'" + email : email,data]);
    SpreadsheetApp.flush();
    return true;
  } finally { lock.releaseLock(); }
}

function upload_(config, file) {
  const name = typeof file.name === 'string' ? file.name : '';
  const allowed = /\.(jpe?g|png|webp|pdf|docx?|xlsx?|pptx?|odt|ods|txt|csv|rtf)$/i;
  if (!name || name.length > 255 || !allowed.test(name) || /[\/\\\x00-\x1f]/.test(name) ||
      typeof file.base64 !== 'string' || file.base64.length > Math.ceil(GARAZ_FILE_LIMIT / 3) * 4) {
    fail_(400,'Nepovolený soubor nebo překročený limit 25 MB.');
  }
  const bytes = Utilities.base64Decode(file.base64);
  if (!bytes.length || bytes.length > GARAZ_FILE_LIMIT) fail_(400,'Prázdný nebo příliš velký soubor.');
  const mime = /^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.mime) ? file.mime : 'application/octet-stream';
  const saved = DriveApp.getFolderById(config.FOLDER_ID).createFile(Utilities.newBlob(bytes,mime,name));
  return {id:saved.getId()};
}

function file_(config,id) {
  if (typeof id !== 'string' || !/^[a-z0-9_-]{5,180}$/i.test(id)) fail_(404,'Soubor není dostupný.');
  let file;
  try { file = DriveApp.getFileById(id); } catch (error) { fail_(404,'Soubor není dostupný.'); }
  const parents = file.getParents();
  let inGarage = false;
  while (parents.hasNext()) if (parents.next().getId() === config.FOLDER_ID) inGarage = true;
  if (!inGarage || file.isTrashed()) fail_(404,'Soubor není ve složce Garáže.');
  if (file.getSize() > GARAZ_FILE_LIMIT) fail_(413,'Soubor je větší než 25 MB.');
  return {base64:Utilities.base64Encode(file.getBlob().getBytes()),mime:file.getMimeType()};
}

function calendarConfig_(ss) {
  const sheet = ss.getSheetByName('Kalendar');
  if (!sheet || sheet.getLastRow() < 1) return null;
  const rows = sheet.getRange(1,1,sheet.getLastRow(),1).getValues().flat();
  if (rows[0] !== 'garaz_calendar_v1') fail_(409,'List Kalendar má jinou strukturu.');
  const history = rows.slice(1).filter(Boolean).map(JSON.parse);
  const superseded = new Set(history.flatMap(row => row.parents));
  const heads = history.filter(row => !superseded.has(row.revision));
  return heads.length ? {...heads[heads.length-1],_heads:heads.map(row => row.revision),_conflict:heads.length>1} : null;
}

function calendarRequest_(ss,config,user,payload) {
  const binding = calendarConfig_(ss);
  if (user.localId !== config.OWNER_UID || !binding || binding._conflict ||
      binding.sourceSheetId !== config.SPREADSHEET_ID || !/@group\.calendar\.google\.com$/.test(binding.calendarId)) {
    fail_(403,'Přístup k synchronizaci kalendáře není povolen.');
  }
  const base = '/calendars/' + encodeURIComponent(binding.calendarId);
  const path = String(payload.path || '');
  const method = String(payload.method || 'GET').toUpperCase();
  const target = path.split('?')[0];
  const isEvent = target.startsWith(base + '/events/') && /^[a-z0-9_-]+$/i.test(target.slice(base.length+8));
  if (!((method === 'GET' && [base,base+'/events'].includes(target)) ||
        (method === 'POST' && target === base+'/events') ||
        (isEvent && ['GET','PATCH','DELETE'].includes(method)))) fail_(400,'Neplatná operace s kalendářem.');
  if (binding.enabled !== true && method !== 'GET') fail_(403,'Synchronizace je pozastavená.');
  const headers = {Authorization:'Bearer '+ScriptApp.getOAuthToken()};
  if (typeof payload.etag === 'string') headers['If-Match'] = payload.etag;
  const res = UrlFetchApp.fetch('https://www.googleapis.com/calendar/v3'+path, {
    method:method.toLowerCase(), headers, muteHttpExceptions:true,
    ...(payload.body ? {contentType:'application/json',payload:payload.body} : {})
  });
  const status = res.getResponseCode();
  if (status >= 400) fail_(status,'Google Kalendář vrátil chybu ('+status+').');
  return status === 204 ? {} : JSON.parse(res.getContentText());
}

function saveCalendar_(ss,config,user,payload) {
  if (user.localId !== config.OWNER_UID) fail_(403,'Kalendář nastavuje vlastník.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const binding = calendarConfig_(ss);
    const update = payload.value;
    if (!binding || binding._conflict || !update || !['default','none','1440','2880'].includes(update.reminder) ||
        typeof update.enabled !== 'boolean' || JSON.stringify(binding._heads) !== JSON.stringify(payload.heads)) {
      fail_(409,'Nastavení kalendáře se změnilo. Obnov data.');
    }
    const {_heads,_conflict,...saved} = binding;
    const next = {...saved,enabled:update.enabled,reminder:update.reminder,parents:_heads,revision:Utilities.getUuid(),updatedAt:new Date().toISOString()};
    ss.getSheetByName('Kalendar').appendRow([JSON.stringify(next)]);
    SpreadsheetApp.flush();
    return {...next,_heads:[next.revision],_conflict:false};
  } finally { lock.releaseLock(); }
}

function diagnostikaGaraze() {
  const config = PropertiesService.getScriptProperties().getProperties();
  const id = String(config.SPREADSHEET_ID || '').trim();
  if (!id) throw new Error('Ve vlastnostech skriptu chybí SPREADSHEET_ID.');
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw new Error('SPREADSHEET_ID musí obsahovat pouze ID tabulky. Zkontroluj, zda v něm není celý odkaz, mezera nebo předpona ID:.');
  }
  const ss = SpreadsheetApp.openById(id);
  console.log('Otevřená tabulka: ' + ss.getName());
  console.log('Odkaz: ' + ss.getUrl());
  const events = eventRows_(ss);
  console.log('Počet záznamů: ' + events.length);
  console.log('Záznamy aut: ' + events.filter(row => row.entity === 'cars').length);
}
