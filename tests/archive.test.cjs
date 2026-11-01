const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(process.env.ARCHIVE_SOURCE||path.join(__dirname,'../archive.js'),'utf8');
const context=vm.createContext({collectionScope:'collection',activeFilters:new Set(),activeRatings:new Set()});
vm.runInContext(source.slice(source.indexOf('function isLegacy'),source.indexOf('function updateRatingButtons')),context);
const select=(...values)=>new Set(values);
test('Legacy follows the checkbox regardless of dates',()=>{
 assert.equal(context.isLegacy({legacy:false,sortDate:'1990-01-01'}),false);
 assert.equal(context.isLegacy({legacy:true,sortDate:'2026-01-01'}),true);
 assert.equal(context.isLegacy({sortDate:'1990-01-01'}),false);
});
test('media filters combine independently from Collection, Legacy and Both scope',()=>{
 const film={category:'Cinema',legacy:false},music={category:'Music',legacy:true},selected=select('Cinema','Music');
 context.collectionScope='collection';assert(context.matchesCollectionFilter(film,selected));assert(!context.matchesCollectionFilter(music,selected));
 context.collectionScope='legacy';assert(!context.matchesCollectionFilter(film,selected));assert(context.matchesCollectionFilter(music,selected));
 context.collectionScope='both';assert(context.matchesCollectionFilter(film,selected));assert(context.matchesCollectionFilter(music,selected));
 assert(!context.matchesCollectionFilter(music,select('Cinema')));assert(context.matchesCollectionFilter(music,select()));
 context.collectionScope='collection';
});

test('scope counts follow active media and ratings and update the selected scope help',()=>{
 const button=scope=>({dataset:{scope},classList:{toggle(){}},setAttribute(key,value){this[key]=value;},count:{textContent:''},querySelector(){return this.count;}});
 const buttons=['collection','legacy','both'].map(button),help={textContent:''};
 const local=vm.createContext({collectionScope:'collection',activeFilters:select(),activeRatings:select(),entries:[
  {category:'Cinema',rating:9},{category:'Cinema',legacy:true,rating:9,hallOfFame:true},
  {category:'Music',rating:8,hallOfFame:true},{category:'Music',legacy:true,rating:null}
 ],pad:v=>String(v).padStart(2,'0'),filters:{querySelectorAll:()=>[]},document:{querySelectorAll:()=>buttons,querySelector:()=>help}});
 vm.runInContext(source.match(/const filterHelp=.+;/)[0],local);
 vm.runInContext(source.slice(source.indexOf('function isLegacy'),source.indexOf('function updateRatingButtons')),local);
 vm.runInContext(source.slice(source.indexOf('function updateFilterButtons'),source.indexOf('function cardMarkup')),local);
 const counts=()=>buttons.map(b=>b.count.textContent);
 local.updateFilterButtons();assert.deepEqual(counts(),['02','01','03']);assert.equal(help.textContent,'Current records.');
 local.activeFilters=select('Cinema');local.updateFilterButtons();assert.deepEqual(counts(),['01','01','02']);
 local.activeRatings=select('goat');local.collectionScope='legacy';local.updateFilterButtons();
 assert.deepEqual(counts(),['00','01','01']);assert.equal(help.textContent,'Earlier records kept in a separate archive.');
 assert.equal(buttons[1]['aria-pressed'],'true');assert.equal(buttons[0]['aria-pressed'],'false');
 local.activeFilters.clear();local.activeRatings=select('score-8','score-9');local.collectionScope='both';local.updateFilterButtons();
 assert.deepEqual(counts(),['02','01','03']);assert.equal(help.textContent,'All current and legacy records.');
 local.activeRatings.clear();local.updateFilterButtons();assert.deepEqual(counts(),['02','01','03']);
});

test('scores and GOAT combine for every source, preserving zero versus missing',()=>{
 for(const source of ['movies','games','books','art','live','arch','music']){
  assert(context.matchesRating({source,rating:8},select('score-8','score-9')));
  assert(!context.matchesRating({source,rating:7},select('score-8','score-9')));
  assert(context.matchesRating({source,rating:7,hallOfFame:true},select('goat','score-9')));
 }
 assert(context.matchesRating({rating:0},select('score-0')));
 assert(!context.matchesRating({rating:null},select('score-0')));
});

