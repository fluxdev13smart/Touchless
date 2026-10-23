'use strict';
const npEl=$('#np'),eqEl=$('#eq'),qsEl=$('#qs'),setEl=$('#set');
const STYLES=[['blur','Blur'],['card','Card'],['vinyl','Vinyl'],['full','Full'],['adaptive','Adaptive'],['circle','Circle'],['classic','Classic'],['minimal','Minimal']];
const VIZ=[['auto','Auto'],['halo','Halo'],['skyline','Skyline'],['warp','Warp'],['waves','Waves'],['rings','Rings'],['off','Off']];

/* ============ text, cover, slide animation ============ */
function setText(t,dir){
  const sub=tSub(t);
  const pairs=[['#npTitle',tTitle(t)],['#npArtist',sub],['#npAlbum',t.album||''],['#barTitle',tTitle(t)],['#barArtist',sub]];
  pairs.forEach(([s,v])=>{
    const el=$(s); if(el.textContent===v)return; el.textContent=v;
    if(dir&&!reduced.matches)el.animate([{opacity:0,transform:`translateX(${dir*26}px)`},{opacity:1,transform:'none'}],{duration:440,easing:'cubic-bezier(.22,1,.36,1)'});
  });
  $('#npFrom').textContent=S.fromName;
  const ba=$('#barArt'); if(!ba._k||ba._k!==(t.art||t.key)){ba._k=t.art||t.key;ba.innerHTML=imgOr(t.art,t.hue)}
}
function currentX(el){const m=getComputedStyle(el).transform;if(!m||m==='none')return 0;try{return new DOMMatrix(m).m41}catch(e){return 0}}
function setCover(t,dir){
  const pulse=$('#pulse'), old=[...pulse.children].filter(c=>!c.classList.contains('leaving')).pop();
  const el=document.createElement('div'); el.className='cover'; el.innerHTML=`<img alt="" src="${t.full}">`; pulse.appendChild(el);
  const W=pulse.offsetWidth||320, from=S.slideFrom; S.slideFrom=undefined;
  if(old)old.classList.add('leaving');
  if(reduced.matches||!dir||!pulse.offsetWidth){
    if(!reduced.matches)el.animate([{opacity:0,transform:'scale(.92)'},{opacity:1,transform:'none'}],{duration:SP_IN.ms,easing:SP_IN.ease});
    if(old){old.animate([{opacity:1},{opacity:0}],{duration:reduced.matches?1:260,fill:'forwards'}).onfinish=()=>old.remove()}
  }else{
    if(old){
      const start=(typeof from==='number')?from:currentX(old); old.getAnimations().forEach(a=>a.cancel());
      old.animate([{transform:`translateX(${start}px) scale(1)`,opacity:1},{transform:`translateX(${-dir*W*1.05}px) scale(.86)`,opacity:0}],{duration:SP_SLIDE.ms,easing:SP_SLIDE.ease,fill:'forwards'}).onfinish=()=>old.remove();
    }
    el.animate([{transform:`translateX(${dir*W*.95}px) scale(.88)`,opacity:0},{transform:'translateX(0) scale(1)',opacity:1}],{duration:SP_IN.ms,easing:SP_IN.ease});
    el.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out'});
  }
  while(pulse.children.length>4)pulse.firstChild.remove();
  const bg=$('#npbg'), img=document.createElement('img'); img.alt=''; img.src=t.pal&&t.pal.soft?t.pal.soft:t.full; bg.appendChild(img);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{img.classList.add('in');[...bg.children].slice(0,-1).forEach(o=>{o.classList.remove('in');setTimeout(()=>o.remove(),1000)})}));
  const ba=$('#barArt'); ba._k=t.full; ba.innerHTML=`<img alt="" src="${t.full}">`;
  if(dir&&!reduced.matches)ba.animate([{opacity:0,transform:`translateX(${dir*14}px)`},{opacity:1,transform:'none'}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
}
(function bindSwipe(stage){
  let id=null,sx=0,sy=0,dx=0,mode=null,hist=[],cov=null;
  stage.addEventListener('pointerdown',e=>{if(!S.cur||id!==null)return;id=e.pointerId;sx=e.clientX;sy=e.clientY;dx=0;mode=null;hist=[[e.timeStamp,e.clientX]]});
  stage.addEventListener('pointermove',e=>{
    if(e.pointerId!==id)return; dx=e.clientX-sx; const dy=e.clientY-sy;
    if(!mode){
      if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)){
        mode='x'; stage.setPointerCapture(id);
        cov=[...$('#pulse').children].filter(c=>!c.classList.contains('leaving')).pop();
        if(cov){const x0=currentX(cov);cov.getAnimations().forEach(a=>a.cancel());cov.style.transform=`translateX(${x0}px)`}
      }else if(Math.abs(dy)>10){mode='y'}
    }
    if(mode==='x'&&cov){
      const W=stage.offsetWidth; cov.style.transform=`translateX(${dx}px) rotate(${dx/W*5}deg)`; cov.style.opacity=String(1-Math.min(.5,Math.abs(dx)/W*.6));
      hist.push([e.timeStamp,e.clientX]); while(hist.length>2&&e.timeStamp-hist[0][0]>100)hist.shift();
    }
  });
  const end=e=>{
    if(e.pointerId!==id)return; id=null;
    if(mode==='x'&&cov){
      const h=hist[0],l=hist[hist.length-1], v=l[0]>h[0]?(l[1]-h[1])/(l[0]-h[0])*1000:0, W=stage.offsetWidth;
      const c=cov; cov=null;
      if(Math.abs(dx+v*.18)>W*.32&&S.queue.length>1){c.style.opacity='';go(dx+v*.18<0?1:-1,false,dx)}
      else{const x0=dx;c.style.transform='';c.style.opacity='';c.animate([{transform:`translateX(${x0}px) rotate(${x0/W*5}deg)`,opacity:1-Math.min(.5,Math.abs(x0)/W*.6)},{transform:'none',opacity:1}],{duration:SP_BACK.ms,easing:SP_BACK.ease})}
    }
    mode=null;
  };
  stage.addEventListener('pointerup',end); stage.addEventListener('pointercancel',end);
})($('#stage'));

