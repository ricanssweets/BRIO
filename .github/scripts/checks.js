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

/* Dimensiones reales de un PNG (IHDR) o WebP (VP8X/VP8L); null si no se puede. */
function dimensiones(ruta) {
  let buf;
  try { buf = fs.readFileSync(ruta); } catch (e) { return null; }
  if (buf.length > 24 && buf.slice(0, 4).toString('hex') === '89504e47') {
    return [buf.readUInt32BE(16), buf.readUInt32BE(20)];
  }
  if (buf.length > 30 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') {
    const tipo = buf.slice(12, 16).toString();
    if (tipo === 'VP8X') return [buf.readUIntLE(24, 3) + 1, buf.readUIntLE(27, 3) + 1];
    if (tipo === 'VP8L') {
      const bits = buf.readUInt32LE(21);
      return [(bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1];
    }
    /* WebP con pérdida: 'VP8 ' → frame tag (3) + 9D 01 2A (3) + ancho + alto */
    if (tipo === 'VP8 ' && buf.length > 30) {
      return [buf.readUInt16LE(26) & 0x3FFF, buf.readUInt16LE(28) & 0x3FFF];
    }
    return null;
  }
  return null;
}

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
    const ruta = path.join(raiz, src);
    ok(!!src && fs.existsSync(ruta), 'el icono "' + src + '" existe en el repo');
    if (!src || !fs.existsSync(ruta)) return;

    /* Las dimensiones declaradas deben ser las reales: el fallo original era
       un manifest que decía 512x512 para un PNG de 1254x1254. */
    const declarado = String(i.sizes || '');
    if (declarado === 'any') return;
    const m = /^(\d+)x(\d+)$/.exec(declarado);
    if (!m) { ok(false, 'el icono "' + src + '" declara sizes válido', declarado); return; }
    const real = dimensiones(ruta);
    if (!real) { console.log('OK     dimensiones de "' + src + '" no verificables (formato)'); return; }
    ok(real[0] === Number(m[1]) && real[1] === Number(m[2]),
      'el icono "' + src + '" declara ' + declarado + ' y mide ' + real[0] + 'x' + real[1]);
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

/* srcset="hero-440.webp 1x, otro.png 2x" */
const srcsetRe = /srcset="([^"]+)"/g;
while ((m = srcsetRe.exec(html)) !== null) {
  m[1].split(',').forEach(function (parte) {
    const u = parte.trim().split(/\s+/)[0];
    if (!u || /^(https?:|data:|\/\/)/.test(u)) return;
    refs.push(u.replace(/^\.\//, ''));
  });
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
