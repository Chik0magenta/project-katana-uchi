// 빌드: src/를 한 파일로 묶어 dist/katana-uchi.html(스크립트·스타일 인라인)을 만든다.
// 이 파일 하나만 브라우저로 열면 바로 플레이할 수 있다(인터넷 연결 불필요).
//   node build.mjs           → dist/katana-uchi.html
//   node build.mjs --serve   → 파일이 바뀔 때마다 다시 빌드하고 http://localhost:5173 에서 제공
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';

const serve = process.argv.includes('--serve');
const OUT = 'dist/katana-uchi.html';
mkdirSync('dist', { recursive: true });

function page(js) {
  const css = readFileSync('src/styles.css', 'utf8');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KATANA-UCHI v0.2</title>
<style>${css}</style>
</head>
<body>
<div id="app"><canvas id="stage" width="320" height="180"></canvas><div id="ui"></div></div>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
</body>
</html>
`;
}

const writeHtml = {
  name: 'write-html',
  setup(build) {
    build.onEnd((res) => {
      if (res.errors.length) return;
      const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
      writeFileSync(OUT, page(js));
      // claude.ai 아티팩트 게시용 (문서 뼈대 태그 없이 내용만)
      const body = page(js).replace(/<!doctype html>\s*<html lang="ko">\s*<head>\s*<meta charset="utf-8">\s*<meta name="viewport"[^>]*>\s*/, '').replace('</head>\n<body>\n', '').replace('</body>\n</html>\n', '');
      writeFileSync('dist/artifact.html', body);
      console.log(`[build] ${OUT} (${(Buffer.byteLength(page(js)) / 1024).toFixed(0)} KB)`);
    });
  },
};

const options = {
  entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: !serve, sourcemap: serve ? 'inline' : false,
  target: 'es2020', write: false, outfile: 'dist/bundle.js', plugins: [writeHtml], logLevel: 'warning',
};

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(readFileSync(OUT));
  }).listen(5173, () => console.log('[serve] http://localhost:5173'));
} else {
  await esbuild.build(options);
}
