/**
 * GitHub Actions publish script
 * Reads a markdown article, converts to HTML, sends to SCF proxy for WeChat publishing
 */
const fs = require('fs');
const https = require('https');
const path = require('path');

const SCF_URL = process.env.SCF_PROXY_URL;
const APP_ID = process.env.WECHAT_APP_ID;
const APP_SECRET = process.env.WECHAT_APP_SECRET;

if (!SCF_URL || !APP_ID || !APP_SECRET) {
  console.error('Missing required environment variables: SCF_PROXY_URL, WECHAT_APP_ID, WECHAT_APP_SECRET');
  process.exit(1);
}

const mdFile = process.argv[2];
if (!mdFile || !fs.existsSync(mdFile)) {
  console.error(`File not found: ${mdFile}`);
  process.exit(1);
}

// Parse frontmatter
const raw = fs.readFileSync(mdFile, 'utf-8');
const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
if (!fmMatch) {
  console.error('Invalid markdown format: missing frontmatter');
  process.exit(1);
}

const fmRaw = fmMatch[1];
const bodyMd = fmMatch[2];

const frontmatter = {};
fmRaw.split('\n').forEach(line => {
  const m = line.match(/^(\w+):\s*(.+)/);
  if (m) frontmatter[m[1]] = m[2].trim();
});

// Convert markdown to HTML (simple converter for WeChat)
function mdToHtml(md) {
  return md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => 
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`)
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1">')
    // Lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, (match) => {
      const items = match.trim().split('\n').map(s => s.trim()).filter(Boolean);
      return '<ul>' + items.join('') + '</ul>';
    })
    // Paragraphs (double newlines)
    .replace(/^([^<\n].+)$/gm, (m) => {
      if (m.includes('<h') || m.includes('<li>') || m.includes('<pre>') || m.includes('<ul>')) return m;
      return `<p>${m}</p>`;
    })
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Tables (basic)
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    .replace(/\n{3,}/g, '\n\n');
}

const htmlContent = mdToHtml(bodyMd);
const title = frontmatter.title || path.basename(mdFile, '.md');

// Build WeChat article HTML with style
const wxContent = `
<section style="font-size:16px;color:#333;line-height:1.8;padding:0 15px;">
${htmlContent}
</section>
`;

const article = {
  title: title,
  author: '润木学堂',
  digest: title,
  content: wxContent.trim(),
  content_source_url: '',
  need_open_comment: 1,
  only_fans_can_comment: 0
};

// Send to SCF proxy
const payload = JSON.stringify({
  appId: APP_ID,
  appSecret: APP_SECRET,
  articles: [article]
});

console.log(`Publishing: ${title}`);
console.log(`SCF URL: ${SCF_URL}`);

const url = new URL(SCF_URL + '/publish');
const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log(`Response: ${res.statusCode}`);
    try {
      const result = JSON.parse(data);
      console.log(JSON.stringify(result, null, 2));
      if (result.errcode && result.errcode !== 0) {
        console.error(`WeChat API Error: ${result.errmsg}`);
        process.exit(1);
      }
      if (result.error) {
        console.error(`SCF Error: ${result.error}`);
        process.exit(1);
      }
      console.log('✅ Draft created successfully!');
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (err) => {
  console.error(`Request failed: ${err.message}`);
  process.exit(1);
});

req.write(payload);
req.end();
