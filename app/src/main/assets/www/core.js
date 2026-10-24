'use strict';
/* ============ helpers ============ */
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const root=document.documentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const TAU=Math.PI*2;
const fmt=s=>{if(!isFinite(s)||s<0)return '0:00';s=Math.floor(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=String(s%60).padStart(2,'0');return h?`${h}:${String(m).padStart(2,'0')}:${x}`:`${m}:${x}`};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const loadImg=url=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url});
const ico=(el,name)=>{const u=el&&el.querySelector('use');if(u)u.setAttribute('href','#i-'+name)};
const svg=(n,cls='')=>`<svg class="ic ${cls}"><use href="#i-${n}"/></svg>`;
const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
const cmp=(a,b)=>collator.compare(a||'',b||'');
const dirOf=p=>p.slice(0,p.lastIndexOf('/'));
const lastSeg=p=>{const i=p.lastIndexOf('/');return i<0?p:p.slice(i+1)};
const plural=(n,w,ws)=>`${n} ${n===1?w:(ws||w+'s')}`;

/* ============ saved data ============ */
const store={
  get(k,d){try{const v=localStorage.getItem('dash.'+k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem('dash.'+k,JSON.stringify(v))}catch(e){}}
};
const prefs=Object.assign({theme:'graphite',accent:'white',style:'blur',viz:'auto',fx:'snow',fxScope:'np',fxAmt:2,shuffle:false,repeat:'off',vol:1,wake:true,grid:'m',fade:true,lyrics:false,sort:{}},store.get('prefs',{}));
if(prefs.ver!==2){prefs.ver=2;prefs.accent='white';prefs.theme='graphite'}
prefs.sort=Object.assign({songs:'title',albums:'name',artists:'name'},prefs.sort||{});
const savePrefs=()=>store.set('prefs',prefs);
const data={
  favs:new Set(store.get('favs',[])),
  hist:store.get('hist',[]),
  plays:store.get('plays',{}),
  playlists:store.get('playlists',[]),
};
const saveData=k=>store.set(k,k==='favs'?[...data.favs]:data[k]);

/* ============ native bridge ============ */
const NAT=window.RoadieNative||null; let NINFO=null;
try{NINFO=NAT&&JSON.parse(NAT.info())}catch(e){}
if(NINFO)root.classList.add('native');
class RemoteFile{
  constructor(m){this.name=m.name;this.size=m.size;this.type=m.type;this.url=location.origin+'/m/'+NINFO.token+'/'+m.i}
  slice(a,b){
    const u=this.url,end=Math.min(b==null?this.size:b,this.size);
    return {arrayBuffer:async()=>{
      if(end<=a)return new ArrayBuffer(0);
      const r=await fetch(u,{headers:{Range:'bytes='+a+'-'+(end-1)}});
      return await r.arrayBuffer();
    }};
  }
}

/* ============ tag reading (ID3, FLAC, MP4) ============ */
const dec=(enc,b)=>{try{return new TextDecoder(enc).decode(b)}catch(e){return ''}};
function dec8(d){
  try{return new TextDecoder('utf-8',{fatal:true}).decode(d)}catch(e){}
  const a=dec('windows-1256',d), non=[...a].filter(c=>c.charCodeAt(0)>127);
  if(non.length&&non.filter(c=>/[؀-ۿ]/.test(c)).length/non.length>.6)return a;
  return dec('windows-1252',d);
}
function decText(e,d){
  if(e===1){ if(d[0]===0xFF&&d[1]===0xFE)return dec('utf-16le',d.subarray(2)); if(d[0]===0xFE&&d[1]===0xFF)return dec('utf-16be',d.subarray(2)); return dec('utf-16le',d) }
  if(e===2)return dec('utf-16be',d); if(e===3)return dec('utf-8',d); return dec8(d);
}
const id3Text=b=>decText(b[0],b.subarray(1)).split('\0')[0].trim();
function readUSLT(d){
  const enc=d[0]; let p=4;
  if(enc===1||enc===2){while(p+1<d.length&&!(d[p]===0&&d[p+1]===0))p+=2;p+=2}else{while(p<d.length&&d[p]!==0)p++;p++}
  return decText(enc,d.subarray(p)).replace(/\0+$/,'').trim();
}
function readAPIC(d,v2){
  const enc=d[0]; let p=1, mime;
  if(v2){mime='image/'+String.fromCharCode(d[1],d[2],d[3]).toLowerCase();p=4}
  else{let e=p;while(e<d.length&&d[e]!==0)e++;mime=String.fromCharCode(...d.subarray(p,e)).toLowerCase();p=e+1}
  const type=d[p++];
  if(enc===1||enc===2){while(p+1<d.length&&!(d[p]===0&&d[p+1]===0))p+=2;p+=2}
  else{while(p<d.length&&d[p]!==0)p++;p++}
  const data=d.subarray(p); if(data.length<100)return null;
  if(data[0]===0xFF&&data[1]===0xD8)mime='image/jpeg'; else if(data[0]===0x89&&data[1]===0x50)mime='image/png'; else if(!/^image\//.test(mime))mime='image/jpeg';
  return {type,mime,data};
}
const cleanGenre=g=>{g=(g||'').replace(/\(\d+\)/g,'').trim();return /^\d+$/.test(g)?'':g.split(/[;\/]/)[0].trim()};
const yearOf=s=>{const m=/(\d{4})/.exec(s||'');return m?+m[1]:0};
async function readID3(file,head){
  const ver=head[3], flags=head[5], size=((head[6]&127)<<21)|((head[7]&127)<<14)|((head[8]&127)<<7)|(head[9]&127);
  let buf=new Uint8Array(await file.slice(10,10+size).arrayBuffer());
  if((flags&0x80)&&ver<4){const o=[];for(let i=0;i<buf.length;i++){o.push(buf[i]);if(buf[i]===0xFF&&buf[i+1]===0)i++}buf=Uint8Array.from(o)}
  let p=0;
  if(flags&0x40){p=ver===4?(((buf[0]&127)<<21)|((buf[1]&127)<<14)|((buf[2]&127)<<7)|(buf[3]&127)):(((buf[0]<<24)|(buf[1]<<16)|(buf[2]<<8)|buf[3])+4)}
  const out={}, idLen=ver===2?3:4, hLen=ver===2?6:10; let best=null;
  while(p+hLen<=buf.length){
    const id=String.fromCharCode(...buf.subarray(p,p+idLen)); if(!/^[A-Z0-9]+$/.test(id))break;
    let fs;
    if(ver===2)fs=(buf[p+3]<<16)|(buf[p+4]<<8)|buf[p+5];
    else if(ver===4)fs=((buf[p+4]&127)<<21)|((buf[p+5]&127)<<14)|((buf[p+6]&127)<<7)|(buf[p+7]&127);
    else fs=((buf[p+4]<<24)|(buf[p+5]<<16)|(buf[p+6]<<8)|buf[p+7])>>>0;
    const d=buf.subarray(p+hLen,p+hLen+fs); p+=hLen+fs; if(!fs)continue;
    if(id==='TIT2'||id==='TT2')out.title=id3Text(d);
    else if(id==='TPE1'||id==='TP1')out.artist=id3Text(d);
    else if(id==='TPE2'||id==='TP2')out.albumArtist=id3Text(d);
    else if(id==='TALB'||id==='TAL')out.album=id3Text(d);
    else if(id==='TCON'||id==='TCO')out.genre=cleanGenre(id3Text(d));
    else if(id==='TDRC'||id==='TYER'||id==='TYE'||id==='TDRL')out.year=out.year||yearOf(id3Text(d));
    else if(id==='TRCK'||id==='TRK')out.tn=parseInt(id3Text(d),10)||0;
    else if(id==='USLT'||id==='ULT'){try{const l=readUSLT(d);if(l)out.lyr=l}catch(e){}}
    else if(id==='APIC'||id==='PIC'){const pic=readAPIC(d,ver===2);if(pic&&(!best||(pic.type===3&&best.type!==3)))best=pic}
  }
  if(best)out.pic=best; return out;
}
async function readFlac(file){
  let off=4; const out={};
  for(let n=0;n<48;n++){
    const h=new Uint8Array(await file.slice(off,off+4).arrayBuffer()); if(h.length<4)break;
    const last=h[0]&128, type=h[0]&127, len=(h[1]<<16)|(h[2]<<8)|h[3]; off+=4;
    if(type===4){
      const b=new Uint8Array(await file.slice(off,off+len).arrayBuffer()), dv=new DataView(b.buffer);
      let p=4+dv.getUint32(0,true); const c=dv.getUint32(p,true); p+=4;
      for(let i=0;i<c&&p<b.length;i++){const l=dv.getUint32(p,true);p+=4;const kv=dec('utf-8',b.subarray(p,p+l));p+=l;const k=kv.indexOf('=');
        const key=kv.slice(0,k).toUpperCase(), val=kv.slice(k+1);
        if(key==='TITLE')out.title=val;else if(key==='ARTIST')out.artist=val;else if(key==='ALBUMARTIST')out.albumArtist=val;else if(key==='ALBUM')out.album=val;
        else if(key==='GENRE')out.genre=cleanGenre(val);else if(key==='DATE'||key==='YEAR')out.year=yearOf(val);
        else if(key==='TRACKNUMBER')out.tn=parseInt(val,10)||0;else if(key==='LYRICS'||key==='UNSYNCEDLYRICS')out.lyr=val}
    }else if(type===6&&!out.pic){
      const b=new Uint8Array(await file.slice(off,off+len).arrayBuffer()), dv=new DataView(b.buffer);
      let p=4; const ml=dv.getUint32(p); p+=4; const mime=dec('utf-8',b.subarray(p,p+ml)); p+=ml;
      const dl=dv.getUint32(p); p+=4+dl+16; const pl=dv.getUint32(p); p+=4;
      out.pic={mime:mime||'image/jpeg',data:b.subarray(p,p+pl)};
    }
    off+=len; if(last)break;
  }
  return out;
}
async function readMp4(file){
  let off=0; const total=file.size; let moov=null;
  while(off<total-8){
    const h=new DataView(await file.slice(off,off+16).arrayBuffer()); let sz=h.getUint32(0), hl=8;
    const ty=String.fromCharCode(h.getUint8(4),h.getUint8(5),h.getUint8(6),h.getUint8(7));
    if(sz===1){sz=h.getUint32(8)*4294967296+h.getUint32(12);hl=16}else if(sz===0)sz=total-off;
    if(sz<8)break;
    if(ty==='moov'){moov=new Uint8Array(await file.slice(off+hl,off+sz).arrayBuffer());break}
    off+=sz;
  }
  if(!moov)return {};
  const dv=new DataView(moov.buffer,moov.byteOffset,moov.byteLength);
  const atoms=(s,e)=>{const r=[];let p=s;while(p+8<=e){const sz=dv.getUint32(p);const ty=String.fromCharCode(moov[p+4],moov[p+5],moov[p+6],moov[p+7]);if(sz<8||p+sz>e)break;r.push({ty,s:p+8,e:p+sz});p+=sz}return r};
  const kid=(a,t)=>atoms(a.s,a.e).find(x=>x.ty===t);
  const udta=kid({s:0,e:moov.length},'udta'), meta=udta&&kid(udta,'meta');
  const ilst=meta&&atoms(meta.s+4,meta.e).find(x=>x.ty==='ilst'); if(!ilst)return {};
  const out={};
  for(const it of atoms(ilst.s,ilst.e)){
    const d=kid(it,'data'); if(!d)continue; const pay=moov.subarray(d.s+8,d.e), fl=moov[d.s+3];
    if(it.ty==='\xa9nam')out.title=dec('utf-8',pay);else if(it.ty==='\xa9ART')out.artist=dec('utf-8',pay);else if(it.ty==='aART')out.albumArtist=dec('utf-8',pay);else if(it.ty==='\xa9alb')out.album=dec('utf-8',pay);
    else if(it.ty==='\xa9gen')out.genre=cleanGenre(dec('utf-8',pay));else if(it.ty==='\xa9day')out.year=yearOf(dec('utf-8',pay));
    else if(it.ty==='trkn'&&pay.length>=4)out.tn=(pay[2]<<8)|pay[3];else if(it.ty==='\xa9lyr')out.lyr=dec('utf-8',pay);
    else if(it.ty==='covr')out.pic={mime:fl===14?'image/png':'image/jpeg',data:pay};
  }
  return out;
}
async function readTags(file){
  try{
    const head=new Uint8Array(await file.slice(0,10).arrayBuffer());
    if(head[0]===0x49&&head[1]===0x44&&head[2]===0x33)return await readID3(file,head);
    if(head[0]===0x66&&head[1]===0x4C&&head[2]===0x61&&head[3]===0x43)return await readFlac(file);
    if(/\.(m4a|m4b|aac|mp4)$/i.test(file.name))return await readMp4(file);
  }catch(e){}
  return {};
}
async function thumbBlob(pic,max,q=.84){
  const url=URL.createObjectURL(new Blob([pic.data],{type:pic.mime||'image/jpeg'}));
  try{
    const img=await loadImg(url), s=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(img.naturalWidth*s)); c.height=Math.max(1,Math.round(img.naturalHeight*s));
    c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return await new Promise(r=>c.toBlob(b=>r(b),'image/jpeg',q));
  }catch(e){return null}finally{URL.revokeObjectURL(url)}
}
function artKeyOf(d){let h=2166136261;const n=d.length,step=Math.max(1,n>>>9);for(let i=0;i<n;i+=step){h^=d[i];h=Math.imul(h,16777619)}return (h>>>0).toString(36)+'.'+n.toString(36)}

/* ============ cache of tags and small covers (IndexedDB) ============ */
const IDB={db:null,ready:null,
  open(){
    if(this.ready)return this.ready;
    this.ready=new Promise(res=>{try{const r=indexedDB.open('roadie',1);r.onupgradeneeded=()=>{r.result.createObjectStore('meta');r.result.createObjectStore('art')};r.onsuccess=()=>{this.db=r.result;res(true)};r.onerror=()=>res(false);r.onblocked=()=>res(false)}catch(e){res(false)}});
    return this.ready;
  },
  async all(st){
    await this.open(); const out=new Map(); if(!this.db)return out;
    return new Promise(res=>{try{const c=this.db.transaction(st,'readonly').objectStore(st).openCursor();c.onsuccess=()=>{const cur=c.result;if(cur){out.set(cur.key,cur.value);cur.continue()}else res(out)};c.onerror=()=>res(out)}catch(e){res(out)}});
  },
  put(st,k,v){if(!this.db)return;try{this.db.transaction(st,'readwrite').objectStore(st).put(v,k)}catch(e){}},
  clear(){if(!this.db)return;try{['meta','art'].forEach(s=>this.db.transaction(s,'readwrite').objectStore(s).clear())}catch(e){}}
};
const metaCache=new Map(), artURL=new Map();   // artKey -> object URL of a 220px cover
function artFromBlob(key,blob){if(!artURL.has(key))artURL.set(key,URL.createObjectURL(blob));return artURL.get(key)}

/* ============ library ============ */
const S={
  tracks:[],byKey:new Map(),cats:new Map(),albums:[],artists:[],genres:[],albumMap:new Map(),artistMap:new Map(),genreMap:new Map(),
  cur:null,playing:false,fromName:'All songs',queue:[],src:[],qi:-1,
  tab:'home',stack:[],q:'',lists:[],parsed:0,total:0,
};
const T=k=>S.byKey.get(k);
const tTitle=t=>t.title||nameFrom(t.name);
const tArtist=t=>t.artist||'';
const tSub=t=>t.artist||t.cat;
function nameFrom(n){return n.replace(/\.[^.]+$/,'').replace(/^\d{1,3}\s*[-._)]\s*/,'').replace(/_/g,' ').trim()||n}

