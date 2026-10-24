'use strict';
const view=$('#view');
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('show'),2800)}
function favChanged(t){$$('.row[data-k]').forEach(r=>{if(r.dataset.k===t.key)$('[data-act=rowfav]',r).setAttribute('aria-pressed',isFav(t))});if(S.stack.length&&S.stack[S.stack.length-1].key==='fav')renderAll(true)}

/* ============ small builders ============ */
const TABS={home:'For you',folders:'Folders',songs:'Songs',albums:'Albums',artists:'Artists',genres:'Genres',playlists:'Playlists'};
const imgOr=(url,h,inner='')=>url?`<img src="${url}" alt="" decoding="async" loading="lazy">`:`<span class="ph" style="--h:${h}">${inner||svg('note')}</span>`;
const thumbHTML=t=>imgOr(coverSmall(t),t.hue);
function reg(list){S.lists.push(list);return S.lists.length-1}
function rowHTML(t,l,i,o={}){
  const on=S.cur===t;
  const num=o.num?`<span class="num">${o.num}</span>`:'';
  return `<div class="row${on?' on':''}" role="button" tabindex="0" data-l="${l}" data-i="${i}" data-k="${esc(t.key)}"><span class="th">${thumbHTML(t)}${num}<span class="pl"><i class="eqb"><b></b><b></b><b></b></i></span></span><span class="tx"><b>${esc(tTitle(t))}</b><small>${esc(tSub(t))}</small></span><span class="al">${esc(t.album)}</span><button class="ib fav" data-act="rowfav" aria-pressed="${isFav(t)}" aria-label="Favourite">${svg('heart')}</button><button class="ib" data-act="rowmore" aria-label="More options">${svg('more')}</button></div>`;
}
const CHUNK=160;
function rowsHTML(list,l,o={}){
  const first=list.slice(0,CHUNK).map((t,i)=>rowHTML(t,l,i,o.nums?{num:o.nums(t,i)}:{})).join('');
  S.more=list.length>CHUNK?{list,l,o,at:CHUNK}:null;
  return `<div class="rows" id="rowsMain">${first}</div>`;
}
function moreRows(){
  const m=S.more; if(!m)return; const box=$('#rowsMain'); if(!box){S.more=null;return}
  const end=Math.min(m.list.length,m.at+CHUNK);
  box.insertAdjacentHTML('beforeend',m.list.slice(m.at,end).map((t,i)=>rowHTML(t,m.l,m.at+i,m.o.nums?{num:m.o.nums(t,m.at+i)}:{})).join(''));
  m.at=end; if(end>=m.list.length)S.more=null;
}
view.addEventListener('scroll',()=>{if(S.more&&view.scrollTop+view.clientHeight>view.scrollHeight-700)moreRows()},{passive:true});
function tintCard(name,hue,kind,key,sub,round){
  const img=(kind==='folder'&&folderCover(key))||tileURL(name,kind+':'+key);
  return `<button class="card${round?' round':''}" data-d="${kind}" data-k="${esc(key)}"><span class="cv"><img src="${img}" alt="" decoding="async" loading="lazy"></span><b>${esc(name)}</b>${sub?`<small>${esc(sub)}</small>`:''}</button>`;
}
function albumCard(al){
  return `<button class="card" data-d="album" data-k="${esc(al.key)}"><span class="cv">${imgOr(al.art||tileURL(al.name,'album:'+al.key),0)}</span><b>${esc(al.name)}</b><small>${esc(al.artist||plural(al.tracks.length,'song'))}</small></button>`;
}
function artistCard(ar){
  const sub=plural(ar.tracks.length,'song');
  return `<button class="card round" data-d="artist" data-k="${esc(ar.key)}"><span class="cv"><img src="${ar.art||tileURL(ar.name,'artist:'+ar.key)}" alt="" decoding="async" loading="lazy"></span><b>${esc(ar.name)}</b><small>${sub}</small></button>`;
}
function artsOf(tracks,n=4){const seen=new Set(),out=[];for(const t of tracks){if(t.art&&!seen.has(t.art)){seen.add(t.art);out.push(t.art);if(out.length>=n)break}}return out}
function collage(tracks,h){
  const a=artsOf(tracks);
  if(a.length>=4)return a.map(u=>`<span><img src="${u}" alt="" decoding="async" loading="lazy" style="width:100%;height:100%;object-fit:cover"></span>`).join('');
  return null;
}
function folderCard(name,tracks){
  const fc=folderCover(name), col=fc?null:collage(tracks), a=fc||artsOf(tracks,1)[0], h=hash(name)%360, sub=plural(tracks.length,'song');
  if(col)return `<button class="card" data-d="folder" data-k="${esc(name)}"><span class="cv col">${col}</span><b>${esc(name)}</b><small>${sub}</small></button>`;
  if(a)return `<button class="card" data-d="folder" data-k="${esc(name)}"><span class="cv"><img src="${a}" alt="" decoding="async" loading="lazy"></span><b>${esc(name)}</b><small>${sub}</small></button>`;
  return tintCard(name,h,'folder',name,sub);
}
function genreCard(g){return tintCard(g.name,hash(g.key)%360,'genre',g.key,plural(g.tracks.length,'song'))}
const SMART={fav:['Favourites','heart',340],recent:['Recently played','queue',210],added:['Last added','plus',150],top:['Top tracks','viz',30]};
function smartTracks(k){
  if(k==='fav')return [...data.favs].map(T).filter(Boolean).reverse();
  if(k==='recent')return data.hist.map(T).filter(Boolean);
  if(k==='added')return S.tracks.filter(t=>t.mod).sort((a,b)=>b.mod-a.mod).slice(0,100);
  if(k==='top')return S.tracks.filter(t=>data.plays[t.key]).sort((a,b)=>data.plays[b.key]-data.plays[a.key]).slice(0,99);
  return [];
}
function plCard(kind,key,name,ic,hue,count){
  return `<button class="card pl" data-d="${kind}" data-k="${esc(key)}"><span class="cv" style="background:linear-gradient(140deg,hsl(${hue} 55% 36%),hsl(${(hue+50)%360} 60% 18%))">${svg(ic)}</span><b>${esc(name)}</b><small>${plural(count,'song')}</small></button>`;
}
function trackCard(t,l,i){
  return `<button class="card" data-l="${l}" data-i="${i}" data-k="${esc(t.key)}"><span class="cv">${thumbHTML(t)}</span><b>${esc(tTitle(t))}</b><small>${esc(tSub(t))}</small></button>`;
}
function sec(title,inner,more){
  return `<section class="sec"><div class="sec-h"><h2>${esc(title)}</h2>${more?`<button class="link" data-act="goto" data-v="${more}">See all</button>`:''}</div>${inner}</section>`;
}

