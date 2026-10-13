
export const norm = s => (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
const q = s => parseFloat((s||'0').replace(/[Q,\s]/g,'')) || 0;
const iso = s => { const m=(s||'').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0') : ''; };
export function decode(buf){ try { return new TextDecoder('utf-8',{fatal:true}).decode(buf); } catch(e){ return new TextDecoder('windows-1252').decode(buf); } }
// Registro: [or, fecha ISO, año, marca|modelo, punto, nombre vehículo, nombre punto, [[desc, repSinIVA, moQSinIVA]], fuente]
export function parseRecords(text){
  const rows = text.split(/\r?\n/); const head = rows.shift() || '';
  const sep = head.split(';').length > head.split(',').length ? ';' : (head.includes('\t') ? '\t' : ',');
  const H = head.split(sep).map(norm);
  const col = (...names) => H.findIndex(h => names.some(n => h.startsWith(n)));
  const C = { or:col('OR'), f:col('FECHA'), marca:col('MARCA'), modelo:col('MODELO'), anio:col('ANO','AÑO'), tipo:col('TIPO'), punto:col('PUNTO DE INSPECCION'), desc:col('DESCRIPCION'), rep:col('COTIZACION - REFACC'), mo:col('COTIZACION - M.O') };
  const occ = {};
  for (const line of rows){ if(!line) continue; const r = line.split(sep);
    if (norm(r[C.tipo]) !== 'SUB-PUNTO') continue;
    const d = iso(r[C.f]); const mk = norm(r[C.marca])+'|'+norm(r[C.modelo]); const pk = norm(r[C.punto]); if(!pk || !d) continue;
    const k = mk+'§'+pk+'§'+r[C.or];
    let o = occ[k]; if(!o){ o = occ[k] = [ String(r[C.or]).trim(), d, (r[C.anio]||'').trim(), mk, pk, (r[C.marca]||'').trim()+' '+(r[C.modelo]||'').trim(), (r[C.punto]||'').trim(), [], 'cm' ]; }
    if (d > o[1]) o[1] = d;
    o[7].push([ (r[C.desc]||'').trim(), q(r[C.rep]), q(r[C.mo]) ]);
  }
  return Object.values(occ);
}
export function buildIndex(text){ return buildFromRecords(parseRecords(text)); }
export function buildFromRecords(recs){
  const m = {}, G = {}, D = {}; let n = 0, minD='9999', maxD='0000', own = 0;
  for (const R of recs){
    const o = { or:R[0], d:R[1], y:R[2], mk:R[3], pk:R[4], disp:[R[5], R[6]], lines:R[7] };
    n += o.lines.length; if (R[8] === 'lns') own++; if(o.d<minD)minD=o.d; if(o.d>maxD)maxD=o.d;
    const g = G[o.pk] = G[o.pk] || { n:0, l:{} }; g.n++;
    const seenD = new Set();
    for (const [desc, rep, mo] of o.lines){ const dk = norm(desc).replace(/[^A-Z0-9 ]/g,' ').replace(/\s+/g,' ').trim(); if(!dk || dk==='N A') continue;
      if(!seenD.has(dk)){ seenD.add(dk); const e = g.l[dk] = g.l[dk] || { c:0, d:desc, t:'', r:0, h:0 }; e.c++; if(o.d >= e.t){ e.t=o.d; e.r=rep; e.h=mo; e.d=desc; } }
      const x = D[dk] = D[dk] || { c:0, d:desc, t:'', r:0, h:0 }; x.c++; if(o.d >= x.t){ x.t=o.d; x.r=rep; x.h=mo; x.d=desc; }
    }
    const M = m[o.mk] = m[o.mk] || { d:o.disp[0], p:{} };
    const P = M.p[o.pk] = M.p[o.pk] || { name:o.disp[1], n:0, last:null, h:[] };
    P.n++; const tot = o.lines.reduce((a,l)=>a+l[1]+l[2],0);
    P.h.push([o.d, Math.round(tot)]);
    if(!P.last || o.d > P.last.d || (o.d===P.last.d && +o.or > +P.last.or)) P.last = { or:o.or, d:o.d, y:o.y, l:o.lines };
  }
  for (const M of Object.values(m)) for (const P of Object.values(M.p)) { P.h.sort((a,b)=>b[0]<a[0]?-1:1); P.h = P.h.slice(0,4); }
  const g = {};
  for (const [pk, v] of Object.entries(G)){ if (v.n < 3) continue;
    const l = Object.values(v.l).filter(e => e.c >= 2 && e.c / v.n >= 0.12).sort((a,b)=>b.c-a.c).slice(0,8).map(e => [e.d, e.c, e.t, e.r, e.h]);
    if (l.length) g[pk] = { n:v.n, l }; }
  const dd = {}; for (const [k, x] of Object.entries(D)) if (x.c >= 3) dd[k] = [x.d, x.c, x.t, x.r, x.h];
  return { g, dd, meta:{ rows:n, recs:recs.length, own, from:minD, to:maxD, built:new Date().toISOString().slice(0,10), models:Object.keys(m).length }, m };
}
// Inicio del trimestre actual menos N años: en ene-2027 corta todo lo anterior a 01/01/2024.
export function cutoffFor(date, years){ const y = date.getFullYear(), qm = Math.floor(date.getMonth()/3)*3; return (y - years) + '-' + String(qm+1).padStart(2,'0') + '-01'; }

export async function parseServicios(buf, JSZip){
  const zip = await JSZip.loadAsync(buf);
  const ssx = zip.file('xl/sharedStrings.xml') ? await zip.file('xl/sharedStrings.xml').async('string') : '';
  const dex = s => s.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  const ss = [...ssx.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>dex([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
  const wb = await zip.file('xl/workbook.xml').async('string');
  const rels = await zip.file('xl/_rels/workbook.xml.rels').async('string');
  const relMap = {}; [...rels.matchAll(/<Relationship [^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].forEach(m=>relMap[m[1]]=m[2].replace(/^\/?xl\//,''));
  [...rels.matchAll(/<Relationship [^>]*Target="([^"]+)"[^>]*Id="([^"]+)"/g)].forEach(m=>relMap[m[2]]=relMap[m[2]]||m[1].replace(/^\/?xl\//,''));
  const sheets = [...wb.matchAll(/<sheet [^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g)].map(m=>({name:dex(m[1]).trim(), path:'xl/'+relMap[m[2]]}));
  const colN = s => s.split('').reduce((a,c)=>a*26+c.charCodeAt(0)-64,0);
  const read = async p => { const x = await zip.file(p).async('string'); const G = {};
    for (const r of x.matchAll(/<row [^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) { const row = {};
      for (const c of r[2].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) { const v = (c[3]||'').match(/<v>([\s\S]*?)<\/v>/); const is = (c[3]||'').match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/);
        let val = v ? v[1] : is ? is[1] : ''; if (/t="s"/.test(c[2])) val = ss[+val]; else val = dex(val); if (val !== '') row[colN(c[1])] = String(val).trim(); }
      G[+r[1]] = row; } return G; };
  const out = { servicios: [], tabla: {} };
  for (const sh of sheets) {
    const G = await read(sh.path); const N = norm(sh.name);
    if (N.startsWith('TABLA')) {
      const h1 = G[1]||{}, h2 = G[2]||{}; const colsBy = {};
      Object.entries(h1).forEach(([c,v]) => { const t = norm(v); if (/MENOR|INTERMEDIO|MAYOR/.test(t) && !colsBy[t]) colsBy[t] = { c:+c, km: h2[c] }; });
      for (const [t, {c, km}] of Object.entries(colsBy)) { out.tabla[t] = { km, l: [] };
        Object.keys(G).map(Number).filter(r=>r>2).sort((a,b)=>a-b).forEach(r => { const row = G[r]; if (row[2] && /^x$/i.test(row[c]||'')) out.tabla[t].l.push(row[2]); }); }
      continue;
    }
    if (N.startsWith('ACEITES')) continue;
    const rows = Object.keys(G).map(Number).sort((a,b)=>a-b);
    for (const r of rows) for (const [c, v] of Object.entries(G[r])) {
      const cc = +c; if (norm(v) !== 'NO.' || norm(G[r][cc+1]||'') !== 'REPUESTOS') continue;
      let title = ''; for (let k = 1; k <= 3 && !title; k++) { const t = (G[r-k]||{})[cc]; if (t && !/^\d/.test(t) && !/TOTAL/i.test(t) && norm(t) !== 'NO.') title = t; }
      if (!title) continue;
      const items = []; let sec = 'Repuestos', tipo = '', total = 0;
      for (let rr = r + 1; rr < r + 40; rr++) { const R = G[rr] || {};
        const lbl = R[cc+3] || ''; if (/TOTAL/i.test(lbl)) { tipo = norm(lbl).replace(/^TOTAL\s*/, '').trim(); total = parseFloat(R[cc+4]) || 0; break; }
        if (norm(R[cc]||'') === 'NO.') { sec = (R[cc+1]||'').trim(); continue; }
        if (/^\d+$/.test(R[cc]||'') && R[cc+1]) { const q = parseFloat(R[cc+2]) || 0, u = parseFloat(R[cc+3]) || 0; items.push([sec, R[cc+1].replace(/\s+/g,' ').trim(), q, Math.round(u*100)/100]); }
      }
      if (!tipo || !items.length) continue;
      const oil = (title.match(/\(([^)]*)\)/)||[])[1] || '';
      out.servicios.push({ t: title.replace(/\s+/g,' ').trim(), hoja: sh.name, oil, tipo, total: Math.round(total), items });
    }
  }
  return out;
}