function buildLibrary(entries){
  S.tracks=[];S.byKey.clear();S.cats.clear();
  entries.sort((a,b)=>cmp(a.path,b.path));
  entries.forEach((e,i)=>{
    let title=nameFrom(e.file.name), artist='';
    const m=/^(.{1,60}?)\s+-\s+(.+)$/.exec(title); if(m){artist=m[1];title=m[2]}
    const t={id:i,key:e.path,file:e.file,url:e.file.url||null,name:e.file.name,path:e.path,cat:e.cat,mod:e.mod||0,lrcUrl:e.lrcUrl||null,size:e.file.size||0,
      title,artist,album:'',genre:'',year:0,tn:0,lyr:'',guess:!!m,artKey:null,art:null,parsed:false,hue:hash(e.path)%360};
    t.mk=t.path+'|'+t.size+'|'+t.mod;
    S.tracks.push(t);S.byKey.set(t.key,t);
    if(!S.cats.has(t.cat))S.cats.set(t.cat,[]); S.cats.get(t.cat).push(t);
  });
  S.parsed=0;S.total=S.tracks.length;
  data.favs=new Set([...data.favs].filter(k=>S.byKey.has(k)||true));
  rebuildCollections();
}
function trackURL(t){
  if(!t.url){t.url=URL.createObjectURL(t.file)}
  return t.url;
}
function rebuildCollections(){
  const albums=new Map(),artists=new Map(),genres=new Map();
  for(const t of S.tracks){
    const ak=t.album?t.album.toLowerCase():'~'+dirOf(t.path);
    let al=albums.get(ak); if(!al){al={key:ak,name:t.album||lastSeg(dirOf(t.path))||'Unknown album',artist:'',year:0,tracks:[],art:null,untagged:!t.album};albums.set(ak,al)}
    al.tracks.push(t); if(t.year&&!al.year)al.year=t.year; if(!al.art&&t.art)al.art=t.art;
    const rk=(t.artist||'').toLowerCase()||'~';
    let ar=artists.get(rk); if(!ar){ar={key:rk,name:t.artist||'Unknown artist',tracks:[],albums:new Set(),art:null};artists.set(rk,ar)}
    ar.tracks.push(t); ar.albums.add(ak); if(!ar.art&&t.art)ar.art=t.art;
    if(t.genre){const gk=t.genre.toLowerCase();let g=genres.get(gk);if(!g){g={key:gk,name:t.genre,tracks:[]};genres.set(gk,g)}g.tracks.push(t)}
  }
  for(const al of albums.values()){
    al.tracks.sort((a,b)=>(a.tn||999)-(b.tn||999)||cmp(a.path,b.path));
    const names=new Set(al.tracks.map(t=>t.artist||'')); al.artist=names.size===1?(al.tracks[0].artist||''):'Various artists';
  }
  S.albumMap=albums;S.artistMap=artists;S.genreMap=genres;
  S.albums=[...albums.values()];S.artists=[...artists.values()];S.genres=[...genres.values()];
}