/* ============ sorting ============ */
const SORTS={
  songs:[['title','Title'],['artist','Artist'],['album','Album'],['added','Date added'],['folder','Folder']],
  albums:[['name','Name'],['artist','Artist'],['year','Year']],
  artists:[['name','Name'],['count','Number of songs']],
};
function sortTracks(list,how){
  const a=list.slice();
  if(how==='artist')a.sort((x,y)=>cmp(x.artist||'~',y.artist||'~')||cmp(x.album,y.album)||(x.tn-y.tn)||cmp(tTitle(x),tTitle(y)));
  else if(how==='album')a.sort((x,y)=>cmp(x.album||'~',y.album||'~')||(x.tn-y.tn)||cmp(tTitle(x),tTitle(y)));
  else if(how==='added')a.sort((x,y)=>y.mod-x.mod||cmp(tTitle(x),tTitle(y)));
  else if(how==='folder')a.sort((x,y)=>cmp(x.path,y.path));
  else a.sort((x,y)=>cmp(tTitle(x),tTitle(y)));
  return a;
}

/* ============ views ============ */
const hourGreet=()=>{const h=new Date().getHours();return h<5?'Good night':h<12?'Good morning':h<18?'Good afternoon':'Good evening'};
function emptyHTML(){
  return `<div class="empty"><h2>Pick the folder your music lives in</h2><p>Each folder inside it becomes a category. Songs can sit inside those, like this:</p>
<div class="tree" aria-label="Example folder layout">Music<b>/</b>
  Rock<b>/</b>
    song one.mp3
  Chill<b>/</b>
    song two.m4a</div>
<div class="acts"><button class="btn pri" data-act="folder">${svg('folder')}Choose folder</button>${NINFO?'':`<button class="btn" data-act="files">${svg('plus')}Add songs</button>`}<button class="btn" data-act="demo">${svg('play')}Try a demo</button></div></div>`;
}
function viewHome(){
  if(!S.tracks.length)return emptyHTML();
  const rnd=rng(hash(new Date().toDateString())), pick=(a,n)=>a.length<=n?a:a.map(x=>[rnd(),x]).sort((p,q)=>p[0]-q[0]).slice(0,n).map(x=>x[1]);
  let h=`<div class="greet">${hourGreet()}</div><div class="quick"><button class="btn pri" data-act="shuffleall">${svg('shuffle')}Shuffle all</button><button class="btn" data-act="goto" data-v="folders">${svg('folder')}Folders</button></div>`;
  const row=(title,list,more)=>{if(!list.length)return '';const l=reg(list);return sec(title,`<div class="hrow">${list.map((t,i)=>trackCard(t,l,i)).join('')}</div>`,more)};
  h+=row('Recently played',smartTracks('recent').slice(0,14),'recent');
  h+=row('Last added',smartTracks('added').slice(0,14),'added');
  h+=row('Favourites',smartTracks('fav').slice(0,14),'fav');
  h+=row('Top tracks',smartTracks('top').slice(0,14),'top');
  const cats=[...S.cats.keys()].sort(cmp);
  h+=sec('Folders',`<div class="hrow">${cats.map(c=>folderCard(c,S.cats.get(c))).join('')}</div>`,'folders');
  const tagged=S.albums.filter(a=>!a.untagged);
  if(tagged.length)h+=sec('Albums for you',`<div class="hrow">${pick(tagged,14).map(albumCard).join('')}</div>`,'albums');
  const arts=S.artists.filter(a=>a.name!=='Unknown artist');
  if(arts.length)h+=sec('Artists',`<div class="hrow">${pick(arts,14).map(artistCard).join('')}</div>`,'artists');
  return h;
}
function viewFolders(){
  if(!S.tracks.length)return emptyHTML();
  const cats=[...S.cats.keys()].sort(cmp);
  return `<div class="grid">${cats.map(c=>folderCard(c,S.cats.get(c))).join('')}</div>`;
}
function viewSongs(){
  if(!S.tracks.length)return emptyHTML();
  const list=sortTracks(S.tracks,prefs.sort.songs); S.detailTracks=list;
  return rowsHTML(list,reg(list));
}
function viewAlbums(){
  if(!S.tracks.length)return emptyHTML();
  const how=prefs.sort.albums, a=S.albums.slice();
  if(how==='artist')a.sort((x,y)=>cmp(x.artist,y.artist)||cmp(x.name,y.name)); else if(how==='year')a.sort((x,y)=>(y.year||0)-(x.year||0)||cmp(x.name,y.name)); else a.sort((x,y)=>cmp(x.name,y.name));
  return `<div class="grid">${a.map(albumCard).join('')}</div>`;
}
function viewArtists(){
  if(!S.tracks.length)return emptyHTML();
  const a=S.artists.slice(); if(prefs.sort.artists==='count')a.sort((x,y)=>y.tracks.length-x.tracks.length||cmp(x.name,y.name)); else a.sort((x,y)=>cmp(x.name,y.name));
  return `<div class="grid">${a.map(artistCard).join('')}</div>`;
}
function viewGenres(){
  if(!S.tracks.length)return emptyHTML();
  if(!S.genres.length)return `<div class="empty"><h2>No genres yet</h2><p>${S.parsed<S.total?'Still reading your songs. Genres appear as they are found.':'Your songs have no genre tags. Folders work well for sorting by hand.'}</p></div>`;
  return `<div class="grid">${S.genres.slice().sort((a,b)=>cmp(a.name,b.name)).map(genreCard).join('')}</div>`;
}
function viewPlaylists(){
  let h=`<div class="grid"><button class="card pl" data-act="newpl"><span class="cv" style="background:var(--panel2)">${svg('plus')}</span><b>New playlist</b><small>Start an empty list</small></button>`;
  for(const k of Object.keys(SMART)){const [n,ic,hue]=SMART[k];h+=plCard('playlist',k,n,ic,hue,smartTracks(k).length)}
  for(const p of data.playlists)h+=plCard('playlist',p.id,p.name,'list',hash(p.id)%360,p.keys.filter(k=>S.byKey.has(k)).length);
  return h+'</div>';
}
function viewSearch(){
  const q=S.q.trim().toLowerCase(), words=q.split(/\s+/);
  const hit=s=>{s=s.toLowerCase();return words.every(w=>s.includes(w))};
  const tr=S.tracks.filter(t=>hit(tTitle(t)+' '+t.artist+' '+t.album+' '+t.genre+' '+t.cat)).slice(0,80);
  const al=S.albums.filter(a=>hit(a.name+' '+a.artist)).slice(0,24), ar=S.artists.filter(a=>hit(a.name)).slice(0,24);
  if(!tr.length&&!al.length&&!ar.length)return `<div class="empty"><h2>No results for “${esc(S.q)}”</h2><p>Check the spelling, or search by artist, album or folder name.</p></div>`;
  let h='';
  if(ar.length)h+=sec('Artists',`<div class="hrow">${ar.map(artistCard).join('')}</div>`);
  if(al.length)h+=sec('Albums',`<div class="hrow">${al.map(albumCard).join('')}</div>`);
  if(tr.length){S.detailTracks=tr;h+=sec('Songs',rowsHTML(tr,reg(tr)))}
  return h;
}

