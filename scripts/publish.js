/**
 * GitHub Actions publish script
 * Reads markdown article, converts to HTML, publishes to WeChat draft directly.
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const APP_ID = process.env.WECHAT_APP_ID;
const APP_SECRET = process.env.WECHAT_APP_SECRET;

if (!APP_ID || !APP_SECRET) {
  console.error('Missing: WECHAT_APP_ID or WECHAT_APP_SECRET');
  process.exit(1);
}

const mdFile = process.argv[2];
if (!mdFile || !fs.existsSync(mdFile)) {
  console.error(`File not found: ${mdFile}`);
  process.exit(1);
}

// ── helpers ──
function wxGet(p) {
  return new Promise((resolve, reject) => {
    const u = new URL('https://api.weixin.qq.com' + p);
    https.get({ hostname: u.hostname, path: u.pathname + u.search, timeout: 15000 }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse: ' + d)); } });
    }).on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
  });
}

function wxPost(p, body) {
  return new Promise((resolve, reject) => {
    const u = new URL('https://api.weixin.qq.com' + p);
    const payload = JSON.stringify(body);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 15000
    };
    const req = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(new Error('parse: ' + d)); } });
    });
    req.on('error', reject).on('timeout', function() { this.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

// ── parse markdown ──
const raw = fs.readFileSync(mdFile, 'utf-8');
const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
if (!fmMatch) { console.error('Missing frontmatter'); process.exit(1); }

const frontmatter = {};
fmMatch[1].split('\n').forEach(line => {
  const m = line.match(/^(\w+):\s*(.+)/);
  if (m) frontmatter[m[1]] = m[2].trim();
});

// ── markdown → HTML ──
function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`)
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/((?:<li>.*<\/li>\n?)+)/g, (match) => {
      const items = match.trim().split('\n').map(s => s.trim()).filter(Boolean);
      return '<ul>' + items.join('') + '</ul>';
    })
    .replace(/^([^<\n].+)$/gm, (m) => {
      if (m.match(/<(h[1-6]|li|pre|ul|blockquote)/)) return m;
      return `<p>${m}</p>`;
    })
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^---$/gm, '<hr>')
    .replace(/\n{3,}/g, '\n\n');
}

const title = frontmatter.title || path.basename(mdFile, '.md');
const wxContent = `<section style="font-size:16px;color:#333;line-height:1.8;padding:0 15px;">\n${mdToHtml(fmMatch[2])}\n</section>`;

async function main() {
  console.log(`Publishing: ${title}`);

  // Step 1: get access_token
  console.log('Step 1: Getting access_token...');
  let tokenRes;
  try {
    tokenRes = await wxGet(`/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`);
  } catch (e) {
    console.error('Failed to get token:', e.message);
    process.exit(1);
  }
  console.log('Token response:', JSON.stringify(tokenRes));
  if (tokenRes.errcode) {
    console.error(`Token error: ${tokenRes.errcode} - ${tokenRes.errmsg}`);
    process.exit(1);
  }

  // Step 2: create draft
  console.log('Step 2: Creating draft...');
  let draftRes;
  try {
    draftRes = await wxPost(`/cgi-bin/draft/add?access_token=${tokenRes.access_token}`, {
      articles: [{
        title: title,
        author: '润木学堂',
        digest: title,
        content: wxContent.trim(),
        content_source_url: '',
        need_open_comment: 1,
        only_fans_can_comment: 0
      }]
    });
  } catch (e) {
    console.error('Failed to create draft:', e.message);
    process.exit(1);
  }
  console.log('Draft response:', JSON.stringify(draftRes));
  if (draftRes.errcode && draftRes.errcode !== 0) {
    console.error(`Draft error: ${draftRes.errcode} - ${draftRes.errmsg}`);
    process.exit(1);
  }
  console.log('✅ Draft created! media_id:', draftRes.media_id);
}

main().catch(e => { console.error(e); process.exit(1); });
