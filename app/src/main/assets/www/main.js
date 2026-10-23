'use strict';
/* ============ choosing music ============ */
function pickFolder(){if(NINFO)NAT.pickFolder();else $('#fFolder').click()}

function stopEverything(){
  try{audio.pause()}catch(e){}
  S.cur=null;S.queue=[];S.src=[];S.qi=-1;S.playing=false;
  closeAllSheets();
  uiPlaying();
}
async function startLibrary(entries,note){
  stopEverything();
  S.stack=[];S.q='';$('#q').value='';
  buildLibrary(entries);
  await loadCache();
  const n=S.cats.size;
  toast(note||`${S.tracks.length} songs in ${plural(n,'folder')}`);
  S.tab=S.tab==='playlists'?'playlists':(S.cats.size>1?'folders':'songs');
  syncRail();
  renderAll();
  enqueue(S.tracks.slice(0,80),true);enqueue(S.tracks);
}
function ingestFiles(files){
  const ext=/\.(mp3|m4a|m4b|aac|flac|wav|ogg|oga|opus|weba)$/i,lrc=/\.lrc$/i,entries=[],lrcs=new Map();
  for(const f of files){
    if(f.name.startsWith('.'))continue;
    const rel=f.webkitRelativePath||f.name;
    if(lrc.test(f.name)){lrcs.set(rel.replace(/\.[^.]+$/,'').toLowerCase(),URL.createObjectURL(f));continue}
    if(!(f.type.startsWith('audio/')||ext.test(f.name)))continue;
    const parts=f.webkitRelativePath?f.webkitRelativePath.split('/'):[];
    let cat;
    if(parts.length>=3)cat=parts[1];else if(parts.length===2)cat=parts[0];else cat='Songs';
    entries.push({file:f,path:rel,cat,mod:f.lastModified||0});
  }
  if(!entries.length){toast('No audio files found there. Try another folder.');return}
  entries.forEach(e=>{const u=lrcs.get(e.path.replace(/\.[^.]+$/,'').toLowerCase());if(u)e.lrcUrl=u});
  startLibrary(entries);
}
$('#fFolder').addEventListener('change',e=>{const f=[...e.target.files];e.target.value='';ingestFiles(f)});
$('#fFiles').addEventListener('change',e=>{const f=[...e.target.files];e.target.value='';ingestFiles(f)});

