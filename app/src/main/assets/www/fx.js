'use strict';
/* ============ audio analysis ============ */
const NB=56, binMap=Array.from({length:NB+1},(_,i)=>Math.round(2*Math.pow(380/2,i/NB)));
const FREQ=new Uint8Array(1024), WAVE=new Uint8Array(2048), bars=new Float32Array(NB);
let bass=0,mid=0,energy=0,bassAvg=0,beat=0,lastBeat=0;
function analyse(now){
  if(an&&S.playing){
    an.getByteFrequencyData(FREQ);an.getByteTimeDomainData(WAVE);
    for(let i=0;i<NB;i++){const a=binMap[i],b=Math.max(a+1,binMap[i+1]);let m=0;for(let j=a;j<b;j++)if(FREQ[j]>m)m=FREQ[j];const v=Math.pow(m/255,1.5);bars[i]+=(v-bars[i])*(v>bars[i]?.65:.2)}
    let bs=0;for(let i=1;i<7;i++)bs+=FREQ[i];bass=bs/6/255;
    let ms=0;for(let i=7;i<70;i++)ms+=FREQ[i];mid=ms/63/255;
    energy=energy*.8+(bass*.6+mid*.4)*.2;
    bassAvg=bassAvg*.96+bass*.04;
    if(bass>bassAvg*1.22&&bass>.38&&now-lastBeat>190){beat=1;lastBeat=now}
  }else{for(let i=0;i<NB;i++)bars[i]*=.9;bass*=.9;mid*=.9;energy*=.9;WAVE.fill(128)}
  beat*=.88;
}