/* ============ progress, modes ============ */
let scrubbing=false;
function bindScrub(el,onMove,onEnd,onKey){
  const fill=$('.fill',el),knob=$('.knob',el); let id=null;
  el._set=r=>{fill.style.transform=`scaleX(${r})`;knob.style.left=(r*100)+'%'};
  const rr=e=>{const b=el.getBoundingClientRect();return clamp((e.clientX-b.left)/b.width,0,1)};
  el.addEventListener('pointerdown',e=>{id=e.pointerId;el.setPointerCapture(id);el.classList.add('drag');const r=rr(e);el._set(r);onMove(r)});
  el.addEventListener('pointermove',e=>{if(e.pointerId!==id)return;const r=rr(e);el._set(r);onMove(r)});
  const up=e=>{if(e.pointerId!==id)return;id=null;el.classList.remove('drag');onEnd(rr(e))};
  el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);
  el.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();onKey&&onKey(e.key==='ArrowRight'?1:-1)}});
}
const seekMove=r=>{scrubbing=true;const d=audio.duration||0;['#barScrub','#npScrub'].forEach(s=>$(s)._set(r));$('#bT1').textContent=$('#npT1').textContent=fmt(r*d)};
const seekEnd=r=>{if(isFinite(audio.duration))audio.currentTime=r*audio.duration;scrubbing=false;natNow()};
const seekKey=d=>seekBy(d*5);
bindScrub($('#barScrub'),seekMove,seekEnd,seekKey);
bindScrub($('#npScrub'),seekMove,seekEnd,seekKey);
const volMove=r=>{setVol(r);['#barVol','#npVol'].forEach(s=>$(s)._set(r))};
bindScrub($('#barVol'),volMove,()=>{},d=>volMove(clamp(prefs.vol+d*.05,0,1)));
bindScrub($('#npVol'),volMove,()=>{},d=>volMove(clamp(prefs.vol+d*.05,0,1)));
function paintProgress(){
  const d=audio.duration, c=audio.currentTime, r=d&&isFinite(d)?clamp(c/d,0,1):0;
  if(!scrubbing){['#barScrub','#npScrub'].forEach(s=>$(s)._set(r));$('#bT1').textContent=$('#npT1').textContent=fmt(c)}
  $('#bT2').textContent=$('#npT2').textContent=fmt(d);
  $('#ringFg').style.strokeDashoffset=(289.03*(1-r)).toFixed(2);
  lyricsTick();
}
function uiPlaying(){
  const p=S.playing; document.body.classList.toggle('is-playing',p); npEl.classList.toggle('playing',p);
  $$('[data-act=play]').forEach(b=>{ico(b,p?'pause':'play');b.setAttribute('aria-label',p?'Pause':'Play')});
  if('mediaSession' in navigator)navigator.mediaSession.playbackState=p?'playing':'paused';
}
function uiModes(){
  $$('[data-act=shuffle]').forEach(b=>b.setAttribute('aria-pressed',prefs.shuffle));
  $$('[data-act=repeat]').forEach(b=>{b.setAttribute('aria-pressed',prefs.repeat!=='off');ico(b,prefs.repeat==='one'?'repeat1':'repeat')});
}
function applyStyle(){
  [...npEl.classList].filter(c=>c.startsWith('s-')).forEach(c=>npEl.classList.remove(c));
  npEl.classList.add('s-'+prefs.style); ctr=0;
}