/* ---------- demo songs, made in the browser so you can try the EQ with no files ---------- */
async function renderDemo(kind){
  const A=kind==='A',sr=44100,bpm=A?104:78,bars_=A?16:12,beat_=60/bpm,dur=bars_*4*beat_+1.5;
  const oc=new OfflineAudioContext(1,Math.ceil(sr*dur),sr),R=rng(A?7:21);
  const master=oc.createGain();master.gain.value=.7;const comp=oc.createDynamicsCompressor();master.connect(comp);comp.connect(oc.destination);
  const lp=(f,dest)=>{const b=oc.createBiquadFilter();b.type='lowpass';b.frequency.value=f;b.connect(dest);return b};
  const bassF=lp(A?420:300,master),padF=lp(1500,master),leadF=lp(3200,master),keysF=lp(2200,master);
  const noise=oc.createBuffer(1,sr,sr),nd=noise.getChannelData(0);for(let i=0;i<sr;i++)nd[i]=Math.random()*2-1;
  const hz=n=>440*Math.pow(2,(n-69)/12);
  const env=(g,t,a,d,pk)=>{g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(pk,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)};
  const osc=(type,f,t,len,pk,dest,a=.005,det=0)=>{const o=oc.createOscillator(),g=oc.createGain();o.type=type;o.frequency.value=f;o.detune.value=det;env(g,t,a,len,pk);o.connect(g);g.connect(dest);o.start(t);o.stop(t+a+len+.05)};
  const kick=(t,v=1)=>{const o=oc.createOscillator(),g=oc.createGain();o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(42,t+.12);env(g,t,.003,.3,v);o.connect(g);g.connect(master);o.start(t);o.stop(t+.4)};
  const nz=(t,len,v,hp)=>{const s=oc.createBufferSource();s.buffer=noise;const f=oc.createBiquadFilter();f.type='highpass';f.frequency.value=hp;const g=oc.createGain();env(g,t,.002,len,v);s.connect(f);f.connect(g);g.connect(master);s.start(t);s.stop(t+len+.05)};
  const prog=A?[{r:33,c:[57,60,64]},{r:29,c:[53,57,60]},{r:36,c:[55,60,64]},{r:31,c:[55,59,62]}]:[{r:29,c:[53,57,60,64]},{r:28,c:[52,55,59,62]},{r:26,c:[50,53,57,60]},{r:24,c:[48,52,55,59]}];
  for(let b=0;b<bars_;b++){
    const ch=prog[b%4],t0=b*4*beat_;
    if(A){
      for(let i=0;i<8;i++)osc('sawtooth',hz(ch.r+(i%4===3?12:0)),t0+i*beat_/2,beat_*.42,.34,bassF);
      for(let k=0;k<4;k++)kick(t0+k*beat_);
      nz(t0+beat_,.18,.5,1200);nz(t0+3*beat_,.18,.5,1200);
      for(let i=0;i<16;i++)nz(t0+i*beat_/4,.04,i%2?.07:.13,7000);
      ch.c.forEach(n=>[-9,9].forEach(d=>osc('sawtooth',hz(n),t0,beat_*3.8,.06,padF,.35,d)));
      if(b>=4)for(let i=0;i<16;i++)osc('square',hz(ch.c[i%3]+12),t0+i*beat_/4,beat_*.2,.05,leadF,.004);
    }else{
      ch.c.forEach(n=>{const f=hz(n);osc('sine',f,t0,beat_*3.6,.09,keysF,.01);osc('sine',f*2,t0,beat_*1.4,.03,keysF,.005);osc('triangle',f,t0,beat_*3,.035,keysF,.01)});
      osc('sine',hz(ch.r),t0,beat_*1.8,.55,bassF,.01);osc('sine',hz(ch.r),t0+2*beat_,beat_*1.6,.45,bassF,.01);
      kick(t0,.9);kick(t0+2.5*beat_,.7);nz(t0+beat_,.22,.28,900);nz(t0+3*beat_,.22,.28,900);
      for(let i=0;i<8;i++)nz(t0+i*beat_/2+(i%2?beat_/6:0),.05,i%2?.05:.09,6000);
      for(let i=0;i<4;i++)if(R()>.4)osc('triangle',hz(ch.c[R()*ch.c.length|0]+12),t0+(R()*8|0)*beat_/2,beat_*.8,.06,keysF,.01);
    }
  }
  const buf=await oc.startRendering(),d=buf.getChannelData(0);
  let pk=0;for(let i=0;i<d.length;i++)pk=Math.max(pk,Math.abs(d[i]));const k=pk?.9/pk:1;
  const out=new DataView(new ArrayBuffer(44+d.length*2)),w=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i))};
  w(0,'RIFF');out.setUint32(4,36+d.length*2,true);w(8,'WAVEfmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,1,true);out.setUint32(24,sr,true);out.setUint32(28,sr*2,true);out.setUint16(32,2,true);out.setUint16(34,16,true);w(36,'data');out.setUint32(40,d.length*2,true);
  for(let i=0;i<d.length;i++)out.setInt16(44+i*2,clamp(d[i]*k,-1,1)*32767,true);
  return new Blob([out],{type:'audio/wav'});
}
async function loadDemo(){
  const AC=window.OfflineAudioContext||window.webkitOfflineAudioContext;if(!AC){toast('Demo songs need a newer browser.');return}
  toast('Making two demo songs…');
  try{
    const [a,b]=await Promise.all([renderDemo('A'),renderDemo('B')]);
    const mk=(blob,name,cat,title,artist,album)=>({file:new File([blob],name,{type:'audio/wav'}),path:'Demo/'+cat+'/'+name,cat,mod:1});
    await startLibrary([mk(a,'Neon Drive.wav','Synthwave'),mk(b,'Low Tide.wav','Lo-fi')],'Demo ready. Play a song, then open the equalizer and try Bass Boost.');
    const set=(k,title,artist,album)=>{const t=S.byKey.get(k);if(t){t.title=title;t.artist=artist;t.album=album;t.parsed=true}};
    set('Demo/Synthwave/Neon Drive.wav','Neon Drive','Demo','Night Loops');
    set('Demo/Lo-fi/Low Tide.wav','Low Tide','Demo','Slow Hours');
    rebuildCollections();renderAll();
  }catch(e){toast('Could not make the demo songs.')}
}