test('unrated entries require explicit selection and combine with GOAT or scores, including zero',()=>{
 for(const entry of [{rating:null},{},{rating:null,hallOfFame:true}]){
  assert(!context.matchesRating(entry,select()));
  assert(!context.matchesRating(entry,select('goat','score-0')));
  assert(context.matchesRating(entry,select('unrated')));
  assert(context.matchesRating(entry,select('unrated','score-8')));
  assert(context.matchesRating(entry,select('unrated','goat')));
 }
 for(const rating of [0,8,10]){
  assert(context.matchesRating({rating},select()));
  assert(!context.matchesRating({rating},select('unrated')));
 }
 assert(context.matchesRating({rating:8},select('unrated','score-8')));
});

// Run the complete script against distinct, selector-aware nodes and dispatch
// bubbling events so these checks cover the public controls and their wiring.
function archiveDOM(entryData){
 class Element{
  constructor({id='',className='',dataset={}}={}){
   this.id=id;this.dataset=dataset;this.children=[];this.parentElement=null;
   this.textContent='';this.value='';this.attributes={};this.listeners={};
   const classes=new Set(className.split(' ').filter(Boolean));
   this.classList={contains:v=>classes.has(v),toggle(v,on){if(on)classes.add(v);else classes.delete(v);}};
  }
  append(child){child.parentElement=this;this.children.push(child);return child;}
  matches(selector){
   if(selector.startsWith('#'))return this.id===selector.slice(1);
   if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));
   const data=selector.match(/^\[data-([\w-]+)(?:="([^"]+)")?\]$/);
   if(data){const key=data[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());return key in this.dataset&&(data[2]===undefined||this.dataset[key]===data[2]);}
   return this.tagName===selector.toUpperCase();
  }
  querySelectorAll(selector){
   const parts=selector.split(' '),last=parts.pop(),found=[];
   const visit=node=>{for(const child of node.children){
    if(child.matches(last)){
     let ancestor=child.parentElement,index=parts.length-1;
     while(ancestor&&index>=0){if(ancestor.matches(parts[index]))index--;ancestor=ancestor.parentElement;}
     if(index<0)found.push(child);
    }
    visit(child);
   }};
   visit(this);return found;
  }
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  closest(selector){return this.matches(selector)?this:this.parentElement?.closest(selector)||null;}
  setAttribute(key,value){this.attributes[key]=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  addEventListener(type,listener){(this.listeners[type]??=[]).push(listener);}
  dispatchEvent(event){if(!event.target)event.target=this;for(const listener of this.listeners[event.type]||[])listener(event);if(event.bubbles)this.parentElement?.dispatchEvent(event);}
  click(){this.dispatchEvent({type:'click',bubbles:true});}
  focus(){document.activeElement=this;}
  get innerHTML(){return this.html||'';}
  set innerHTML(html){
   this.html=html;this.children=[];
   // Only filter containers need generated children for these interactions.
   if(!this.classList.contains('filters')&&!this.classList.contains('rating-options'))return;
   for(const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)){
    const dataset={};for(const [,key,value]of match[1].matchAll(/data-([\w]+)="([^"]*)"/g))dataset[key]=value;
    const button=this.append(new Element({dataset}));button.tagName='BUTTON';
    button.setAttribute('aria-pressed','false');
    if(match[2].includes('<sup>')){const sup=button.append(new Element());sup.tagName='SUP';}
   }
  }
 }
 const document=new Element();document.documentElement=new Element();
 document.getElementById=id=>document.querySelector(`#${id}`);
 const add=(parent,id,extra={})=>parent.append(new Element({id,...extra}));
 for(const id of ['collection-grid','search','load-status','result-count','empty-state','load-more','shown-count','reset-search','menu-result','view-results','menu-reset'])add(document,id);
 const scope=add(document,'collection-scope');
 for(const value of ['collection','legacy','both']){
  const button=add(scope,'',{dataset:{scope:value}});button.tagName='BUTTON';
  const sup=add(button,'');sup.tagName='SUP';
 }
 add(document,'scope-help');
 add(document,'',{className:'filters'});
 const ratings=add(document,'rating-filters');
 add(ratings,'goat-help');add(ratings,'rating-summary');add(ratings,'rating-clear');
 add(ratings,'',{dataset:{rating:'goat'}});add(ratings,'',{dataset:{rating:'unrated'}});
 const scoreGroup=add(ratings,'',{dataset:{ratingGroup:'score'}});
 add(scoreGroup,'',{className:'rating-options'});
 const entries=[
  {title:'Needle',category:'映画',rating:9},
  {title:'Current film',category:'映画',rating:8},
  {title:'Earlier film',category:'映画',rating:9,legacy:true},
  {title:'Current music',category:'音楽',rating:8},
  {title:'Earlier music',category:'音楽',rating:9,legacy:true},
  {title:'Unrated music',category:'音楽',rating:null,legacy:true}
 ].map((entry,id)=>({...entry,id:String(id),tags:[],label:'TEST'}));
 const local=vm.createContext({document,ARCHIVE:{entries:entryData||entries},window:{},MutationObserver:class{observe(){}}});
 vm.runInContext(source,local);
 const floating=fs.readFileSync(path.join(__dirname,'../floating.js'),'utf8');
 vm.runInContext(floating.slice(floating.indexOf(' const menuResult='),floating.indexOf(" document.querySelector('#search').addEventListener('keydown'")),local);
 document.refreshMenu=()=>vm.runInContext('updateResults()',local);
 return document;
}