/* ============ sheets ============ */
const sheetHooks={np(){resizeViz();startTick()},eq(){ensureAudio();buildEQ();resizeCurve();startTick()},qs(){renderQueue()},set(){buildSettings()}};
function openSheet(el){
  if(!el.hidden)return; el.hidden=false;
  if(!reduced.matches)el.animate([{transform:'translateY(100%)'},{transform:'translateY(0)'}],{duration:SP_SHEET.ms,easing:SP_SHEET.ease});
  sheetHooks[el.id]&&sheetHooks[el.id]();
  const f=$('button',el); f&&f.focus({preventScroll:true});
}
function closeSheet(el,from=0){
  if(el.hidden)return; el.style.transform='';
  if(reduced.matches){el.hidden=true;return}
  const a=el.animate([{transform:`translateY(${from}px)`},{transform:'translateY(100%)'}],{duration:380,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});
  a.onfinish=()=>{el.hidden=true;a.cancel()};
}
const topSheet=()=>[setEl,eqEl,qsEl,npEl].find(s=>!s.hidden);
function closeAllSheets(){[setEl,eqEl,qsEl,npEl].forEach(s=>closeSheet(s))}
function sheetDrag(el,grab){
  let id=null,y0=0,dy=0,hist=[];
  grab.addEventListener('pointerdown',e=>{id=e.pointerId;y0=e.clientY;dy=0;hist=[[e.timeStamp,e.clientY]];el.getAnimations().forEach(a=>a.cancel());grab.setPointerCapture(id)});
  grab.addEventListener('pointermove',e=>{
    if(e.pointerId!==id)return; dy=e.clientY-y0; el.style.transform=`translateY(${dy<0?-rubber(-dy,160):dy}px)`;
    hist.push([e.timeStamp,e.clientY]); while(hist.length>2&&e.timeStamp-hist[0][0]>100)hist.shift();
  });
  const end=e=>{
    if(e.pointerId!==id)return; id=null; const h=hist[0],l=hist[hist.length-1], vy=l[0]>h[0]?(l[1]-h[1])/(l[0]-h[0])*1000:0;
    el.style.transform='';
    if(dy+vy*.2>el.offsetHeight*.3||vy>900)closeSheet(el,Math.max(0,dy));
    else if(dy!==0)el.animate([{transform:`translateY(${dy}px)`},{transform:'none'}],{duration:SP_BACK.ms,easing:SP_BACK.ease});
  };
  grab.addEventListener('pointerup',end);grab.addEventListener('pointercancel',end);
}
sheetDrag(npEl,$('#npGrab'));sheetDrag(eqEl,$('#eqGrab'));sheetDrag(qsEl,$('#qGrab'));sheetDrag(setEl,$('#setGrab'));

