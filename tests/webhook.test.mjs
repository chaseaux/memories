import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import worker,{trusted} from '../integrations/notion-webhook/worker.mjs';
test('only the exact signed body is trusted',async()=>{
 const body='{"type":"page.content_updated"}',secret='test-secret';
 const signature='sha256='+createHmac('sha256',secret).update(body).digest('hex');
 assert(await trusted(body,signature,secret));
 assert(!await trusted(body+' ',signature,secret));
 assert(!await trusted(body,signature,'other'));
 assert(!await trusted(body,null,secret));
});
test('bootstrap token requires a private route and cannot be overwritten',async()=>{
 const values=new Map(),env={SETUP_KEY:'private',NOTION_EVENTS:{get:async key=>values.get(key),put:async(key,value)=>values.set(key,value)}};
 const request=key=>new Request('https://example.com/notion?key='+key,{method:'POST',body:JSON.stringify({verification_token:'notion-token'})});
 assert.equal((await worker.fetch(request('wrong'),env)).status,401);
 assert.equal((await worker.fetch(request('private'),env)).status,200);
 assert.equal(values.get('verification'),'notion-token');
 assert.equal((await worker.fetch(request('private'),env)).status,409);
 assert.equal((await worker.fetch(new Request('https://example.com/setup'),env)).status,401);
});

function delivery(type='page.content_updated',entity={id:'4080a8e7-f46e-81c0-b032-f82684d90083',type:'page'}) {
 const values=new Map([['verification','test-secret']]);
 const env={SETUP_KEY:'private',NOTION_WORKSPACE_ID:'workspace',GITHUB_REPOSITORY:'test/repo',GITHUB_TOKEN:'example-token',NOTION_EVENTS:{get:async key=>values.get(key),put:async(key,value)=>values.set(key,value)}};
 const event={id:'56c3e00c-4f0c-4566-9676-4b058a50a03d',workspace_id:'workspace',type,entity};
 const request=(value=event)=>{const body=JSON.stringify(value);return new Request('https://example.com/notion?key=private',{method:'POST',body,headers:{'X-Notion-Signature':'sha256='+createHmac('sha256','test-secret').update(body).digest('hex')}});};
 return {values,env,event,request};
}

test('signed page event forwards the exact affected work to Actions',async t=>{
 const d=delivery();let sent;
 t.mock.method(globalThis,'fetch',async(url,options)=>{sent=JSON.parse(options.body);return new Response(null,{status:204});});
 assert.equal((await worker.fetch(d.request(),d.env)).status,202);
 assert.deepEqual(sent.client_payload.page_ids,[d.event.entity.id]);
 assert.equal(sent.client_payload.event_id,d.event.id);
 assert.equal(sent.client_payload.event_type,'page.content_updated');
 assert.equal(sent.event_type,'notion_changed');
 assert.equal(d.values.get('event:'+d.event.id),'accepted');
});

test('distinct same-work notifications both dispatch; duplicate event is ignored',async t=>{
 const d=delivery();const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push(JSON.parse(options.body));return new Response(null,{status:204});});
 await worker.fetch(d.request(),d.env);
 await worker.fetch(d.request(),d.env);
 await worker.fetch(d.request({...d.event,id:'56c3e00c-4f0c-4566-9676-4b058a50a03e'}),d.env);
 assert.equal(requests.length,2);
 assert.deepEqual(requests.map(x=>x.client_payload.page_ids),[[d.event.entity.id],[d.event.entity.id]]);
});

test('data-source changes force that source while unknown entity shapes request full refresh',async t=>{
 const requests=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{requests.push(JSON.parse(options.body).client_payload);return new Response(null,{status:204});});
 for(const entity of [{type:'data_source',id:'4d14774e-bc83-4db1-a46d-5a9c77fea43d'},{type:'block',id:'../../bad'}]){
  const d=delivery('data_source.content_updated',entity);
  assert.equal((await worker.fetch(d.request(),d.env)).status,202);
 }
 assert.deepEqual(requests[0].source_ids,['4d14774e-bc83-4db1-a46d-5a9c77fea43d']);
 assert.equal(requests[1].full_refresh,true);
});

test('failed dispatch remains retryable and wrong workspace never dispatches',async t=>{
 const d=delivery();let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(null,{status:calls===1?503:204});});
 assert.equal((await worker.fetch(d.request({...d.event,workspace_id:'other'}),d.env)).status,403);
 assert.equal(calls,0);
 assert.equal((await worker.fetch(d.request(),d.env)).status,503);
 assert.equal(d.values.has('event:'+d.event.id),false);
 assert.equal((await worker.fetch(d.request(),d.env)).status,202);
 assert.equal(calls,2);
});

test('health identifies targeted refresh support without exposing credentials',async()=>{
 const d=delivery();const result=await (await worker.fetch(new Request('https://example.com/health'),d.env)).json();
 assert.equal(result.syncProtocol,2);
 assert.equal(result.ready,true);
 assert.equal(JSON.stringify(result).includes(d.env.GITHUB_TOKEN),false);
});
