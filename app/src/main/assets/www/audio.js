'use strict';
/* ============ springs (damping + response, like iOS) ============ */
const hasLinear=(()=>{try{return CSS.supports('animation-timing-function','linear(0,1)')}catch(e){return false}})();
function spring(z,resp){
  const w=TAU/resp, T=z<1?6.9/(z*w):9.2/w, N=44, pts=[];
  for(let i=0;i<=N;i++){const t=i/N*T;let x;
    if(z<1){const wd=w*Math.sqrt(1-z*z);x=1-Math.exp(-z*w*t)*(Math.cos(wd*t)+(z*w/wd)*Math.sin(wd*t))}
    else x=1-Math.exp(-w*t)*(1+w*t);
    pts.push(x.toFixed(4))}
  pts[N]='1';
  return {ease:hasLinear?'linear('+pts.join(',')+')':'cubic-bezier(.22,1,.36,1)',ms:Math.round(T*1000)};
}
const SP_SLIDE=spring(1,.36), SP_IN=spring(.84,.4), SP_SHEET=spring(.86,.34), SP_BACK=spring(.8,.3), SP_POP=spring(.78,.32);
const rubber=(x,d,c=.55)=>(x*d*c)/(d+c*x);

/* ============ colours from the cover ============ */
function hsl2hex(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1))),x=v=>Math.round(255*v).toString(16).padStart(2,'0');return '#'+x(f(0))+x(f(8))+x(f(4))}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2;let h=0,s=0;if(mx!==mn){const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);h=mx===r?(g-b)/d+(g<b?6:0):mx===g?(b-r)/d+2:(r-g)/d+4;h*=60}return[h,s,l]}
const lumOf=hex=>{const n=parseInt(hex.slice(1),16),f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(n>>16&255)+.7152*f(n>>8&255)+.0722*f(n&255)};
const onColor=hex=>lumOf(hex)>.38?'#0b0b0e':'#ffffff';
const hexRGB=hex=>{const n=parseInt(hex.slice(1),16);return [n>>16&255,n>>8&255,n&255]};
async function paletteOf(url){
  const img=await loadImg(url), c=document.createElement('canvas'); c.width=c.height=40;
  const x=c.getContext('2d',{willReadFrequently:true}); x.drawImage(img,0,0,40,40);
  const d=x.getImageData(0,0,40,40).data, bins=Array.from({length:24},()=>({w:0,h:0,s:0,l:0}));
  for(let i=0;i<d.length;i+=4){
    if(d[i+3]<128)continue; const [h,s,l]=rgb2hsl(d[i],d[i+1],d[i+2]); if(l<.1||l>.93)continue;
    const w=s*s*(1-Math.abs(2*l-1))+.002, b=bins[Math.floor(h/15)%24]; b.w+=w;b.h+=h*w;b.s+=s*w;b.l+=l*w;
  }
  const rk=bins.filter(b=>b.w>0).sort((a,b)=>b.w-a.w).map(b=>({h:b.h/b.w,s:b.s/b.w,l:b.l/b.w,w:b.w}));
  let soft=null; try{ let cur=c; for(const sz of [80,160]){const n=document.createElement('canvas');n.width=n.height=sz;const nx=n.getContext('2d');nx.imageSmoothingQuality='high';nx.drawImage(cur,0,0,sz,sz);cur=n} soft=cur.toDataURL('image/jpeg',.8) }catch(e){}
  const p1=rk[0];
  if(!p1||p1.s<.14)return {acc:'#e4e4ea',a1:'#33363f',a2:'#0d0e12',va:'#e4e4ea',vb:'#9aa0b4',soft};
  const hd=(a,b)=>{const q=Math.abs(a-b)%360;return Math.min(q,360-q)};
  const p2=rk.find(p=>hd(p.h,p1.h)>=40&&p.w>=p1.w*.12)||{h:(p1.h+38)%360,s:p1.s,l:p1.l};
  const S1=clamp(p1.s,.5,.95)*100, S2=clamp(p2.s,.45,.9)*100;
  return {soft,
    acc:hsl2hex(p1.h,S1,62), a1:hsl2hex(p1.h,clamp(p1.s*.9,.28,.7)*100,30), a2:hsl2hex(p2.h,clamp(p2.s*.75,.2,.55)*100,11),
    va:hsl2hex(p1.h,S1,64), vb:hsl2hex(p2.h,S2,66)};
}
const C={a:'#e6e6ea',b:'#9a9aa3',w:'rgba(255,255,255,.9)'};
const ACC={white:['Mono','#f2f2f5'],cover:['Match cover',null],blue:['Blue','#6ea8e8'],coral:['Coral','#e8806f'],amber:['Amber','#e5b04a'],green:['Green','#6fcf97'],pink:['Pink','#e8a0c4']};
function applyAccent(){
  const a=prefs.accent, base=(a==='cover'?(S.cur&&S.cur.pal?S.cur.pal.acc:'#f2f2f5'):(ACC[a]||ACC.white)[1]);
  const [r,g,b]=hexRGB(base);
  root.style.setProperty('--accent',base); root.style.setProperty('--on-accent',onColor(base)); root.style.setProperty('--accent-soft',`rgba(${r},${g},${b},.2)`);
}
function applyPalette(p){
  root.style.setProperty('--art1',p.a1); root.style.setProperty('--art2',p.a2); root.style.setProperty('--artacc',p.acc);
  root.style.setProperty('--on-art',onColor(p.acc));
  C.a=p.va; C.b=p.vb; applyAccent();
}