function assertScopeDOM(document,counts,help,scope,medium='all',rating=null){
 assert.deepEqual(document.querySelectorAll('[data-scope]').map(button=>button.querySelector('sup').textContent),counts);
 assert.equal(document.querySelector('#scope-help').textContent,help);
 for(const [attribute,selected]of [['scope',scope],['filter',medium],['rating',rating]]){
  for(const button of document.querySelectorAll(`[data-${attribute}]`)){
   assert.equal(button.getAttribute('aria-pressed'),String(button.dataset[attribute]===selected),`${attribute} ${button.dataset[attribute]}`);
   assert.equal(button.classList.contains('active'),button.dataset[attribute]===selected);
  }
 }
}

test('scope, medium and rating clicks refresh counts and help, and public reset restores Collection',()=>{
 const document=archiveDOM();
 assertScopeDOM(document,['03','02','05'],'Current records.','collection');
 // Click the nested count to also exercise delegated closest('[data-scope]').
 document.querySelector('[data-scope="legacy"]').querySelector('sup').click();
 assertScopeDOM(document,['03','02','05'],'Earlier records kept in a separate archive.','legacy');
 document.querySelector('[data-filter="映画"]').click();
 assertScopeDOM(document,['02','01','03'],'Earlier records kept in a separate archive.','legacy','映画');
 document.querySelector('[data-rating="score-9"]').click();
 assertScopeDOM(document,['01','01','02'],'Earlier records kept in a separate archive.','legacy','映画','score-9');
 document.querySelector('#search').value='Earlier';
 document.querySelector('#reset-search').click();
 assert.equal(document.querySelector('#search').value,'');
 assertScopeDOM(document,['03','02','05'],'Current records.','collection');
 assert.equal(document.querySelector('#result-count').textContent,'03 OBJECTS / COLLECTION');
});

test('search input changes results without changing scope or medium facet counts',()=>{
 const document=archiveDOM();
 document.querySelector('[data-scope="both"]').click();
 document.querySelector('[data-filter="映画"]').click();
 document.querySelector('[data-rating="score-9"]').click();
 assertScopeDOM(document,['01','01','02'],'All current and legacy records.','both','映画','score-9');
 const mediumCounts=()=>document.querySelectorAll('[data-filter]').map(button=>button.querySelector('sup').textContent);
 assert.deepEqual(mediumCounts(),['03','02','01']);
 assert.equal(document.querySelector('#result-count').textContent,'02 OBJECTS / COLLECTION + LEGACY / FILTERED');
 const search=document.querySelector('#search');search.value='Needle';search.dispatchEvent({type:'input',bubbles:true});
 assertScopeDOM(document,['01','01','02'],'All current and legacy records.','both','映画','score-9');
 assert.deepEqual(mediumCounts(),['03','02','01']);
 assert.equal(document.querySelector('#result-count').textContent,'01 OBJECT / COLLECTION + LEGACY / FILTERED');
});

function archiveSnapshot(){
 return vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data.js'),'utf8')+';ARCHIVE.entries');
}
function visibleIds(document){
 return [...document.querySelector('#collection-grid').innerHTML.matchAll(/data-entry="([^"]+)"/g)].map(match=>match[1]);
}

test('default Collection hides unrated entries from the list and all facet counts',()=>{
 const entries=archiveSnapshot(),document=archiveDOM(entries),unrated=entries.filter(e=>typeof e.rating!=='number');
 assert.equal(unrated.length,5);
 assert.equal(document.querySelector('#result-count').textContent,'97 OBJECTS / COLLECTION');
 assert.equal(document.querySelector('#rating-summary').textContent,'Rated');
 assert.match(fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),/id="rating-summary">Rated</);
 for(const scope of ['collection','legacy','both']){
  document.querySelector(`[data-scope="${scope}"]`).click();
  for(const button of document.querySelectorAll('[data-filter]')){
   const expected=entries.filter(e=>typeof e.rating==='number'&&(scope==='both'||(e.legacy===true)===(scope==='legacy'))&&(button.dataset.filter==='all'||button.dataset.filter===e.category)).length;
   assert.equal(Number(button.querySelector('sup').textContent),expected);
  }
  assert(visibleIds(document).every(id=>!unrated.some(e=>e.id===id)));
 }
});