/* ---- detail pages ---- */
function userPl(id){return data.playlists.find(p=>p.id===id)}
function detailOf(e){
  const {kind,key}=e;
  if(kind==='album'){const al=S.albumMap.get(key);if(!al)return null;
    return {title:al.name,kind:'Album',tracks:al.tracks,meta:[al.artist,al.year||'',plural(al.tracks.length,'song')].filter(Boolean).join(' · '),cover:`<img src="${al.art||tileURL(al.name,'album:'+al.key,512)}" alt="">`,hue:hash(key)%360,nums:true}}
  if(kind==='artist'){const ar=S.artistMap.get(key);if(!ar)return null;
    const tr=ar.tracks.slice().sort((a,b)=>cmp(a.album,b.album)||(a.tn-b.tn)||cmp(tTitle(a),tTitle(b)));
    return {title:ar.name,kind:'Artist',tracks:tr,meta:`${plural(ar.albums.size,'album')} · ${plural(tr.length,'song')}`,cover:`<img src="${ar.art||tileURL(ar.name,'artist:'+ar.key,512)}" alt="">`,round:true,hue:hash(key)%360,albums:[...ar.albums].map(k=>S.albumMap.get(k)).filter(Boolean)}}
  if(kind==='folder'){const tr=S.cats.get(key);if(!tr)return null;
    const fc=folderCover(key),col=fc?null:collage(tr),a=fc||artsOf(tr,1)[0];
    return {title:key,kind:'Folder',tracks:tr,meta:plural(tr.length,'song'),cover:col||`<img src="${a||tileURL(key,'folder:'+key,512)}" alt="">`,colClass:!!col,hue:hash(key)%360,folder:key}}
  if(kind==='genre'){const g=S.genreMap.get(key);if(!g)return null;
    const tr=g.tracks.slice().sort((a,b)=>cmp(tTitle(a),tTitle(b))),a=artsOf(tr,1)[0];
    return {title:g.name,kind:'Genre',tracks:tr,meta:plural(tr.length,'song'),cover:`<img src="${a||tileURL(g.name,'genre:'+g.key,512)}" alt="">`,hue:hash(key)%360}}
  if(kind==='playlist'){
    if(SMART[key]){const tr=smartTracks(key),a=artsOf(tr,1)[0];return {title:SMART[key][0],kind:'Playlist',tracks:tr,meta:plural(tr.length,'song'),cover:a?`<img src="${a}" alt="">`:null,hue:SMART[key][2],smart:key}}
    const p=userPl(key);if(!p)return null;const tr=p.keys.map(T).filter(Boolean),a=artsOf(tr,1)[0];
    return {title:p.name,kind:'Playlist',tracks:tr,meta:plural(tr.length,'song'),cover:a?`<img src="${a}" alt="">`:null,hue:hash(key)%360,user:p}}
  return null;
}
function viewDetail(e){
  const d=detailOf(e); if(!d){S.stack.pop();return viewTab()}
  S.detail=d; S.detailTracks=d.tracks;
  const cov=d.cover?`<div class="cv${d.round?' round':''}${d.colClass?' col':''}">${d.cover}</div>`:`<div class="cv${d.round?' round':''}"><span class="ph" style="--h:${d.hue}">${d.round?`<b>${esc(d.title.charAt(0).toUpperCase())}</b>`:svg(d.smart?SMART[d.smart][1]:'note')}</span></div>`;
  let h=`<div class="hero">${cov}<div><div class="kind">${d.kind}</div><h2>${esc(d.title)}</h2><div class="meta">${esc(d.meta)}</div>
    <div class="acts"><button class="fab" data-act="dplay" aria-label="Play">${svg('play','f')}</button><button class="chip" data-act="dshuffle">${svg('shuffle')}Shuffle</button><button class="chip" data-act="dmore">${svg('more')}More</button></div></div></div>`;
  if(d.albums&&d.albums.length>1)h+=sec('Albums',`<div class="hrow">${d.albums.map(albumCard).join('')}</div>`);
  if(!d.tracks.length)h+=`<div class="note">${d.smart==='fav'?'Tap the heart on any song to keep it here.':d.smart==='recent'?'Songs you play show up here.':d.smart==='top'?'Songs you play often show up here.':d.smart==='added'?'This needs the folder scan to know when songs were added.':'Nothing here yet. Use “Add to playlist” on any song.'}</div>`;
  else h+=(d.albums&&d.albums.length>1?`<section class="sec"><div class="sec-h"><h2>Songs</h2></div>`:'')+rowsHTML(d.tracks,reg(d.tracks),d.nums?{nums:(t,i)=>t.tn||i+1}:{})+(d.albums&&d.albums.length>1?'</section>':'');
  return h;
}
function viewTab(){
  switch(S.tab){case 'folders':return viewFolders();case 'songs':return viewSongs();case 'albums':return viewAlbums();case 'artists':return viewArtists();case 'genres':return viewGenres();case 'playlists':return viewPlaylists();default:return viewHome()}
}