/* ============ visualizer behind Now Playing ============ */
const vz=$('#viz'), vc=vz.getContext('2d'); let vw=0,vh=0,ccx=0,ccy=0,cr=100,ctr=0;
function resizeViz(){const d=Math.min(devicePixelRatio||1,1.5);vw=npEl.clientWidth;vh=npEl.clientHeight;vz.width=Math.max(1,vw*d);vz.height=Math.max(1,vh*d);vc.setTransform(d,0,0,d,0,0);ctr=0}
function locate(){
  const s=$('#stage').getBoundingClientRect(), n=npEl.getBoundingClientRect();
  if(s.width<10){ccx=vw*.72;ccy=vh*.42;cr=Math.min(vw,vh)*.3;return}
  ccx=s.left-n.left+s.width/2; ccy=s.top-n.top+s.height/2; cr=Math.min(s.width,s.height)/2*(prefs.style==='vinyl'||prefs.style==='circle'?1:1.28);
}
const SCENES=['halo','skyline','warp','waves','rings'];
let scene='halo',autoScene=SCENES[Math.random()*SCENES.length|0],autoT=16,vfade=1;
const parts=Array.from({length:130},()=>({a:Math.random()*TAU,r:Math.random(),s:.4+Math.random()*1.2,k:Math.random()*3|0}));
const rings=[];
function rr(c,x,y,w,h,r){c.beginPath();c.roundRect?c.roundRect(x,y,w,h,r):c.rect(x,y,w,h);c.fill()}
const drawScene={
  halo(c){
    const tot=NB*2, inner=cr*.86+beat*cr*.02; c.lineCap='round';
    for(let i=0;i<tot;i++){
      const v=bars[i<NB?i:tot-1-i], ang=i/tot*TAU-Math.PI/2, len=cr*.03+v*cr*.42, cs=Math.cos(ang), sn=Math.sin(ang);
      c.strokeStyle=i%2?C.a:C.b; c.globalAlpha=(.35+v*.65)*vfade; c.lineWidth=Math.max(2,TAU*inner/tot*.5);
      c.beginPath();c.moveTo(ccx+cs*inner,ccy+sn*inner);c.lineTo(ccx+cs*(inner+len),ccy+sn*(inner+len));c.stroke();
    }
    c.globalAlpha=.5*vfade;c.strokeStyle=C.w;c.lineWidth=2;c.beginPath();
    for(let i=0;i<=120;i++){const k=Math.floor(i/120*(WAVE.length-2)),v=(WAVE[k]-128)/128,ang=i/120*TAU-Math.PI/2,r=inner*.94+v*cr*.1;const x=ccx+Math.cos(ang)*r,y=ccy+Math.sin(ang)*r;i?c.lineTo(x,y):c.moveTo(x,y)}
    c.closePath();c.stroke();
  },
  skyline(c){
    const bw=vw/NB, g=c.createLinearGradient(0,vh,0,vh*.45);g.addColorStop(0,C.a);g.addColorStop(1,C.b);c.fillStyle=g;c.globalAlpha=.6*vfade;
    for(let i=0;i<NB;i++){const h=5+bars[i]*vh*.5;rr(c,i*bw+bw*.16,vh-h,bw*.68,h,bw*.3)}
  },
  warp(c,dt){
    const maxR=Math.hypot(vw,vh)*.6, sp=(.3+energy*2.4+beat*2.2)*dt*60; c.lineCap='round';
    parts.forEach(p=>{
      const r0=p.r*maxR; p.r+=(.004+p.r*.02)*p.s*sp; if(p.r>1){p.r=.02+Math.random()*.05;p.a=Math.random()*TAU}
      const r1=p.r*maxR, len=r1-r0+2+energy*14, cs=Math.cos(p.a), sn=Math.sin(p.a);
      c.strokeStyle=p.k===0?C.a:p.k===1?C.b:C.w; c.globalAlpha=Math.min(1,p.r*1.6)*.8*vfade; c.lineWidth=1+p.r*2.6;
      c.beginPath();c.moveTo(ccx+cs*(r1-len),ccy+sn*(r1-len));c.lineTo(ccx+cs*r1,ccy+sn*r1);c.stroke();
    });
  },
  waves(c){
    const cy=vh*.5, layers=[[C.a,4,1,0],[C.b,3,.7,90],[C.w,1.5,.5,200]]; c.lineJoin='round';
    layers.forEach(([col,lw,k,off],li)=>{
      c.strokeStyle=col;c.lineWidth=lw;c.globalAlpha=(li===2?.45:.8)*vfade;c.beginPath();
      const n=96;
      for(let i=0;i<=n;i++){const idx=(Math.floor(i/n*900)+off)%(WAVE.length-1),v=(WAVE[idx]-128)/128,x=i/n*vw,y=cy+v*vh*.34*k*(1+energy*1.5)+Math.sin(i*.2+performance.now()/900*(li+1))*6;i?c.lineTo(x,y):c.moveTo(x,y)}
      c.stroke();
    });
  },
  rings(c,dt){
    if(beat>.9)rings.push({r:cr*.7,a:.9});
    for(let i=rings.length-1;i>=0;i--){const q=rings[i];q.r+=(2.5+energy*8)*dt*60;q.a*=.965;if(q.a<.02){rings.splice(i,1);continue}c.strokeStyle=i%2?C.a:C.b;c.globalAlpha=q.a*vfade;c.lineWidth=2+q.a*7;c.beginPath();c.arc(ccx,ccy,q.r,0,TAU);c.stroke()}
    c.globalAlpha=.4*vfade;c.strokeStyle=C.w;c.lineWidth=2;
    for(let k=0;k<3;k++){c.beginPath();c.arc(ccx,ccy,cr*(.78+k*.14)+bars[k*8]*cr*.1,0,TAU);c.stroke()}
  }
};
function drawViz(dt){
  if(prefs.viz==='off'){if(ctr!==-1){vc.clearRect(0,0,vw,vh);ctr=-1}return}
  if(ctr===-1)ctr=0;
  if(--ctr<=0){locate();ctr=20}
  vc.clearRect(0,0,vw,vh);
  if(prefs.viz==='auto'){autoT-=dt;if(autoT<=0){autoT=14+Math.random()*10;autoScene=SCENES.filter(s=>s!==scene)[Math.random()*(SCENES.length-1)|0]}}
  const want=prefs.viz==='auto'?autoScene:prefs.viz;
  if(want!==scene){vfade=Math.max(0,vfade-dt*3);if(vfade<=0)scene=want}else vfade=Math.min(1,vfade+dt*2);
  drawScene[scene](vc,dt);vc.globalAlpha=1;
  if(!reduced.matches&&S.playing)$('#pulse').style.transform=`scale(${(1+beat*.028+bass*.012).toFixed(4)})`;
}