test('Unrated selection reveals unrated records and clear rating or reset restores Rated',()=>{
 const document=archiveDOM(archiveSnapshot()),button=document.querySelector('[data-rating="unrated"]');
 button.click();
 assert.equal(document.querySelector('#rating-summary').textContent,'Unrated');
 assert.equal(document.querySelector('#result-count').textContent,'05 OBJECTS / COLLECTION / FILTERED');
 assert.deepEqual(visibleIds(document).sort(),Array.from(archiveSnapshot().filter(e=>typeof e.rating!=='number'),e=>e.id).sort());
 assert.deepEqual(document.querySelectorAll('[data-scope]').map(b=>b.querySelector('sup').textContent),['05','00','05']);
 for(const medium of document.querySelectorAll('[data-filter]'))assert.equal(medium.querySelector('sup').textContent,['all','音楽'].includes(medium.dataset.filter)?'05':'00');
 for(const clear of ['#rating-clear','#reset-search']){
  document.querySelector(clear).click();
  assert.equal(document.querySelector('#rating-summary').textContent,'Rated');
  assert.equal(document.querySelector('#result-count').textContent,'97 OBJECTS / COLLECTION');
  button.click();
 }
 button.click();
 assert.equal(document.querySelector('#result-count').textContent,'97 OBJECTS / COLLECTION');
});

test('search for an unrated title requires the Unrated filter',()=>{
 const entries=archiveSnapshot(),document=archiveDOM(entries),unrated=entries.find(e=>typeof e.rating!=='number');
 const search=document.querySelector('#search');search.value=unrated.title;search.dispatchEvent({type:'input',bubbles:true});
 assert.equal(document.querySelector('#result-count').textContent,'00 OBJECTS / COLLECTION / FILTERED');
 assert.deepEqual(visibleIds(document),[]);
 document.querySelector('[data-rating="unrated"]').click();
 assert(visibleIds(document).includes(unrated.id));
 document.querySelector('#rating-clear').click();
 assert.equal(document.querySelector('#result-count').textContent,'00 OBJECTS / COLLECTION / FILTERED');
});

test('hero stage pool excludes unrated entries while retaining numeric zero and legacy covers',()=>{
 const floating=fs.readFileSync(path.join(__dirname,'../floating.js'),'utf8'),stage={innerHTML:''};
 const entries=[{id:'zero',rating:0,cover:'zero.jpg'},{id:'legacy',rating:9,legacy:true,cover:'legacy.jpg'},
  {id:'null',rating:null,cover:'null.jpg'},{id:'missing',cover:'missing.jpg'},
  {id:'string',rating:'9',cover:'string.jpg'},{id:'blank',rating:8,cover:' '}];
 vm.runInNewContext(floating.slice(0,floating.indexOf(' const menu='))+'})();',{
  entries,document:{querySelector:()=>stage},escapeHTML:v=>String(v||''),pad:String
 });
 assert.deepEqual([...stage.innerHTML.matchAll(/data-entry="([^"]+)"/g)].map(match=>match[1]).sort(),['legacy','zero']);
});

test('menu result count and Clear filters share the rated default',()=>{
 const document=archiveDOM(archiveSnapshot());
 assert.equal(document.querySelector('#menu-result').textContent,'97 objects');
 assert.match(document.querySelector('#view-results').innerHTML,/View 97 objects/);
 document.querySelector('[data-rating="unrated"]').click();document.refreshMenu();
 assert.equal(document.querySelector('#menu-result').textContent,'5 objects');
 document.querySelector('#search').value='no such unrated title';
 document.querySelector('#menu-reset').click();document.refreshMenu();
 assert.equal(document.querySelector('#search').value,'');
 assert.equal(document.querySelector('#rating-summary').textContent,'Rated');
 assert.equal(document.querySelector('#result-count').textContent,'97 OBJECTS / COLLECTION');
 assert.equal(document.querySelector('#menu-result').textContent,'97 objects');
 assert.equal(document.querySelector('#menu-reset').hidden,true);
});