/* ============ lyrics ============ */
const lyr=$('#lyr');
function renderLyrics(){
  const L=S.lyr; lyr.className=''; L.idx=-2;
  if(L.state==='loading')lyr.innerHTML='<div class="none">Looking for lyrics…</div>';
  else if(L.state==='none')lyr.innerHTML='<div class="none">No lyrics for this song yet. Put a .lrc file with the same name next to the song and it will show here, in time with the music.</div>';
  else if(L.synced)lyr.innerHTML=L.lines.map((l,i)=>`<p data-i="${i}">${esc(l.text||'♪')}</p>`).join('');
  else{lyr.className='plain';lyr.innerHTML=L.plain.split(/\r?\n/).map(s=>`<p>${esc(s)||'&nbsp;'}</p>`).join('')}
  lyr.scrollTop=0; lyricsTick();
}
function lyricsTick(){
  const L=S.lyr; if(!npEl.classList.contains('lyr-on')||!L.synced||npEl.hidden)return;
  const now=audio.currentTime+.2; let lo=0,hi=L.lines.length-1,idx=-1;
  while(lo<=hi){const mid=(lo+hi)>>1;if(L.lines[mid].t<=now){idx=mid;lo=mid+1}else hi=mid-1}
  if(idx===L.idx)return; L.idx=idx;
  const ps=lyr.children;
  for(let i=0;i<ps.length;i++){ps[i].classList.toggle('now',i===idx);ps[i].classList.toggle('past',i<idx)}
  const p=ps[Math.max(idx,0)]; if(p)lyr.scrollTo({top:p.offsetTop-lyr.clientHeight/2+p.offsetHeight/2,behavior:reduced.matches||Math.abs(lyr.scrollTop-p.offsetTop)>1500?'auto':'smooth'});
}
lyr.addEventListener('click',e=>{const p=e.target.closest('p[data-i]');if(p&&S.lyr.synced){audio.currentTime=S.lyr.lines[+p.dataset.i].t;if(audio.paused)play()}});
function setLyrics(on){
  npEl.classList.toggle('lyr-on',on); $('#btnLyr').setAttribute('aria-pressed',on); prefs.lyrics=on; savePrefs(); S.lyr.idx=-2; lyricsTick();
}

