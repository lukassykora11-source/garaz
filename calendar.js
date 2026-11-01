/* One-way sync to an app-created secondary calendar. No primary-calendar access. */
(function(root){
  'use strict';
  const APP='garaz-v1',ZONE='Europe/Prague';
  const enc=s=>encodeURIComponent(s);
  const json=(method,data,etag)=>({method,headers:{'Content-Type':'application/json',...(etag?{'If-Match':etag}:{})},body:JSON.stringify(data)});
  const pendingKey=(sheet,email)=>'garaz.calendar.pending.v1:'+sheet+':'+email.toLowerCase();
  function pending(sheet,email){try{return JSON.parse(localStorage.getItem(pendingKey(sheet,email))||'null');}catch{return null;}}
  function remember(sheet,email,value){try{const text=JSON.stringify(value),key=pendingKey(sheet,email);localStorage.setItem(key,text);return localStorage.getItem(key)===text;}catch{return false;}}
  function clearPending(sheet,email){try{localStorage.removeItem(pendingKey(sheet,email));}catch{}}
  function marker(sheet){return 'GARAZ_CALENDAR_V1\nsourceSheetId='+sheet;}
  function isForSheet(meta,sheet){const lines=String(meta.description||'').split(/\r?\n/);return lines.includes('GARAZ_CALENDAR_V1')&&lines.includes('sourceSheetId='+sheet);}
  async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('');}
  async function create(google){
    const sheet=google.config.spreadsheetId,email=google.profile?.email;
    if(!sheet||!email||!google.calendarGranted)throw new Error('Nejdřív připoj tabulku a povol Google Kalendář.');
    const previous=pending(sheet,email);
    if(previous?.binding)return recover(google,previous.binding.calendarId);
    if(previous?.state==='creating')throw new Error('Předchozí vytváření bylo přerušeno. Kalendář už mohl vzniknout. Najdi v Google Kalendáři „Garáž — opravy a termíny“ a níže obnov propojení jeho ID. Nevytvářej další kopii.');
    if(!remember(sheet,email,{state:'creating'}))throw new Error('Prohlížeč nepovolil uložení průběhu vytváření. Povol místní úložiště, aby nevznikaly kopie kalendáře.');
    let r;
    try{r=await google.calendarApi('/calendars',json('POST',{summary:'Garáž — opravy a termíny',description:'Úkoly z aplikace Garáž. Změny prováděj v Garáži.\n'+marker(sheet),timeZone:ZONE}));}
    catch(error){if(error.status&&error.status<500)clearPending(sheet,email);throw error;}
    const binding={calendarId:r.id,name:r.summary,ownerEmail:email,sourceSheetId:sheet,timeZone:ZONE,reminder:'1440',enabled:true};
    remember(sheet,email,{state:'created',binding});
    return binding;
  }
  async function recover(google,id){
    const sheet=google.config.spreadsheetId,email=google.profile?.email;
    if(!id||id==='primary')throw new Error('Vlož ID samostatného kalendáře vytvořeného aplikací.');
    const meta=await google.calendarApi('/calendars/'+enc(id));
    if(!isForSheet(meta,sheet))throw new Error('Tento kalendář nepatří ke společné tabulce Garáže. Propojení nebylo změněno.');
    const role=await google.calendarApi('/users/me/calendarList/'+enc(id));
    if(role.accessRole!=='owner')throw new Error('Pro obnovu propojení se přihlas jako vlastník tohoto kalendáře.');
    const binding={calendarId:id,name:meta.summary,ownerEmail:email,sourceSheetId:sheet,timeZone:meta.timeZone||ZONE,reminder:'1440',enabled:true};
    remember(sheet,email,{state:'created',binding});return binding;
  }
  function payload(task,car,binding,core,appUrl){
    const done=task.status==='done',state={todo:'Naplánováno',doing:'V řešení',waiting:'Čeká na díly',done:'Hotovo'}[task.status]||'Naplánováno';
    const description=[task.description||'', '', 'Auto: '+(car?.name||'Bez auta'),'Stav: '+state,'Zařizuje: '+(task.owner||'Nepřiřazeno'),'Upravuj v aplikaci Garáž: '+appUrl].map(core.escape).join('\n');
    const reminders=done||binding.reminder==='none'?{useDefault:false,overrides:[]}:binding.reminder==='default'?{useDefault:true}:{useDefault:false,overrides:[{method:'popup',minutes:Number(binding.reminder)}]};
    return {summary:(done?'✓ HOTOVO · ':'')+(car?.name?car.name+' · ':'')+task.title,description,start:{date:task.due},end:{date:core.offset(1,core.date(task.due))},status:'confirmed',transparency:done?'transparent':'opaque',colorId:done?'8':task.priority==='high'?'11':task.status==='doing'?'10':task.status==='waiting'?'5':'9',reminders,extendedProperties:{private:{garazApp:APP,garazSheetId:binding.sourceSheetId,garazTaskId:task.id}},source:{title:'Garáž',url:appUrl}};
  }
  function same(existing,wanted){
    for(const field of ['summary','description','status','transparency','colorId'])if((existing[field]||'')!==wanted[field])return false;
    if(existing.start?.date!==wanted.start.date||existing.end?.date!==wanted.end.date)return false;
    const a=existing.reminders||{},b=wanted.reminders;
    if(!!a.useDefault!==b.useDefault)return false;
    if(!b.useDefault){const normalized=v=>(v||[]).map(r=>r.method+':'+r.minutes).sort().join('|');if(normalized(a.overrides)!==normalized(b.overrides))return false;}
    const props=existing.extendedProperties?.private||{};
    return Object.entries(wanted.extendedProperties.private).every(([k,v])=>props[k]===v);
  }
  function owned(event,sheet){return event.extendedProperties?.private?.garazApp===APP&&event.extendedProperties.private.garazSheetId===sheet;}
  async function sync({google,core,binding,records,appUrl,onProgress=()=>{}}){
    const sheet=google.config.spreadsheetId,account=google.profile?.email?.toLowerCase();
    if(!binding?.enabled)return {created:0,updated:0,removed:0,unchanged:0,skipped:0,errors:[]};
    if(binding._conflict)throw new Error('Nastavení kalendáře má souběžné změny. Synchronizace je pozastavená, aby se nezvolil nesprávný kalendář.');
    if(binding.sourceSheetId!==sheet||binding.ownerEmail?.toLowerCase()!==account)throw new Error('Synchronizaci spouští účet, který kalendář propojil: '+binding.ownerEmail);
    if(binding.calendarId==='primary')throw new Error('Garáž nesynchronizuje hlavní kalendář.');
    if(!['default','none','1440','2880'].includes(binding.reminder))throw new Error('Neplatné nastavení připomínek.');
    const guard=()=>{if(google.config.spreadsheetId!==sheet||google.profile?.email?.toLowerCase()!==account||!google.calendarGranted)throw new Error('Přihlášení nebo tabulka se změnily. Synchronizace byla zastavena.');};
    guard();
    const meta=await google.calendarApi('/calendars/'+enc(binding.calendarId));
    if(!isForSheet(meta,sheet))throw new Error('Kalendář nemá značku této Garáže. Synchronizace nic nezměnila.');
    const base='/calendars/'+enc(binding.calendarId)+'/events';
    const existing=[];let pageToken='';
    do{
      guard();const query=new URLSearchParams({maxResults:'2500',showDeleted:'false'});
      query.append('privateExtendedProperty','garazApp='+APP);query.append('privateExtendedProperty','garazSheetId='+sheet);
      if(pageToken)query.set('pageToken',pageToken);
      const page=await google.calendarApi(base+'?'+query.toString());
      existing.push(...(page.items||[]).filter(ev=>owned(ev,sheet)&&ev.status!=='cancelled'));pageToken=page.nextPageToken||'';
    }while(pageToken);
    const byTask=new Map();for(const ev of existing){const id=ev.extendedProperties.private.garazTaskId;if(!byTask.has(id))byTask.set(id,[]);byTask.get(id).push(ev);}
    const results={created:0,updated:0,removed:0,unchanged:0,skipped:0,errors:[]};
    for(const task of records.tasks){
      guard();
      const car=records.cars.find(c=>c.id===task.carId),matches=byTask.get(task.id)||[];
      if(task._conflict||car?._conflict){results.skipped++;continue;}
      if(matches.length>1){results.skipped++;results.errors.push(task.title+': v Google Kalendáři je více kopií. Žádná nebyla přepsána.');continue;}
      const current=matches[0],excluded=task.removed||!task.due||task.calendarSync===false;
      try{
        if(excluded){
          if(current){guard();try{await google.calendarApi(base+'/'+enc(current.id)+'?sendUpdates=none',{method:'DELETE',headers:{'If-Match':current.etag}});}catch(error){if(![404,410].includes(error.status))throw error;}results.removed++;}
          continue;
        }
        if(!/^\d{4}-\d{2}-\d{2}$/.test(task.due)||core.day(core.date(task.due))!==task.due)throw new Error('Neplatný termín úkolu.');
        const wanted=payload(task,car,binding,core,appUrl);
        if(current){
          if(same(current,wanted)){results.unchanged++;continue;}
          guard();await google.calendarApi(base+'/'+enc(current.id)+'?sendUpdates=none',json('PATCH',{...wanted,extendedProperties:{private:{...(current.extendedProperties?.private||{}),...wanted.extendedProperties.private}}},current.etag));results.updated++;
        }else{
          let candidate=await hash([sheet,task.id,...(task._heads||[]).slice().sort()].join('|')),written=false;
          for(let attempt=0;attempt<6&&!written;attempt++){
            guard();
            try{await google.calendarApi(base+'?sendUpdates=none',json('POST',{...wanted,id:candidate}));results.created++;written=true;}
            catch(error){
              if(error.status!==409)throw error;
              const conflict=await google.calendarApi(base+'/'+enc(candidate));
              if(conflict.status==='cancelled'){candidate=await hash(candidate+'|revive');continue;}
              if(!owned(conflict,sheet)||conflict.extendedProperties?.private?.garazTaskId!==task.id)throw new Error('Kolize ID události. Cizí událost nebyla změněna.');
              if(!same(conflict,wanted)){guard();await google.calendarApi(base+'/'+enc(candidate)+'?sendUpdates=none',json('PATCH',wanted,conflict.etag));results.updated++;}else results.unchanged++;
              written=true;
            }
          }
          if(!written)throw new Error('Nelze bezpečně obnovit ručně smazanou událost.');
        }
      }catch(error){results.errors.push(task.title+': '+(error.status===412?'Událost někdo mezitím změnil; zkus synchronizaci znovu.':error.message));if(error.status===401||error.status===403||!google.ready())throw error;}
      onProgress(results);
    }
    return results;
  }
  const api={create,recover,sync,payload,same,marker,pending,clearPending};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.GarazCalendar=api;
})(typeof window!=='undefined'?window:globalThis);