/* ============ Android bridge ============ */
window.__roadieLibrary=ok=>{
  if(!ok){renderAll(true);return}
  let list=[];try{list=JSON.parse(NAT.getLibrary())}catch(e){}
  if(!list.length){toast('No songs found in that folder.');return}
  startLibrary(list.map(m=>({file:new RemoteFile(m),path:m.path,cat:m.cat,mod:m.mod||0,lrcUrl:m.lrc!=null&&m.lrc!==''&&m.lrc!==false?location.origin+'/l/'+NINFO.token+'/'+m.i:null})));
};
window.__roadieError=m=>toast(m);
window.__roadieBack=()=>{
  if(!$('#scrim').hidden){closeMenu();return true}
  const o=topSheet();if(o){closeSheet(o);return true}
  return popDetail();
};

/* ============ settings ============ */
const SIZES=[['s','Small',124],['m','Medium',158],['l','Large',196]];
function applyGrid(){const s=SIZES.find(x=>x[0]===prefs.grid)||SIZES[1];root.style.setProperty('--card',s[2]+'px')}
function optRow(key,list,cur,extra=''){
  return `<div class="opts">${list.map(([v,l,c])=>`<button class="chip${String(v)===String(cur)?' on':''}" data-set="${key}" data-v="${v}">${c?`<span class="sw" style="background:${c}"></span>`:''}${esc(l)}</button>`).join('')}${extra}</div>`;
}
function buildSettings(){
  const accs=Object.entries(ACC).map(([k,[l,c]])=>[k,l,c||'conic-gradient(#ff6b5e,#ffb020,#1ed760,#4da3ff,#8b7cff,#ff7ac6,#ff6b5e)']);
  $('#setBody').innerHTML=`
  <div class="sh-head"><h2 style="margin:0;font-size:26px">Settings</h2><button class="rb" data-act="setclose" aria-label="Close">${svg('down')}</button></div>
  <section class="grp"><h3>Accent colour</h3>${optRow('accent',accs,prefs.accent)}<p class="hint">“Match cover” changes buttons and highlights with every song.</p></section>
  <section class="grp"><h3>Now playing look</h3>${optRow('style',STYLES,prefs.style)}</section>
  <section class="grp"><h3>Music visuals</h3>${optRow('viz',VIZ,prefs.viz)}</section>
  <section class="grp"><h3>Weather effect</h3>${optRow('fx',FX_LIST,prefs.fx)}
    <div style="height:10px"></div>${optRow('fxScope',[['np','Now playing only'],['all','Everywhere']],prefs.fxScope)}
    <div style="height:10px"></div>${optRow('fxAmt',[[1,'Light'],[2,'Normal'],[3,'Heavy']],prefs.fxAmt)}
    <p class="hint">Snow, rain, storm, stars and more drift over the screen. Turn off if the tablet feels slow.</p></section>
  <section class="grp"><h3>Album size</h3>${optRow('grid',SIZES.map(s=>[s[0],s[1]]),prefs.grid)}</section>
  <section class="grp"><h3>Playback</h3><div class="opts">
    <button class="chip${prefs.fade?' on':''}" data-set="fade" data-v="toggle">Fade when pausing</button>
    <button class="chip${prefs.wake?' on':''}" data-set="wake" data-v="toggle">Keep screen on while playing</button></div></section>
  <section class="grp"><h3>Library</h3><div class="opts">
    <button class="chip" data-act="folder">${svg('folder')}Change folder</button>
    <button class="chip" data-set="rescan" data-v="1">Rescan folder</button>
    <button class="chip" data-set="clearhist" data-v="1">Clear recently played</button>
    <button class="chip" data-set="clearcache" data-v="1">Clear cover cache</button></div></section>`;
}
$('#setBody').addEventListener('click',async e=>{
  const b=e.target.closest('[data-set]');if(!b)return;
  const k=b.dataset.set,v=b.dataset.v;
  if(k==='rescan'){if(NINFO){NAT.loadSaved();toast('Scanning folder…')}else pickFolder();return}
  if(k==='clearhist'){data.hist=[];data.plays={};saveData('hist');saveData('plays');renderAll(true);toast('History cleared');return}
  if(k==='clearcache'){IDB.clear();metaCache.clear();toast('Cache cleared. It rebuilds next time you pick the folder.');return}
  if(v==='toggle'){
    prefs[k]=!prefs[k];
    if(k==='wake'){if(!prefs.wake)wake(false);else if(S.playing)wake(true)}
  }else prefs[k]=/^\d+$/.test(v)&&k==='fxAmt'?+v:v;
  savePrefs();
  if(k==='accent')applyAccent();
  else if(k==='style')applyStyle();
  else if(k==='viz'){try{resizeViz()}catch(x){}}
  else if(k==='fx'||k==='fxScope'||k==='fxAmt')fxChanged();
  else if(k==='grid')applyGrid();
  const sc=$('#setBody').scrollTop;buildSettings();$('#setBody').scrollTop=sc;
});

