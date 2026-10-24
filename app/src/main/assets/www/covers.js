'use strict';
/* ============ cover generator ============
   Every song, folder, album, artist and genre without art gets a quiet, minimal cover.
   Folders share a style and palette so they read as a family; each song varies a little.
   Anyone can override a song or a whole folder with a style + palette, or with their own picture. */
const COV_PALS=[
  ['Stone','#1d1d1f','#f1efe9','#6b6a66'],
  ['Sand','#e9e3d6','#1f1d19','#b8ad97'],
  ['Sage','#cdd7c9','#1b2a21','#8fa58f'],
  ['Clay','#b8644a','#fbf0e8','#7d3f2c'],
  ['Sky','#c3d4e2','#13212d','#8aa4ba'],
  ['Ink','#0f1215','#e9eef1','#4d5860'],
  ['Blush','#e8cdc8','#2b1816','#c79a93'],
  ['Moss','#363b2d','#e5e8d5','#7b8461'],
  ['Paper','#f3f2ee','#121212','#bdbbb3'],
  ['Deep sea','#1c3547','#dce9f0','#4f7993'],
];
const COV_STYLES=[['letter','Letter'],['rings','Rings'],['waves','Waves'],['arc','Arc'],['dots','Dots'],['blocks','Blocks'],['haze','Haze'],['bars','Bars']];
const COV=Object.assign({t:{},f:{}},store.get('covers',{}));
const saveCov=()=>{try{localStorage.setItem('dash.covers',JSON.stringify(COV));return true}catch(e){return false}};
const covCache=new Map();
try{document.fonts&&document.fonts.load('800 40px Figtree')}catch(e){}