/* ============ covers: real art when there is some, a generated one when not ============ */
const bigArt=new Map();
async function fullArt(t){
  if(COV.t[t.key])return coverBig(t);
  const ck=t.artKey||('g:'+t.key);
  if(bigArt.has(ck))return bigArt.get(ck);
  let url=null;
  try{
    const m=await readTags(t.file);
    if(m.lyr&&!t.lyr)t.lyr=m.lyr;
    if(m.pic){const b=await thumbBlob(m.pic,720,.9);if(b)url=URL.createObjectURL(b)}
  }catch(e){}
  if(!url)url=coverBig(t);
  bigArt.set(ck,url);
  if(bigArt.size>14){const k=bigArt.keys().next().value;URL.revokeObjectURL(bigArt.get(k));bigArt.delete(k)}
  return url;
}
const palCache=new Map();
async function palFor(url){if(palCache.has(url))return palCache.get(url);const p=await paletteOf(url);palCache.set(url,p);if(palCache.size>24)palCache.delete(palCache.keys().next().value);return p}

/* ============ audio graph + equalizer ============ */
const audio=new Audio(); audio.preload='auto';
const EQ_F=[31,62,125,250,500,1000,2000,4000,8000,16000], EQ_L=['31','62','125','250','500','1k','2k','4k','8k','16k'];
const PRESETS={'Flat':[0,0,0,0,0,0,0,0,0,0],'Bass Boost':[6,5,4,2,0,0,0,0,0,0],'V-Shape':[5,4,2,0,-2,-2,0,2,4,5],'Treble':[0,0,0,0,0,1,3,4,5,6],'Vocal':[-3,-2,-1,1,3,4,3,1,0,-1],'Rock':[5,4,2,-1,-2,-1,2,4,5,5],'Pop':[-1,1,3,4,3,0,-1,-1,1,2],'Hip-Hop':[5,4,2,3,-1,-1,1,-1,2,3],'Electronic':[5,4,1,0,-2,2,1,2,4,5],'Jazz':[3,2,1,2,-2,-2,0,1,2,3],'Classical':[4,3,2,2,-1,-1,0,2,3,4]};
const eq=Object.assign({on:true,g:Array(10).fill(0),pre:0},store.get('eq',{}));
if(!Array.isArray(eq.g)||eq.g.length!==10)eq.g=Array(10).fill(0);
let ac=null,pre,lim,master,an,bands=[];
function ensureAudio(){
  if(ac){if(ac.state==='suspended')ac.resume().catch(()=>{});return ac}
  const AC=window.AudioContext||window.webkitAudioContext; if(!AC)return null;
  try{
    ac=new AC({latencyHint:'playback'});
    const src=ac.createMediaElementSource(audio);
    pre=ac.createGain(); src.connect(pre); let prev=pre;
    EQ_F.forEach((f,i)=>{const b=ac.createBiquadFilter();b.type=i===0?'lowshelf':i===EQ_F.length-1?'highshelf':'peaking';b.frequency.value=f;b.Q.value=1.1;b.gain.value=0;prev.connect(b);prev=b;bands.push(b)});
    lim=ac.createDynamicsCompressor();lim.threshold.value=-2;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.002;lim.release.value=.15;
    master=ac.createGain();an=ac.createAnalyser();an.fftSize=2048;an.smoothingTimeConstant=.78;
    prev.connect(lim);lim.connect(an);lim.connect(master);master.connect(ac.destination);
    audio.volume=1;master.gain.value=prefs.vol;applyEQ(true);
    if(ac.state==='suspended')ac.resume().catch(()=>{});
  }catch(e){ac=null;toast('This device cannot process audio, so the EQ is unavailable.')}
  return ac;
}
function applyEQ(now){
  if(!ac)return; const t=ac.currentTime;
  bands.forEach((b,i)=>{const g=eq.on?eq.g[i]:0; now?(b.gain.value=g):b.gain.setTargetAtTime(g,t,.015)});
  const p=Math.pow(10,(eq.on?eq.pre:0)/20); now?(pre.gain.value=p):pre.gain.setTargetAtTime(p,t,.02);
}
function setVol(v){prefs.vol=v;if(master)master.gain.setTargetAtTime(v,ac.currentTime,.02);else audio.volume=v;savePrefs()}
let fadeTimer=0;
function gainTo(v,sec){
  if(!master)return; const t=ac.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value,t); master.gain.linearRampToValueAtTime(v,t+sec);
}
function pauseSmooth(sec=.25){
  clearTimeout(fadeTimer);
  if(!prefs.fade||!master||audio.paused){audio.pause();return}
  gainTo(0,sec); fadeTimer=setTimeout(()=>{audio.pause();if(master){master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(prefs.vol,ac.currentTime)}},sec*1000+30);
}
function play(){
  clearTimeout(fadeTimer); ensureAudio();
  if(prefs.fade&&master&&audio.paused){master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(0,ac.currentTime);gainTo(prefs.vol,.3)}
  else if(master){master.gain.cancelScheduledValues(ac.currentTime);master.gain.setValueAtTime(prefs.vol,ac.currentTime)}
  const p=audio.play(); if(p&&p.catch)p.catch(err=>{if(err&&err.name!=='AbortError')toast('Tap play to start the sound.')});
}

