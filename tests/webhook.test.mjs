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