/* ============ header, render, navigation ============ */
function renderHead(){
  const top=S.stack[S.stack.length-1], searching=!!S.q.trim();
  let sub='Library',title=TABS[S.tab],extra='';
  const folderBtn=`<button class="chip" data-act="folder">${svg('folder')}<span>Change folder</span></button>`;
  if(searching){sub='Search';title=`“${S.q.trim()}”`}
  else if(top){const d=S.detail;sub=d?d.kind:'';title=d?d.title:''}
  else{
    if(S.tab==='home'){sub=S.tracks.length?`${plural(S.tracks.length,'song')} in ${plural(S.cats.size,'folder')}`:'Welcome';title='For you'}
    else if(S.tab==='songs')sub=plural(S.tracks.length,'song');
    else if(S.tab==='albums')sub=plural(S.albums.length,'album');
    else if(S.tab==='artists')sub=plural(S.artists.length,'artist');
    else if(S.tab==='folders')sub=plural(S.cats.size,'folder');
    else if(S.tab==='genres')sub=plural(S.genres.length,'genre');
    else if(S.tab==='playlists')sub=plural(data.playlists.length+4,'playlist');
    const k=SORTS[S.tab];
    if(k&&S.tracks.length)extra+=`<button class="chip" data-act="sort">${svg('list')}<span>${esc(k.find(x=>x[0]===prefs.sort[S.tab])[1])}</span></button>`;
    if(S.tab==='playlists')extra+=`<button class="chip" data-act="newpl">${svg('plus')}<span>New</span></button>`;
    if(S.tracks.length)extra+=folderBtn;
  }
  $('#hSub').textContent=sub; $('#hTitle').textContent=title; $('#hExtra').innerHTML=extra;
  $('#back').hidden=!(top||searching);
  $$('.nav[data-tab]').forEach(b=>b.setAttribute('aria-current',String(b.dataset.tab===S.tab&&!top&&!searching)));
  $('#searchBox').classList.toggle('has',!!$('#q').value);
}
function renderAll(keepScroll){
  const sc=keepScroll?view.scrollTop:0;
  S.lists=[];S.more=null;
  const top=S.stack[S.stack.length-1];
  let html;
  if(S.q.trim())html=viewSearch(); else if(top){S.detail=null;html=viewDetail(top)} else html=viewTab();
  renderHead();
  view.innerHTML=html; view.scrollTop=sc;
}
function goTab(tab){S.tab=tab;S.stack=[];S.q='';$('#q').value='';S.baseScroll=0;renderAll()}
function openDetail(kind,key){
  const prev=S.stack.length?S.stack[S.stack.length-1]:S; prev.scrollY=view.scrollTop;
  if(S.q.trim()){S.q='';$('#q').value=''}
  S.stack.push({kind,key}); renderAll();
}
function popDetail(){
  if(S.q.trim()){S.q='';$('#q').value='';renderAll(false);view.scrollTop=S.scrollY||0;return true}
  if(!S.stack.length)return false;
  S.stack.pop(); renderAll(false);
  const t=S.stack.length?S.stack[S.stack.length-1]:S; view.scrollTop=t.scrollY||0; return true;
}
function setStatus(){
  const el=$('#status'), busy=S.total&&S.parsed<S.total;
  el.classList.toggle('on',!!busy); if(busy)el.textContent=`Reading song details ${S.parsed}/${S.total}`;
}
onParsedUI=()=>{
  setStatus();
  const typing=document.activeElement&&document.activeElement.id==='q';
  if(S.parsed>=S.total||(view.scrollTop<40&&!typing))renderAll(true);
  markPlayingUI();
};
function markPlayingUI(){
  const k=S.cur&&S.cur.key;
  $$('.row[data-k]').forEach(r=>r.classList.toggle('on',r.dataset.k===k));
  $$('.qrow[data-k]').forEach(r=>r.classList.toggle('on',r.dataset.k===k));
}
function updateFavUI(){
  const f=isFav(S.cur);
  $$('.ib.fav[data-act=fav]').forEach(b=>b.setAttribute('aria-pressed',f));
}

