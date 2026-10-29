const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../archive.js'),'utf8');
const context=vm.createContext({});
vm.runInContext(source.slice(source.indexOf('function isLegacy'),source.indexOf('function updateRatingButtons')),context);
const select=(...values)=>new Set(values);
test('Legacy follows the checkbox regardless of dates',()=>{
 assert.equal(context.isLegacy({legacy:false,sortDate:'1990-01-01'}),false);
 assert.equal(context.isLegacy({legacy:true,sortDate:'2026-01-01'}),true);
 assert.equal(context.isLegacy({sortDate:'1990-01-01'}),false);
});
test('categories combine and Legacy includes older selected-category works',()=>{
 const film={category:'Cinema',legacy:false},music={category:'Music',legacy:true};
 assert(context.matchesCollectionFilter(film,select('Cinema','Music')));
 assert(!context.matchesCollectionFilter(music,select('Cinema','Music')));
 assert(context.matchesCollectionFilter(music,select('Cinema','Music','legacy')));
 assert(!context.matchesCollectionFilter(film,select('legacy')));
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