/* ============ weather effects (full-screen, behind your touches) ============ */
const FX_LIST=[['off','Off'],['snow','Snow'],['rain','Rain'],['storm','Storm'],['stars','Stars'],['fireflies','Fireflies'],['petals','Petals'],['leaves','Leaves'],['embers','Embers'],['bubbles','Bubbles'],['aurora','Aurora']];
const fxc=$('#fx'), fxx=fxc.getContext('2d'); let fw=0,fh=0,fxParts=[],fxKind='',fxDrawn=false,fxScale=1,fxSlow=0,fxT=0,flash=0,lastFlash=0,nextRand=8,splashes=[],shoots=[],nextShoot=4;
const aur=document.createElement('canvas'); aur.width=160; aur.height=90; const aux=aur.getContext('2d');
const sprites=new Map();
function glow(color){
  if(sprites.has(color))return sprites.get(color);
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),[r,g,b]=hexRGB(color);
  const gr=x.createRadialGradient(32,32,0,32,32,32);gr.addColorStop(0,`rgba(${r},${g},${b},1)`);gr.addColorStop(.25,`rgba(${r},${g},${b},.55)`);gr.addColorStop(1,`rgba(${r},${g},${b},0)`);
  x.fillStyle=gr;x.fillRect(0,0,64,64);sprites.set(color,c);return c;
}
function fxResize(){fw=fxc.width=innerWidth;fh=fxc.height=innerHeight;fxInit()}
const FX_BASE={snow:110,rain:150,storm:230,stars:90,fireflies:34,petals:36,leaves:30,embers:60,bubbles:30,aurora:0};
const PETAL=['#ffc2d6','#ffadc7','#ffd9e4','#ff9fbd'], LEAF=['#e0702b','#c9482b','#e6a02e','#a8501f','#d4872a'];
function newP(kind,initial){
  const R=Math.random, p={x:R()*fw,y:initial?R()*fh:-20-R()*60,ph:R()*TAU};
  switch(kind){
    case 'snow':p.r=1+R()*3.2;p.vy=28+p.r*16+R()*20;p.sw=10+R()*22;p.a=.5+R()*.45;break;
    case 'rain':case 'storm':p.len=14+R()*22;p.vy=(kind==='storm'?1000:760)+R()*380;p.a=.18+R()*.3;p.y=initial?R()*fh:-40-R()*fh*.3;break;
    case 'stars':p.y=R()*fh;p.r=.5+R()*1.5;p.sp=.6+R()*2;break;
    case 'fireflies':p.y=R()*fh;p.ang=R()*TAU;p.v=10+R()*24;p.r=10+R()*14;p.sp=1+R()*1.5;break;
    case 'petals':p.s=5+R()*6;p.rot=R()*TAU;p.vr=(R()-.5)*3;p.vy=26+R()*34;p.sw=22+R()*40;p.col=PETAL[R()*PETAL.length|0];break;
    case 'leaves':p.s=7+R()*7;p.rot=R()*TAU;p.vr=(R()-.5)*2.6;p.vy=34+R()*40;p.sw=30+R()*50;p.col=LEAF[R()*LEAF.length|0];break;
    case 'embers':p.y=initial?R()*fh:fh+10+R()*60;p.r=6+R()*10;p.vy=30+R()*60;p.sw=14+R()*26;p.life=.4+R()*.6;break;
    case 'bubbles':p.y=initial?R()*fh:fh+30+R()*60;p.r=7+R()*24;p.vy=22+R()*46;p.sw=10+R()*20;break;
  }
  return p;
}
function fxInit(){
  fxKind=prefs.fx; fxParts=[]; splashes=[]; shoots=[]; flash=0;
  const base=FX_BASE[fxKind]||0, area=clamp(fw*fh/(1280*720),.6,1.8), n=Math.round(base*[.5,1,1.7][clamp(prefs.fxAmt,1,3)-1]*area*fxScale);
  for(let i=0;i<n;i++)fxParts.push(newP(fxKind,true));
}
function fxActive(){return prefs.fx!=='off'&&!reduced.matches&&(prefs.fxScope==='all'||!npEl.hidden)}
function fxChanged(){fxInit();startTick();if(!fxActive()){fxx.clearRect(0,0,fw,fh);fxDrawn=false}}
function drawFx(dt,now){
  if(fxKind!==prefs.fx)fxInit();
  fxT+=dt; const c=fxx, t=fxT, k=fxKind, E=energy, wind=Math.sin(t*.2)*24+E*40;
  // slow device guard
  if(dt>.034){if(++fxSlow>90&&fxScale>.4){fxScale*=.7;fxSlow=0;fxInit()}}else if(fxSlow>0)fxSlow--;
  c.clearRect(0,0,fw,fh); fxDrawn=true;
  const [ar,ag,ab]=hexRGB(C.a);
  if(k==='snow'){
    for(const p of fxParts){
      p.y+=p.vy*dt*(1+E*1.1); p.x+=(Math.sin(t*.8+p.ph)*p.sw+wind)*dt;
      if(p.y>fh+8){p.y=-8;p.x=Math.random()*fw}if(p.x>fw+8)p.x=-8;else if(p.x<-8)p.x=fw+8;
      c.globalAlpha=p.a;c.fillStyle='#fff';c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.fill();
      if(p.r>2.6){c.globalAlpha=p.a*.25;c.beginPath();c.arc(p.x,p.y,p.r*2,0,TAU);c.fill()}
    }
  }else if(k==='rain'||k==='storm'){
    const w=(k==='storm'?-190:-50)+wind*(k==='storm'?2:1); c.lineCap='round';
    for(const p of fxParts){
      p.y+=p.vy*dt; p.x+=w*dt;
      if(p.y>fh){ if(Math.random()<.45&&splashes.length<80)splashes.push({x:p.x,y:fh-2-Math.random()*6,r:1,a:.5}); p.y=-p.len-Math.random()*80;p.x=Math.random()*(fw+200)-100 }
      const sl=w/p.vy; c.globalAlpha=p.a;c.strokeStyle='#cfe3ff';c.lineWidth=1.2;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-sl*p.len,p.y-p.len);c.stroke();
    }
    for(let i=splashes.length-1;i>=0;i--){const s=splashes[i];s.r+=dt*46;s.a-=dt*1.6;if(s.a<=0){splashes.splice(i,1);continue}c.globalAlpha=s.a;c.strokeStyle='#cfe3ff';c.lineWidth=1.2;c.beginPath();c.ellipse(s.x,s.y,s.r,s.r*.35,0,0,TAU);c.stroke()}
    if(k==='storm'){
      nextRand-=dt;
      if((beat>.9&&bass>.5&&now-lastFlash>3200)||nextRand<=0){flash=1;lastFlash=now;nextRand=7+Math.random()*9;setTimeout(()=>{flash=Math.max(flash,.75)},110)}
      if(flash>.02){c.globalAlpha=flash*.32;c.fillStyle='#e8f0ff';c.fillRect(0,0,fw,fh);flash*=.86}
    }
  }else if(k==='stars'){
    c.fillStyle='#fff';
    for(const p of fxParts){const a=.25+.75*(.5+.5*Math.sin(t*p.sp+p.ph));c.globalAlpha=a;c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.fill();if(p.r>1.4){c.globalAlpha=a*.4;c.fillRect(p.x-p.r*3,p.y-.4,p.r*6,.8);c.fillRect(p.x-.4,p.y-p.r*3,.8,p.r*6)}}
    nextShoot-=dt; if(nextShoot<=0){nextShoot=5+Math.random()*7;shoots.push({x:Math.random()*fw*.8,y:Math.random()*fh*.4,vx:620+Math.random()*300,vy:260+Math.random()*160,l:0})}
    for(let i=shoots.length-1;i>=0;i--){const s=shoots[i];s.l+=dt;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.l>.9){shoots.splice(i,1);continue}const a=Math.sin(s.l/.9*Math.PI);const g=c.createLinearGradient(s.x,s.y,s.x-s.vx*.16,s.y-s.vy*.16);g.addColorStop(0,`rgba(255,255,255,${a})`);g.addColorStop(1,'rgba(255,255,255,0)');c.globalAlpha=1;c.strokeStyle=g;c.lineWidth=2;c.beginPath();c.moveTo(s.x,s.y);c.lineTo(s.x-s.vx*.16,s.y-s.vy*.16);c.stroke()}
  }else if(k==='fireflies'){
    const spr=glow('#ffe97a'), spr2=glow(C.a);
    for(const p of fxParts){
      p.ang+=(Math.random()-.5)*dt*5; p.x+=Math.cos(p.ang)*p.v*dt; p.y+=Math.sin(p.ang)*p.v*dt*.7;
      if(p.x<-20)p.x=fw+20;else if(p.x>fw+20)p.x=-20; if(p.y<-20)p.y=fh+20;else if(p.y>fh+20)p.y=-20;
      const a=Math.max(0,.15+.85*Math.sin(t*p.sp+p.ph)); c.globalAlpha=a*(.7+E*.6);c.drawImage(p.ph>3.2?spr2:spr,p.x-p.r,p.y-p.r,p.r*2,p.r*2);
    }
  }else if(k==='petals'||k==='leaves'){
    for(const p of fxParts){
      p.y+=p.vy*dt*(1+E*.6); p.x+=(Math.sin(t*.9+p.ph)*p.sw+wind)*dt; p.rot+=p.vr*dt;
      if(p.y>fh+20){p.y=-20;p.x=Math.random()*fw}if(p.x>fw+30)p.x=-30;else if(p.x<-30)p.x=fw+30;
      c.save();c.translate(p.x,p.y);c.rotate(p.rot);c.scale(1,Math.cos(t*1.7+p.ph)*.6+.45);c.fillStyle=p.col;c.globalAlpha=.9;
      c.beginPath();
      if(k==='petals'){c.moveTo(0,-p.s);c.bezierCurveTo(p.s*.9,-p.s*.7,p.s*.8,p.s*.5,0,p.s);c.bezierCurveTo(-p.s*.8,p.s*.5,-p.s*.9,-p.s*.7,0,-p.s)}
      else{c.moveTo(0,-p.s*1.3);c.bezierCurveTo(p.s*1.1,-p.s*.5,p.s*.9,p.s*.8,0,p.s*1.3);c.bezierCurveTo(-p.s*.9,p.s*.8,-p.s*1.1,-p.s*.5,0,-p.s*1.3)}
      c.fill();
      if(k==='leaves'){c.strokeStyle='rgba(0,0,0,.25)';c.lineWidth=1;c.beginPath();c.moveTo(0,-p.s*1.2);c.lineTo(0,p.s*1.5);c.stroke()}
      c.restore();
    }
  }else if(k==='embers'){
    const spr=glow('#ff9a3c'), spr2=glow('#ffd36b');
    for(const p of fxParts){
      p.y-=p.vy*dt*(1+E*1.4+beat*.8); p.x+=Math.sin(t*1.2+p.ph)*p.sw*dt+wind*.3*dt; p.life-=dt*.14;
      if(p.life<=0||p.y<-20){Object.assign(p,newP('embers',false),{x:Math.random()*fw})}
      c.globalAlpha=Math.min(1,p.life*1.6)*(.55+.45*Math.sin(t*9+p.ph));c.drawImage(p.ph>3?spr:spr2,p.x-p.r,p.y-p.r,p.r*2,p.r*2);
    }
  }else if(k==='bubbles'){
    for(const p of fxParts){
      p.y-=p.vy*dt*(1+E*.8); p.x+=Math.sin(t*1.1+p.ph)*p.sw*dt;
      if(p.y<-p.r*2){Object.assign(p,newP('bubbles',false),{x:Math.random()*fw})}
      c.globalAlpha=.55;c.strokeStyle='rgba(255,255,255,.7)';c.lineWidth=1.3;c.beginPath();c.arc(p.x,p.y,p.r,0,TAU);c.stroke();
      c.globalAlpha=.08;c.fillStyle='#fff';c.fill();
      c.globalAlpha=.55;c.strokeStyle='#fff';c.lineWidth=1.6;c.beginPath();c.arc(p.x,p.y,p.r*.68,Math.PI*1.12,Math.PI*1.45);c.stroke();
    }
  }else if(k==='aurora'){
    const W=aur.width,H=aur.height; aux.clearRect(0,0,W,H); aux.globalCompositeOperation='lighter';
    const [br,bg,bb]=hexRGB(C.b);
    for(let band=0;band<3;band++){
      const col=band===1?[br,bg,bb]:band===2?[(ar+br)>>1,(ag+bg)>>1,(ab+bb)>>1]:[ar,ag,ab];
      for(let x=0;x<W;x+=2){
        const yc=H*(.26+.07*band)+Math.sin(x*.045+t*.5+band*2.1)*H*.08+Math.sin(x*.015-t*.3+band)*H*.07, hh=H*(.1+.07*Math.sin(x*.03+t*.7+band*1.3)+E*.12);
        for(let pass=0;pass<3;pass++){c.globalAlpha=1;aux.fillStyle=`rgba(${col[0]},${col[1]},${col[2]},${[.05,.07,.09][pass]})`;const k2=[1.6,1,.5][pass];aux.fillRect(x,yc-hh*k2,2,hh*2*k2)}
      }
    }
    aux.globalCompositeOperation='source-over';
    c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.globalAlpha=.9;c.drawImage(aur,0,0,fw,fh);
  }
  c.globalAlpha=1;
}

/* ============ the one animation loop ============ */
let raf=0,last=0;
function startTick(){if(!raf)raf=requestAnimationFrame(tick)}
function tick(ts){
  raf=0; if(document.hidden)return;
  const dt=Math.min(.05,(ts-last)/1000||.016); last=ts;
  paintProgress();
  const npOpen=!npEl.hidden, eqOpen=!eqEl.hidden, fxOn=fxActive();
  if(npOpen||eqOpen||S.playing||fxOn)analyse(ts);
  if(npOpen)drawViz(dt);
  if(eqOpen)drawCurve();
  if(fxOn)drawFx(dt,ts); else if(fxDrawn){fxx.clearRect(0,0,fw,fh);fxDrawn=false}
  if(!npOpen&&S.playing)$('#tint').style.opacity=(.6+bass*.3+beat*.1).toFixed(3);
  if(S.playing||npOpen||eqOpen||fxOn)raf=requestAnimationFrame(tick);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)startTick()});
new ResizeObserver(()=>{fxResize();if(!npEl.hidden)resizeViz();if(!eqEl.hidden)resizeCurve()}).observe(document.body);