/* ============ menus and dialogs ============ */
let menuOpen=false;
function openMenu({title,sub,art,hue=260,items}){
  const m=$('#menu'), sc=$('#scrim');
  m.innerHTML=(title?`<div class="m-top"><span class="th">${imgOr(art,hue)}</span><div class="tx"><b>${esc(title)}</b>${sub?`<small>${esc(sub)}</small>`:''}</div></div>`:'')+
    `<div class="m-list">${items.map((it,i)=>`<button class="mi${it.danger?' danger':''}" role="menuitem" data-i="${i}">${it.ic?svg(it.ic):''}<span>${esc(it.label)}</span>${it.check?`<span class="ck">${svg('check')}</span>`:''}${it.small?`<small>${esc(it.small)}</small>`:''}</button>`).join('')}</div>`;
  m._items=items; sc.hidden=false; menuOpen=true;
  if(!reduced.matches)m.animate([{transform:'translateY(60px) scale(.96)',opacity:0},{transform:'none',opacity:1}],{duration:SP_POP.ms,easing:SP_POP.ease});
  const f=$('.mi',m); f&&f.focus({preventScroll:true});
}
function closeMenu(){
  if(!menuOpen)return; menuOpen=false; const sc=$('#scrim');
  if(reduced.matches){sc.hidden=true;return}
  const a=$('#menu').animate([{opacity:1,transform:'none'},{opacity:0,transform:'translateY(30px) scale(.97)'}],{duration:160,easing:'ease-in'});
  a.onfinish=()=>{if(!menuOpen)sc.hidden=true};
}
$('#scrim').addEventListener('click',e=>{
  if(e.target.id==='scrim'){closeMenu();return}
  const b=e.target.closest('.mi'); if(!b)return;
  const it=$('#menu')._items[+b.dataset.i]; closeMenu(); if(it&&it.fn)setTimeout(it.fn,0);
});
function openChoice(title,options,current,pick){
  openMenu({title,items:options.map(([v,l,ic])=>({label:l,ic,check:v===current,fn:()=>pick(v)}))});
}
function askText(title,initial='',ok='Save'){
  return new Promise(res=>{
    const d=$('#dlg'); d.hidden=false;
    d.innerHTML=`<form><h3>${esc(title)}</h3><input id="dlgIn" type="text" maxlength="60" value="${esc(initial)}" autocomplete="off"><div class="row2"><button type="button" class="btn" id="dlgNo">Cancel</button><button type="submit" class="btn pri">${esc(ok)}</button></div></form>`;
    const inp=$('#dlgIn'); setTimeout(()=>{inp.focus();inp.select()},50);
    const done=v=>{d.hidden=true;d.innerHTML='';res(v)};
    $('form',d).onsubmit=e=>{e.preventDefault();done(inp.value.trim()||null)};
    $('#dlgNo').onclick=()=>done(null);
    d.onclick=e=>{if(e.target===d)done(null)};
  });
}
function showInfo(title,rows){
  const d=$('#dlg'); d.hidden=false;
  d.innerHTML=`<form><h3>${esc(title)}</h3><div style="display:flex;flex-direction:column;gap:10px">${rows.filter(r=>r[1]).map(([k,v])=>`<div><div style="color:var(--fg3);font-size:12px;font-weight:700">${esc(k)}</div><div style="font-weight:600;overflow-wrap:anywhere;user-select:text;-webkit-user-select:text">${esc(v)}</div></div>`).join('')}</div><div class="row2"><button type="submit" class="btn pri">Close</button></div></form>`;
  $('form',d).onsubmit=e=>{e.preventDefault();d.hidden=true;d.innerHTML=''};
  d.onclick=e=>{if(e.target===d){d.hidden=true;d.innerHTML=''}};
}
const sizeTxt=n=>n>1048576?(n/1048576).toFixed(1)+' MB':Math.round(n/1024)+' KB';
function songInfo(t){showInfo(tTitle(t),[['Artist',t.artist],['Album',t.album],['Genre',t.genre],['Year',t.year||''],['Track number',t.tn||''],['Folder',dirOf(t.path)],['File',t.name],['Size',t.size?sizeTxt(t.size):'']])}