/* ============ queue and playback ============ */
S.speed=store.get('speed',1); S.loadSeq=0; S.counted=false; S.errs=0;
function playTracks(list,idx,name){
  if(!list.length)return;
  S.src=list.map(t=>t.key); S.fromName=name||'All songs';
  if(prefs.shuffle){const cur=list[idx];const rest=shuffle(list.filter(t=>t!==cur).map(t=>t.key));S.queue=[cur.key,...rest];S.qi=0}
  else{S.queue=S.src.slice();S.qi=idx}
  loadTrack(T(S.queue[S.qi]),{dir:0});
}
function playShuffled(list,name){if(!list.length)return;setShuffle(true);playTracks(list,Math.random()*list.length|0,name)}
function setShuffle(on){
  prefs.shuffle=on; savePrefs();
  if(S.cur&&S.queue.length){
    if(on){const rest=S.queue.slice(S.qi+1);shuffle(rest);S.queue=[...S.queue.slice(0,S.qi+1),...rest]}
    else{const i=S.src.indexOf(S.cur.key);if(i>=0){S.queue=S.src.slice();S.qi=i}}
  }
  uiModes(); queueChanged();
}
function enqueue_(list,next){
  if(!list.length)return;
  if(!S.cur){playTracks(list,0,'Queue');return}
  const keys=list.map(t=>t.key);
  if(next)S.queue.splice(S.qi+1,0,...keys); else S.queue.push(...keys);
  S.src.push(...keys); queueChanged();
  toast(next?(list.length>1?`${list.length} songs play next`:'Plays next'):(list.length>1?`${list.length} songs added to the queue`:'Added to the queue'));
}
const playNext=l=>enqueue_(l,true), addToQueue=l=>enqueue_(l,false);
function jumpTo(i){if(i<0||i>=S.queue.length)return;const dir=i>S.qi?1:-1;S.qi=i;loadTrack(T(S.queue[i]),{dir})}
function removeFromQueue(i){
  if(i===S.qi||i<0||i>=S.queue.length)return;
  S.queue.splice(i,1); if(i<S.qi)S.qi--; queueChanged();
}
function clearQueue(){if(!S.cur)return;S.queue=[S.cur.key];S.src=[S.cur.key];S.qi=0;queueChanged()}
function go(dir,auto=false,from){
  if(!S.queue.length)return;
  let i=S.qi+dir;
  if(dir>0){
    if(i>=S.queue.length){
      if(auto&&prefs.repeat==='off'){pauseSmooth(.05);audio.currentTime=0;return}
      if(prefs.shuffle)S.queue=shuffle(S.queue.slice());
      i=0;
    }
  }else{
    if(!auto&&audio.currentTime>3){audio.currentTime=0;return}
    if(i<0)i=S.queue.length-1;
  }
  S.qi=i; loadTrack(T(S.queue[i]),{dir,from});
}
function toggle(){
  if(!S.cur){ if(S.tracks.length){playTracks(S.tracks,0,'All songs')} else pickFolder(); return }
  audio.paused?play():pauseSmooth();
}
function seekBy(s){audio.currentTime=clamp(audio.currentTime+s,0,audio.duration||0)}
async function loadTrack(t,{dir=0,from}={}){
  if(!t)return;
  const my=++S.loadSeq; S.cur=t; S.slideFrom=from; S.counted=false;
  audio.src=trackURL(t); audio.playbackRate=S.speed; try{audio.preservesPitch=true}catch(e){}
  data.hist=[t.key,...data.hist.filter(k=>k!==t.key)].slice(0,300); saveData('hist');
  setText(t,dir); markPlayingUI(); lyricsReset(); updateFavUI();
  play();
  try{
    if(!t.parsed)await parseTrack(t);
    if(my!==S.loadSeq)return;
    const url=await fullArt(t); if(my!==S.loadSeq)return;
    t.full=url; t.pal=await palFor(url); if(my!==S.loadSeq)return;
  }catch(e){console.error('cover',e&&e.message,e&&e.stack)}
  if(my!==S.loadSeq)return;
  if(!t.full)t.full='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${t.hue},50%,22%)"/><stop offset="1" stop-color="hsl(${(t.hue+60)%360},60%,40%)"/></linearGradient></defs><rect width="8" height="8" fill="url(#g)"/></svg>`);
  setText(t,0); setCover(t,dir); applyPalette(t.pal||{a1:'#232326',a2:'#0e0e10',acc:'#f2f2f5',va:'#e6e6ea',vb:'#9a9aa3'}); mediaMeta(t); natNow(); loadLyrics(t); updateFavUI();
}
audio.addEventListener('ended',()=>{
  if(S.sleep&&S.sleep.song){clearSleep();audio.pause();toast('Sleep timer: stopped after this song');return}
  prefs.repeat==='one'?(audio.currentTime=0,play()):go(1,true);
});
audio.addEventListener('play',()=>{S.playing=true;S.errs=0;uiPlaying();wake(true);startTick();natNow()});
audio.addEventListener('pause',()=>{S.playing=false;uiPlaying();wake(false);natNow()});
audio.addEventListener('seeked',natNow);
audio.addEventListener('loadedmetadata',()=>{paintProgress();natNow()});
audio.addEventListener('timeupdate',()=>{
  if(!S.counted&&S.cur&&audio.currentTime>Math.min(30,(audio.duration||60)*.5)){
    S.counted=true; data.plays[S.cur.key]=(data.plays[S.cur.key]||0)+1; saveData('plays');
  }
});
audio.addEventListener('error',()=>{
  if(!S.cur)return; toast(`Can't play “${tTitle(S.cur)}”. Skipping.`);
  if(++S.errs<6&&S.queue.length>1)setTimeout(()=>go(1,true),700);
});
function setSpeed(v){S.speed=v;store.set('speed',v);audio.playbackRate=v}