function drawCover(c,N,sp,label){
  const pal=COV_PALS[(sp.p|0)%COV_PALS.length],bg=pal[1],fg=pal[2],mid=pal[3],R=rng((sp.k|0)+7);
  c.fillStyle=bg;c.fillRect(0,0,N,N);
  c.lineCap='round';c.lineJoin='round';
  switch(sp.s){
    case 'rings':{
      const cx=N*(.28+R()*.44),cy=N*(.28+R()*.44),n=5+(R()*3|0);
      for(let i=n;i>=1;i--){c.strokeStyle=fg;c.globalAlpha=Math.max(.18,1-i*.12);c.lineWidth=N*.008;c.beginPath();c.arc(cx,cy,N*(.06+i*.1),0,TAU);c.stroke()}
      c.globalAlpha=1;c.fillStyle=fg;c.beginPath();c.arc(cx,cy,N*.05,0,TAU);c.fill();break}
    case 'waves':{
      const rows=9;
      for(let r=0;r<rows;r++){
        const y0=N*(.16+r*.085),amp=N*(.012+R()*.04),f=1.2+R()*2.2,ph=R()*TAU;
        c.strokeStyle=r===(R()*rows|0)?mid:fg;c.globalAlpha=.35+.65*(1-Math.abs(r-4)/5);c.lineWidth=N*.0065;c.beginPath();
        for(let x=0;x<=N;x+=4){const y=y0+Math.sin(x/N*TAU*f+ph)*amp;x?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}
      c.globalAlpha=1;break}
    case 'arc':{
      const right=R()>.5,down=R()>.5,ox=right?N:0,oy=down?N:0;
      c.fillStyle=fg;c.beginPath();c.arc(ox,oy,N*.78,0,TAU);c.fill();
      c.fillStyle=mid;c.beginPath();c.arc(right?N*.24:N*.76,down?N*.24:N*.76,N*.15,0,TAU);c.fill();
      c.fillStyle=bg;c.beginPath();c.arc(ox,oy,N*.4,0,TAU);c.fill();break}
    case 'dots':{
      const n=9,g=N/(n+1),px=R()*N,py=R()*N,max=Math.hypot(N,N)*.7;
      for(let i=1;i<=n;i++)for(let j=1;j<=n;j++){
        const x=i*g,y=j*g,d=Math.hypot(x-px,y-py)/max,r=g*(.08+.36*Math.max(0,1-d*1.15));
        c.fillStyle=d<.18?fg:mid;c.globalAlpha=.55+.45*(1-d);c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
      c.globalAlpha=1;break}
    case 'blocks':{
      const g=N*.07,s=(N-g*4)/3,cols=[fg,mid,fg,mid,mid,fg,bg,bg,bg];
      for(let i=cols.length-1;i>0;i--){const j=R()*(i+1)|0;[cols[i],cols[j]]=[cols[j],cols[i]]}
      cols.forEach((col,i)=>{const x=g+(i%3)*(s+g),y=g+(i/3|0)*(s+g);if(col===bg){c.strokeStyle=mid;c.globalAlpha=.5;c.lineWidth=N*.005;c.strokeRect(x,y,s,s);c.globalAlpha=1}else{c.fillStyle=col;c.fillRect(x,y,s,s)}});
      c.fillStyle=bg;const q=(R()*3|0),qx=g+q*(s+g),qy=g+(R()*3|0)*(s+g);c.beginPath();c.arc(qx+s/2,qy+s/2,s*.28,0,TAU);c.fill();break}
    case 'haze':{
      for(let i=0;i<3;i++){
        const x=N*(.15+R()*.7),y=N*(.15+R()*.7),r=N*(.45+R()*.3),gr=c.createRadialGradient(x,y,0,x,y,r);
        gr.addColorStop(0,i?mid:fg);gr.addColorStop(1,'rgba(0,0,0,0)');c.globalAlpha=i?.55:.42;c.fillStyle=gr;c.fillRect(0,0,N,N)}
      c.globalAlpha=.07;c.fillStyle=fg;for(let i=0;i<N*3;i++)c.fillRect(R()*N,R()*N,1.2,1.2);c.globalAlpha=1;break}
    case 'bars':{
      const n=7,w=N*.075,gap=(N-n*w)/(n+1),hl=R()*n|0;
      for(let i=0;i<n;i++){const h=N*(.18+R()*.5),x=gap+i*(w+gap),y=(N-h)/2;c.fillStyle=i===hl?mid:fg;c.beginPath();c.roundRect?c.roundRect(x,y,w,h,w/2):c.rect(x,y,w,h);c.fill()}
      break}
    default:{ // letter
      const ch=((label||'').trim().charAt(0)||'♪').toUpperCase();
      c.fillStyle=fg;c.font=`800 ${N*.6}px Figtree,system-ui,-apple-system,Segoe UI,sans-serif`;c.textAlign='center';c.textBaseline='alphabetic';
      const m=c.measureText(ch),asc=m.actualBoundingBoxAscent||N*.4,des=m.actualBoundingBoxDescent||0;
      c.fillText(ch,N/2,N/2+(asc-des)/2);
      c.fillStyle=mid;c.fillRect(N*.14,N*.87,N*.1,N*.012);break}
  }
}
function genURL(sp,N,label){
  if(sp.img)return sp.img;
  const key=sp.s+'|'+sp.p+'|'+sp.k+'|'+N+(sp.s==='letter'?'|'+((label||'').trim().charAt(0)):'');
  let u=covCache.get(key);if(u)return u;
  const c=document.createElement('canvas');c.width=c.height=N;drawCover(c.getContext('2d'),N,sp,label);
  u=c.toDataURL('image/jpeg',N>300?.9:.86);covCache.set(key,u);
  if(covCache.size>500)covCache.delete(covCache.keys().next().value);
  return u;
}
/* the automatic look: one style and palette per folder, small variation per song */
function autoSpec(key,group,vary){
  const g=hash(group||key);
  return {s:COV_STYLES[g%COV_STYLES.length][0],p:(g>>>5)%COV_PALS.length,k:vary?hash(key):g};
}
const trackSpec=t=>COV.t[t.key]||null;
function coverSmall(t){
  const c=COV.t[t.key];if(c)return genURL(c,256,tTitle(t));
  if(t.art)return t.art;
  const f=COV.f[t.cat];if(f)return genURL(f,256,tTitle(t));
  return genURL(autoSpec(t.path,t.cat,true),256,tTitle(t));
}
function coverBig(t){   // used when a song has no embedded picture, or has a custom one
  const c=COV.t[t.key];if(c)return genURL(c,720,tTitle(t));
  const f=COV.f[t.cat];if(f)return genURL(f,720,tTitle(t));
  return genURL(autoSpec(t.path,t.cat,true),720,tTitle(t));
}
const hasCustom=t=>!!COV.t[t.key];
function tileURL(name,key,N=256){return genURL(autoSpec(key||name,key||name,false),N,name)}
function folderCover(name){const f=COV.f[name];return f?genURL(f,256,name):null}

/* ============ the picker ============ */
let CVP=null;
function openCoverPicker(kind,key,title,label){
  const cur=COV[kind][key];
  const base=kind==='t'?(T(key)?autoSpec(T(key).path,T(key).cat,true):autoSpec(key)):autoSpec(key,key,false);
  CVP={kind,key,title,label:label||title,spec:cur?Object.assign({},cur):Object.assign({},base),had:!!cur};
  let el=$('#cvp');
  if(!el){el=document.createElement('div');el.id='cvp';el.setAttribute('role','dialog');el.setAttribute('aria-label','Change cover');document.body.appendChild(el)}
  el.hidden=false;paintCvp();
  const f=$('button',el);f&&f.focus({preventScroll:true});
}
function paintCvp(){
  const el=$('#cvp'),sp=CVP.spec,img=sp.img||genURL(sp,512,CVP.label);
  el.innerHTML=`<div class="cvp-box">
    <div class="cvp-prev"><img src="${img}" alt=""><b>${esc(CVP.title)}</b><small>${CVP.kind==='t'?'This song':'Every song in this folder without its own picture'}</small></div>
    <div class="cvp-ctl">
      <h3>Style</h3><div class="opts">${COV_STYLES.map(([v,l])=>`<button class="chip${!sp.img&&sp.s===v?' on':''}" data-cv="s" data-v="${v}">${l}</button>`).join('')}</div>
      <h3>Colour</h3><div class="cvp-sw">${COV_PALS.map(([n,bg,fg],i)=>`<button class="cvp-s${!sp.img&&sp.p===i?' on':''}" data-cv="p" data-v="${i}" aria-label="${n}" title="${n}" style="background:${bg};color:${fg}"><i style="background:${fg}"></i></button>`).join('')}</div>
      <div class="opts" style="margin-top:6px">
        <button class="chip" data-cv="shuffle">${svg('shuffle')}Another take</button>
        <button class="chip" data-cv="img">${svg('look')}Use my own picture</button>
        ${CVP.had?`<button class="chip" data-cv="reset">Back to automatic</button>`:''}
      </div>
      <div class="cvp-foot"><button class="btn" data-cv="cancel">Cancel</button><button class="btn pri" data-cv="done">Save</button></div>
    </div></div>
    <input type="file" id="fCover" accept="image/*" hidden>`;
}
function closeCvp(){const el=$('#cvp');if(el){el.hidden=true;el.innerHTML=''}CVP=null}
async function refreshCovers(){
  for(const k of [...bigArt.keys()])if(String(k).startsWith('g:'))bigArt.delete(k);
  renderAll(true);
  const t=S.cur;
  if(t){
    try{t.full=await fullArt(t);t.pal=await palFor(t.full);setCover(t,0);applyPalette(t.pal);mediaMeta(t)}catch(e){}
  }
}
async function squareImage(file){
  const u=URL.createObjectURL(file);
  try{
    const im=await loadImg(u),N=560,c=document.createElement('canvas');c.width=c.height=N;
    const s=Math.min(im.naturalWidth,im.naturalHeight),sx=(im.naturalWidth-s)/2,sy=(im.naturalHeight-s)/2;
    c.getContext('2d').drawImage(im,sx,sy,s,s,0,0,N,N);
    return c.toDataURL('image/jpeg',.85);
  }finally{URL.revokeObjectURL(u)}
}
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-cv]');
  if(!b){const el=$('#cvp');if(el&&!el.hidden&&e.target===el)closeCvp();return}
  if(!CVP)return;
  const a=b.dataset.cv,v=b.dataset.v;
  if(a==='s'){delete CVP.spec.img;CVP.spec.s=v;if(CVP.spec.p==null)CVP.spec.p=0;paintCvp()}
  else if(a==='p'){delete CVP.spec.img;CVP.spec.p=+v;if(!CVP.spec.s)CVP.spec.s='letter';paintCvp()}
  else if(a==='shuffle'){delete CVP.spec.img;CVP.spec.k=Math.random()*1e9|0;if(!CVP.spec.s)CVP.spec.s=COV_STYLES[Math.random()*8|0][0];paintCvp()}
  else if(a==='img'){$('#fCover').click()}
  else if(a==='cancel')closeCvp();
  else if(a==='reset'){delete COV[CVP.kind][CVP.key];saveCov();closeCvp();refreshCovers();toast('Back to the automatic cover')}
  else if(a==='done'){
    COV[CVP.kind][CVP.key]=CVP.spec;
    if(!saveCov()){delete COV[CVP.kind][CVP.key];toast('Not enough space to keep that picture. Try a smaller one.');return}
    closeCvp();refreshCovers();toast('Cover saved');
  }
});
document.addEventListener('change',async e=>{
  if(e.target.id!=='fCover'||!CVP)return;
  const f=e.target.files&&e.target.files[0];if(!f)return;
  try{const d=await squareImage(f);CVP.spec={img:d};paintCvp()}catch(x){toast('Could not open that picture.')}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&CVP){closeCvp();e.stopPropagation()}},true);