/* ---- playlists ---- */
function savePl(){saveData('playlists')}
async function pickPlaylist(tracks){
  const items=[{ic:'plus',label:'New playlist…',fn:async()=>{
    const name=await askText('New playlist','','Create'); if(!name)return;
    const p={id:'p'+Date.now().toString(36),name,keys:[]}; data.playlists.push(p); addToPl(p,tracks);
  }}];
  for(const p of data.playlists)items.push({ic:'list',label:p.name,small:String(p.keys.length),fn:()=>addToPl(p,tracks)});
  openMenu({title:'Add to playlist',sub:tracks.length>1?plural(tracks.length,'song'):tTitle(tracks[0]),items});
}
function addToPl(p,tracks){
  let n=0; for(const t of tracks)if(!p.keys.includes(t.key)){p.keys.push(t.key);n++}
  savePl(); toast(n?`Added to ${p.name}`:`Already in ${p.name}`); if(S.stack.length||S.tab==='playlists')renderAll(true);
}
async function newPlaylist(){
  const name=await askText('New playlist','','Create'); if(!name)return;
  data.playlists.push({id:'p'+Date.now().toString(36),name,keys:[]}); savePl(); renderAll(true);
}

/* ---- track and collection menus ---- */
function trackMenu(t,ctx){
  const items=[
    {ic:'next1',label:'Play next',fn:()=>playNext([t])},
    {ic:'queue',label:'Add to queue',fn:()=>addToQueue([t])},
    {ic:'list',label:'Add to playlist',fn:()=>pickPlaylist([t])},
    {ic:'heart',label:isFav(t)?'Remove from favourites':'Add to favourites',fn:()=>toggleFav(t)},
  ];
  const al=S.albumMap.get(t.album?t.album.toLowerCase():'~'+dirOf(t.path)); if(al)items.push({ic:'album',label:'Go to album',fn:()=>{closeAllSheets();openDetail('album',al.key)}});
  const ar=S.artistMap.get((t.artist||'').toLowerCase()||'~'); if(ar&&t.artist)items.push({ic:'artist',label:'Go to artist',fn:()=>{closeAllSheets();openDetail('artist',ar.key)}});
  if(ctx&&ctx.user)items.push({ic:'trash',label:'Remove from this playlist',danger:true,fn:()=>{ctx.user.keys=ctx.user.keys.filter(k=>k!==t.key);savePl();renderAll(true)}});
  items.push({ic:'look',label:'Change cover',fn:()=>openCoverPicker('t',t.key,tTitle(t),tTitle(t))});
  items.push({ic:'info',label:'Song details',fn:()=>songInfo(t)});
  openMenu({title:tTitle(t),sub:tSub(t),art:coverSmall(t),hue:t.hue,items});
}
function collectionMenu(name,sub,art,hue,tracks,extra=[]){
  openMenu({title:name,sub,art,hue,items:[
    {ic:'play',label:'Play',fn:()=>playTracks(tracks,0,name)},
    {ic:'shuffle',label:'Shuffle',fn:()=>playShuffled(tracks,name)},
    {ic:'next1',label:'Play next',fn:()=>playNext(tracks)},
    {ic:'queue',label:'Add to queue',fn:()=>addToQueue(tracks)},
    {ic:'list',label:'Add to playlist',fn:()=>pickPlaylist(tracks)},
    ...extra]});
}
function cardMenu(kind,key){
  const d=detailOf({kind,key}); if(!d||!d.tracks.length)return;
  collectionMenu(d.title,d.meta,artsOf(d.tracks,1)[0],d.hue,d.tracks,kind==='folder'?[{ic:'look',label:'Change folder cover',fn:()=>openCoverPicker('f',key,key,key)}]:d.user?[{ic:'edit',label:'Rename',fn:()=>renamePl(d.user)},{ic:'trash',label:'Delete playlist',danger:true,fn:()=>delPl(d.user)}]:[]);
}
async function renamePl(p){const n=await askText('Rename playlist',p.name,'Rename');if(!n)return;p.name=n;savePl();renderAll(true)}
function delPl(p){
  openMenu({title:`Delete “${p.name}”?`,sub:'The songs stay in your library.',items:[{ic:'trash',label:'Delete playlist',danger:true,fn:()=>{data.playlists=data.playlists.filter(x=>x!==p);savePl();if(S.stack.length)S.stack.pop();renderAll(false);toast('Playlist deleted')}},{ic:'x',label:'Keep it',fn:()=>{}}]});
}
function sortMenu(){const k=SORTS[S.tab];if(!k)return;openChoice('Sort by',k,prefs.sort[S.tab],v=>{prefs.sort[S.tab]=v;savePrefs();renderAll(false)})}