/* ============ favourites ============ */
const isFav=t=>t&&data.favs.has(t.key);
function toggleFav(t){
  if(!t)return; data.favs.has(t.key)?data.favs.delete(t.key):data.favs.add(t.key); saveData('favs');
  updateFavUI(); favChanged&&favChanged(t);
}

/* ============ sleep timer ============ */
S.sleep=null;
function setSleep(min){S.sleep={end:Date.now()+min*60000,song:false};sleepUI();toast(`Sleep timer set for ${min} minutes`)}
function setSleepSong(){S.sleep={end:0,song:true};sleepUI();toast('Will stop after this song')}
function clearSleep(){S.sleep=null;sleepUI()}
setInterval(()=>{
  if(S.sleep&&S.sleep.end){
    const left=S.sleep.end-Date.now();
    if(left<=0){clearSleep();toast('Sleep timer: good night');pauseSmooth(4)}
    else sleepUI();
  }
},1000);

/* ============ lyrics ============ */
S.lyr={lines:[],synced:false,plain:'',state:'none',idx:-1}; let lyrSeq=0;
function parseLRC(text){
  const re=/\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g, lines=[];
  for(const raw of text.split(/\r?\n/)){
    const times=[...raw.matchAll(re)]; if(!times.length)continue;
    const txt=raw.replace(re,'').trim();
    for(const m of times){const frac=m[3]?+('0.'+m[3]):0;lines.push({t:(+m[1])*60+(+m[2])+frac,text:txt})}
  }
  lines.sort((a,b)=>a.t-b.t); return lines;
}
function lyricsReset(){lyrSeq++;S.lyr={lines:[],synced:false,plain:'',state:'loading',idx:-1};renderLyrics&&renderLyrics()}
async function loadLyrics(t){
  const my=++lyrSeq; let text='';
  if(t.lrcUrl){try{const r=await fetch(t.lrcUrl);if(r.ok)text=dec8(new Uint8Array(await r.arrayBuffer())).replace(/^﻿/,'')}catch(e){}}
  if(!text)text=t.lyr||'';
  if(my!==lyrSeq||S.cur!==t)return;
  const lines=text?parseLRC(text):[];
  if(lines.length>=3)S.lyr={lines,synced:true,plain:'',state:'ok',idx:-1};
  else if(text.trim())S.lyr={lines:[],synced:false,plain:text.replace(re_ts,'').trim(),state:'ok',idx:-1};
  else S.lyr={lines:[],synced:false,plain:'',state:'none',idx:-1};
  renderLyrics();
}
const re_ts=/\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/g;