/* ============ reading tags in the background ============ */
const pq={q:[],busy:0}; let colT=0, onParsedUI=null;
function enqueue(list,prio){list.forEach(t=>{if(!t.parsed&&!t.queued){t.queued=true;prio?pq.q.unshift(t):pq.q.push(t)}});pump()}
function pump(){while(pq.busy<3&&pq.q.length){const t=pq.q.shift();pq.busy++;parseTrack(t).catch(()=>{}).finally(()=>{pq.busy--;pump()})}}
function applyMeta(t,m){
  if(m.title)t.title=m.title; if(m.artist)t.artist=m.artist; else if(m.albumArtist&&!t.guess)t.artist=m.albumArtist;
  if(m.album)t.album=m.album; if(m.genre)t.genre=m.genre; if(m.year)t.year=m.year; if(m.tn)t.tn=m.tn; if(m.lyr)t.lyr=m.lyr;
  if(m.artKey){t.artKey=m.artKey;t.art=artURL.get(m.artKey)||null}
}
async function parseTrack(t){
  if(t.parsed)return; if(t.parsing)return t.parsing;
  t.parsing=(async()=>{
    const c=metaCache.get(t.mk);
    if(c){ if(c.artKey&&!artURL.has(c.artKey)){c.artKey=null} applyMeta(t,c) }
    else{
      const m=await readTags(t.file), rec={title:m.title,artist:m.artist,albumArtist:m.albumArtist,album:m.album,genre:m.genre,year:m.year,tn:m.tn,lyr:m.lyr&&m.lyr.length<30000?m.lyr:''};
      if(m.pic){
        const key=artKeyOf(m.pic.data);
        if(!artURL.has(key)){const b=await thumbBlob(m.pic,220,.82);if(b){artFromBlob(key,b);IDB.put('art',key,b)}}
        if(artURL.has(key))rec.artKey=key;
      }
      applyMeta(t,rec); IDB.put('meta',t.mk,rec);
    }
    t.parsed=true; S.parsed++;
    if(!colT)colT=setTimeout(()=>{colT=0;rebuildCollections();onParsedUI&&onParsedUI()},S.parsed>=S.total?50:1200);
  })();
  return t.parsing;
}
async function loadCache(){
  const [m,a]=await Promise.all([IDB.all('meta'),IDB.all('art')]);
  m.forEach((v,k)=>metaCache.set(k,v)); a.forEach((v,k)=>artFromBlob(k,v));
}