/* ============ clicks and long-press inside the library ============ */
function listOf(el){const l=S.lists[+el.dataset.l];return l?{l,i:+el.dataset.i}:null}
view.addEventListener('click',e=>{
  if(S.suppress){S.suppress=false;return}
  const act=e.target.closest('[data-act]');
  if(act&&view.contains(act)){
    const a=act.dataset.act, row=act.closest('[data-k]'), t=row&&T(row.dataset.k);
    if(a==='rowfav'&&t){toggleFav(t);e.stopPropagation();return}
    if(a==='rowmore'&&t){trackMenu(t,S.detail&&S.detail.user?{user:S.detail.user}:null);e.stopPropagation();return}
    if(a==='goto'){const v=act.dataset.v;if(SMART[v]){openDetail('playlist',v)}else goTab(v);e.stopPropagation();return}
    if(a==='shuffleall'){playShuffled(S.tracks,'All songs');e.stopPropagation();return}
    if(a==='dplay'){playTracks(S.detail.tracks,0,S.detail.title);e.stopPropagation();return}
    if(a==='dshuffle'){playShuffled(S.detail.tracks,S.detail.title);e.stopPropagation();return}
    if(a==='dmore'){const d=S.detail;collectionMenu(d.title,d.meta,artsOf(d.tracks,1)[0],d.hue,d.tracks,d.folder?[{ic:'look',label:'Change folder cover',fn:()=>openCoverPicker('f',d.folder,d.title,d.title)}]:d.user?[{ic:'edit',label:'Rename',fn:()=>renamePl(d.user)},{ic:'trash',label:'Delete playlist',danger:true,fn:()=>delPl(d.user)}]:[]);e.stopPropagation();return}
    if(a==='newpl'){newPlaylist();e.stopPropagation();return}
    return;
  }
  const card=e.target.closest('.card[data-d]');
  if(card){openDetail(card.dataset.d,card.dataset.k);return}
  const el=e.target.closest('[data-l]');
  if(el){const r=listOf(el);if(r)playTracks(r.l,r.i,r.l===S.detailTracks&&S.detail?S.detail.title:(S.q.trim()?'Search':S.tab==='songs'?'All songs':'For you'))}
});
view.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.row')){const r=listOf(e.target);if(r)playTracks(r.l,r.i,'All songs')}});
(()=>{
  let timer=0,sx=0,sy=0;
  const clear=()=>{clearTimeout(timer);timer=0};
  view.addEventListener('pointerdown',e=>{
    const el=e.target.closest('.card[data-d],.card[data-l],.row');
    if(!el||e.target.closest('[data-act]'))return;
    sx=e.clientX;sy=e.clientY; clear();
    timer=setTimeout(()=>{
      timer=0; S.suppress=true; setTimeout(()=>{S.suppress=false},700);
      if(navigator.vibrate)try{navigator.vibrate(12)}catch(x){}
      if(el.dataset.d)cardMenu(el.dataset.d,el.dataset.k);
      else{const t=T(el.dataset.k);if(t)trackMenu(t,S.detail&&S.detail.user?{user:S.detail.user}:null)}
    },520);
  });
  view.addEventListener('pointermove',e=>{if(timer&&(Math.abs(e.clientX-sx)>10||Math.abs(e.clientY-sy)>10))clear()});
  ['pointerup','pointercancel','pointerleave'].forEach(n=>view.addEventListener(n,clear));
  view.addEventListener('contextmenu',e=>e.preventDefault());
})();