/* ============ queue ============ */
function qRowHTML(k,i,cur,done){
  const t=T(k); if(!t)return '';
  return `<div class="qrow${cur?' on':''}${done?' done':''}" role="button" tabindex="0" data-q="${i}" data-k="${esc(k)}"><span class="th">${thumbHTML(t)}<span class="pl"><i class="eqb"><b></b><b></b><b></b></i></span></span><span class="tx"><b>${esc(tTitle(t))}</b><small>${esc(tSub(t))}</small></span>${cur?'<span></span>':`<button class="ib" data-rm="${i}" aria-label="Remove from queue">${svg('x')}</button>`}</div>`;
}
function renderQueue(){
  const box=$('#qList'); if(qsEl.hidden)return;
  const q=S.queue, qi=S.qi, from=Math.max(0,qi-3), to=Math.min(q.length,qi+161);
  $('#qSub').textContent=q.length?`Playing from ${S.fromName}. ${qi+1} of ${q.length}`:'Nothing queued yet';
  if(!q.length){box.innerHTML='<div class="note">Play a song, then add more with “Play next” or “Add to queue”.</div>';return}
  let h='';
  if(from>0)h+=`<div class="qlabel">${plural(from,'earlier song')} not shown</div>`;
  for(let i=from;i<qi;i++)h+=qRowHTML(q[i],i,false,true);
  h+=`<div class="qlabel">Now playing</div>`+qRowHTML(q[qi],qi,true,false);
  if(qi+1<q.length)h+=`<div class="qlabel">Next up</div>`;
  for(let i=qi+1;i<to;i++)h+=qRowHTML(q[i],i,false,false);
  if(to<q.length)h+=`<div class="qlabel">${plural(q.length-to,'more song')} after these</div>`;
  box.innerHTML=h;
  const cur=$('.qrow.on',box); if(cur&&!S.qScrolled){S.qScrolled=true;cur.scrollIntoView({block:'center'})}
}
function queueChanged(){renderQueue()}
$('#qList').addEventListener('click',e=>{
  const rm=e.target.closest('[data-rm]'); if(rm){removeFromQueue(+rm.dataset.rm);return}
  const r=e.target.closest('.qrow'); if(r)jumpTo(+r.dataset.q);
});
$('#qSave').addEventListener('click',async()=>{
  if(!S.queue.length)return; const name=await askText('Save queue as playlist','Queue','Save'); if(!name)return;
  data.playlists.push({id:'p'+Date.now().toString(36),name,keys:S.queue.slice()});savePl();toast(`Saved “${name}”`);
});
$('#qClearBtn').addEventListener('click',()=>{clearQueue();toast('Queue cleared')});
const _openQ=()=>{S.qScrolled=false;openSheet(qsEl)};

/* ============ sleep timer, speed, more menu ============ */
const sleepLeft=()=>S.sleep&&S.sleep.end?Math.max(0,Math.ceil((S.sleep.end-Date.now())/60000)):0;
function sleepUI(){$('#sleepDot').hidden=!S.sleep}
function sleepMenu(){
  const cur=S.sleep?(S.sleep.song?'song':'t'):'off';
  openMenu({title:'Sleep timer',sub:S.sleep?(S.sleep.song?'Stops after this song':`${sleepLeft()} min left`):'Off',items:[
    {ic:'x',label:'Off',check:cur==='off',fn:()=>{clearSleep();toast('Sleep timer off')}},
    ...[5,10,15,30,45,60].map(m=>({ic:'moon',label:`${m} minutes`,fn:()=>setSleep(m)})),
    {ic:'moon',label:'End of this song',check:cur==='song',fn:setSleepSong}]});
}
function speedMenu(){openChoice('Playback speed',[0.5,0.75,1,1.25,1.5,2].map(v=>[v,v===1?'Normal':v+'×','speed']),S.speed,v=>{setSpeed(v);toast(v===1?'Normal speed':`Speed ${v}×`)})}
function npMore(){
  const t=S.cur; if(!t)return;
  const fxName=(FX_LIST.find(f=>f[0]===prefs.fx)||['','Off'])[1];
  openMenu({title:tTitle(t),sub:tSub(t),art:t.art,hue:t.hue,items:[
    {ic:'moon',label:'Sleep timer',small:S.sleep?(S.sleep.song?'This song':sleepLeft()+' min'):'Off',fn:sleepMenu},
    {ic:'speed',label:'Playback speed',small:S.speed===1?'Normal':S.speed+'×',fn:speedMenu},
    {ic:'look',label:'Now Playing look',small:STYLES.find(s=>s[0]===prefs.style)[1],fn:()=>openChoice('Now Playing look',STYLES.map(s=>[s[0],s[1],'look']),prefs.style,v=>{prefs.style=v;savePrefs();applyStyle()})},
    {ic:'viz',label:'Visuals',small:VIZ.find(s=>s[0]===prefs.viz)[1],fn:()=>openChoice('Visuals',VIZ.map(s=>[s[0],s[1],'viz']),prefs.viz,v=>{prefs.viz=v;savePrefs()})},
    {ic:'sparkle',label:'Weather effect',small:fxName,fn:()=>openChoice('Weather effect',FX_LIST.map(f=>[f[0],f[1],'sparkle']),prefs.fx,v=>{prefs.fx=v;savePrefs();fxChanged()})},
    {ic:'list',label:'Add to playlist',fn:()=>pickPlaylist([t])},
    {ic:'info',label:'Song details',fn:()=>songInfo(t)},
  ]});
}

