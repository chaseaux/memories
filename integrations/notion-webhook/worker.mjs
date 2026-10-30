// Secrets: SETUP_KEY, GITHUB_TOKEN; KV binding: NOTION_EVENTS.
// Optional secret NOTION_VERIFICATION_TOKEN overrides the bootstrap token in KV.
export async function trusted(body, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/i.test(signature || '')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC',hash:'SHA-256'}, false, ['verify']);
  const bytes = Uint8Array.from(signature.slice(7).match(/../g), value=>parseInt(value,16));
  return crypto.subtle.verify('HMAC',key,bytes,new TextEncoder().encode(body));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health' && request.method === 'GET') {
      const kv = Boolean(env.NOTION_EVENTS?.get);
      let verification = false, last = null, storage = kv;
      try {
        if (kv) {
          verification = Boolean(env.NOTION_VERIFICATION_TOKEN || await env.NOTION_EVENTS.get('verification'));
          const saved = await env.NOTION_EVENTS.get('diagnostics:last');
          last = saved ? JSON.parse(saved) : null;
        }
      } catch { storage = false; }
      const checks = {storage,setupKey:Boolean(env.SETUP_KEY),githubToken:Boolean(env.GITHUB_TOKEN),repository:Boolean(env.GITHUB_REPOSITORY),workspace:Boolean(env.NOTION_WORKSPACE_ID),verification};
      return Response.json({ready:Object.values(checks).every(Boolean),checks,lastEvent:last},{headers:{'Cache-Control':'no-store'}});
    }
    if (url.pathname === '/setup' && request.method === 'GET') {
      if (!env.SETUP_KEY || request.headers.get('Authorization') !== `Bearer ${env.SETUP_KEY}`) return new Response('Unauthorized',{status:401});
      const token = await env.NOTION_EVENTS.get('verification');
      return Response.json({verification_token:token},{headers:{'Cache-Control':'no-store'}});
    }
    if (url.pathname !== '/notion' || request.method !== 'POST') return new Response('Not found',{status:404});
    // A private route key also protects the unsigned, one-time subscription handshake.
    if (!env.SETUP_KEY || url.searchParams.get('key') !== env.SETUP_KEY) return new Response('Unauthorized',{status:401});
    if (Number(request.headers.get('Content-Length') || 0) > 131072) return new Response('Too large',{status:413});
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 131072) return new Response('Too large',{status:413});
    let event;
    try { event=JSON.parse(raw); } catch { return new Response('Invalid JSON',{status:400}); }
    if (!event || typeof event !== 'object' || Array.isArray(event)) return new Response('Invalid event',{status:400});
    const diagnostic = async (status, githubStatus) => {
      await env.NOTION_EVENTS.put('diagnostics:last',JSON.stringify({at:new Date().toISOString(),status,...(githubStatus?{githubStatus}:{})}));
    };
    const stored = await env.NOTION_EVENTS.get('verification');
    if (typeof event.verification_token === 'string') {
      if (!stored && !env.NOTION_VERIFICATION_TOKEN) {
        await env.NOTION_EVENTS.put('verification',event.verification_token);
        return new Response('Verification received');
      }
      return new Response('Already configured',{status:409});
    }
    if (!await trusted(raw,request.headers.get('X-Notion-Signature'),env.NOTION_VERIFICATION_TOKEN || stored)) { await diagnostic('invalid_signature'); return new Response('Invalid signature',{status:401}); }
    if (!env.NOTION_WORKSPACE_ID || event.workspace_id !== env.NOTION_WORKSPACE_ID) { await diagnostic('wrong_workspace'); return new Response('Wrong workspace',{status:403}); }
    const allowed = /^(page\.(created|properties_updated|content_updated|moved|deleted|undeleted)|data_source\.(content_updated|schema_updated|created|moved|deleted|undeleted))$/;
    if (!allowed.test(event.type || '')) return new Response('Ignored',{status:202});
    if (!/^[a-f0-9-]{36}$/i.test(event.id || '')) return new Response('Invalid event',{status:400});
    if (await env.NOTION_EVENTS.get(`event:${event.id}`)) return new Response('Already accepted',{status:202});
    // Every run reconciles metadata across all seven DBs. Coalesced GitHub runs
    // cannot lose a changed work, including deletions and moves between DBs.
    const result = await fetch(`https://api.github.com/repos/${env.GITHUB_REPOSITORY}/dispatches`,{
      method:'POST',headers:{Authorization:`Bearer ${env.GITHUB_TOKEN}`,Accept:'application/vnd.github+json','User-Agent':'memories-notion-webhook','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
      body:JSON.stringify({event_type:'notion_changed'})
    });
    if (!result.ok) { await diagnostic('dispatch_failed',result.status); return new Response('Dispatch failed; retry later',{status:503}); }
    await env.NOTION_EVENTS.put(`event:${event.id}`,'accepted',{expirationTtl:86400});
    await diagnostic('accepted',result.status);
    return new Response('Accepted',{status:202});
  }
};
