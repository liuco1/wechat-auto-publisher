// EdgeOne Pages Function: WeChat publisher proxy
// POST /api/publish  →  publish to WeChat Official Account drafts
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);

  // Health check
  if (url.pathname === '/api/publish' && request.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Publish endpoint
  if (url.pathname === '/api/publish' && request.method === 'POST') {
    try {
      const { appId, appSecret, articles } = await request.json();

      if (!appId || !appSecret || !articles) {
        return new Response(JSON.stringify({ error: 'Missing appId, appSecret or articles' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Step 1: Get access_token
      const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`;
      const tokenRes = await fetch(tokenUrl);
      const tokenData = await tokenRes.json();

      if (tokenData.errcode) {
        return new Response(JSON.stringify({ error: 'WeChat token error', ...tokenData }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Step 2: Add draft
      const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${tokenData.access_token}`;
      const draftRes = await fetch(draftUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles })
      });
      const draftData = await draftRes.json();

      return new Response(JSON.stringify(draftData), {
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not Found', { status: 404 });
}
