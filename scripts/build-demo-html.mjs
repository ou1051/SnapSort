// Packs the web export (dist/) into ONE self-contained HTML file:
// the JS bundle is inlined and every image asset becomes a data: URI.
// Usage: npx expo export --platform web && node scripts/build-demo-html.mjs [out.html]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const dist = process.env.DIST_DIR ?? 'dist';
const out = process.argv[2] ?? 'dist-demo/index.html';

let html = readFileSync(join(dist, 'index.html'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
if (scripts.length === 0) throw new Error('No bundle <script> found in index.html');

let inlined = '';
for (const [, src] of scripts) {
  let js = readFileSync(join(dist, src), 'utf8');
  js = js.replace(/"(\/assets\/[^"]+\.(png|jpg|jpeg|gif|svg))"/g, (match, path, ext) => {
    const file = join(dist, path);
    if (!existsSync(file)) return match;
    const mime = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
    return JSON.stringify(`data:${mime};base64,${readFileSync(file).toString('base64')}`);
  });
  inlined += `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`;
}

html = html
  .replace(/<script src="[^"]+" defer><\/script>/g, '')
  .replace(/<link rel="icon"[^>]*>/, '')
  .replace('<meta httpEquiv="X-UA-Compatible" content="IE=edge" />', '')
  // The demo is a single page: start every load at the home route.
  .replace('</head>', `<script>try{if(location.pathname!=='/')history.replaceState(null,'','/')}catch(e){}</script></head>`)
  // Function replacer: the bundle contains `$&`-style sequences that a string replacement would expand.
  .replace('</body>', () => `${inlined}</body>`);

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB)`);
