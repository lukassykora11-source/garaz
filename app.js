(() => {
  'use strict';
  const C=window.GarazCore,G=window.GarazGoogle,$=s=>document.querySelector(s),e=C.escape;
  const prefix='garaz.demo.v1:'+location.pathname;
  const status={todo:'Naplánováno',doing:'V řešení',waiting:'Čeká na díly',done:'Hotovo'};
  const kinds={repair:'Oprava',improve:'Vylepšení',service:'Údržba',inspection:'STK / kontrola',other:'Ostatní'};
  const colors=['#799073','#ca986c','#8597a8','#b4877d','#999276','#777e84'];
  const labels={overview:'Přehled',cars:'Moje auta',tasks:'Úkoly',calendar:'Kalendář',notes:'Poznámky a odkazy',photos:'Fotky',settings:'Nastavení a přístup',car:'Detail auta'};
  let mode='demo',events=[],data=C.reduce([]),view='overview',carId='',carTab='tasks',busy=false,uploading=false,month=new Date(),filters={q:'',car:'',status:'open'},edit=null,lastSync='',toastTimer;
  let renderVersion=0;const photoUrls=new Map();
  const uid=()=>crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
  const today=()=>C.day(new Date());
  const fmt=(s,options={day:'numeric',month:'short'})=>s?new Intl.DateTimeFormat('cs-CZ',options).format(C.date(s)):'Bez termínu';
  const money=n=>new Intl.NumberFormat('cs-CZ',{style:'currency',currency:'CZK',maximumFractionDigits:0}).format(Number(n)||0);
  const car=id=>data.cars.find(c=>c.id===id);
  const activeCars=()=>data.cars.filter(c=>!c.archived);
  const tasks=()=>data.tasks.filter(t=>!t.removed);
  const openTasks=()=>tasks().filter(t=>t.status!=='done');
  const writable=()=>mode==='demo'||G.ready()&&G.canEdit;
  const event=(entity,recordId,record,parents=[])=>({id:uid(),entity,recordId,parents,at:new Date().toISOString(),author:mode==='cloud'?G.profile?.email||'Google uživatel':'Ukázka',data:record});
  function notify(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),8500);}
  function setData(rows){events=rows;data=C.reduce(events);}
  function seed(){
    const cars=[{id:'allegro',name:'Chevrolet Allegro',year:'1988',type:'Obytné auto',plate:'',color:colors[0],style:'rv',description:'Ukázkové auto. Vlastní vozy přidáš po připojení Googlu.'},{id:'ford',name:'Ford F250',year:'1976',type:'Pick-up',plate:'',color:colors[1],style:'pickup',description:'Ukázkové auto.'},{id:'jeep',name:'Jeep Grand Cherokee',year:'2018',type:'SUV',plate:'',color:colors[2],style:'suv',description:'Ukázkové auto.'}];
    const ts=[{carId:'ford',title:'Opravit podlahu v kabině',description:'Zjistit rozsah koroze a domluvit termín opravy.',due:C.offset(-3),owner:'Já',kind:'repair',priority:'high',status:'todo',cost:'',actualCost:''},{carId:'allegro',title:'Vybrat čalounění sedaček',description:'Porovnat materiály a vzorky béžové kůže.',due:C.offset(2),owner:'Já',kind:'improve',priority:'normal',status:'doing',cost:'',actualCost:''},{carId:'jeep',title:'Výměna oleje a filtrů',description:'Ověřit specifikaci oleje a objednat servis.',due:C.offset(5),owner:'Servis',kind:'service',priority:'normal',status:'todo',cost:'',actualCost:''},{carId:'allegro',title:'Proměřit prostor pro stolek',description:'Zapsat rozměry mezi křesly.',due:C.offset(9),owner:'Já',kind:'improve',priority:'normal',status:'todo',cost:'',actualCost:''},{carId:'ford',title:'Objednat těsnění dveří',description:'Dohledat kompatibilní sadu.',due:'',owner:'',kind:'repair',priority:'normal',status:'waiting',cost:'',actualCost:''},{carId:'jeep',title:'Zkontrolovat brzdy',description:'Ukázka dokončeného úkolu.',due:C.offset(-7),owner:'Servis',kind:'service',priority:'normal',status:'done',completedAt:today(),cost:'',actualCost:''}];
    return [...cars.map(c=>event('cars',c.id,C.clean(c))),...ts.map(t=>event('tasks',uid(),t)),event('notes',uid(),{carId:'allegro',kind:'note',title:'Nápady na interiér',body:'Béžová kůže, mahagon a podlaha v dekoru ořechu.\nPřed objednávkou všechno znovu přeměřit.',url:''}),event('notes',uid(),{carId:'ford',kind:'link',title:'Inspirace a návody na opravy',body:'Ukázka uloženého odkazu. Můžeš sem dávat konkrétní videa i stránky s díly.',url:'https://www.youtube.com/'})];
  }
  try {const stored=JSON.parse(localStorage.getItem(prefix)||'null');setData(Array.isArray(stored)?stored:seed());}catch{setData(seed());}
  if(localStorage.getItem('garaz.theme')==='dark')document.body.classList.add('dark');
  const compareHeads=(a,b)=>JSON.stringify([...(a||[])].sort())===JSON.stringify([...(b||[])].sort());
  async function loadCloud(){const rows=await G.load();setData(rows);lastSync=new Intl.DateTimeFormat('cs-CZ',{hour:'2-digit',minute:'2-digit'}).format(new Date());}
  async function write(entity,id,record,parents){
    if(busy)throw new Error('Počkej na dokončení předchozího ukládání.');
    busy=true;
    try{
      if(mode==='cloud')await loadCloud();
      else {const stored=JSON.parse(localStorage.getItem(prefix)||'null');if(Array.isArray(stored))setData(stored);}
      const current=data[entity].find(r=>r.id===id);
      if(!compareHeads(current?._heads,parents))throw new Error('Někdo tento záznam mezitím změnil. Tvoje rozepsaná data zůstala ve formuláři. Zkopíruj je, zavři formulář a otevři záznam znovu pro porovnání.');
      if(entity!=='cars'&&record.carId&&!data.cars.some(c=>c.id===record.carId))throw new Error('Vybrané auto již neexistuje. Obnov data.');
      if(entity==='cars'&&record.coverFileId&&!data.files.some(f=>f.id===record.coverFileId&&f.carId===id&&!f.removed))throw new Error('Úvodní fotka musí patřit k tomuto autu. Vyber ji znovu.');
      const row=event(entity,id,record,parents);
      if(mode==='demo'){
        const next=[...events,row];localStorage.setItem(prefix,JSON.stringify(next));setData(next);
      }else{
        try{await G.append(row);}catch(error){try{await loadCloud();if(!events.some(r=>r.id===row.id))throw error;}catch{throw error;}}
        // Preserve an acknowledged append even if the subsequent refresh is offline.
        if(!events.some(r=>r.id===row.id))setData([...events,row]);
        try{await loadCloud();}catch{notify('Změna je uložená v Googlu. Úplné obnovení dat se nepodařilo; zkus Obnovit.');}
      }
    }finally{busy=false;}
  }
  function art(c){
    const color=e(c.color||colors[0]),style=c.style||'suv';
    const wheels='<circle cx="71" cy="120" r="21" fill="#343c37"/><circle cx="71" cy="120" r="11" fill="#cbd0c7"/><circle cx="71" cy="120" r="5" fill="#7e887f"/><circle cx="244" cy="120" r="21" fill="#343c37"/><circle cx="244" cy="120" r="11" fill="#cbd0c7"/><circle cx="244" cy="120" r="5" fill="#7e887f"/>';
    let body=style==='rv'?`<path d="M26 39Q26 31 36 31H238L276 66 293 73V116H26Z" fill="${color}"/><path d="M33 88H281V106H33Z" fill="#e3d3b1"/><path d="M43 43H95V72H43ZM108 43H164V72H108ZM180 43H230L255 68H180Z" fill="#c6d5d1"/><path d="M172 37V108" stroke="#414d3e55" stroke-width="2"/><rect x="182" y="78" width="12" height="3" rx="1" fill="#44533d"/><path d="M29 95H291" stroke="#6c725650" stroke-width="3"/><rect x="281" y="81" width="12" height="11" rx="2" fill="#fae5a8"/>`:style==='pickup'?`<path d="M26 78H115V45Q115 39 123 39H187L213 76H284Q293 76 293 86V115H26Z" fill="${color}"/><path d="M124 46H179L198 75H124Z" fill="#b8cdcd"/><path d="M115 79V110M212 79V110" stroke="#684b3644" stroke-width="2"/><path d="M28 83H103V99H28Z" fill="#ece0c4"/><path d="M218 88H287V102H218Z" fill="#ece0c4"/><rect x="179" y="83" width="14" height="3" rx="1" fill="#594737"/><rect x="281" y="78" width="12" height="15" rx="2" fill="#fae5a8"/>`:`<path d="M25 84 50 75 78 44Q83 39 93 39H221L250 75 286 83Q293 85 293 94V116H25Z" fill="${color}"/><path d="M62 75 86 47H136V75ZM147 47H210L233 75H147Z" fill="#c2d3d4"/><path d="M140 42V110M243 79V111" stroke="#46536455" stroke-width="2"/><path d="M30 99H289" stroke="#d7dcd5" stroke-width="4"/><rect x="120" y="82" width="13" height="3" rx="1" fill="#414d55"/><rect x="216" y="82" width="13" height="3" rx="1" fill="#414d55"/><rect x="280" y="82" width="12" height="10" rx="2" fill="#fae5a8"/>`;
    return `<svg viewBox="0 0 320 155" aria-hidden="true"><ellipse cx="160" cy="137" rx="141" ry="6" fill="#303b2912"/>${body}${wheels}<path d="M22 115H45M270 115H299" stroke="#cad0c8" stroke-width="6" stroke-linecap="round"/></svg>`;
  }
  const button=(label,action,extra='',cls='button')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const empty=(title,body,action='',label='Přidat úkol')=>`<div class="empty"><span class="empty-symbol">▱</span><strong>${e(title)}</strong>${e(body)}${action?'<br>'+button(label,action,'','button primary'):''}</div>`;
  function carVisual(c){
    const cover=data.files.find(f=>f.id===c.coverFileId&&f.carId===c.id&&!f.removed);
    return art(c)+(cover?`<div class="car-cover" data-photo="${e(cover.id)}" aria-label="Úvodní fotografie ${e(c.name)}"></div>`:'');
  }
  function top(title,description,action='',label='+ Přidat úkol'){return `<div class="page-top"><div><span class="eyebrow">${new Intl.DateTimeFormat('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()).toLocaleUpperCase('cs')}</span><h1>${e(title)}</h1><p>${e(description)}</p></div>${action&&writable()?button(e(label),action,'','button primary'):''}</div>`;}
  function carCard(c){
    const ts=openTasks().filter(t=>t.carId===c.id),late=ts.filter(t=>C.due(t)==='late').length;
    return `<article class="car-card" tabindex="0" role="button" data-action="open-car" data-id="${e(c.id)}" aria-label="Otevřít ${e(c.name)}"><div class="car-art">${carVisual(c)}<span class="badge">${e(c.type||'Auto')}</span><span class="year">${e(c.year)}</span></div><div class="car-body"><h3>${e(c.name)}</h3><p>${e(c.plate||'Vlastní místo pro všechny plány')}</p><div class="car-bottom"><span>${ts.length} ${ts.length===1?'otevřený úkol':'otevřených úkolů'}</span><span class="${late?'late':''}">${late?late+' po termínu':'Vše pod kontrolou'} <span aria-hidden="true">↗</span></span></div></div></article>`;
  }
  function taskRow(t){const c=car(t.carId),d=C.due(t);return `<div class="task-row ${t.status==='done'?'completed':''}"><button class="check ${t.status==='done'?'checked':''}" data-action="toggle-task" data-id="${e(t.id)}" aria-label="${t.status==='done'?'Znovu otevřít':'Dokončit'}: ${e(t.title)}" ${writable()?'':'disabled'}>${t.status==='done'?'✓':''}</button><button class="task-main" data-action="edit-task" data-id="${e(t.id)}"><span class="task-title">${e(t.title)}${t._conflict?' ⚠':''}</span><span class="task-meta"><i class="dot" style="background:${safeColor(c?.color)}"></i>${e(c?.name||'Auto')}<span>·</span>${e(t.owner||'Nepřiřazeno')}<span>·</span>${e(kinds[t.kind]||'Úkol')}</span></button><div class="task-trailing"><span class="badge ${e(t.status)}">${e(status[t.status]||'Úkol')}</span><span class="due-text ${d==='late'?'late':''}">${d==='late'?'↳ ':''}${fmt(t.due)}</span></div></div>`;}
  function safeColor(s){return /^#[0-9a-f]{6}$/i.test(s||'')?s:colors[0];}
  function agenda(ts){return ts.length?`<div class="panel agenda">${ts.map(t=>`<div class="agenda-row"><div class="date-square">${C.date(t.due).getDate()}<small>${fmt(t.due,{month:'short'})}</small></div><button class="task-main" data-action="edit-task" data-id="${e(t.id)}"><span class="task-title">${e(t.title)}</span><span class="task-meta">${e(car(t.carId)?.name)} · ${e(t.owner||'Nepřiřazeno')}</span></button></div>`).join('')}</div>`:empty('Nic nehoří','Nejbližší naplánované úkoly se objeví tady.');}
  function overview(){
    const open=openTasks(),late=open.filter(t=>C.due(t)==='late'),soon=open.filter(t=>C.due(t)==='soon'),done=tasks().filter(t=>t.status==='done'&&t.completedAt?.slice(0,7)===today().slice(0,7)),upcoming=open.filter(t=>t.due&&t.due>=today()).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,3);
    const priority=[...open].sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')).slice(0,5);
    return top('Auta pod kontrolou.','Opravy, nápady a termíny. Všechno na jednom místě.','new-task')+`<div class="stats">${[[activeCars().length,'Aut v garáži','Každé má svůj příběh','▱',''],[late.length,'Po termínu','Tady je potřeba zabrat','↗','alert'],[soon.length,'V příštích 7 dnech','Dnes a dalších 7 dní','▦',''],[done.length,'Hotovo tento měsíc','I malé kroky se počítají','✓','']].map(([n,title,sub,icon,cls])=>`<div class="stat ${cls}"><div class="stat-line">${title}<span class="stat-icon">${icon}</span></div><strong>${n}</strong><small>${sub}</small></div>`).join('')}</div><div class="section-heading"><h2>Moje auta <span class="muted" style="font-size:12px;font-weight:400"> / ${activeCars().length}</span></h2>${button('Všechna auta →','view-cars','','text-button')}</div>${activeCars().length?'<div class="car-grid">'+activeCars().slice(0,3).map(carCard).join('')+'</div>':empty('Garáž čeká na první auto','Začni přidáním auta, pak k němu naplánuj první práci.','new-car','+ Přidat auto')}<div class="two-col"><section><div class="section-heading"><h2>Co je potřeba vyřešit</h2>${button('Všechny úkoly →','view-tasks','','text-button')}</div><div class="panel">${priority.length?priority.map(taskRow).join(''):empty('Máš čistý stůl','Přidej další opravu nebo nápad.','new-task')}</div></section><section><div class="section-heading"><h2>Nejbližší termíny</h2>${button('Kalendář ↗','view-calendar','','text-button')}</div>${agenda(upcoming)}<div class="tip"><span>✦</span><div><strong>${open.filter(t=>!t.due).length?'Dej plánům konkrétní datum':'Nápad nemusíš držet v hlavě'}</strong><p>${open.filter(t=>!t.due).length?'Úkoly bez termínu: '+open.filter(t=>!t.due).length+'. Stačí jim doplnit datum a objeví se v kalendáři.':'Ulož si poznámku, odkaz nebo fotku rovnou ke konkrétnímu autu.'}</p></div></div></section></div>`;
  }
  function filterBar(withStatus=false){return `<div class="filters"><input id="search" type="search" placeholder="Hledat v názvech a popisech…" value="${e(filters.q)}" aria-label="Hledat"><select id="filter-car" aria-label="Filtrovat auto"><option value="">Všechna auta</option>${data.cars.map(c=>`<option value="${e(c.id)}" ${filters.car===c.id?'selected':''}>${e(c.name)}${c.archived?' (archiv)':''}</option>`).join('')}</select>${withStatus?`<select id="filter-status" aria-label="Filtrovat stav"><option value="open" ${filters.status==='open'?'selected':''}>Otevřené úkoly</option><option value="all" ${filters.status==='all'?'selected':''}>Všechny stavy</option>${Object.entries(status).map(([k,v])=>`<option value="${k}" ${filters.status===k?'selected':''}>${v}</option>`).join('')}<option value="late" ${filters.status==='late'?'selected':''}>Po termínu</option><option value="none" ${filters.status==='none'?'selected':''}>Bez termínu</option></select>`:''}</div>`;}
  function matches(r,selectedCar=filters.car){return (!selectedCar||r.carId===selectedCar)&&(!filters.q||[r.title,r.description,r.body,r.owner,r.url,car(r.carId)?.name].join(' ').toLocaleLowerCase('cs').includes(filters.q.toLocaleLowerCase('cs')));}
  function taskList(list=tasks(),useFilter=true){const filtered=list.filter(t=>!useFilter||matches(t)&&(filters.status==='all'||filters.status==='open'&&t.status!=='done'||filters.status==='late'&&C.due(t)==='late'||filters.status==='none'&&!t.due&&t.status!=='done'||filters.status===t.status)).sort((a,b)=>(a.status==='done')-(b.status==='done')||(a.due||'9999').localeCompare(b.due||'9999'));return `<div class="panel">${filtered.length?filtered.map(taskRow).join(''):empty('Tady zatím nic není','Změň filtr nebo přidej nový úkol.')}</div>`;}
  function notesList(list){return list.length?`<div class="notes-grid">${list.map(n=>`<article class="note-card"><span class="badge">${n.kind==='link'?'↗ Odkaz':'▤ Poznámka'}</span><h3>${e(n.title)}${n._conflict?' ⚠':''}</h3><p>${e(n.body)}</p>${C.url(n.url)?`<a href="${e(C.url(n.url))}" target="_blank" rel="noopener noreferrer">${e(n.url)} ↗</a>`:''}<div class="note-bottom"><span>${e(car(n.carId)?.name||'Společné poznámky')}</span>${button('Otevřít →','edit-note',`data-id="${e(n.id)}"`,'text-button')}</div></article>`).join('')}</div>`:empty('Místo pro tvoje nápady','Poznámky, stránky s díly i videa z YouTube.','new-note','+ Přidat poznámku');}
  function photosList(list){return list.length?`<div class="photo-grid">${list.map(f=>`<article class="photo-card"><div class="photo-placeholder" data-photo="${e(f.id)}">Načítám náhled…</div><div class="photo-caption"><strong>${e(f.title||f.name)}</strong>${car(f.carId)?.coverFileId===f.id?'<span class="badge done">Úvodní fotka</span>':writable()?button('Použít jako úvodní','use-cover',`data-id="${e(f.id)}"`,'text-button'):''}<small>${e(car(f.carId)?.name)}${f.taskId?' · '+e(data.tasks.find(t=>t.id===f.taskId)?.title||'Úkol'):''}</small><div class="note-bottom"><span>${fmt(f.createdAt?.slice(0,10))}</span>${f.driveId?`<a href="https://drive.google.com/file/d/${encodeURIComponent(f.driveId)}/view" target="_blank" rel="noopener noreferrer">Otevřít na Disku ↗</a>`:button('Otevřít fotku ↗','open-photo',`data-id="${e(f.id)}"`,'text-button')}</div></div></article>`).join('')}</div>`:empty('Zatím bez fotek','Vyfoť stav před opravou, průběh práce nebo zajímavý detail.','new-photo','+ Přidat fotky');}
  function calendarView(){const y=month.getFullYear(),m=month.getMonth();const list=tasks().filter(t=>matches(t));return top('Každý plán má svůj termín.','Kliknutím na den přidáš úkol. Kliknutím na událost otevřeš detail.')+filterBar()+`<div class="section-heading"><div class="calendar-toolbar">${button('‹','prev-month','aria-label="Předchozí měsíc"')}<h2>${new Intl.DateTimeFormat('cs-CZ',{month:'long',year:'numeric'}).format(month)}</h2>${button('›','next-month','aria-label="Další měsíc"')}${button('Dnes','this-month','','button small')}</div>${button('Export .ics ↓','export-ics','','button small')}</div><div class="panel calendar-scroll"><div class="calendar-grid">${['PO','ÚT','ST','ČT','PÁ','SO','NE'].map(d=>`<div class="weekday">${d}</div>`).join('')}${C.calendar(y,m).map(d=>`<div class="cal-day ${d.inside?'':'outside'}"><button class="day-num ${d.day===today()?'today':''}" data-action="day-task" data-day="${d.day}" aria-label="Přidat úkol na ${e(fmt(d.day,{day:'numeric',month:'long',year:'numeric'}))}">${d.number}</button>${list.filter(t=>t.due===d.day).map(t=>`<button class="cal-event ${t.status==='done'?'done':''}" data-action="edit-task" data-id="${e(t.id)}" title="${e(t.title)}"><small>${e(car(t.carId)?.name)}</small>${e(t.title)}</button>`).join('')}</div>`).join('')}</div></div><p style="font-size:11px;margin-top:14px">${list.filter(t=>!t.due&&t.status!=='done').length} otevřených úkolů bez termínu. Export je jednorázový snímek pro import do kalendáře.</p>`;}
  function carDetail(){const c=car(carId);if(!c)return empty('Auto se nepodařilo najít','Vrať se do přehledu aut.','view-cars','Moje auta');const ts=tasks().filter(t=>t.carId===c.id),open=ts.filter(t=>t.status!=='done');return top(c.name,[c.year,c.type,c.plate].filter(Boolean).join(' · '),'edit-car','Upravit auto')+`<div class="car-detail-top"><div class="car-art">${carVisual(c)}</div><div><span class="badge">${c.archived?'Archivované auto':'V mojí garáži'}</span><p style="white-space:pre-wrap;font-size:12px;margin-top:15px">${e(c.description||'Každý detail se hodí. Doplň si poznámku k autu.')}</p><div class="mini-stats"><span><strong>${open.length}</strong> otevřeno</span><span><strong>${ts.filter(t=>t.status==='done').length}</strong> hotovo</span><span><strong>${money(ts.reduce((s,t)=>s+(Number(t.actualCost)||0),0))}</strong> náklady</span></div>${writable()?button('+ Přidat úkol','new-task')+' '+button('+ Fotky','new-photo','','button ghost'):''}</div></div><div class="tabs">${[['tasks','Úkoly a historie'],['notes','Poznámky a odkazy'],['photos','Fotky']].map(([key,label])=>`<button data-action="car-tab" data-tab="${key}" class="${carTab===key?'active':''}">${label}</button>`).join('')}</div>${carTab==='tasks'?taskList(ts,false):carTab==='notes'?`<div class="section-heading"><h2>Poznámky k autu</h2>${writable()?button('+ Přidat','new-note','','button small'):''}</div>`+notesList(data.notes.filter(n=>!n.removed&&n.carId===carId)):photosList(data.files.filter(f=>!f.removed&&f.carId===carId))}`;}
  function settings(){const cfg=G.config;return top('Tvoje garáž. Tvoje data.','Připoj Google a sdílej práci s lidmi, které si vybereš.')+`<div class="settings-grid"><div><section class="panel"><h3>1. Připojení ke Googlu</h3><p>Propoj aplikaci se svým Google projektem podle přiloženého návodu NASAZENI.md. Tyto hodnoty jsou veřejná konfigurace, žádné heslo.</p><form id="config-form"><label>Google OAuth Client ID<input name="clientId" value="${e(cfg.clientId)}" placeholder="…apps.googleusercontent.com" required></label><div class="form-grid"><label>Google Picker API key<input name="apiKey" value="${e(cfg.apiKey)}" required></label><label>Číslo Google Cloud projektu<input name="projectNumber" value="${e(cfg.projectNumber)}" inputmode="numeric" required></label></div><button class="button" type="submit">Uložit konfiguraci</button></form><div class="stack">${button(mode==='cloud'&&G.ready()?'Změnit Google účet':'Přihlásit přes Google','connect','','button primary')}${mode==='cloud'?button('Odhlásit','logout'):''}</div>${G.profile?`<p style="margin:12px 0 0">Přihlášen: ${e(G.profile.email)}${G.canEdit?' · Úpravy povoleny':' · Nejprve vyber tabulku'}</p>`:''}</section><section class="panel"><h3>2. Společná tabulka</h3><p>Vlastník ji jednou vytvoří. Ostatní vyberou stejnou nasdílenou tabulku přes Google. Výběrem jí povolí přístup pro aplikaci.</p><div class="status-box">${cfg.spreadsheetId?`<a href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.spreadsheetId)}/edit" target="_blank" rel="noopener noreferrer">Otevřít tabulku ↗</a><br>ID: ${e(cfg.spreadsheetId)}`:'Zatím není vybraná tabulka.'}</div><div class="stack">${button('Vybrat tabulku','pick-sheet')}${button('Vytvořit novou','create-sheet','','button ghost')}</div></section></div><div><section class="panel"><h3>3. Složka pro fotky</h3><p>Můžeš použít svou existující složku. Nasdílej ji stejným lidem jako tabulku. Každý ji při prvním připojení vybere pro aplikaci.</p><div class="status-box">${cfg.folderId?`<a href="https://drive.google.com/drive/folders/${encodeURIComponent(cfg.folderId)}" target="_blank" rel="noopener noreferrer">Otevřít složku ↗</a><br>ID: ${e(cfg.folderId)}`:'Zatím není vybraná složka.'}</div><div class="stack">${button('Vybrat složku','pick-folder')}${button('Vytvořit novou','create-folder','','button ghost')}</div></section><section class="panel"><h3>Kdo má přístup</h3><p>Tabulku i složku v Googlu nastav na <strong>Omezený přístup</strong> a pozvi konkrétní e-maily. Pro práci přiděl roli Editor, pro prohlížení Čtenář. Všichni přizvaní vidí všechna auta.</p><p>Přístup do dat hlídá Google. Samotná stránka na GitHub Pages je veřejná. Účastníci s rolí Editor mohou upravovat i zdrojovou tabulku.</p><p>Termíny jsou celodenní. Aplikace zatím neposílá automatické e-maily ani push upozornění. Kalendář lze jednorázově exportovat do .ics.</p></section><section class="panel"><h3>Záloha a ukázková data</h3><p>Export obsahuje záznamy a odkazy na fotky, nikoli samotné obrázky. Originály zůstávají na Disku. V ukázce se data ukládají pouze v tomto prohlížeči.</p><div class="stack">${button('Export záznamů JSON ↓','export-json')}${button('Vrátit původní ukázku','reset-demo','','button ghost')}</div></section></div></div>`;}
  function render(){
    renderVersion++;
    $('#breadcrumb').textContent=view==='car'?car(carId)?.name||labels.car:labels[view];
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===(view==='car'?'cars':view)));
    $('#car-count').textContent=activeCars().length;$('#task-count').textContent=openTasks().length;
    $('#connection').textContent=mode==='demo'?'Ukázkový režim':G.ready()?(G.canEdit?'Google · '+(lastSync||'připojeno'):'Google · čtení'):'Přihlášení vypršelo';$('#connection').classList.toggle('online',mode==='cloud'&&G.ready());
    $('#account').textContent=mode==='cloud'?(G.profile?.given_name||G.profile?.email||'G')[0].toLocaleUpperCase('cs'):'G';
    const banners=[];
    if(mode==='demo')banners.push('UKÁZKA · Zkoušej bez obav. Změny zůstávají v tomto prohlížeči, do Googlu se neposílají. '+button('Připojit Google →','view-settings'));
    else if(!G.ready())banners.push('Přihlášení vypršelo. '+button('Přihlásit znovu','connect'));
    if(data.conflicts.length)banners.push('⚠ '+data.conflicts.length+' souběžně upravených záznamů. Otevři je, porovnej verze a ulož společnou podobu.');
    $('#mode-banner').innerHTML=banners.join('<br>');
    let html='';
    if(view==='overview')html=overview();
    if(view==='cars')html=top('Každé auto má svoje místo.','Od každodenních jízd po projekty, které stojí za to.','new-car','+ Přidat auto')+`<div class="car-grid">${activeCars().map(carCard).join('')}</div>`+(activeCars().length?'':empty('Přidej svoje první auto','Ať má každá oprava a nápad svoje místo.','new-car','+ Přidat auto'))+(data.cars.some(c=>c.archived)?'<h2 style="margin-bottom:18px">Archiv</h2><div class="car-grid">'+data.cars.filter(c=>c.archived).map(carCard).join('')+'</div>':'');
    if(view==='tasks')html=top('Od nápadu k hotové práci.','Co opravit, kdo to zařídí a do kdy.','new-task')+filterBar(true)+taskList();
    if(view==='calendar')html=calendarView();
    if(view==='notes')html=top('Dobré nápady se neztrácí.','Poznámky, zajímavé stránky i návody z YouTube.','new-note','+ Přidat poznámku')+filterBar()+notesList(data.notes.filter(n=>!n.removed&&matches(n)));
    if(view==='photos')html=top('Všechno důležité i na fotce.','Stav před opravou, drobné detaily i hotová práce.','new-photo','+ Přidat fotky')+filterBar()+photosList(data.files.filter(f=>!f.removed&&matches(f)));
    if(view==='car')html=carDetail();
    if(view==='settings')html=settings();
    $('#main').innerHTML=html;
    $('#theme span').textContent=document.body.classList.contains('dark')?'Světlý vzhled':'Tmavý vzhled';
    hydratePhotos(renderVersion);
  }
  function navigate(v){view=v;filters={q:'',car:'',status:'open'};location.hash=v==='car'?'car/'+encodeURIComponent(carId):v;render();}
  function field(name,label,value='',type='text',extra=''){return `<label ${extra}>${label}<input name="${name}" type="${type}" value="${e(value)}" ${name==='title'||name==='name'?'required maxlength="150"':''} ${type==='number'?'min="0" step="0.01"':''}></label>`;}
  function select(name,label,options,value='',extra=''){return `<label ${extra}>${label}<select name="${name}">${options.map(([k,v])=>`<option value="${e(k)}" ${k===value?'selected':''}>${e(v)}</option>`).join('')}</select></label>`;}
  function carsOptions(includeEmpty=false){return [...(includeEmpty?[['','Společné / bez auta']]:[]),...data.cars.filter(c=>!c.archived||c.id===edit?.record?.carId||(view==='car'&&c.id===carId)).map(c=>[c.id,c.name+(c.archived?' (archiv)':'')])];}
  function conflictFields(r){return r?._conflict?`<div class="conflict"><strong>Souběžné změny — porovnej obě verze</strong>${r._variants.map((v,i)=>`<details><summary>Verze ${i+1} · ${e(v.author)} · ${e(new Date(v.at).toLocaleString('cs-CZ'))}</summary><pre>${e(JSON.stringify(v.data,null,2))}</pre></details>`).join('')}<label style="margin:12px 0 0"><input style="display:inline;width:auto" type="checkbox" name="resolveConflict" required> Porovnal jsem verze a ukládám jejich společnou podobu.</label></div>`:'';}
  function showEditor(kind,id='',day=''){
    if(!writable()&&!id){notify('Pro úpravy potřebuješ přihlášení a roli Editor v tabulce.');return;}
    if(!id&&kind!=='car'&&!activeCars().length&&kind!=='note'&&!(view==='car'&&car(carId))){notify('Nejdřív přidej auto.');showEditor('car');return;}
    const entity={car:'cars',task:'tasks',note:'notes',photo:'files'}[kind],record=data[entity].find(r=>r.id===id)||{},cId=view==='car'?carId:filters.car||activeCars()[0]?.id||'';
    edit={kind,entity,id:id||uid(),record,parents:record._heads||[]};
    $('#dialog-title').textContent={car:id?'Upravit auto':'Nové auto',task:id?'Detail úkolu':'Co je potřeba udělat?',note:id?'Poznámka a odkaz':'Ulož si nápad',photo:'Přidat fotky'}[kind];
    $('#dialog-eyebrow').textContent=mode==='demo'?'UKÁZKA · POUZE TENTO PROHLÍŽEČ':'SPOLEČNÁ GARÁŽ';
    let fields=conflictFields(record);
    if(kind==='car')fields+=`<div class="form-grid">${field('name','Název auta',record.name||'','text','class="wide"')}${field('year','Rok výroby',record.year||'','text')}${field('plate','SPZ / poznávací označení',record.plate||'')}${field('type','Typ auta',record.type||'')}${select('style','Ilustrace',[['suv','Osobní auto / SUV'],['pickup','Pick-up'],['rv','Obytné auto']],record.style||'suv')}${select('color','Barva karty',colors.map((c,i)=>[c,['Šalvějová','Písková','Modrošedá','Cihlová','Olivová','Grafitová'][i]]),record.color||colors[0])}${select('archived','Zařazení',[['no','Aktivní garáž'],['yes','Archiv']],record.archived?'yes':'no')}${select('coverFileId','Úvodní fotka',[['','Použít ilustraci'],...data.files.filter(f=>!f.removed&&f.carId===id).map(f=>[f.id,f.title||f.name])],record.coverFileId||'','class="wide"')}<p class="wide" style="font-size:11px">Vlastní fotku nahraješ po uložení auta tlačítkem + Fotky. V galerii ji můžeš nastavit jako úvodní.</p><label class="wide">Poznámka k autu<textarea name="description" maxlength="20000">${e(record.description)}</textarea></label></div>`;
    if(kind==='task')fields+=`<div class="form-grid">${field('title','Název úkolu',record.title||'','text','class="wide"')}${select('carId','Auto',carsOptions(),record.carId||cId)}${select('kind','Typ práce',Object.entries(kinds),record.kind||'repair')}${field('due','Termín',record.due||day,'date')}${field('owner','Kdo to zařídí',record.owner||'')}${select('status','Stav',Object.entries(status),record.status||'todo')}${select('priority','Priorita',[['normal','Běžná'],['high','Vysoká']],record.priority||'normal')}${field('cost','Odhad nákladů (Kč)',record.cost??'','number')}${field('actualCost','Skutečné náklady (Kč)',record.actualCost??'','number')}<label class="wide">Co je potřeba a další podrobnosti<textarea name="description" maxlength="20000">${e(record.description)}</textarea></label></div>`+(id?`<div class="stack">${button('Přidat fotky k úkolu','task-photo',`data-id="${e(id)}"`,'button small')}${button('Odstranit úkol','remove-task',`data-id="${e(id)}"`,'button ghost danger')}</div>`:'');
    if(kind==='note')fields+=`<div class="form-grid">${field('title','Nadpis',record.title||'','text','class="wide"')}${select('carId','K jakému autu',carsOptions(true),record.carId??(view==='car'?carId:''))}${select('kind','Co ukládáš',[['note','Poznámka'],['link','Odkaz / video']],record.kind||'note')}${field('url','Odkaz na web / YouTube',record.url||'','url','class="wide"')}<label class="wide">Poznámka<textarea name="body" maxlength="20000">${e(record.body)}</textarea></label></div>`+(id?button('Odstranit poznámku','remove-note',`data-id="${e(id)}"`,'button ghost danger'):'');
    if(kind==='photo')fields+=select('carId','Auto',carsOptions(),record.carId||cId)+select('taskId','Ke konkrétnímu úkolu',[['','Jen k autu'],...tasks().filter(t=>t.carId===(record.carId||cId)).map(t=>[t.id,t.title])],'')+`<label>Popis fotek (nepovinný)<input name="title" maxlength="150"></label><label>Vybrat fotky<input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple required><small>JPG, PNG nebo WebP. Nejvýše 12 MB na fotku a 8 fotek najednou. Ukládají se originály. HEIC nejdřív převeď do JPG.</small></label><label class="checkbox-label"><input type="checkbox" name="useCover" ${car(record.carId||cId)?.coverFileId?'':'checked'}> Použít první nahranou fotku jako úvodní fotografii auta</label>`;
    $('#form-fields').innerHTML=fields;$('#save-button').disabled=false;$('#save-button').textContent=kind==='photo'?'Nahrát fotky':'Uložit';
    $('#save-button').classList.toggle('hidden',!writable());
    if(!writable()){
      $('#form-fields').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
      $('#dialog-eyebrow').textContent='PROHLÍŽENÍ · PŘÍSTUP JEN KE ČTENÍ';
    }
    if(!$('#editor').open)$('#editor').showModal();
    setTimeout(()=>$('#editor input, #editor select')?.focus(),0);
  }
  function closeEditor(){if(busy||uploading)return;$('#editor').close();edit=null;}
  async function saveEditor(ev){ev.preventDefault();if(!edit)return;const current=edit,values=Object.fromEntries(new FormData(ev.target));const submit=$('#save-button');submit.disabled=true;submit.textContent='Ukládám…';
    try{
      if(current.kind==='photo'){uploading=true;try{await uploadPhotos(values,ev.target.elements.photos.files);}finally{uploading=false;}closeEditor();render();notify('Fotky jsou uložené.');return;}
      const r={...C.clean(current.record),...values};delete r.resolveConflict;
      if(current.kind==='car'){r.name=r.name.trim();if(!r.name)throw new Error('Napiš název auta.');r.archived=r.archived==='yes';}
      if(current.kind==='task'){r.title=r.title.trim();if(!r.title)throw new Error('Napiš název úkolu.');r.completedAt=r.status==='done'?(current.record.status==='done'?current.record.completedAt||today():today()):'';}
      if(current.kind==='note'){r.title=r.title.trim();if(!r.title)throw new Error('Napiš nadpis.');if(r.url&&!C.url(r.url))throw new Error('Odkaz musí začínat https:// nebo http://.');if(r.kind==='link'&&!r.url)throw new Error('K odkazu doplň webovou adresu.');}
      await write(current.entity,current.id,r,current.parents);closeEditor();render();notify(mode==='cloud'?'Uloženo do Googlu.':'Uloženo v ukázce v tomto prohlížeči.');
    }catch(error){notify(error.message);}
    finally{submit.disabled=false;submit.textContent=current.kind==='photo'?'Nahrát fotky':'Uložit';}
  }
  function localDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('garaz-photos:'+location.pathname,1);req.onupgradeneeded=()=>req.result.createObjectStore('photos');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('Prohlížeč nepovolil místní ukládání fotek.'));});}
  async function localPhoto(id,blob){const db=await localDb();return new Promise((resolve,reject)=>{const tx=db.transaction('photos',blob?'readwrite':'readonly'),req=blob?tx.objectStore('photos').put(blob,id):tx.objectStore('photos').get(id);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(new Error('Fotku se nepodařilo uložit v prohlížeči.'));};});}
  async function uploadPhotos(v,files){
    if(files.length>8)throw new Error('Vyber nejvýš 8 fotek najednou.');
    for(const f of files){if(!['image/jpeg','image/png','image/webp'].includes(f.type))throw new Error('Povolené jsou pouze JPG, PNG a WebP.');if(f.size>12*1024*1024)throw new Error('Fotka '+f.name+' je větší než 12 MB.');}
    const selectedTask=data.tasks.find(t=>t.id===v.taskId);if(v.taskId&&selectedTask?.carId!==v.carId)throw new Error('Úkol musí patřit k vybranému autu.');
    const coverCar=v.useCover?car(v.carId):null;
    if(coverCar?._conflict)throw new Error('Auto má souběžné úpravy. Nejdřív je vyřeš v Upravit auto.');
    let uploaded=0;
    for(const f of files){const id=uid();let driveId='';
      try{
        if(mode==='cloud'){const r=await G.upload(f);driveId=r.id;}else await localPhoto(id,f);
        await write('files',id,{carId:v.carId,taskId:v.taskId||'',title:v.title.trim()||f.name,name:f.name,mime:f.type,size:f.size,driveId,createdAt:new Date().toISOString()},[]);uploaded++;
        if(uploaded===1&&coverCar)await write('cars',coverCar.id,{...C.clean(coverCar),coverFileId:id},coverCar._heads);
      }catch(err){render();throw new Error('Uloženo '+uploaded+' z '+files.length+' fotek. '+err.message+(driveId?' Fotka již je na Disku, ale její záznam se nepodařilo připojit: https://drive.google.com/file/d/'+driveId+'/view':''));}
    }
  }
  async function hydratePhotos(version){
    const nodes=[...document.querySelectorAll('[data-photo]')];
    // Limit concurrent original-image downloads and keep a bounded object URL cache.
    let cursor=0;await Promise.all(Array.from({length:Math.min(3,nodes.length)},async()=>{while(cursor<nodes.length){const node=nodes[cursor++],f=data.files.find(f=>f.id===node.dataset.photo);if(!f||version!==renderVersion)continue;try{let url=photoUrls.get(f.id);if(!url){const blob=mode==='cloud'?await G.photo(f.driveId):await localPhoto(f.id);if(!blob)throw Error();url=URL.createObjectURL(blob);photoUrls.set(f.id,url);if(photoUrls.size>40){const [oldId,oldUrl]=photoUrls.entries().next().value;URL.revokeObjectURL(oldUrl);photoUrls.delete(oldId);}}if(version!==renderVersion)continue;const image=new Image();image.alt=f.title||f.name;image.src=url;image.loading='lazy';node.replaceChildren(image);}catch{if(version===renderVersion&&node.classList.contains('car-cover')){node.title='Fotku se nepodařilo načíst. Zkontroluj přihlášení a přístup k fotce na Disku.';continue;}if(version===renderVersion)node.textContent=mode==='cloud'?'Náhled není dostupný. Otevři fotku na Disku.':'Fotka není v tomto prohlížeči dostupná.';}}}));
  }
  function clearPhotos(){for(const url of photoUrls.values())URL.revokeObjectURL(url);photoUrls.clear();}
  function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function connect(){
    if(busy)return;
    const p=await G.connect();mode='cloud';clearPhotos();setData([]);view='settings';lastSync='';render();
    if(G.config.spreadsheetId){try{await loadCloud();view='overview';}catch(error){notify(error.message);}}
    render();notify('Přihlášeno jako '+p.email+'. '+(G.config.spreadsheetId?'':'Vyber nebo vytvoř společnou tabulku.'));
  }
  async function action(name,target){
    const id=target?.dataset.id;
    if(name.startsWith('view-')){navigate(name.slice(5));return;}
    if(name==='use-cover'){
      if(!writable())throw new Error('Pro úpravy potřebuješ přihlášení a roli Editor.');
      const f=data.files.find(f=>f.id===id&&!f.removed),c=f&&car(f.carId);
      if(!c)throw new Error('Auto nebo fotka už není dostupná.');
      if(c._conflict){showEditor('car',c.id);return;}
      await write('cars',c.id,{...C.clean(c),coverFileId:f.id},c._heads);render();notify('Úvodní fotka auta je nastavená.');return;
    }
    if(name==='open-car'){carId=id;carTab='tasks';navigate('car');return;}
    if(name==='car-tab'){carTab=target.dataset.tab;render();return;}
    if(name==='new-car'||name==='edit-car'){showEditor('car',name==='edit-car'?carId:'');return;}
    if(name==='new-task'||name==='edit-task'||name==='day-task'){showEditor('task',name==='edit-task'?id:'',target?.dataset.day||'');return;}
    if(name==='new-note'||name==='edit-note'){showEditor('note',name==='edit-note'?id:'');return;}
    if(name==='new-photo'){showEditor('photo');return;}
    if(name==='task-photo'){if(!confirm('Otevřít nahrání fotek? Neuložené změny ve formuláři se zahodí.'))return;const t=data.tasks.find(t=>t.id===id);closeEditor();showEditor('photo');$('#editor-form [name=carId]').value=t.carId;updatePhotoTasks(t.carId);$('#editor-form [name=taskId]').value=id;return;}
    if(name==='toggle-task'){if(!writable())throw new Error('Přihlas se pro úpravy.');const t=data.tasks.find(t=>t.id===id);if(t._conflict){showEditor('task',id);return;}const record={...C.clean(t),status:t.status==='done'?'todo':'done',completedAt:t.status==='done'?'':today()};await write('tasks',id,record,t._heads);render();return;}
    if(name==='remove-task'||name==='remove-note'){const entity=name==='remove-task'?'tasks':'notes',r=data[entity].find(r=>r.id===id);if(r._conflict)throw new Error('Nejdřív porovnej souběžné verze a ulož společnou podobu.');if(!confirm('Odstranit tento záznam z aplikace? Fotky zůstanou uložené.'))return;await write(entity,id,{...C.clean(r),removed:true},r._heads);closeEditor();render();return;}
    if(name==='prev-month'||name==='next-month'||name==='this-month'){month=name==='this-month'?new Date():new Date(month.getFullYear(),month.getMonth()+(name==='prev-month'?-1:1),1,12);render();return;}
    if(name==='export-ics'){download('garaz-kalendar.ics',C.ics(tasks().filter(t=>matches(t)),data.cars),'text/calendar;charset=utf-8');return;}
    if(name==='export-json'){download('garaz-zaznamy-'+today()+'.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),mode,events},null,2),'application/json');return;}
    if(name==='open-photo'){const f=data.files.find(f=>f.id===id);const blob=await localPhoto(f.id);if(!blob)throw new Error('Fotka není dostupná.');download(f.name,blob,f.mime);return;}
    if(name==='connect'){await connect();return;}
    if(name==='logout'){G.logout();clearPhotos();mode='demo';try{setData(JSON.parse(localStorage.getItem(prefix)||'null')||seed());}catch{setData(seed());}navigate('settings');return;}
    if(name==='pick-sheet'||name==='create-sheet'||name==='pick-folder'||name==='create-folder'){
      if(mode!=='cloud'||!G.ready())throw new Error('Nejdřív se přihlas přes Google.');
      if(name==='create-sheet'&&G.config.spreadsheetId&&!confirm('Vytvořit další prázdnou tabulku a přepnout na ni? Stávající zůstane beze změny.'))return;
      let result;
      if(name==='pick-sheet')result=await G.pick('sheet');if(name==='pick-folder')result=await G.pick('folder');if(name==='create-sheet')result=await G.createSheet();if(name==='create-folder')result=await G.createFolder();
      if(!result)return;
      if(name.includes('sheet')){clearPhotos();setData([]);await loadCloud();}
      render();notify(name.startsWith('create')?'Vytvořeno. Nezapomeň soubor v Googlu nasdílet svým lidem.':'Výběr uložen.');return;
    }
    if(name==='reset-demo'){if(!confirm('Vrátit ukázkové záznamy do výchozího stavu? Data v Googlu zůstanou beze změny.'))return;const rows=seed();localStorage.setItem(prefix,JSON.stringify(rows));if(mode==='demo'){setData(rows);clearPhotos();render();}notify('Ukázka je připravená znovu.');}
  }
  function updatePhotoTasks(id){const sel=$('#editor-form [name=taskId]');if(sel)sel.innerHTML='<option value="">Jen k autu</option>'+tasks().filter(t=>t.carId===id).map(t=>`<option value="${e(t.id)}">${e(t.title)}</option>`).join('');}
  document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-action],[data-view]');if(!b)return;try{if(b.dataset.view)navigate(b.dataset.view);else await action(b.dataset.action,b);}catch(err){notify(err.message);}});
  document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('.car-card')){ev.preventDefault();action('open-car',ev.target).catch(err=>notify(err.message));}});
  document.addEventListener('change',ev=>{if(ev.target.id==='filter-car'){filters.car=ev.target.value;render();}if(ev.target.id==='filter-status'){filters.status=ev.target.value;render();}if(edit?.kind==='photo'&&ev.target.name==='carId')updatePhotoTasks(ev.target.value);});
  document.addEventListener('input',ev=>{if(ev.target.id==='search'){filters.q=ev.target.value;const pos=ev.target.selectionStart;render();$('#search')?.focus();$('#search')?.setSelectionRange(pos,pos);}});
  document.addEventListener('submit',ev=>{if(ev.target.id!=='config-form')return;ev.preventDefault();const f=Object.fromEntries(new FormData(ev.target));for(const k of Object.keys(f))f[k]=f[k].trim();if(!f.clientId.endsWith('.apps.googleusercontent.com')||!/^\d+$/.test(f.projectNumber)){notify('Zkontroluj Client ID a číselné číslo projektu.');return;}const old=G.config;G.persist(f);if(mode==='cloud'&&(old.clientId!==f.clientId||old.projectNumber!==f.projectNumber)){G.logout();mode='demo';clearPhotos();try{setData(JSON.parse(localStorage.getItem(prefix)||'null')||seed());}catch{setData(seed());}}render();notify('Konfigurace uložená pro tento prohlížeč. Pro ostatní ji vlož také do config.js.');});
  $('#editor-form').addEventListener('submit',saveEditor);
  $('#close-dialog').addEventListener('click',closeEditor);$('#cancel-dialog').addEventListener('click',closeEditor);
  $('#editor').addEventListener('cancel',ev=>{if(busy||uploading)ev.preventDefault();else edit=null;});
  $('#theme').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('garaz.theme',document.body.classList.contains('dark')?'dark':'light');render();});
  $('#account').addEventListener('click',()=>navigate('settings'));
  $('#sync').addEventListener('click',async()=>{try{if(mode==='cloud'){if(!G.ready()){await connect();return;}await loadCloud();render();notify('Data jsou aktuální.');}else notify('Používáš místní ukázku. Společná data připojíš v Nastavení.');}catch(err){notify(err.message);}});
  window.addEventListener('storage',ev=>{if(ev.key===prefix&&mode==='demo'&&!busy){try{setData(JSON.parse(ev.newValue)||seed());render();}catch{}}});
  window.addEventListener('hashchange',()=>{const hash=location.hash.slice(1);if(hash.startsWith('car/')){carId=decodeURIComponent(hash.slice(4));view='car';}else if(labels[hash])view=hash;render();});
  window.addEventListener('beforeunload',ev=>{if(busy||uploading){ev.preventDefault();ev.returnValue='';}});
  const initial=location.hash.slice(1);if(labels[initial])view=initial;else if(initial.startsWith('car/')){carId=decodeURIComponent(initial.slice(4));view='car';}
  render();
})();