/* ============ equalizer ============ */
const matchPreset=()=>{if(eq.pre!==0)return 'Custom';for(const [n,v] of Object.entries(PRESETS))if(v.every((x,i)=>x===eq.g[i]))return n;return 'Custom'};
const dbTxt=v=>(v>0?'+':'')+v.toFixed(1);
const faderHTML=(key,label,aria)=>`<div class="fader" data-k="${key}"><output>0.0</output><div class="trk" role="slider" tabindex="0" aria-label="${aria}" aria-valuemin="-12" aria-valuemax="12" aria-valuenow="0"><i class="mid"></i><i class="fillv"></i><b class="kn"></b></div><label>${label}</label></div>`;
function buildEQ(){
  if($('#eqFaders').children.length)return paintEQ();
  $('#eqFaders').innerHTML=faderHTML('pre','Pre','Preamp')+EQ_F.map((f,i)=>faderHTML(i,EQ_L[i],EQ_L[i]+' hertz')).join('');
  $$('#eqFaders .fader').forEach(bindFader);
  $('#eqPresets').innerHTML=Object.keys(PRESETS).map(n=>`<button class="chip" data-preset="${n}">${n}</button>`).join('');
  paintEQ();
}
function bindFader(f){
  const k=f.dataset.k==='pre'?'pre':+f.dataset.k, trk=$('.trk',f); let id=null,lastTap=0;
  const set=v=>{v=clamp(Math.round(v*2)/2,-12,12);if(k==='pre')eq.pre=v;else eq.g[k]=v;applyEQ();paintEQ();saveEQ()};
  const fromY=e=>{const b=trk.getBoundingClientRect();return (0.5-clamp((e.clientY-b.top-6)/(b.height-12),0,1))*24};
  trk.addEventListener('pointerdown',e=>{id=e.pointerId;trk.setPointerCapture(id);trk.classList.add('drag');const now=e.timeStamp;if(now-lastTap<320){set(0);lastTap=0;return}lastTap=now;set(fromY(e))});
  trk.addEventListener('pointermove',e=>{if(e.pointerId===id)set(fromY(e))});
  const up=e=>{if(e.pointerId===id){id=null;trk.classList.remove('drag')}};
  trk.addEventListener('pointerup',up);trk.addEventListener('pointercancel',up);
  trk.addEventListener('keydown',e=>{const v=k==='pre'?eq.pre:eq.g[k];if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();set(v+.5)}else if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();set(v-.5)}else if(e.key==='Home'||e.key==='0'){set(0)}});
}
function paintEQ(){
  $$('#eqFaders .fader').forEach(f=>{
    const k=f.dataset.k==='pre'?'pre':+f.dataset.k, v=k==='pre'?eq.pre:eq.g[k], pos=(12-v)/24*100, trk=$('.trk',f);
    $('output',f).textContent=dbTxt(v); trk.setAttribute('aria-valuenow',v);
    const fl=$('.fillv',f), kn=$('.kn',f), top=Math.min(50,pos);
    fl.style.top=`calc(6px + (100% - 12px) * ${top/100})`; fl.style.height=`calc((100% - 12px) * ${Math.abs(pos-50)/100})`;
    kn.style.top=`calc(6px + (100% - 12px) * ${pos/100})`;
  });
  const cur=matchPreset(); $$('#eqPresets .chip').forEach(c=>c.classList.toggle('on',c.dataset.preset===cur));
  eqEl.classList.toggle('eq-off',!eq.on); $('#eqOn').setAttribute('aria-checked',eq.on); $('#eqOnTxt').textContent=eq.on?'On':'Off';
}
let saveT=0; function saveEQ(){clearTimeout(saveT);saveT=setTimeout(()=>store.set('eq',eq),250)}
$('#eqPresets').addEventListener('click',e=>{const b=e.target.closest('[data-preset]');if(!b)return;eq.g=PRESETS[b.dataset.preset].slice();eq.pre=0;applyEQ();paintEQ();saveEQ()});
$('#eqReset').addEventListener('click',()=>{eq.g=Array(10).fill(0);eq.pre=0;applyEQ();paintEQ();saveEQ()});
$('#eqOn').addEventListener('click',()=>{eq.on=!eq.on;applyEQ();paintEQ();saveEQ()});
const CF=new Float32Array(160).map((_,i)=>20*Math.pow(1000,i/159)), CM=new Float32Array(160), CP=new Float32Array(160), CT=new Float32Array(160);
const cv=$('#eqCurve'), cx2=cv.getContext('2d'); let cw=0,ch=0;
function resizeCurve(){const r=cv.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);cw=r.width;ch=r.height;cv.width=Math.max(1,r.width*d);cv.height=Math.max(1,r.height*d);cx2.setTransform(d,0,0,d,0,0)}
const fx_=f=>(Math.log(f/20)/Math.log(1000))*cw, dy2=db=>ch/2-(db/15)*(ch/2-14);
function drawCurve(){
  if(!cw)resizeCurve(); const c=cx2; c.clearRect(0,0,cw,ch); c.font='12px '+getComputedStyle(root).getPropertyValue('--lcd'); c.textBaseline='middle';
  c.lineWidth=1;
  [12,6,0,-6,-12].forEach(db=>{c.strokeStyle=db===0?'rgba(255,255,255,.28)':'rgba(255,255,255,.08)';c.beginPath();c.moveTo(0,dy2(db));c.lineTo(cw,dy2(db));c.stroke();c.fillStyle='rgba(255,255,255,.4)';c.fillText((db>0?'+':'')+db,6,dy2(db)-8)});
  [100,1000,10000].forEach(f=>{c.strokeStyle='rgba(255,255,255,.08)';c.beginPath();c.moveTo(fx_(f),0);c.lineTo(fx_(f),ch);c.stroke();c.fillStyle='rgba(255,255,255,.4)';c.fillText(f>=1000?(f/1000)+'k':f,fx_(f)+5,ch-9)});
  c.globalAlpha=.3;c.fillStyle=C.a;const sr=ac?ac.sampleRate:44100;
  for(let i=0;i<NB;i++){const f=Math.max(20,binMap[i]*sr/2048),f2=Math.max(21,binMap[i+1]*sr/2048),x1=fx_(f),x2=fx_(f2),h=bars[i]*(ch-30);c.fillRect(x1,ch-h-4,Math.max(1,x2-x1-1),h)}
  c.globalAlpha=1;
  if(!ac)return;
  CT.fill(0); bands.forEach(b=>{b.getFrequencyResponse(CF,CM,CP);for(let i=0;i<160;i++)CT[i]+=20*Math.log10(CM[i]||1e-6)});
  const off=eq.on?eq.pre:0;
  c.beginPath();for(let i=0;i<160;i++){const x=i/159*cw,y=dy2(clamp(CT[i]+off,-15,15));i?c.lineTo(x,y):c.moveTo(x,y)}
  c.lineJoin='round';c.lineWidth=3;c.strokeStyle=eq.on?C.a:'rgba(255,255,255,.35)';c.stroke();
  c.lineTo(cw,dy2(0));c.lineTo(0,dy2(0));c.closePath();c.globalAlpha=.16;c.fillStyle=C.a;c.fill();c.globalAlpha=1;
  EQ_F.forEach((f,i)=>{const g=eq.on?eq.g[i]:0;c.beginPath();c.arc(fx_(f),dy2(clamp(g+off,-15,15)),4,0,TAU);c.fillStyle='#fff';c.fill()});
}
