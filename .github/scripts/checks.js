#!/usr/bin/env node
/* =========================================================================
   Comprobaciones de CI para B.R.I.O. — sin dependencias.
   Uso:  node .github/scripts/checks.js [ruta-del-proyecto]
   Sale con código 1 si algo falla, para que el workflow marque el push en rojo.
   ========================================================================= */
'use strict';

const fs = require('fs');
const path = require('path');

const raiz = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const leer = function (f) { return fs.readFileSync(path.join(raiz, f), 'utf8'); };

let fallos = 0;
function ok(condicion, mensaje, detalle) {
  console.log((condicion ? 'OK     ' : 'FALLO  ') + mensaje + (condicion || !detalle ? '' : ' -> ' + detalle));
  if (!condicion) fallos++;
}

/* ---------------------------------------------------------- 1. manifest */
let manifest = null;
try { manifest = JSON.parse(leer('manifest.json')); } catch (e) { /* se informa abajo */ }
ok(!!manifest, 'manifest.json es JSON válido', 'no parsea');
if (manifest) {
  ['name', 'short_name', 'start_url', 'display', 'icons'].forEach(function (k) {
    ok(k in manifest, 'manifest declara "' + k + '"');
  });
  ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'manifest declara al menos un icono');
  (manifest.icons || []).forEach(function (i) {
    const src = String(i.src || '').replace(/^\.\//, '');
    ok(!!src && fs.existsSync(path.join(raiz, src)), 'el icono "' + src + '" existe en el repo');
  });
  if (manifest.start_url) {
    const destino = String(manifest.start_url).replace(/^\.\//, '');
    ok(destino === '' || fs.existsSync(path.join(raiz, destino)), 'start_url "' + manifest.start_url + '" apunta a algo que existe');
  }
}

/* ------------------------------------- 2. referencias locales del HTML */
const html = leer('index.html');
const refs = [];
const refRe = /(?:src|href)="([^"#?]+)"/g;
let m;
while ((m = refRe.exec(html)) !== null) {
  const u = m[1];
  if (/^(https?:|data:|mailto:|\/\/)/.test(u)) continue;
  refs.push(u.replace(/^\.\//, ''));
}
Array.from(new Set(refs)).forEach(function (r) {
  ok(fs.existsSync(path.join(raiz, r)), 'la referencia local "' + r + '" existe');
});

/* ------------------------------------------------- 3. guardas de CSP */
const scripts = [];
const tagRe = /<script\b([^>]*)>/gi;
while ((m = tagRe.exec(html)) !== null) scripts.push(m[1]);
ok(scripts.length > 0, 'index.html carga su script');
scripts.forEach(function (attrs, i) {
  ok(/\bsrc\s*=/.test(attrs), 'el <script> #' + (i + 1) + ' tiene src (no es código en línea)');
});

const csp = (html.match(/Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
ok(/default-src 'self'/.test(csp), 'la CSP declara default-src self');
ok(/script-src 'self'/.test(csp), "la CSP declara script-src 'self'");
ok(!/script-src[^;]*unsafe-inline/.test(csp), "la CSP no permite 'unsafe-inline' en scripts");
ok(!/script-src[^;]*unsafe-eval/.test(csp), "la CSP no permite 'unsafe-eval' en scripts");

/* ------------------------------------- 4. el service worker precachea */
const sw = leer('sw.js');
const shell = (sw.match(/const SHELL\s*=\s*\[([\s\S]*?)\]/) || [])[1] || '';
ok(shell !== '', 'sw.js define la lista SHELL');
['index.html', 'app.js', 'manifest.json'].forEach(function (f) {
  ok(shell.indexOf(f) !== -1, 'el service worker precachea ' + f);
});
ok(/request\.mode === 'navigate'/.test(sw), 'el service worker usa network-first en la navegación');

/* --------------------------------- 5. app.js respeta la CSP estricta */
const js = leer('app.js');
ok(!/\beval\s*\(/.test(js), 'app.js no usa eval()');
ok(!/\bnew\s+Function\s*\(/.test(js), 'app.js no usa new Function()');
ok(!/document\.write\s*\(/.test(js), 'app.js no usa document.write()');
ok(!/\sonclick\s*=/.test(js), 'app.js no genera manejadores onclick en línea');

console.log('');
if (fallos) {
  console.error(fallos + ' comprobación(es) fallida(s)');
  process.exit(1);
}
console.log('Todo correcto.');