/* ============ buttons ============ */
function syncRail(){$$('#rail .nav[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===S.tab)))}
const ACTS={
  play:()=>toggle(),next:()=>go(1),prev:()=>go(-1),
  shuffle:()=>{setShuffle(!prefs.shuffle);toast(prefs.shuffle?'Shuffle on':'Shuffle off')},
  repeat:()=>{prefs.repeat=prefs.repeat==='off'?'all':prefs.repeat==='all'?'one':'off';savePrefs();uiModes();toast({off:'Repeat off',all:'Repeat all',one:'Repeat this song'}[prefs.repeat])},
  np:()=>S.cur?openSheet(npEl):toast('Pick a song first'),
  npclose:()=>closeSheet(npEl),
  eq:()=>openSheet(eqEl),eqclose:()=>closeSheet(eqEl),
  queue:()=>_openQ(),qclose:()=>closeSheet(qsEl),
  settings:()=>openSheet(setEl),setclose:()=>closeSheet(setEl),
  lyrics:()=>{prefs.lyrics=!prefs.lyrics;savePrefs();setLyrics(prefs.lyrics)},
  npmore:()=>npMore(),
  fav:()=>{if(S.cur)toggleFav(S.cur)},
  folder:()=>pickFolder(),files:()=>$('#fFiles').click(),demo:()=>loadDemo(),
  sort:()=>sortMenu(),
};
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b||view.contains(b))return;
  const f=ACTS[b.dataset.act];if(f)f();
});
// the empty screen lives inside the view, so it needs its own few actions
view.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act;
  if(a==='folder'||a==='files'||a==='demo'||a==='sort'){ACTS[a]();e.stopPropagation()}
},true);
$$('#rail .nav[data-tab]').forEach(b=>b.addEventListener('click',()=>{goTab(b.dataset.tab);syncRail()}));
$('#back').addEventListener('click',()=>{popDetail()});
let qT=0;
$('#q').addEventListener('input',e=>{clearTimeout(qT);qT=setTimeout(()=>{S.q=e.target.value;renderAll(false)},140)});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,textarea'))return;
  if(e.key===' '&&!e.target.closest('button,[role=slider]')){e.preventDefault();toggle()}
  else if(e.key==='ArrowRight'&&!e.target.closest('[role=slider]'))go(1);
  else if(e.key==='ArrowLeft'&&!e.target.closest('[role=slider]'))go(-1);
  else if(e.key==='Escape'){if(!$('#scrim').hidden)closeMenu();else{const o=topSheet();o?closeSheet(o):popDetail()}}
});

/* ============ boot ============ */
applyStyle();applyAccent();applyGrid();uiModes();uiPlaying();
$('#barVol')._set(prefs.vol);$('#npVol')._set(prefs.vol);audio.volume=prefs.vol;
$('#barScrub')._set(0);$('#npScrub')._set(0);
setLyrics(prefs.lyrics);
renderAll();syncRail();fxChanged();
if(NINFO)NAT.loadSaved();
