'use strict';
const entries=ARCHIVE.entries.map(e=>({...e,pageTitle:e.title,title:e.category==='映画'?(e.originalTitle?.trim()||e.title):e.title})),grid=document.querySelector('#collection-grid'),search=document.querySelector('#search'),filters=document.querySelector('.filters'),detailDialog=document.querySelector('#detail-dialog'),aboutDialog=document.querySelector('#about-dialog');
let activeFilter='all',displayLimit=12;
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isJapanese=v=>/[\u3040-\u30ff\u3400-\u9fff]/.test(v);
const pad=v=>String(v).padStart(2,'0');
const formatDate=v=>v?v.slice(0,10).replaceAll('-','.'):'UNDATED';
const categoryNames={'all':'All objects','映画':'Cinema','音楽':'Music','アート':'Art','舞台・ライブ':'Live','建築':'Architecture','ゲーム':'Games','本':'Books','その他':'Other'};
const ratingText=e=>e.ratingLabel.replace('殿堂入り','Hall of fame').replace('未評価','Unrated').replace('未記録','Unrated');
const safeURL=v=>{try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:'';}catch{return '';}};
// The object edition uses short panel transitions; other editions keep native dialogs.
const floatingEdition=document.documentElement.dataset.edition==='floating';
const dialogClosures=new WeakMap(),dialogOpeners=new WeakMap();
function openArchiveDialog(dialog){
 if(dialog.open)return;
 dialogOpeners.set(dialog,document.activeElement);
 dialog.classList.remove('is-closing');dialog.showModal();dialog.scrollTop=0;
}
function closeArchiveDialog(dialog){
 if(dialogClosures.has(dialog))return dialogClosures.get(dialog);
 if(!dialog.open)return Promise.resolve();
 const finish=()=>{
  dialog.close();dialog.classList.remove('is-closing');
  const opener=dialogOpeners.get(dialog);if(opener?.isConnected)opener.focus({preventScroll:true});
 };
 if(!floatingEdition||matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return Promise.resolve();}
 const closing=new Promise(resolve=>{
  dialog.classList.add('is-closing');
  setTimeout(()=>{finish();dialogClosures.delete(dialog);resolve();},160);
 });
 dialogClosures.set(dialog,closing);return closing;
}
const palettes={'映画':'cinema','音楽':'music','アート':'art','建築':'architecture','舞台・ライブ':'live','ゲーム':'game','本':'book','その他':'other'};
function coverMarkup(e,eager=false){
 const n=pad(entries.indexOf(e)+1);
 if(e.cover)return `<div class="cover cover-photo ${e.source==='music'?'is-album':''}"><img src="${escapeHTML(e.cover)}" alt="${escapeHTML(e.title)} — cover artwork" ${eager?'':'loading="lazy"'}><span class="photo-number" aria-hidden="true">M / ${n}</span></div>`;
 return `<div class="cover cover-typographic palette-${palettes[e.category]||'other'}" aria-hidden="true"><span class="cover-index">M / ${n}</span><span class="fallback-shape"></span><span class="real-cover-title${isJapanese(e.title)?' japanese':''}${e.title.length>28?' long-title':''}">${escapeHTML(e.title)}</span><span class="cover-year">${e.label} / TEXT EDITION</span></div>`;
}
function inlineMarkdown(text){
 return text.split(/(\[[^\]]+\]\(https?:\/\/[^\s]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).map(part=>{
  const link=part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s]+)\)$/);
  if(link){const u=safeURL(link[2]);return u?`<a href="${escapeHTML(u)}" target="_blank" rel="noopener noreferrer">${escapeHTML(link[1])} ↗</a>`:escapeHTML(link[1]);}
  if(part.startsWith('**')&&part.endsWith('**'))return `<strong>${escapeHTML(part.slice(2,-2))}</strong>`;
  if(part.startsWith('`')&&part.endsWith('`'))return `<code>${escapeHTML(part.slice(1,-1))}</code>`;
  return escapeHTML(part);
 }).join('');
}
// Hide unfilled template sections, preserving written content and the source snapshot.
function omitEmptySections(markdown){
 const optional=new Set(['感想','好きだった点 / いまいちだった点','お気に入りの曲','メモ','お気に入りの一節・シーン','次に観たい・読みたいもの','批評家スコア']);
 const lines=markdown.replaceAll('\r','').split('\n').filter(line=>!/^\s*(?:[-*+]\s+|\d+\.\s+)?(?:Pitchfork|Metacritic)\s*[:：]\s*$/i.test(line.replace(/\*\*/g,'')));
 const heading=line=>line.match(/^(#{1,6})\s+(.+)$/);
 const hasContent=line=>{
  const text=line.trim().replace(/^>\s*/,'').replace(/^(?:[-*+]\s*|\d+\.\s*)/,'').replace(/^\[[ xX]\]\s*/,'').replace(/\*\*/g,'').trim();
  return !!text&&!/^[-*_]+$/.test(text)&&!heading(text)&&!/^(?:好き|いまいち)\s*[:：]\s*$/.test(text);
 };
 for(let i=lines.length-1;i>=0;i--){
  const h=heading(lines[i]);if(!h||!optional.has(h[2].trim().replace(/\s*[／/]\s*/g,' / ')))continue;
  let end=i+1;while(end<lines.length){const next=heading(lines[end]);if(next&&next[1].length<=h[1].length)break;end++;}
  if(!lines.slice(i+1,end).some(hasContent))lines.splice(i,end-i);
 }
 return lines.join('\n');
}
// Escape source content before rendering. Notion HTML is never executed.
function renderMarkdown(markdown){
 let html='',paragraph=[],list=null;
 const flush=()=>{if(paragraph.length){html+=`<p>${paragraph.map(inlineMarkdown).join('<br>')}</p>`;paragraph=[];}};
 const closeList=()=>{if(list){html+=`</${list}>`;list=null;}};
 for(const line of omitEmptySections(markdown).split('\n')){
  if(!line.trim()){flush();closeList();continue;}
  const h=line.match(/^(#{1,6})\s+(.+)$/);
  if(h){flush();closeList();const n=h[1].length<=2?3:4;html+=`<h${n}>${inlineMarkdown(h[2])}</h${n}>`;continue;}
  if(/^---+$/.test(line.trim())){flush();closeList();html+='<hr>';continue;}
  const item=line.match(/^\s*(?:([-*])\s+|\d+\.\s+)(.*)$/);
  if(item){flush();const kind=item[1]?'ul':'ol';if(list!==kind){closeList();html+=`<${kind}>`;list=kind;}html+=`<li>${inlineMarkdown(item[2])}</li>`;continue;}
  if(/^>/.test(line)){flush();closeList();const q=line.replace(/^>\s?/,'');if(q.trim())html+=`<blockquote>${inlineMarkdown(q)}</blockquote>`;continue;}
  closeList();paragraph.push(line);
 }
 flush();closeList();return html;
}
function initFilters(){
 const order=['all','映画','音楽','アート','舞台・ライブ','建築','ゲーム','本','その他'];
 filters.innerHTML=order.filter(c=>c==='all'||entries.some(e=>e.category===c)).map(c=>`<button class="filter${c==='all'?' active':''}" data-filter="${escapeHTML(c)}" aria-pressed="${c==='all'}">${categoryNames[c]} <sup>${pad(c==='all'?entries.length:entries.filter(e=>e.category===c).length)}</sup></button>`).join('');
}
function cardMarkup(e){
 const date=e.source==='music'?e.releaseDate:e.experiencedDate;
 if(document.documentElement.dataset.edition==='floating')return `<article class="object-card"><button class="object-open" data-entry="${e.id}" aria-label="Read the note: ${escapeHTML(e.title)}"><span class="object-index">${pad(entries.indexOf(e)+1)}</span>${coverMarkup(e)}<span class="object-caption"><span class="object-title"${isJapanese(e.title)?' lang="ja"':''}>${escapeHTML(e.title)}</span><span class="object-label">${e.label}</span><span class="object-rating">${escapeHTML(ratingText(e))}</span></span><span class="hover-label" aria-hidden="true">Open ↗</span></button></article>`;
 return `<article class="object-card"><button class="object-open" data-entry="${e.id}" aria-label="Read the note: ${escapeHTML(e.title)}">${coverMarkup(e)}<div class="card-content"><div class="object-meta"><span>${e.label}</span><span>${date?`${e.source==='music'?'RELEASED':'EXPERIENCED'} ${formatDate(date)}`:'UNDATED'}</span></div><h3 class="object-title${isJapanese(e.title)?' jp':''}"${isJapanese(e.title)?' lang="ja"':''}>${escapeHTML(e.title)}</h3><p class="object-creator">${escapeHTML(e.creator||'Creator unrecorded')}</p><p class="card-excerpt${e.note?'':' is-empty'}"${isJapanese(e.note)?' lang="ja"':''}>${escapeHTML(e.note||'No note.')}</p><div class="object-bottom"><span class="card-rating${e.hallOfFame?' is-favorite':''}">${e.hallOfFame?'◇ ':''}${escapeHTML(ratingText(e))}${e.hallOfFame&&e.source==='music'?' · GOAT':''}</span><span class="card-read">Read note <span class="card-arrow" aria-hidden="true">↗</span></span></div></div></button></article>`;
}
function render(append=false){
 if(!append)document.querySelector('#load-status').textContent='';
 const q=search.value.trim().normalize('NFKC').toLocaleLowerCase('ja');
 let visible=entries.filter(e=>(activeFilter==='all'||e.category===activeFilter)&&[e.title,e.pageTitle,e.originalTitle,e.creator,e.category,e.label,e.note,...e.tags].join(' ').normalize('NFKC').toLocaleLowerCase('ja').includes(q));
 const shown=visible.slice(0,displayLimit);
 const previousCount=append?grid.children.length:0;
 // Keep existing DOM, image state, reveal state and scroll position when extending.
 if(append)grid.insertAdjacentHTML('beforeend',shown.slice(previousCount).map(cardMarkup).join(''));
 else grid.innerHTML=shown.map(cardMarkup).join('');
 document.querySelector('#result-count').textContent=`${pad(visible.length)} OBJECTS${q||activeFilter!=='all'?' / FILTERED':''}`;
 document.querySelector('#empty-state').hidden=visible.length>0;
 const more=document.querySelector('#load-more');more.hidden=shown.length>=visible.length;more.innerHTML=`Load more <span class="remaining-count">${visible.length-shown.length} remaining</span><span aria-hidden="true">↓</span>`;
 document.querySelector('#shown-count').textContent=visible.length?`${shown.length} / ${visible.length} RECORDS`:'';
 if(append){
  document.querySelector('#load-status').textContent=`${shown.length-previousCount} more records added. Showing ${shown.length} of ${visible.length}.`;
  // Continue keyboard reading at the newly inserted content without scrolling.
  grid.children[previousCount]?.querySelector('button').focus({preventScroll:true});
 }
}
function detailSources(e){
 const links=Object.entries(e.links).filter(([,u])=>safeURL(u));
 const scores=new Map(),extraFacts=[];
 const scoreText=(label,value)=>{
  const text=String(value??'').trim();if(!text)return '';
  const n=text.match(/^(\d+(?:\.\d+)?)(?:\s*(%|\/\s*\d+))?(.*)$/);
  if(!n)return text;
  const unit=n[2]||(label.startsWith('Rotten Tomatoes')?'%':label==='Metacritic'?'/ 100':'/ 10');
  return `${n[1]}${unit==='%'?'%':' '+unit}${n[3]}`;
 };
 for(const[label,value]of Object.entries(e.scores||{})){const text=scoreText(label,value);if(text)scores.set(label,text);}
 const body=[],review=[];let sectionLevel=0;
 for(const line of (e.body||'').replaceAll('\r','').split('\n')){
  const heading=line.match(/^(#{1,6})\s+(.+)$/);
  if(heading&&sectionLevel&&heading[1].length<=sectionLevel)sectionLevel=0;
  if(heading&&heading[2].trim()==='批評家スコア'){sectionLevel=heading[1].length;continue;}
  (sectionLevel?review:body).push(line);
 }
 for(const line of review){
  for(const[,label,url]of line.matchAll(/\[([^\]]+)\]\((https?:\/\/[^\s]+)\)/g)){
   if(!safeURL(url))continue;
   const host=new URL(url).hostname.replace(/^www\./,'');
   const name=host==='pitchfork.com'?'Pitchfork':host==='metacritic.com'?'Metacritic':host==='rottentomatoes.com'?'Rotten Tomatoes':label;
   if(!links.some(([,u])=>safeURL(u)===safeURL(url)))links.push([name,url]);
  }
  const text=line.replace(/^\s*(?:[-*]\s+|>\s*)/,'').replace(/\[([^\]]+)\]\(https?:\/\/[^\s]+\)/g,'$1').replace(/\*\*/g,'').trim();
  if(!text||/^[-*_]+$/.test(text)||/^出典\s*[:：]/.test(text))continue;
  const score=text.match(/^(Pitchfork|Metacritic|Rotten Tomatoes)([^:：]*)[:：]\s*(.*)$/);
  if(score){
   const name=score[1]==='Rotten Tomatoes'&&/オーディエンス|audience/i.test(score[2])?'Rotten Tomatoes / Audience':score[1];
   const value=scoreText(name,score[3]);if(value)scores.set(name,value);continue;
  }
  const fact=text.match(/^([^:：]+)[:：]\s*(.+)$/);
  if(fact)extraFacts.push([fact[1]==='参照日'?'SCORES CHECKED ON':fact[1]==='プラットフォーム'?'PLATFORM':fact[1],fact[2]]);
  else if(!/^#/.test(text))extraFacts.push(['REVIEW NOTE',text]);
 }
 return {links,body:body.join('\n'),reviewFacts:[...scores,...extraFacts]};
}
function showEntry(id){
 const e=entries.find(item=>item.id===id);if(!e)return;
 const facts=[['PERSONAL RATING',e.ratingLabel],[e.source==='music'?'RELEASED ON':'EXPERIENCED ON',formatDate(e.source==='music'?e.releaseDate:e.experiencedDate)]];
 if(e.format)facts.push(['FORMAT',e.format]);
 const {links,body,reviewFacts}=detailSources(e);
 const checkedOn=reviewFacts.filter(([k])=>k==='SCORES CHECKED ON').map(([,v])=>v);
 facts.push(...reviewFacts.filter(([k])=>k!=='SCORES CHECKED ON'));
 const scoreContext=checkedOn.length?`<span class="score-context">Checked ${checkedOn.map(v=>escapeHTML(formatDate(v))).join(', ')}. Scores may change.</span>`:'';
 document.querySelector('#detail-content').innerHTML=`<div class="detail-layout"><div class="detail-visual">${coverMarkup(e,true)}</div><div class="detail-body"><h2 id="detail-title" class="${isJapanese(e.title)?'jp':''}">${escapeHTML(e.title)}</h2>${e.originalTitle?.trim() && e.originalTitle.trim()!==e.title?`<p class="original-title">${escapeHTML(e.originalTitle)}</p>`:''}<p class="detail-creator">${escapeHTML(e.creator||'Creator unrecorded')}</p><div class="detail-tags">${e.tags.map(t=>`<span>${escapeHTML(t)}</span>`).join('')}</div><p class="detail-note${e.note?'':' note-empty'}">${e.note?escapeHTML(e.note):'No note has been recorded yet.'}</p><dl class="detail-facts">${facts.map(([k,v])=>`<div><dt>${escapeHTML(k)}</dt><dd>${escapeHTML(v)}</dd></div>`).join('')}</dl><div class="source-links">${links.map(([k,u])=>`<a href="${escapeHTML(safeURL(u))}" target="_blank" rel="noopener noreferrer">${k==='リンク'?'Listen online':escapeHTML(k)} ↗</a>`).join('')}</div></div></div><section class="entry-body">${body?renderMarkdown(body):'<p class="note-empty">This record has no written entry yet.</p>'}</section><p class="detail-disclaimer"><a href="${escapeHTML(safeURL(e.url))}" target="_blank" rel="noopener noreferrer">Open original in Notion</a>${scoreContext}</p>`;
 openArchiveDialog(detailDialog);
}
function renderFavorites(){
 if(!document.querySelector('.favorite-grid'))return;
 const favorites=entries.filter(e=>e.hallOfFame);
 document.querySelector('.favorite-grid').innerHTML=favorites.map((e,i)=>`<button class="favorite" data-entry="${e.id}" aria-label="Hall of fame: ${escapeHTML(e.title)}"><span class="favorite-number">${['I.','II.','III.','IV.'][i]||i+1}</span><div class="round-art ${e.cover?'':'round-fallback'}">${e.cover?`<img src="${escapeHTML(e.cover)}" alt="${escapeHTML(e.title)} — cover artwork" loading="lazy">`:`<span>${escapeHTML(e.originalTitle||e.title)}</span>`}</div><span class="favorite-kind">${e.label} / ${e.source==='music'?'GOAT':'ALL-TIME BEST'}</span><h3 class="${isJapanese(e.title)?'jp':''}">${escapeHTML(e.title)}</h3><span class="favorite-link">${escapeHTML(ratingText(e))} <span aria-hidden="true">↗</span></span></button>`).join('');
 document.querySelector('#favorites-count').textContent=`${pad(favorites.length)} PERSONAL FAVORITES`;
}
filters.addEventListener('click',event=>{const b=event.target.closest('[data-filter]');if(!b)return;activeFilter=b.dataset.filter;displayLimit=12;filters.querySelectorAll('[data-filter]').forEach(item=>{const selected=item===b;item.classList.toggle('active',selected);item.setAttribute('aria-pressed',String(selected));});render();});
search.addEventListener('input',()=>{displayLimit=12;render();});
document.querySelector('#load-more').addEventListener('click',()=>{displayLimit+=12;render(true);});
document.addEventListener('click',event=>{const b=event.target.closest('[data-entry]');if(b)showEntry(b.dataset.entry);});
document.querySelector('#reset-search').addEventListener('click',()=>{search.value='';filters.querySelector('[data-filter="all"]').click();search.focus();});
for(const id of ['about-open','credits-open'])document.getElementById(id)?.addEventListener('click',()=>{if(floatingEdition&&id==='about-open')return;openArchiveDialog(aboutDialog);});
document.querySelectorAll('dialog').forEach(dialog=>{
 dialog.querySelector('.dialog-close').addEventListener('click',()=>closeArchiveDialog(dialog));
 let backdropStart=false;
 const outside=event=>{const r=dialog.getBoundingClientRect();return event.target===dialog&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
 dialog.addEventListener('pointerdown',event=>{backdropStart=outside(event);});
 dialog.addEventListener('click',event=>{if(backdropStart&&outside(event))closeArchiveDialog(dialog);backdropStart=false;});
 dialog.addEventListener('cancel',event=>{if(floatingEdition){event.preventDefault();closeArchiveDialog(dialog);}});
 dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow='';});
 new MutationObserver(()=>{if(dialog.open)document.body.style.overflow='hidden';}).observe(dialog,{attributes:true,attributeFilter:['open']});
});
document.addEventListener('keydown',event=>{if(event.key==='/'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){event.preventDefault();search.focus();search.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}});
document.addEventListener('error',event=>{const img=event.target;if(img.tagName!=='IMG'||!img.closest('.cover-photo'))return;const card=img.closest('.cover-photo');card.classList.add('image-unavailable','cover-typographic');card.classList.remove('cover-photo');img.remove();const label=document.createElement('span');label.className='real-cover-title';label.textContent=img.alt.replace(/ — cover artwork$/,'');card.append(label);},true);
initFilters();renderFavorites();render();
document.querySelectorAll('[data-snapshot-date]').forEach(item=>item.textContent=ARCHIVE.snapshotDate);
if(document.querySelector('#archive-total'))document.querySelector('#archive-total').textContent=`${pad(entries.length)} OBJECTS / 02 COLLECTIONS`;
