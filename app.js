(() => {
  'use strict';
  const C=window.GarazCore,G=window.GarazGoogle,H=window.GarazCalendar,M=window.GarazMedia,$=s=>document.querySelector(s),e=C.escape;
  const prefix='garaz.demo.v1:'+location.pathname;
  const status={todo:'Naplánováno',doing:'V řešení',waiting:'Čeká na díly',done:'Hotovo'};
  const kinds={repair:'Oprava',improve:'Vylepšení',service:'Údržba',inspection:'STK / kontrola',other:'Ostatní'};
  const colors=['#799073','#ca986c','#8597a8','#b4877d','#999276','#777e84'];
  const labels={overview:'Přehled',cars:'Moje auta',tasks:'Úkoly',calendar:'Kalendář',notes:'Poznámky a odkazy',photos:'Fotky a soubory',settings:'Nastavení a přístup',car:'Detail auta'};
  let mode='demo',events=[],data=C.reduce([]),view='overview',carId='',carTab='tasks',busy=false,uploading=false,month=new Date(),filters={q:'',car:'',status:'open'},edit=null,lastSync='',toastTimer;
  let restoringLogin=false,connecting=false;
  let renderVersion=0;const photoUrls=new Map();
  let calendarBinding=null,calendarConfigError='',calendarSetupBusy=false;
  const calendarState={running:false,message:'',error:'',lastSync:''};
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
      if(entity==='cars'&&record.coverFileId&&!data.files.some(f=>f.id===record.coverFileId&&f.carId===id&&!f.removed&&isPhoto(f)))throw new Error('Úvodní fotka musí patřit k tomuto autu. Vyber ji znovu.');
      const row=event(entity,id,record,parents);
      if(mode==='demo'){
        const next=[...events,row];localStorage.setItem(prefix,JSON.stringify(next));setData(next);
      }else{
        try{await G.append(row);}catch(error){try{await loadCloud();if(!events.some(r=>r.id===row.id))throw error;}catch{throw error;}}
        // Preserve an acknowledged append even if the subsequent refresh is offline.
        if(!events.some(r=>r.id===row.id))setData([...events,row]);
        try{await loadCloud();}catch{notify('Změna je uložená v Googlu. Úplné obnovení dat se nepodařilo; zkus Obnovit.');}
      }
      if(mode==='cloud'&&['cars','tasks'].includes(entity))setTimeout(()=>syncCalendar(false),600);
      return {...record,id,_heads:[row.id]};
    }finally{busy=false;}
  }
  function art(c){
    const color=safeColor(c.color),style=c.style||'suv';
    const wheels='<circle cx="71" cy="120" r="21" fill="#343c37"/><circle cx="71" cy="120" r="11" fill="#cbd0c7"/><circle cx="71" cy="120" r="5" fill="#7e887f"/><circle cx="244" cy="120" r="21" fill="#343c37"/><circle cx="244" cy="120" r="11" fill="#cbd0c7"/><circle cx="244" cy="120" r="5" fill="#7e887f"/>';
    let body=style==='rv'?`<path d="M26 39Q26 31 36 31H238L276 66 293 73V116H26Z" fill="${color}"/><path d="M33 88H281V106H33Z" fill="#e3d3b1"/><path d="M43 43H95V72H43ZM108 43H164V72H108ZM180 43H230L255 68H180Z" fill="#c6d5d1"/><path d="M172 37V108" stroke="#414d3e55" stroke-width="2"/><rect x="182" y="78" width="12" height="3" rx="1" fill="#44533d"/><path d="M29 95H291" stroke="#6c725650" stroke-width="3"/><rect x="281" y="81" width="12" height="11" rx="2" fill="#fae5a8"/>`:style==='pickup'?`<path d="M26 78H115V45Q115 39 123 39H187L213 76H284Q293 76 293 86V115H26Z" fill="${color}"/><path d="M124 46H179L198 75H124Z" fill="#b8cdcd"/><path d="M115 79V110M212 79V110" stroke="#684b3644" stroke-width="2"/><path d="M28 83H103V99H28Z" fill="#ece0c4"/><path d="M218 88H287V102H218Z" fill="#ece0c4"/><rect x="179" y="83" width="14" height="3" rx="1" fill="#594737"/><rect x="281" y="78" width="12" height="15" rx="2" fill="#fae5a8"/>`:`<path d="M25 84 50 75 78 44Q83 39 93 39H221L250 75 286 83Q293 85 293 94V116H25Z" fill="${color}"/><path d="M62 75 86 47H136V75ZM147 47H210L233 75H147Z" fill="#c2d3d4"/><path d="M140 42V110M243 79V111" stroke="#46536455" stroke-width="2"/><path d="M30 99H289" stroke="#d7dcd5" stroke-width="4"/><rect x="120" y="82" width="13" height="3" rx="1" fill="#414d55"/><rect x="216" y="82" width="13" height="3" rx="1" fill="#414d55"/><rect x="280" y="82" width="12" height="10" rx="2" fill="#fae5a8"/>`;
    return `<svg viewBox="0 0 320 155" aria-hidden="true"><ellipse cx="160" cy="137" rx="141" ry="6" fill="#303b2912"/>${body}${wheels}<path d="M22 115H45M270 115H299" stroke="#cad0c8" stroke-width="6" stroke-linecap="round"/></svg>`;
  }
  const button=(label,action,extra='',cls='button')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`;
  const empty=(title,body,action='',label='Přidat úkol')=>`<div class="empty"><span class="empty-symbol">▱</span><strong>${e(title)}</strong>${e(body)}${action?'<br>'+button(label,action,'','button primary'):''}</div>`;
  function coverPhoto(car){
    if(!car?.coverFileId)return undefined;
    return data.files.find(file=>file.id===car.coverFileId&&file.carId===car.id&&!file.removed&&isPhoto(file));
  }
  function carVisual(c){
    const cover=coverPhoto(c);
    return art(c)+(cover?`<div class="car-cover" data-photo="${e(cover.id)}" aria-label="Úvodní fotografie ${e(c.name)}"></div>`:'');
  }
  function top(title,description,action='',label='+ Přidat úkol'){return `<div class="page-top"><div><span class="eyebrow">${new Intl.DateTimeFormat('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date()).toLocaleUpperCase('cs')}</span><h1>${e(title)}</h1>${description?'<p>'+e(description)+'</p>':''}</div>${action&&writable()?button(e(label),action,'','button primary'):''}</div>`;}
  function carCard(c){
    const ts=openTasks().filter(t=>t.carId===c.id),late=ts.filter(t=>C.due(t)==='late').length;
    return `<article class="car-card" tabindex="0" role="button" data-action="open-car" data-id="${e(c.id)}" aria-label="Otevřít ${e(c.name)}"><div class="car-art">${carVisual(c)}<span class="badge">${e(c.type||'Auto')}</span><span class="year">${e(c.year)}</span></div><div class="car-body"><h3>${e(c.name)}</h3><p class="car-card-specs">${e([c.plate,c.engine,c.paint].filter(Boolean).join(' · ')||'Vlastní místo pro všechny plány')}</p><div class="car-bottom"><span>${ts.length} ${ts.length===1?'otevřený úkol':'otevřených úkolů'}</span><span class="${late?'late':''}">${late?late+' po termínu':'Vše pod kontrolou'} <span aria-hidden="true">↗</span></span></div></div></article>`;
  }
  function overviewCar(c){
    const open=openTasks().filter(t=>t.carId===c.id),late=open.filter(t=>C.due(t)==='late').length;
    return `<button type="button" class="overview-car" data-action="open-car" data-id="${e(c.id)}" aria-label="Otevřít ${e(c.name)}" title="${e([c.name,c.year,c.plate,c.engine,c.paint].filter(Boolean).join(' · '))}"><span class="car-art">${carVisual(c)}</span><span class="overview-car-info"><strong>${e(c.name)}</strong><span class="overview-car-year">${e([c.year,c.plate].filter(Boolean).join(' · ')||c.type||'Auto')}</span><span class="overview-car-tasks ${late?'late':''}">${open.length} ${open.length===1?'úkol':open.length>=2&&open.length<=4?'úkoly':'úkolů'}${late?' · '+late+' po termínu':''}</span></span><span class="overview-car-arrow" aria-hidden="true">↗</span></button>`;
  }
  function taskRow(t){const c=car(t.carId),d=C.due(t);return `<div class="task-row ${t.status==='done'?'completed':''}"><button class="check ${t.status==='done'?'checked':''}" data-action="toggle-task" data-id="${e(t.id)}" aria-label="${t.status==='done'?'Znovu otevřít':'Dokončit'}: ${e(t.title)}" ${writable()?'':'disabled'}>${t.status==='done'?'✓':''}</button><button class="task-main" data-action="edit-task" data-id="${e(t.id)}"><span class="task-title">${e(t.title)}${t._conflict?' ⚠':''}</span><span class="task-meta"><i class="dot" style="background:${safeColor(c?.color)}"></i>${e(c?.name||'Auto')}<span>·</span>${e(t.owner||'Nepřiřazeno')}<span>·</span>${e(kinds[t.kind]||'Úkol')}</span></button><div class="task-trailing"><span class="badge ${e(t.status)}">${e(status[t.status]||'Úkol')}</span><span class="due-text ${d==='late'?'late':''}">${d==='late'?'↳ ':''}${fmt(t.due)}${t.dueTime?`<span class="task-clock">${e(t.dueTime)}</span>`:''}</span></div></div>`;}
  function safeColor(s){return /^#[0-9a-f]{6}$/i.test(s||'')?s:colors[0];}
  function agenda(ts){return ts.length?`<div class="panel agenda">${ts.map(t=>`<div class="agenda-row"><div class="date-square">${C.date(t.due).getDate()}<small>${fmt(t.due,{month:'short'})}</small></div><button class="task-main" data-action="edit-task" data-id="${e(t.id)}"><span class="task-title">${e(t.title)}</span><span class="task-meta">${t.dueTime?e(t.dueTime)+' · ':''}${e(car(t.carId)?.name)} · ${e(t.owner||'Nepřiřazeno')}</span></button></div>`).join('')}</div>`:empty('Nic nehoří','Nejbližší naplánované úkoly se objeví tady.');}
  function overview(){
    const open=openTasks(),late=open.filter(t=>C.due(t)==='late'),soon=open.filter(t=>C.due(t)==='soon'),done=tasks().filter(t=>t.status==='done'&&t.completedAt?.slice(0,7)===today().slice(0,7)),upcoming=open.filter(t=>t.due&&t.due>=today()).sort((a,b)=>(a.due+'T'+(a.dueTime||'')).localeCompare(b.due+'T'+(b.dueTime||''))).slice(0,3);
    const priority=[...open].sort((a,b)=>((a.due||'9999')+'T'+(a.dueTime||'')).localeCompare((b.due||'9999')+'T'+(b.dueTime||''))).slice(0,3);
    return '<div class="dashboard-overview">'+top('Přehled','','new-task')+`<div class="stats">${[[activeCars().length,'Aut v garáži','view-cars',''],[late.length,'Po termínu','tasks-late','alert'],[soon.length,'V příštích 7 dnech','tasks-soon',''],[done.length,'Hotovo tento měsíc','tasks-done-month','']].map(([n,title,action,cls])=>`<button type="button" class="stat ${cls}" data-action="${action}"><span class="stat-line">${title}</span><strong>${n}</strong></button>`).join('')}</div><div class="section-heading"><h2>Moje auta <span class="muted" style="font-size:12px;font-weight:400"> / ${activeCars().length}</span></h2>${button('Všechna auta →','view-cars','','text-button')}</div>${activeCars().length?'<div class="overview-cars">'+activeCars().map(overviewCar).join('')+'</div>':empty('Garáž čeká na první auto','Začni přidáním auta, pak k němu naplánuj první práci.','new-car','+ Přidat auto')}<div class="two-col"><section><div class="section-heading"><h2>Co je potřeba vyřešit</h2>${button('Všechny úkoly →','view-tasks','','text-button')}</div><div class="panel">${priority.length?priority.map(taskRow).join(''):empty('Máš čistý stůl','Přidej další opravu nebo nápad.','new-task')}</div></section><section><div class="section-heading"><h2>Nejbližší termíny</h2>${button('Kalendář ↗','view-calendar','','text-button')}</div>${agenda(upcoming)}</section></div></div>`;
  }
  function filterBar(withStatus=false){return `<div class="filters"><input id="search" type="search" placeholder="Hledat v názvech a popisech…" value="${e(filters.q)}" aria-label="Hledat"><select id="filter-car" aria-label="Filtrovat auto"><option value="">Všechna auta</option>${data.cars.map(c=>`<option value="${e(c.id)}" ${filters.car===c.id?'selected':''}>${e(c.name)}${c.archived?' (archiv)':''}</option>`).join('')}</select>${withStatus?`<select id="filter-status" aria-label="Filtrovat stav"><option value="open" ${filters.status==='open'?'selected':''}>Otevřené úkoly</option><option value="all" ${filters.status==='all'?'selected':''}>Všechny stavy</option>${Object.entries(status).map(([k,v])=>`<option value="${k}" ${filters.status===k?'selected':''}>${v}</option>`).join('')}<option value="late" ${filters.status==='late'?'selected':''}>Po termínu</option><option value="soon" ${filters.status==='soon'?'selected':''}>V příštích 7 dnech</option><option value="done-month" ${filters.status==='done-month'?'selected':''}>Hotovo tento měsíc</option><option value="none" ${filters.status==='none'?'selected':''}>Bez termínu</option></select>`:''}</div>`;}
  function matches(r,selectedCar=filters.car){return (!selectedCar||r.carId===selectedCar)&&(!filters.q||[r.title,r.description,r.body,r.owner,r.url,car(r.carId)?.name].join(' ').toLocaleLowerCase('cs').includes(filters.q.toLocaleLowerCase('cs')));}
  function taskList(list=tasks(),useFilter=true){const filtered=list.filter(t=>!useFilter||matches(t)&&(filters.status==='all'||filters.status==='open'&&t.status!=='done'||filters.status==='late'&&t.status!=='done'&&C.due(t)==='late'||filters.status==='soon'&&t.status!=='done'&&C.due(t)==='soon'||filters.status==='done-month'&&t.status==='done'&&t.completedAt?.slice(0,7)===today().slice(0,7)||filters.status==='none'&&!t.due&&t.status!=='done'||filters.status===t.status)).sort((a,b)=>(a.status==='done')-(b.status==='done')||((a.due||'9999')+'T'+(a.dueTime||'')).localeCompare((b.due||'9999')+'T'+(b.dueTime||'')));return `<div class="panel">${filtered.length?filtered.map(taskRow).join(''):empty('Tady zatím nic není','Změň filtr nebo přidej nový úkol.')}</div>`;}
  function notesList(list){return list.length?`<div class="notes-grid">${list.map(n=>`<article class="note-card"><span class="badge">${n.kind==='link'?'↗ Odkaz':'▤ Poznámka'}</span><h3>${e(n.title)}${n._conflict?' ⚠':''}</h3><p>${e(n.body)}</p>${C.url(n.url)?`<a href="${e(C.url(n.url))}" target="_blank" rel="noopener noreferrer">${e(n.url)} ↗</a>`:''}<div class="note-bottom"><span>${e(car(n.carId)?.name||'Společné poznámky')}</span>${button('Otevřít →','edit-note',`data-id="${e(n.id)}"`,'text-button')}</div></article>`).join('')}</div>`:empty('Místo pro tvoje nápady','Poznámky, stránky s díly i videa z YouTube.','new-note','+ Přidat poznámku');}
  const isPhoto=f=>['image/jpeg','image/png','image/webp'].includes(f.mime);
  function photosList(list){return list.length?`<div class="photo-grid">${list.map(f=>`<article class="photo-card">${isPhoto(f)?`<div class="photo-placeholder" data-photo="${e(f.id)}">Načítám náhled…</div>`:`<div class="photo-placeholder"><span>📄 ${e(f.name?.split('.').pop()?.toUpperCase()||'SOUBOR')}</span></div>`}<div class="photo-caption"><strong>${e(f.title||f.name)}</strong>${isPhoto(f)?(car(f.carId)?.coverFileId===f.id?'<span class="badge done">Úvodní fotka</span>':writable()?button('Použít jako úvodní','use-cover',`data-id="${e(f.id)}"`,'text-button'):''):''}<small>${e(car(f.carId)?.name)}${f.taskId?' · '+e(data.tasks.find(t=>t.id===f.taskId)?.title||'Úkol'):''}</small><div class="note-bottom"><span>${fmt(f.createdAt?.slice(0,10))}</span>${f.driveId?`<a href="https://drive.google.com/file/d/${encodeURIComponent(f.driveId)}/view" target="_blank" rel="noopener noreferrer">Otevřít na Disku ↗</a>`:button('Stáhnout soubor ↓','open-photo',`data-id="${e(f.id)}"`,'text-button')}${writable()?button('Smazat z Garáže','remove-file',`data-id="${e(f.id)}"`,'button small ghost danger'):''}</div></div></article>`).join('')}</div>`:empty('Zatím bez příloh','Přidej fotky, faktury, návody nebo další dokumenty.','new-photo','+ Fotky a soubory');}
  function calendarView(){const y=month.getFullYear(),m=month.getMonth();const list=tasks().filter(t=>matches(t)).sort((a,b)=>(a.dueTime||'').localeCompare(b.dueTime||''));return top('Každý plán má svůj termín.','Kliknutím na den přidáš úkol. Kliknutím na událost otevřeš detail.')+filterBar()+`<div class="section-heading"><div class="calendar-toolbar">${button('‹','prev-month','aria-label="Předchozí měsíc"')}<h2>${new Intl.DateTimeFormat('cs-CZ',{month:'long',year:'numeric'}).format(month)}</h2>${button('›','next-month','aria-label="Další měsíc"')}${button('Dnes','this-month','','button small')}</div>${button('Export .ics ↓','export-ics','','button small')}</div><div class="panel calendar-scroll"><div class="calendar-grid">${['PO','ÚT','ST','ČT','PÁ','SO','NE'].map(d=>`<div class="weekday">${d}</div>`).join('')}${C.calendar(y,m).map(d=>`<div class="cal-day ${d.inside?'':'outside'}"><button class="day-num ${d.day===today()?'today':''}" data-action="day-task" data-day="${d.day}" aria-label="Přidat úkol na ${e(fmt(d.day,{day:'numeric',month:'long',year:'numeric'}))}">${d.number}</button>${list.filter(t=>t.due===d.day).map(t=>`<button class="cal-event ${t.status==='done'?'done':''}" data-action="edit-task" data-id="${e(t.id)}" title="${e(t.title)}"><small>${e(car(t.carId)?.name)}</small>${t.dueTime?e(t.dueTime)+' · ':''}${e(t.title)}</button>`).join('')}</div>`).join('')}</div></div><p style="font-size:11px;margin-top:14px">${list.filter(t=>!t.due&&t.status!=='done').length} otevřených úkolů bez termínu. Export je jednorázový snímek pro import do kalendáře.</p>`;}
  function carDetail(){const c=car(carId);if(!c)return empty('Auto se nepodařilo najít','Vrať se do přehledu aut.','view-cars','Moje auta');const ts=tasks().filter(t=>t.carId===c.id),open=ts.filter(t=>t.status!=='done');return top(c.name,[c.year,c.type,c.plate].filter(Boolean).join(' · '),'edit-car','Upravit auto')+`<div class="car-detail-top"><div class="car-art">${carVisual(c)}</div><div><span class="badge">${c.archived?'Archivované auto':'V mojí garáži'}</span><dl class="car-facts"><div><dt>Motor</dt><dd>${e(c.engine||'Nevyplněno')}</dd></div><div><dt>Barva</dt><dd>${e(c.paint||'Nevyplněno')}</dd></div></dl><p style="white-space:pre-wrap;font-size:12px;margin-top:15px">${e(c.description||'Každý detail se hodí. Doplň si poznámku k autu.')}</p><div class="mini-stats"><span><strong>${open.length}</strong> otevřeno</span><span><strong>${ts.filter(t=>t.status==='done').length}</strong> hotovo</span><span><strong>${money(ts.reduce((s,t)=>s+(Number(t.actualCost)||0),0))}</strong> náklady</span></div>${writable()?button('+ Přidat úkol','new-task')+' '+button('+ Fotky a soubory','new-photo','','button ghost'):''}</div></div><div class="tabs">${[['tasks','Úkoly a historie'],['notes','Poznámky a odkazy'],['photos','Fotky a soubory']].map(([key,label])=>`<button data-action="car-tab" data-tab="${key}" class="${carTab===key?'active':''}">${label}</button>`).join('')}</div>${carTab==='tasks'?taskList(ts,false):carTab==='notes'?`<div class="section-heading"><h2>Poznámky k autu</h2>${writable()?button('+ Přidat','new-note','','button small'):''}</div>`+notesList(data.notes.filter(n=>!n.removed&&n.carId===carId)):photosList(data.files.filter(f=>!f.removed&&f.carId===carId))}`;}
  function connectionConfig(){const cfg=G.config;return `<details class="advanced-config"><summary>Pokročilé nastavení připojení</summary><p>Pro správu aplikace. Pro běžné přihlášení tyto hodnoty nemusíš zadávat.</p><form id="config-form"><label>Google OAuth Client ID<input name="clientId" value="${e(cfg.clientId)}" placeholder="…apps.googleusercontent.com" required></label><div class="form-grid"><label>Google Picker API key<input name="apiKey" value="${e(cfg.apiKey)}" required></label><label>Číslo Google Cloud projektu<input name="projectNumber" value="${e(cfg.projectNumber)}" inputmode="numeric" required></label></div><button class="button" type="submit">Uložit konfiguraci</button></form></details>`;}
  function rememberLogin(){return `<label style="display:flex;align-items:center;gap:10px;margin-top:16px"><input type="checkbox" id="remember-login" style="width:auto" ${G.remember?'checked':''}> Pamatovat přihlášení na tomto zařízení</label><p>Jen na vlastním zařízení. Do prohlížeče se uloží krátkodobý přístup ke Googlu, nejdéle asi na hodinu od přihlášení. Po vypršení přístup obnovíš tlačítkem Google. Odhlášení uložený přístup odstraní.</p>`;}
  function loginScreen(){
    const configured=!!G.config.clientId;
    return `<section class="panel login-panel"><span class="eyebrow">DC RUST GARAGE</span><h1>Tvoje garáž na jednom místě.</h1><p>Auta, opravy, termíny, fotky a dokumenty. Přihlas se svým Google účtem a otevři společnou garáž.</p>${restoringLogin?'<p role="status">Obnovuji přihlášení…</p>':`${button(connecting?'Přihlašuji…':'Přihlásit přes Google','connect',connecting?'disabled':'','button primary login-button')}${rememberLogin()}${configured?'':'<p>Připojení této instalace ještě není nastavené. Nastavení doplní správce aplikace.</p>'+connectionConfig()}`}<p class="login-privacy"><a href="privacy.html">Ochrana údajů</a></p></section>`;
  }
  function settings(){const cfg=G.config;return top('Nastavení garáže','Tvůj účet, společné soubory a kalendář.')+`<div class="settings-grid"><div><section class="panel"><h3>Tvůj účet</h3><p>Přihlášen: <strong>${e(G.profile?.email)}</strong>${G.canEdit?' · Úpravy povoleny':' · Přístup k tabulce zatím není ověřený'}</p><div class="stack">${button('Změnit Google účet','connect','','button primary')}${button('Odhlásit','logout')}</div>${rememberLogin()}${connectionConfig()}</section><section class="panel"><h3>Společná tabulka</h3><p>Používej společnou tabulku garáže. Při prvním připojení ji případně vyber přes Google.</p><div class="status-box">${cfg.spreadsheetId?`<a href="https://docs.google.com/spreadsheets/d/${encodeURIComponent(cfg.spreadsheetId)}/edit" target="_blank" rel="noopener noreferrer">Otevřít tabulku ↗</a>`:'Zatím není vybraná tabulka.'}</div><div class="stack">${button('Vybrat tabulku','pick-sheet')}${button('Vytvořit novou','create-sheet','','button ghost')}</div></section></div><div><section class="panel"><h3>Složka pro fotky a dokumenty</h3><p>Používej sdílenou složku garáže. Přístup k ní nastavuje vlastník v Googlu.</p><div class="status-box">${cfg.folderId?`<a href="https://drive.google.com/drive/folders/${encodeURIComponent(cfg.folderId)}" target="_blank" rel="noopener noreferrer">Otevřít složku ↗</a>`:'Zatím není vybraná složka.'}</div><div class="stack">${button('Vybrat složku','pick-folder')}${button('Vytvořit novou','create-folder','','button ghost')}</div></section>${calendarPanel()}<section class="panel"><h3>Sdílení garáže</h3><p>Tabulku a složku nasdílej konkrétním e-mailům. Pro práci zvol Editor, pro prohlížení Čtenář. Všichni pozvaní vidí všechna auta; editoři mohou upravovat také zdrojovou tabulku. Kalendář má vlastní nastavení sdílení.</p></section><section class="panel"><h3>Záloha</h3><p>Export obsahuje záznamy a odkazy na přílohy. Fotky a dokumenty zůstávají na Disku.</p>${button('Export záznamů JSON ↓','export-json')}</section></div></div>`;}
  const calendarOwner=()=>calendarBinding?.ownerEmail?.toLowerCase()===G.profile?.email?.toLowerCase();
  const calendarUrl=id=>'https://calendar.google.com/calendar/u/0/r?cid='+encodeURIComponent(btoa(id));
  async function refreshCalendarBinding(){
    calendarConfigError='';
    if(mode!=='cloud'||!G.ready()||!G.config.spreadsheetId){calendarBinding=null;return;}
    try{calendarBinding=await G.loadCalendarConfig();}
    catch(error){calendarBinding=null;calendarConfigError=error.message;}
  }
  function paintCalendarStatus(){
    const node=$('#calendar-sync-status');
    if(node)node.textContent=calendarState.running?'Synchronizuji s Google Kalendářem…':calendarState.error||calendarState.message||(calendarState.lastSync?'Poslední synchronizace v tomto okně: '+calendarState.lastSync:'Synchronizace ještě neproběhla.');
    document.querySelectorAll('.calendar-panel button').forEach(b=>b.disabled=calendarState.running||calendarSetupBusy);
  }
  function calendarPanel(){
    const cloud=mode==='cloud'&&G.ready()&&!!G.config.spreadsheetId,b=calendarBinding,owner=calendarOwner(),disabled=calendarState.running||calendarSetupBusy?'disabled':'';
    let body='';
    if(!cloud)body='<p>Přihlas se přes Google a připoj společnou tabulku. Ukázkové úkoly se do Google Kalendáře neposílají.</p>'+button('Nastavení připojení →','view-settings','','button small');
    else if(calendarConfigError)body='<div class="conflict">'+e(calendarConfigError)+'</div>'+button('Zkusit znovu','calendar-refresh',disabled);
    else if(!b){
      body='<p>Vytvoř samostatný kalendář <strong>Garáž — opravy a termíny</strong>. Přístup se omezí na kalendáře vytvořené touto aplikací. Soukromé kalendáře nemusíš zpřístupňovat.</p><div class="stack">'+(G.calendarGranted?button('Vytvořit kalendář Garáž','calendar-create',disabled,'button primary'):button('Povolit Google Kalendář','calendar-authorize',disabled,'button primary'))+'</div>'+
      '<details class="calendar-recovery"><summary>Obnovit propojení po přerušeném vytváření</summary><p>Pokud kalendář už vznikl, jeho ID najdeš v Google Kalendáři → Nastavení → vybraný kalendář → Integrovat kalendář.</p><form id="calendar-recover-form"><label>ID vytvořeného kalendáře<input name="calendarId" required maxlength="1024" placeholder="…@group.calendar.google.com"></label><button class="button small" type="submit">Obnovit propojení</button></form></details>';
    }else{
      body='<div class="calendar-binding"><span class="badge '+(b.enabled?'done':'waiting')+'">'+(b.enabled?'Propojeno':'Pozastaveno')+'</span><strong>'+e(b.name||'Garáž — opravy a termíny')+'</strong></div><p>Účet synchronizace: '+e(b.ownerEmail)+'</p>';
      if(b._conflict)body+='<div class="conflict">Nastavení má souběžné změny. Synchronizace je zastavená; nastavení v listu Kalendar vyžaduje kontrolu.</div>';
      body+='<div class="stack"><a class="button small" href="'+e(calendarUrl(b.calendarId))+'" target="_blank" rel="noopener noreferrer">Otevřít Google Kalendář ↗</a>';
      if(owner&&!b._conflict){
        if(!G.calendarGranted)body+=button('Povolit synchronizaci pro tento účet','calendar-authorize',disabled,'button primary');
        else body+=button('Synchronizovat teď','calendar-sync',disabled,'button primary')+button(b.enabled?'Pozastavit':'Obnovit synchronizaci','calendar-toggle',disabled,'button ghost');
      }
      body+='</div>';
      if(owner&&!b._conflict)body+='<form id="calendar-options-form" class="calendar-options">'+select('reminder','Připomínka otevřených úkolů',[['1440','Den předem'],['2880','Dva dny předem'],['default','Podle nastavení Google kalendáře'],['none','Bez připomínky']],b.reminder||'1440')+'<button class="button small" type="submit">Uložit připomínku</button></form>';
      if(!owner)body+='<p>Události aktualizuje uvedený účet při používání Garáže. Tvoje změny úkolů se přenesou, až tento účet spustí synchronizaci. Sdílení kalendáře nastavuje jeho vlastník přímo v Googlu.</p>';
      body+='<p class="calendar-note">Úkoly měň v Garáži. Změny přímo v Google Kalendáři se nevracejí zpět a při synchronizaci mohou být nahrazené. Dokončené úkoly zůstanou označené jako hotové bez připomínky.</p>';
    }
    return '<section class="panel calendar-panel"><div class="section-heading"><h3>Google Kalendář</h3><span class="eyebrow">GARÁŽ → GOOGLE</span></div>'+body+'<p id="calendar-sync-status" class="calendar-status" role="status">'+e(calendarState.error||calendarState.message||'')+'</p><p class="calendar-note">Přenos běží při používání aplikace účtem synchronizace. Po zavření aplikace se nové změny nepřenášejí; už uložené připomínky dál zajišťuje Google. Bez času jsou úkoly celodenní. S časem rezervují 1 hodinu v českém časovém pásmu. Připomínky zkontroluj v Google Kalendáři.</p></section>';
  }
  async function syncCalendar(manual=false){
    if(calendarState.running||calendarSetupBusy||busy||uploading)return;
    if(mode!=='cloud'||!G.ready()||!G.config.spreadsheetId)return;
    if(!manual&&(!calendarBinding?.enabled||!calendarOwner()||!G.calendarGranted||$('#editor').open))return;
    calendarState.running=true;calendarState.error='';calendarState.message='Synchronizuji…';paintCalendarStatus();
    try{
      await refreshCalendarBinding();
      if(calendarConfigError)throw new Error(calendarConfigError);
      if(!calendarBinding?.enabled){calendarState.message='Synchronizace je pozastavená.';return;}
      if(!calendarOwner())throw new Error('Synchronizaci spouští účet '+calendarBinding.ownerEmail+'.');
      const fresh=C.reduce(await G.load()),appUrl=location.origin+location.pathname+'#tasks';
      const r=await H.sync({google:G,core:C,binding:calendarBinding,records:fresh,appUrl});
      calendarState.lastSync=new Intl.DateTimeFormat('cs-CZ',{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
      calendarState.message='Synchronizováno '+calendarState.lastSync+' · Nové: '+r.created+' · Upravené: '+r.updated+' · Odebrané: '+r.removed+' · Beze změny: '+r.unchanged+(r.skipped?' · Přeskočené: '+r.skipped:'');
      if(r.errors.length)calendarState.error=r.errors.join('\n');
      if(manual)notify(r.errors.length?'Část událostí se nepodařilo přenést. Podrobnosti najdeš v nastavení kalendáře.':calendarState.message);
    }catch(error){calendarState.error=error.status===403?'Google Kalendář odmítl přístup. Ověř zapnuté Calendar API a povol kalendář znovu.':error.message;if(manual)notify('Záznamy v tabulce zůstaly uložené. Kalendář: '+calendarState.error);}
    finally{calendarState.running=false;paintCalendarStatus();}
  }
  async function calendarAction(name){
    if(calendarState.running||calendarSetupBusy)throw new Error('Počkej na dokončení práce s kalendářem.');
    if(mode!=='cloud'||!G.ready()||!G.config.spreadsheetId)throw new Error('Nejdřív se přihlas ke společné tabulce.');
    if(name==='calendar-sync'){await syncCalendar(true);return;}
    calendarSetupBusy=true;paintCalendarStatus();
    try{
      if(name==='calendar-refresh')await refreshCalendarBinding();
      if(name==='calendar-authorize'){await G.authorizeCalendar();await refreshCalendarBinding();calendarState.message='Přístup povolen. '+(calendarBinding?'Kalendář je připravený.':'Teď vytvoř kalendář Garáž.');}
      if(name==='calendar-create'){
        if(!G.canEdit)throw new Error('Vytvoření propojení vyžaduje roli Editor v tabulce.');
        await refreshCalendarBinding();
        if(calendarConfigError)throw new Error(calendarConfigError);
        if(calendarBinding)throw new Error('Tabulka už má propojený kalendář. Další nebyl vytvořen.');
        const binding=await H.create(G);
        try{calendarBinding=await G.saveCalendarConfig(binding,[]);H.clearPending(G.config.spreadsheetId,G.profile.email);}
        catch(error){throw new Error('Kalendář vznikl, ale propojení se nepodařilo uložit. Klikni znovu na vytvoření — aplikace použije stejný kalendář. '+error.message);}
        calendarState.message='Kalendář vytvořený a propojený.';
      }
      if(name==='calendar-toggle'){
        if(!calendarBinding||!calendarOwner())throw new Error('Propojení spravuje účet, který kalendář vytvořil.');
        calendarBinding=await G.saveCalendarConfig({...calendarBinding,enabled:!calendarBinding.enabled},calendarBinding._heads);
        calendarState.message=calendarBinding.enabled?'Synchronizace obnovena.':'Synchronizace pozastavená. Existující události zůstaly v Googlu.';
      }
    }finally{calendarSetupBusy=false;if(!G.ready()&&!G.profile){setData([]);calendarBinding=null;}render();paintCalendarStatus();}
    if(calendarBinding?.enabled&&G.calendarGranted&&calendarOwner())await syncCalendar(true);
  }
  function render(){
    renderVersion++;
    const signedIn=mode==='cloud'&&G.ready()&&!!G.profile&&!restoringLogin&&!connecting;
    document.body.classList.toggle('signed-out',!signedIn);
    document.body.classList.toggle('overview-page',signedIn&&view==='overview');
    $('#theme span').textContent=document.body.classList.contains('dark')?'Světlý vzhled':'Tmavý vzhled';
    if(!signedIn){
      setMobileMenu(false);
      $('#breadcrumb').textContent='Přihlášení';$('#account').textContent='G';
      $('#mode-banner').innerHTML='';$('#car-count').textContent='';$('#task-count').textContent='';
      $('#main').innerHTML=loginScreen();return;
    }
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
    if(view==='tasks')html=top('Úkoly','','new-task')+filterBar(true)+taskList();
    if(view==='calendar')html=calendarPanel()+calendarView();
    if(view==='notes')html=top('Dobré nápady se neztrácí.','Poznámky, zajímavé stránky i návody z YouTube.','new-note','+ Přidat poznámku')+filterBar()+notesList(data.notes.filter(n=>!n.removed&&matches(n)));
    if(view==='photos')html=top('Fotky a dokumenty na jednom místě.','Fotky, návody, faktury i podklady k opravám.','new-photo','+ Přidat soubory')+filterBar()+photosList(data.files.filter(f=>!f.removed&&matches(f)));
    if(view==='car')html=carDetail();
    if(view==='settings')html=settings();
    $('#main').innerHTML=html;
    $('#theme span').textContent=document.body.classList.contains('dark')?'Světlý vzhled':'Tmavý vzhled';
    hydratePhotos(renderVersion);paintCalendarStatus();
  }
  function setMobileMenu(open){
    const toggle=$('#menu-toggle');
    document.body.classList.toggle('menu-open',open);
    if(toggle){toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Zavřít menu':'Otevřít menu');}
  }
  function navigate(v,taskStatus='open'){setMobileMenu(false);view=v;filters={q:'',car:'',status:taskStatus};location.hash=v==='car'?'car/'+encodeURIComponent(carId):v;render();}
  function field(name,label,value='',type='text',extra=''){return `<label ${extra}>${label}<input name="${name}" type="${type}" value="${e(value)}" ${name==='title'||name==='name'?'required maxlength="150"':''} ${type==='number'?'min="0" step="0.01"':''}></label>`;}
  function select(name,label,options,value='',extra=''){return `<label ${extra}>${label}<select name="${name}">${options.map(([k,v])=>`<option value="${e(k)}" ${k===value?'selected':''}>${e(v)}</option>`).join('')}</select></label>`;}
  function carsOptions(includeEmpty=false){return [...(includeEmpty?[['','Společné / bez auta']]:[]),...data.cars.filter(c=>!c.archived||c.id===edit?.record?.carId||(view==='car'&&c.id===carId)).map(c=>[c.id,c.name+(c.archived?' (archiv)':'')])];}
  function conflictFields(r){return r?._conflict?`<div class="conflict"><strong>Souběžné změny — porovnej obě verze</strong>${r._variants.map((v,i)=>`<details><summary>Verze ${i+1} · ${e(v.author)} · ${e(new Date(v.at).toLocaleString('cs-CZ'))}</summary><pre>${e(JSON.stringify(v.data,null,2))}</pre></details>`).join('')}<label style="margin:12px 0 0"><input style="display:inline;width:auto" type="checkbox" name="resolveConflict" required> Porovnal jsem verze a ukládám jejich společnou podobu.</label></div>`:'';}
  function showEditor(kind,id='',day=''){
    if(!writable()&&!id){notify('Pro úpravy potřebuješ přihlášení a roli Editor v tabulce.');return;}
    if(!id&&kind!=='car'&&!activeCars().length&&kind!=='note'&&!(view==='car'&&car(carId))){notify('Nejdřív přidej auto.');showEditor('car');return;}
    const entity={car:'cars',task:'tasks',note:'notes',photo:'files'}[kind],storedRecord=data[entity].find(r=>r.id===id)||{},cId=view==='car'?carId:filters.car||activeCars()[0]?.id||'';
    const record=kind==='car'&&!coverPhoto(storedRecord)?{...storedRecord,coverFileId:''}:storedRecord;
    releaseCoverPreview();
    edit={kind,entity,id:id||uid(),record,parents:record._heads||[],pendingCover:null,previewUrl:''};
    $('#dialog-title').textContent={car:id?'Upravit auto':'Nové auto',task:id?'Detail úkolu':'Co je potřeba udělat?',note:id?'Poznámka a odkaz':'Ulož si nápad',photo:'Přidat fotky a dokumenty'}[kind];
    $('#dialog-eyebrow').textContent=mode==='demo'?'UKÁZKA · POUZE TENTO PROHLÍŽEČ':'SPOLEČNÁ GARÁŽ';
    let fields=conflictFields(record);
    if(kind==='car')fields+=`<div class="form-grid">${field('name','Název auta',record.name||'','text','class="wide"')}${field('year','Rok výroby',record.year||'','text')}${field('plate','SPZ / poznávací označení',record.plate||'')}${field('type','Typ auta',record.type||'')}<label>Motor<input name="engine" maxlength="160" value="${e(record.engine||'')}" placeholder="Např. 5.8 V8, benzín"></label><label class="wide">Barva auta<input name="paint" maxlength="120" value="${e(record.paint||'')}" placeholder="Např. béžová / hnědá, dvoubarevná"></label>${select('style','Náhradní ilustrace',[['suv','Osobní auto / SUV'],['pickup','Pick-up'],['rv','Obytné auto']],record.style||'suv')}${select('archived','Zařazení',[['no','Aktivní garáž'],['yes','Archiv']],record.archived?'yes':'no')}<section class="wide car-cover-editor"><h3>Úvodní fotografie auta</h3><div id="cover-upload-preview" class="cover-upload-preview">${record.coverFileId?'<span>Načítám uloženou fotku…</span>':'<span>Vyber fotku auta z počítače nebo telefonu.</span>'}</div><label class="cover-upload-label">Nahrát novou úvodní fotku<input type="file" name="coverUpload" accept="image/jpeg,image/png,image/webp,.heic,.heif"><small>JPG, PNG nebo WebP do 25 MB. Automaticky zmenšíme na nejvýše 1920 px, JPG kvalita 80 %. Originál v telefonu zůstane.</small></label>${button('Zrušit výběr nové fotky','clear-cover-upload','','button small ghost')}${select('coverFileId','Nebo vybrat z již uložených fotek',[['','Použít ilustraci'],...data.files.filter(f=>!f.removed&&f.carId===id&&isPhoto(f)).map(f=>[f.id,f.title||f.name])],record.coverFileId||'')}</section><label class="wide">Poznámka k autu<textarea name="description" maxlength="20000">${e(record.description)}</textarea></label></div>`;
    if(kind==='task')fields+=`<div class="form-grid">${field('title','Název úkolu',record.title||'','text','class="wide"')}${select('carId','Auto',carsOptions(),record.carId||cId)}${select('kind','Typ práce',Object.entries(kinds),record.kind||'repair')}${field('due','Datum termínu',record.due||day,'date')}<label>Čas (nepovinný)<input name="dueTime" type="time" step="60" value="${e(record.dueTime||'')}"><small>Český čas. S časem se v Google Kalendáři rezervuje 1 hodina; bez času je úkol celodenní.</small></label>${field('owner','Kdo to zařídí',record.owner||'')}${select('status','Stav',Object.entries(status),record.status||'todo')}${select('priority','Priorita',[['normal','Běžná'],['high','Vysoká']],record.priority||'normal')}${field('cost','Odhad nákladů (Kč)',record.cost??'','number')}${field('actualCost','Skutečné náklady (Kč)',record.actualCost??'','number')}<label class="wide">Co je potřeba a další podrobnosti<textarea name="description" maxlength="20000">${e(record.description)}</textarea></label><label class="wide checkbox-label"><input type="checkbox" name="calendarSync" ${record.calendarSync===false?'':'checked'}> Zobrazovat v Google Kalendáři, pokud má úkol termín</label></div>`+(id?`<div class="stack">${button('Fotky a dokumenty k úkolu','task-photo',`data-id="${e(id)}"`,'button small')}${button('Odstranit úkol','remove-task',`data-id="${e(id)}"`,'button ghost danger')}</div>`:'');
    if(kind==='note')fields+=`<div class="form-grid">${field('title','Nadpis',record.title||'','text','class="wide"')}${select('carId','K jakému autu',carsOptions(true),record.carId??(view==='car'?carId:''))}${select('kind','Co ukládáš',[['note','Poznámka'],['link','Odkaz / video']],record.kind||'note')}${field('url','Odkaz na web / YouTube',record.url||'','url','class="wide"')}<label class="wide">Poznámka<textarea name="body" maxlength="20000">${e(record.body)}</textarea></label></div>`+(id?button('Odstranit poznámku','remove-note',`data-id="${e(id)}"`,'button ghost danger'):'');
    if(kind==='photo')fields+=select('carId','Auto',carsOptions(),record.carId||cId)+select('taskId','Ke konkrétnímu úkolu',[['','Jen k autu'],...tasks().filter(t=>t.carId===(record.carId||cId)).map(t=>[t.id,t.title])],'')+`<label>Popis příloh (nepovinný)<input name="title" maxlength="150"></label><label>Vybrat fotky nebo dokumenty<input type="file" name="photos" accept="image/jpeg,image/png,image/webp,.heic,.heif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.txt,.csv,.rtf" multiple required><small>Nejvýše 25 MB na soubor a 8 souborů najednou. Fotky zmenšíme na 1920 px, JPG kvalita 80 %. Malé fotky nezvětšujeme. Průhlednost nahradíme bílou. Dokumenty ukládáme beze změny. HEIC funguje, pokud jej telefon umí otevřít v prohlížeči.</small></label><label class="checkbox-label"><input type="checkbox" name="useCover" ${coverPhoto(car(record.carId||cId))?'':'checked'}> Použít první fotografii z výběru jako úvodní fotografii auta (dokumenty přeskočíme)</label>`;
    $('#form-fields').innerHTML=fields;$('#save-button').disabled=false;$('#save-button').textContent=kind==='photo'?'Nahrát soubory':'Uložit';
    $('#save-button').classList.toggle('hidden',!writable());
    if(!writable()){
      $('#form-fields').querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
      $('#dialog-eyebrow').textContent='PROHLÍŽENÍ · PŘÍSTUP JEN KE ČTENÍ';
    }
    if(!$('#editor').open)$('#editor').showModal();
    if(kind==='car')updateCoverPreview();
    setTimeout(()=>$('#editor input, #editor select')?.focus(),0);
  }
  function closeEditor(){if(busy||uploading)return;releaseCoverPreview();$('#editor').close();edit=null;}
  async function saveEditor(ev){ev.preventDefault();if(!edit||busy||uploading)return;const current=edit,values=Object.fromEntries(new FormData(ev.target));const submit=$('#save-button');submit.disabled=true;submit.textContent='Ukládám…';
    try{
      if(current.kind==='photo'){uploading=true;try{await uploadPhotos(values,ev.target.elements.photos.files);}finally{uploading=false;}closeEditor();render();notify('Soubory jsou uložené.');return;}
      const r={...C.clean(current.record),...values};delete r.resolveConflict;delete r.coverUpload;
      if(current.kind==='car'){r.name=r.name.trim();if(!r.name)throw new Error('Napiš název auta.');r.archived=r.archived==='yes';r.engine=String(r.engine||'').trim();r.paint=String(r.paint||'').trim();r.color=current.record.color||colors[5];const selected=ev.target.elements?.coverUpload?.files?.[0];if(selected)validatePhotos([selected],1);}
      if(current.kind==='task'){r.dueTime=String(values.dueTime||'').trim();if(r.dueTime&&!r.due)throw new Error('K času doplň také datum termínu.');if(r.due)C.taskTiming(r);r.calendarSync=values.calendarSync==='on';r.title=r.title.trim();if(!r.title)throw new Error('Napiš název úkolu.');r.completedAt=r.status==='done'?(current.record.status==='done'?current.record.completedAt||today():today()):'';}
      if(current.kind==='note'){r.title=r.title.trim();if(!r.title)throw new Error('Napiš nadpis.');if(r.url&&!C.url(r.url))throw new Error('Odkaz musí začínat https:// nebo http://.');if(r.kind==='link'&&!r.url)throw new Error('K odkazu doplň webovou adresu.');}
      const cover=current.kind==='car'?ev.target.elements?.coverUpload?.files?.[0]:null;
      if(cover)uploading=true;
      const locked=cover?[...(ev.target.querySelectorAll?.('input,select,textarea,button')||[])].map(node=>({node,disabled:node.disabled})):[];
      for(const item of locked)item.node.disabled=true;
      try{
        const saved=await write(current.entity,current.id,r,current.parents);
        if(current.kind==='car'){current.record=saved;current.parents=saved._heads;current.carSaved=true;if(cover){submit.textContent='Nahrávám úvodní fotku…';await saveCarCover(current,cover);}}
      }finally{if(cover)uploading=false;for(const item of locked)item.node.disabled=item.disabled;}
      closeEditor();render();notify(mode==='cloud'?'Uloženo do Googlu.':'Uloženo v ukázce v tomto prohlížeči.');
    }catch(error){notify(current.kind==='car'&&current.carSaved?'Auto už je uložené. '+error.message+' Formulář zůstal otevřený; po odstranění problému můžeš uložení zopakovat.':error.message);}
    finally{submit.disabled=false;submit.textContent=current.kind==='photo'?'Nahrát soubory':'Uložit';}
  }
  function validatePhotos(files,max=8){M.validate(files,true,max);}
  function releaseCoverPreview(){if(edit?.previewUrl){URL.revokeObjectURL(edit.previewUrl);edit.previewUrl='';}}
  function updateCoverPreview(){
    if(edit?.kind!=='car')return;
    const preview=$('#cover-upload-preview'),input=$('#editor-form [name=coverUpload]'),choice=$('#editor-form [name=coverFileId]');
    if(!preview)return;
    releaseCoverPreview();preview.removeAttribute('data-photo');
    const file=input?.files?.[0];
    if(file){
      try{validatePhotos([file],1);edit.previewUrl=URL.createObjectURL(file);preview.innerHTML='<img src="'+e(edit.previewUrl)+'" alt="Náhled nové úvodní fotky auta">';}
      catch(error){input.value='';preview.innerHTML='<span>'+e(error.message)+'</span>';notify(error.message);}
      return;
    }
    const selected=choice?.value||'';
    if(selected){preview.dataset.photo=selected;preview.innerHTML='<span>Načítám uloženou fotku…</span>';hydratePhotos(renderVersion);}
    else preview.innerHTML='<span>Vyber fotku auta z počítače nebo telefonu.</span>';
  }
  async function saveCarCover(current,file){
    let pending=current.pendingCover;
    if(!pending||pending.file!==file)pending=current.pendingCover={file,id:uid(),driveId:'',uploaded:false};
    if(!pending.prepared)pending.prepared=await M.prepare(file);
    const prepared=pending.prepared;
    if(!pending.uploaded){
      if(mode==='cloud'){const remote=await G.upload(prepared);pending.driveId=remote.id;}
      else await localPhoto(pending.id,prepared);
      pending.uploaded=true;
    }
    if(!data.files.some(f=>f.id===pending.id))await write('files',pending.id,{carId:current.id,taskId:'',title:'Úvodní fotka — '+current.record.name,name:prepared.name,mime:prepared.type,size:prepared.size,originalSize:file.size,driveId:pending.driveId,createdAt:new Date().toISOString()},[]);
    const latest=car(current.id);
    if(!latest||latest._conflict)throw new Error('Fotka je uložená, ale auto má souběžné změny. Obnov záznam a vyber fotku z galerie.');
    const saved=await write('cars',current.id,{...C.clean(latest),coverFileId:pending.id},latest._heads);
    current.record=saved;current.parents=saved._heads;current.pendingCover=null;
  }
  function localDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open('garaz-photos:'+location.pathname,1);req.onupgradeneeded=()=>req.result.createObjectStore('photos');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(new Error('Prohlížeč nepovolil místní ukládání fotek.'));});}
  async function localPhoto(id,blob){const db=await localDb();return new Promise((resolve,reject)=>{const tx=db.transaction('photos',blob?'readwrite':'readonly'),req=blob?tx.objectStore('photos').put(blob,id):tx.objectStore('photos').get(id);let result;req.onsuccess=()=>result=req.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(new Error('Fotku se nepodařilo uložit v prohlížeči.'));};});}
  async function uploadPhotos(v,files){
    M.validate(files);
    const selectedTask=data.tasks.find(t=>t.id===v.taskId);if(v.taskId&&selectedTask?.carId!==v.carId)throw new Error('Úkol musí patřit k vybranému autu.');
    const coverCar=v.useCover?car(v.carId):null;
    if(coverCar?._conflict)throw new Error('Auto má souběžné úpravy. Nejdřív je vyřeš v Upravit auto.');
    let uploaded=0,coverAssigned=false;
    for(const original of files){const id=uid();let driveId='';
      try{
        const f=await M.prepare(original);
        if(mode==='cloud'){const r=await G.upload(f);driveId=r.id;}else await localPhoto(id,f);
        await write('files',id,{carId:v.carId,taskId:v.taskId||'',title:v.title.trim()||f.name,name:f.name,mime:f.type,size:f.size,originalSize:original.size,driveId,createdAt:new Date().toISOString()},[]);uploaded++;
        if(!coverAssigned&&coverCar&&M.isImage(f)){await write('cars',coverCar.id,{...C.clean(coverCar),coverFileId:id},coverCar._heads);coverAssigned=true;}
      }catch(err){render();throw new Error('Uloženo '+uploaded+' z '+files.length+' souborů. '+err.message+(driveId?' Soubor již je na Disku, ale jeho záznam se nepodařilo připojit: https://drive.google.com/file/d/'+driveId+'/view':''));}
    }
  }
  const pendingPhotoUrls=new Map();
  async function photoUrl(file){
    if(photoUrls.has(file.id))return photoUrls.get(file.id);
    if(pendingPhotoUrls.has(file.id))return pendingPhotoUrls.get(file.id);
    const pending=(async()=>{
      const blob=mode==='cloud'?await G.photo(file.driveId):await localPhoto(file.id);
      if(!blob||pendingPhotoUrls.get(file.id)!==pending)throw new Error('Fotka už není dostupná.');
      const url=URL.createObjectURL(blob);
      photoUrls.set(file.id,url);
      if(photoUrls.size>40){
        const [oldId,oldUrl]=photoUrls.entries().next().value;
        URL.revokeObjectURL(oldUrl);
        photoUrls.delete(oldId);
      }
      return url;
    })();
    pendingPhotoUrls.set(file.id,pending);
    try{return await pending;}
    finally{if(pendingPhotoUrls.get(file.id)===pending)pendingPhotoUrls.delete(file.id);}
  }
  async function hydratePhotos(version){
    const nodes=[...document.querySelectorAll('[data-photo]')];
    // Limit concurrent original-image downloads and keep a bounded object URL cache.
    let cursor=0;await Promise.all(Array.from({length:Math.min(3,nodes.length)},async()=>{while(cursor<nodes.length){const node=nodes[cursor++],f=data.files.find(f=>f.id===node.dataset.photo);if(!f||version!==renderVersion)continue;try{const url=await photoUrl(f);if(version!==renderVersion||node.dataset.photo!==f.id)continue;const image=new Image();image.alt=f.title||f.name;image.src=url;image.loading='lazy';node.replaceChildren(image);}catch{if(version===renderVersion&&node.classList.contains('car-cover')){node.title='Fotku se nepodařilo načíst. Zkontroluj přihlášení a přístup k fotce na Disku.';continue;}if(version===renderVersion)node.textContent=mode==='cloud'?'Náhled není dostupný. Otevři fotku na Disku.':'Fotka není v tomto prohlížeči dostupná.';}}}));
  }
  function clearPhotos(){pendingPhotoUrls.clear();for(const url of photoUrls.values())URL.revokeObjectURL(url);photoUrls.clear();}
  function download(name,content,type){const u=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  async function connect(){
    if(busy||restoringLogin||connecting)return;
    connecting=true;render();
    try{const p=await G.connect();await connected(p,false);}
    finally{connecting=false;render();}
  }
  async function connected(p,restoring){
    const desiredView=view;calendarBinding=null;calendarConfigError='';calendarState.error='';calendarState.message='';mode='cloud';clearPhotos();setData([]);view='settings';lastSync='';render();
    if(G.config.spreadsheetId){try{await Promise.all([loadCloud(),refreshCalendarBinding()]);view='overview';}catch(error){notify(error.message);}}
    if(restoring)view=desiredView;
    setTimeout(()=>syncCalendar(false),800);render();notify('Přihlášeno jako '+p.email+'. '+(G.config.spreadsheetId?'':'Vyber nebo vytvoř společnou tabulku.'));
  }
  async function action(name,target){
    if(restoringLogin)throw new Error('Počkej na obnovení přihlášení.');
    const id=target?.dataset.id;
    if(name.startsWith('calendar-')){await calendarAction(name);return;}
    if((calendarState.running||calendarSetupBusy)&&['connect','logout','pick-sheet','create-sheet'].includes(name))throw new Error('Počkej na dokončení synchronizace kalendáře.');
    if(['tasks-late','tasks-soon','tasks-done-month'].includes(name)){navigate('tasks',name.slice(6));return;}
    if(name.startsWith('view-')){navigate(name.slice(5));return;}
    if(name==='remove-file'){
      if(!writable())throw new Error('K odebrání potřebuješ právo upravovat garáž.');
      const file=data.files.find(item=>item.id===id&&!item.removed);
      if(!file)return;
      if(file._conflict)throw new Error('Příloha má souběžné změny. Obnov data před odebráním.');
      const storageNotice=file.driveId?'Originál zůstane na Google Disku.':'Soubor zůstane uložený v tomto prohlížeči.';
      if(!confirm('Odebrat „'+(file.title||file.name)+'“ z Garáže? '+storageNotice))return;
      await write('files',id,{...C.clean(file),removed:true},file._heads);
      render();
      notify('Příloha byla odebrána z Garáže.');
      return;
    }
    if(name==='use-cover'){
      if(!writable())throw new Error('Pro úpravy potřebuješ přihlášení a roli Editor.');
      const f=data.files.find(f=>f.id===id&&!f.removed),c=f&&car(f.carId);
      if(!c||!isPhoto(f))throw new Error('Vyber fotografii patřící k autu.');
      if(c._conflict){showEditor('car',c.id);return;}
      await write('cars',c.id,{...C.clean(c),coverFileId:f.id},c._heads);render();notify('Úvodní fotka auta je nastavená.');return;
    }
    if(name==='open-car'){carId=id;carTab='tasks';navigate('car');return;}
    if(name==='car-tab'){carTab=target.dataset.tab;render();return;}
    if(name==='clear-cover-upload'){if(busy||uploading)return;const input=$('#editor-form [name=coverUpload]');if(input)input.value='';updateCoverPreview();return;}
    if(name==='new-car'||name==='edit-car'){showEditor('car',name==='edit-car'?carId:'');return;}
    if(name==='new-task'||name==='edit-task'||name==='day-task'){showEditor('task',name==='edit-task'?id:'',target?.dataset.day||'');return;}
    if(name==='new-note'||name==='edit-note'){showEditor('note',name==='edit-note'?id:'');return;}
    if(name==='new-photo'){showEditor('photo');return;}
    if(name==='task-photo'){if(!confirm('Otevřít nahrání fotek a dokumentů? Neuložené změny ve formuláři se zahodí.'))return;const t=data.tasks.find(t=>t.id===id);closeEditor();showEditor('photo');$('#editor-form [name=carId]').value=t.carId;updatePhotoTasks(t.carId);$('#editor-form [name=taskId]').value=id;return;}
    if(name==='toggle-task'){if(!writable())throw new Error('Přihlas se pro úpravy.');const t=data.tasks.find(t=>t.id===id);if(t._conflict){showEditor('task',id);return;}const record={...C.clean(t),status:t.status==='done'?'todo':'done',completedAt:t.status==='done'?'':today()};await write('tasks',id,record,t._heads);render();return;}
    if(name==='remove-task'||name==='remove-note'){const entity=name==='remove-task'?'tasks':'notes',r=data[entity].find(r=>r.id===id);if(r._conflict)throw new Error('Nejdřív porovnej souběžné verze a ulož společnou podobu.');if(!confirm('Odstranit tento záznam z aplikace? Fotky zůstanou uložené.'))return;await write(entity,id,{...C.clean(r),removed:true},r._heads);closeEditor();render();return;}
    if(name==='prev-month'||name==='next-month'||name==='this-month'){month=name==='this-month'?new Date():new Date(month.getFullYear(),month.getMonth()+(name==='prev-month'?-1:1),1,12);render();return;}
    if(name==='export-ics'){download('garaz-kalendar.ics',C.ics(tasks().filter(t=>matches(t)),data.cars),'text/calendar;charset=utf-8');return;}
    if(name==='export-json'){download('garaz-zaznamy-'+today()+'.json',JSON.stringify({version:1,exportedAt:new Date().toISOString(),mode,events},null,2),'application/json');return;}
    if(name==='open-photo'){const f=data.files.find(f=>f.id===id);const blob=await localPhoto(f.id);if(!blob)throw new Error('Fotka není dostupná.');download(f.name,blob,f.mime);return;}
    if(name==='connect'){await connect();return;}
    if(name==='logout'){G.logout();calendarBinding=null;calendarState.message='';calendarState.error='';clearPhotos();mode='demo';try{setData(JSON.parse(localStorage.getItem(prefix)||'null')||seed());}catch{setData(seed());}navigate('settings');return;}
    if(name==='pick-sheet'||name==='create-sheet'||name==='pick-folder'||name==='create-folder'){
      if(mode!=='cloud'||!G.ready())throw new Error('Nejdřív se přihlas přes Google.');
      if(name==='create-sheet'&&G.config.spreadsheetId&&!confirm('Vytvořit další prázdnou tabulku a přepnout na ni? Stávající zůstane beze změny.'))return;
      let result;
      if(name==='pick-sheet')result=await G.pick('sheet');if(name==='pick-folder')result=await G.pick('folder');if(name==='create-sheet')result=await G.createSheet();if(name==='create-folder')result=await G.createFolder();
      if(!result)return;
      if(name.includes('sheet')){clearPhotos();setData([]);calendarBinding=null;await loadCloud();await refreshCalendarBinding();}
      render();notify(name.startsWith('create')?'Vytvořeno. Nezapomeň soubor v Googlu nasdílet svým lidem.':'Výběr uložen.');return;
    }
    if(name==='reset-demo'){if(!confirm('Vrátit ukázkové záznamy do výchozího stavu? Data v Googlu zůstanou beze změny.'))return;const rows=seed();localStorage.setItem(prefix,JSON.stringify(rows));if(mode==='demo'){setData(rows);clearPhotos();render();}notify('Ukázka je připravená znovu.');}
  }
  function updatePhotoTasks(id){const sel=$('#editor-form [name=taskId]');if(sel)sel.innerHTML='<option value="">Jen k autu</option>'+tasks().filter(t=>t.carId===id).map(t=>`<option value="${e(t.id)}">${e(t.title)}</option>`).join('');}
  $('#menu-toggle')?.addEventListener('click',()=>setMobileMenu(!document.body.classList.contains('menu-open')));
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&document.body.classList.contains('menu-open')){
      setMobileMenu(false);
      $('#menu-toggle')?.focus();
    }
  });
  document.addEventListener('click',async ev=>{
    if(document.body.classList.contains('menu-open')&&!ev.target.closest('#garage-menu,#menu-toggle'))setMobileMenu(false);
    const b=ev.target.closest('[data-action],[data-view]');if(!b)return;try{if(b.dataset.view)navigate(b.dataset.view);else await action(b.dataset.action,b);}catch(err){notify(err.message);}});
  document.addEventListener('keydown',ev=>{if((ev.key==='Enter'||ev.key===' ')&&ev.target.matches('.car-card')){ev.preventDefault();action('open-car',ev.target).catch(err=>notify(err.message));}});
  document.addEventListener('change',ev=>{if(ev.target.id==='remember-login'){try{G.setRemember(ev.target.checked);notify(ev.target.checked?'Zapamatování zapnuto do vypršení přístupu Google.':'Zapamatování vypnuto.');}catch(error){ev.target.checked=G.remember;notify(error.message);}return;}if(ev.target.id==='filter-car'){filters.car=ev.target.value;render();}if(ev.target.id==='filter-status'){filters.status=ev.target.value;render();}if(edit?.kind==='photo'&&ev.target.name==='carId')updatePhotoTasks(ev.target.value);if(edit?.kind==='car'&&['coverUpload','coverFileId'].includes(ev.target.name))updateCoverPreview();});
  document.addEventListener('input',ev=>{if(ev.target.id==='search'){filters.q=ev.target.value;const pos=ev.target.selectionStart;render();$('#search')?.focus();$('#search')?.setSelectionRange(pos,pos);}});
  document.addEventListener('submit',async ev=>{
    if(!['calendar-options-form','calendar-recover-form'].includes(ev.target.id))return;
    ev.preventDefault();if(calendarState.running||calendarSetupBusy){notify('Počkej na dokončení synchronizace.');return;}
    if(mode!=='cloud'||!G.ready()){notify('Nejdřív se přihlas přes Google.');return;}
    const values=Object.fromEntries(new FormData(ev.target));calendarSetupBusy=true;paintCalendarStatus();
    try{
      if(ev.target.id==='calendar-options-form'){
        if(!calendarBinding||!calendarOwner()||calendarBinding._conflict)throw new Error('Připomínky nastavuje účet, který kalendář propojil.');
        if(!['default','none','1440','2880'].includes(values.reminder))throw new Error('Vyber platnou připomínku.');
        calendarBinding=await G.saveCalendarConfig({...calendarBinding,reminder:values.reminder},calendarBinding._heads);
      }else{
        await refreshCalendarBinding();if(calendarConfigError)throw new Error(calendarConfigError);
        if(calendarBinding)throw new Error('Tabulka už kalendář má. Existující propojení nebylo změněno.');
        const binding=await H.recover(G,values.calendarId.trim());calendarBinding=await G.saveCalendarConfig(binding,[]);H.clearPending(G.config.spreadsheetId,G.profile.email);
      }
      calendarState.message='Nastavení kalendáře je uložené ve společné tabulce.';
    }catch(error){notify(error.message);}
    finally{calendarSetupBusy=false;render();paintCalendarStatus();}
    if(calendarBinding?.enabled&&G.calendarGranted&&calendarOwner())await syncCalendar(true);
  });
  document.addEventListener('submit',ev=>{if(ev.target.id!=='config-form')return;ev.preventDefault();if(restoringLogin){notify('Počkej na obnovení přihlášení.');return;}if(calendarState.running||calendarSetupBusy){notify('Počkej na dokončení synchronizace.');return;}const f=Object.fromEntries(new FormData(ev.target));for(const k of Object.keys(f))f[k]=f[k].trim();if(!f.clientId.endsWith('.apps.googleusercontent.com')||!/^\d+$/.test(f.projectNumber)){notify('Zkontroluj Client ID a číselné číslo projektu.');return;}const old=G.config;G.persist(f);if(mode==='cloud'&&(old.clientId!==f.clientId||old.projectNumber!==f.projectNumber)){G.logout();mode='demo';clearPhotos();try{setData(JSON.parse(localStorage.getItem(prefix)||'null')||seed());}catch{setData(seed());}}render();notify('Konfigurace uložená pro tento prohlížeč. Pro ostatní ji vlož také do config.js.');});
  $('#editor-form').addEventListener('submit',saveEditor);
  $('#close-dialog').addEventListener('click',closeEditor);$('#cancel-dialog').addEventListener('click',closeEditor);
  $('#editor').addEventListener('cancel',ev=>{if(busy||uploading)ev.preventDefault();else{releaseCoverPreview();edit=null;}});
  $('#theme').addEventListener('click',()=>{document.body.classList.toggle('dark');localStorage.setItem('garaz.theme',document.body.classList.contains('dark')?'dark':'light');render();});
  $('#account').addEventListener('click',()=>navigate('settings'));
  $('#sync').addEventListener('click',async()=>{if(restoringLogin)return;try{if(mode==='cloud'){if(!G.ready()){await connect();return;}await Promise.all([loadCloud(),refreshCalendarBinding()]);render();await syncCalendar(false);notify('Data jsou aktuální.');}else notify('Používáš místní ukázku. Společná data připojíš v Nastavení.');}catch(err){notify(err.message);}});
  window.addEventListener('storage',ev=>{if(ev.key===prefix&&mode==='demo'&&!busy){try{setData(JSON.parse(ev.newValue)||seed());render();}catch{}}});
  window.addEventListener('hashchange',()=>{setMobileMenu(false);const hash=location.hash.slice(1);if(hash.startsWith('car/')){carId=decodeURIComponent(hash.slice(4));view='car';}else if(labels[hash])view=hash;render();});
  window.addEventListener('beforeunload',ev=>{if(busy||uploading||calendarState.running||calendarSetupBusy){ev.preventDefault();ev.returnValue='';}});
  const initial=location.hash.slice(1);if(labels[initial])view=initial;else if(initial.startsWith('car/')){carId=decodeURIComponent(initial.slice(4));view='car';}
  setInterval(()=>{if(document.visibilityState==='visible'&&!$('#editor').open)syncCalendar(false);},60000);
  if(G.hasRememberedSession?.()){
    restoringLogin=true;mode='cloud';setData([]);render();
    $('#connection').textContent='Obnovuji přihlášení…';
    G.resume().then(p=>{if(!p)throw new Error('Uložený přístup už vypršel.');return connected(p,true);}).catch(error=>{G.logout();mode='demo';setData([]);view='settings';render();notify('Přihlášení se nepodařilo obnovit. '+error.message);}).finally(()=>{restoringLogin=false;render();});
  }else render();
})();
