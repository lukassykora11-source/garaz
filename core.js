(function (root) {
  'use strict';
  const pad = n => String(n).padStart(2, '0');
  const day = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const date = s => new Date(s + 'T12:00:00');
  const offset = (n, base = new Date()) => { const d = new Date(base); d.setDate(d.getDate()+n); return day(d); };
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function url(s) { try { const u = new URL(s); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } }
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
      lines.push('BEGIN:VEVENT','UID:'+text(t.id)+'@garaz','DTSTAMP:'+now,'DTSTART;VALUE=DATE:'+t.due.replace(/-/g,''),'DTEND;VALUE=DATE:'+offset(1,date(t.due)).replace(/-/g,''),'SUMMARY:'+text((car?car.name+' · ':'')+t.title),'DESCRIPTION:'+text(t.description),'END:VEVENT');
    }
    lines.push('END:VCALENDAR');
    // RFC 5545: fold at no more than 75 octets, preserving UTF-8 code points.
    const enc=new TextEncoder();
    return lines.map(line=>{let out='',part='',size=0;for(const c of line){const n=enc.encode(c).length;if(size+n>75){out+=part+'\r\n';part=' ';size=1;}part+=c;size+=n;}return out+part;}).join('\r\n')+'\r\n';
  }
  const api={day,date,offset,escape,url,reduce,clean,due,calendar,ics};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  else root.GarazCore=api;
})(typeof window !== 'undefined' ? window : globalThis);
