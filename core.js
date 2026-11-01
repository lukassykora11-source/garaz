(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const day = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const date = s => new Date(s + 'T12:00:00');
  const offset = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate()+n); return day(d); };
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function url(s) { try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
  function taskTiming(task) {
    const d=task.due,t=task.dueTime||'';
    if(!d)throw new Error('K času doplň také datum termínu.');
    const midnight=Date.parse(d+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)||!Number.isFinite(midnight)||new Date(midnight).toISOString().slice(0,10)!==d)throw new Error('Neplatné datum termínu.');
    if(!t)return {start:{date:d},end:{date:new Date(midnight+86400000).toISOString().slice(0,10)}};
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(t))throw new Error('Čas zadej ve formátu HH:MM, například 15:00.');
    const zone='Europe/Prague',formatter=new Intl.DateTimeFormat('en-GB',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const wall=ms=>{const p=Object.fromEntries(formatter.formatToParts(new Date(ms)).map(v=>[v.type,v.value]));return `${p.year.padStart(4,'0')}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;};
    const desired=d+'T'+t+':00',naive=Date.parse(desired+'Z'),offsets=new Set();
    for(const delta of [-36,0,36]){const probe=naive+delta*3600000;offsets.add(Date.parse(wall(probe)+'Z')-probe);}
    const candidates=[...offsets].map(o=>naive-o).filter(ms=>wall(ms)===desired).sort((a,b)=>a-b);
    if(!candidates.length)throw new Error('Tento čas v Praze kvůli přechodu na letní čas neexistuje. Vyber jiný čas.');
    // At the autumn clock change, use the first occurrence of an ambiguous time.
    const start=candidates[0];
    return {start:{dateTime:new Date(start).toISOString(),timeZone:zone},end:{dateTime:new Date(start+3600000).toISOString(),timeZone:zone}};
  }
  function reduce(events) {
    const groups = new Map(), seen = new Set();
    for (const e of events) {
      if (!e || seen.has(e.id) || !e.id || !['cars','tasks','notes','files'].includes(e.entity) || !e.recordId || !e.data || !Array.isArray(e.parents)) continue;
      seen.add(e.id);
      const key = e.entity + ':' + e.recordId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(e);
    }
    const result = {cars:[],tasks:[],notes:[],files:[],conflicts:[]};
    for (const rows of groups.values()) {
      const superseded = new Set(rows.flatMap(e => e.parents));
      const heads = rows.filter(e => !superseded.has(e.id));
      if (!heads.length) continue;
      const latest = heads[heads.length-1];
      const record = {...latest.data, id:latest.recordId, _heads:heads.map(e=>e.id), _variants:heads, _conflict:heads.length>1};
      result[latest.entity].push(record);
      if(record._conflict) result.conflicts.push({entity:latest.entity,record});
    }
    return result;
  }
  function clean(record) { return Object.fromEntries(Object.entries(record).filter(([k]) => !k.startsWith('_') && k !== 'id')); }
  function due(task, today = day(new Date())) {
    if (task.status === 'done' || task.removed) return 'done';
    if (!task.due) return 'none';
    return task.due < today ? 'late' : task.due <= offset(7,date(today)) ? 'soon' : 'later';
  }
  function calendar(year, month) {
    const first = new Date(year,month,1,12), start = new Date(first);
    start.setDate(1-((first.getDay()+6)%7));
    return Array.from({length:42},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return {day:day(d),number:d.getDate(),inside:d.getMonth()===month};});
  }
  function ics(tasks, cars) {
    const text=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Garaz//CS','CALSCALE:GREGORIAN'];
    const now=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    for(const t of tasks.filter(t=>t.due&&!t.removed&&t.status!=='done')){
      const car=cars.find(c=>c.id===t.carId);
      const timing=taskTiming(t),stamp=s=>s.replace(/[-:]/g,'').replace(/\.\d{3}/,'');
      lines.push('BEGIN:VEVENT','UID:'+text(t.id)+'@garaz','DTSTAMP:'+now,...(timing.start.date?['DTSTART;VALUE=DATE:'+stamp(timing.start.date),'DTEND;VALUE=DATE:'+stamp(timing.end.date)]:['DTSTART:'+stamp(timing.start.dateTime),'DTEND:'+stamp(timing.end.dateTime)]),'SUMMARY:'+text((car?car.name+' · ':'')+t.title),'DESCRIPTION:'+text(t.description),'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // RFC 5545: fold at no more than 75 octets, preserving UTF-8 code points.
    const enc=new TextEncoder();
    return lines.map(line=>{let out='',part='',size=0;for(const c of line){const n=enc.encode(c).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=c;size+=n;}return out+part;}).join('\r\n')+'\r\n';
  }
  const api={day,date,offset,escape,url,reduce,clean,due,calendar,ics,taskTiming};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.GarazCore=api;
})(typeof window !== 'undefined' ? window : globalThis);
