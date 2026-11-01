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
 local.updateFilterButtons();assert.deepEqual(counts(),['02','02','04']);assert.equal(help.textContent,'Current records.');
 local.activeFilters=select('Cinema');local.updateFilterButtons();assert.deepEqual(counts(),['01','01','02']);
 local.activeRatings=select('goat');local.collectionScope='legacy';local.updateFilterButtons();
 assert.deepEqual(counts(),['00','01','01']);assert.equal(help.textContent,'Earlier records kept in a separate archive.');
 assert.equal(buttons[1]['aria-pressed'],'true');assert.equal(buttons[0]['aria-pressed'],'false');
 local.activeFilters.clear();local.activeRatings=select('score-8','score-9');local.collectionScope='both';local.updateFilterButtons();
 assert.deepEqual(counts(),['02','01','03']);assert.equal(help.textContent,'All current and legacy records.');
 local.activeRatings.clear();local.updateFilterButtons();assert.deepEqual(counts(),['02','02','04']);
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

test('unrated entries can be isolated or combined with scores, including zero',()=>{
 for(const entry of [{rating:null},{},{rating:null,hallOfFame:true}]){
  assert(context.matchesRating(entry,select()));
  assert(!context.matchesRating(entry,select('goat','score-0')));
  assert(context.matchesRating(entry,select('unrated')));
  assert(context.matchesRating(entry,select('unrated','score-8')));
 }
 for(const rating of [0,8,10]){
  assert(context.matchesRating({rating},select()));
  assert(!context.matchesRating({rating},select('unrated')));
 }
 assert(context.matchesRating({rating:8},select('unrated','score-8')));
});
