// Concatenate src/* into one self-contained page (artifact format) plus a local preview with a document skeleton.
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8');
const page = `<title>Hollowwood Manor</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IM+Fell+English:ital@0;1&display=swap">
<style>
${rd('style.css')}</style>
${rd('body.html')}
<script>
${rd('engine.js')}</script>
<script>
${rd('render.js')}</script>
<script>
${rd('ui.js')}</script>
`;
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
fs.writeFileSync(path.join(__dirname, 'hollowwood-manor.html'), page);
const full = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${page}</body></html>`;
fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), full);
fs.writeFileSync(path.join(__dirname, 'index.html'), full); // what GitHub Pages serves
console.log('built', (page.length / 1024).toFixed(0) + ' KB');