/* ============ media session, screen wake, steering-wheel keys ============ */
let wl=null;
async function wake(on){
  try{
    if(on&&prefs.wake&&'wakeLock' in navigator&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}
    else if(!on&&wl){wl.release();wl=null}
  }catch(e){wl=null}
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.playing)wake(true)});
function mediaMeta(t){
  if(!('mediaSession' in navigator))return;
  try{navigator.mediaSession.metadata=new MediaMetadata({title:tTitle(t),artist:tSub(t),album:t.album||S.fromName,artwork:t.full?[{src:t.full,sizes:'640x640',type:'image/jpeg'}]:[]})}catch(e){}
}
if('mediaSession' in navigator){
  const set=(a,f)=>{try{navigator.mediaSession.setActionHandler(a,f)}catch(e){}};
  set('play',()=>play());set('pause',()=>pauseSmooth());set('previoustrack',()=>go(-1));set('nexttrack',()=>go(1));
  set('seekto',d=>{if(d.seekTime!=null)audio.currentTime=d.seekTime});
  set('seekbackward',()=>seekBy(-10));set('seekforward',()=>seekBy(10));
}
function natNow(){
  if(!NINFO||!S.cur)return;
  try{NAT.nowPlaying(tTitle(S.cur),tSub(S.cur),S.cur.album||'',S.playing,audio.currentTime||0,isFinite(audio.duration)?audio.duration:0,!!prefs.wake)}catch(e){}
}
window.__roadieKey=(k,v)=>{
  if(k==='play')play();else if(k==='pause')pauseSmooth();else if(k==='next')go(1);else if(k==='prev')go(-1);
  else if(k==='toggle')toggle();else if(k==='seek'&&isFinite(v))audio.currentTime=v;
};
