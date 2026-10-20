# B.R.I.O. — Base Racional de Ideas y Objetivos

App web instalable (PWA) para trabajar un **ciclo de 120 días** en **7 áreas** (Espiritual, Personal, Familia, Profesional, Financiera, Comunidad y Placer), con metas medibles y registro diario. Funciona **por completo en el dispositivo**: no hay servidor, no hay cuenta y ningún dato sale del navegador.

- **Demo:** https://ricanssweets.github.io/BRIO/
- **Sin build, sin dependencias:** HTML, CSS, un script y dos imágenes. Se despliega empujando a `main`.

## Cómo funciona

1. **Contrato** — nombre, profesión, contacto y fecha de inicio. Se firma marcando la casilla.
2. **Mis 7 columnas** — se eligen de 3 a 5 objetivos por columna, con cantidad y frecuencia (`por día`, `por semana`, `por mes` o `en el ciclo`).
3. **Panel** — días restantes, anillo de progreso y avance por columna.
4. **Detalle de columna** — botones `+` / `−` que registran el avance **del día de hoy**, etiqueta "Hecho hoy" y racha de días seguidos.
5. **Perfil** — resumen, gestión de ciclo, historial de ciclos cerrados y **Zona de Datos** (exportar/importar respaldo, reiniciar).

El día de inicio cuenta como **Día 1** y el ciclo termina 119 días después: 120 días en total.

## Estructura

| Archivo | Para qué |
|---|---|
| `index.html` | Marcado y estilos (~30 KB) |
| `app.js` | Toda la lógica de la app (~45 KB) |
| `sw.js` | Service Worker: navegación *network-first* y precaché del shell |
| `manifest.json` | Metadatos PWA (nombre, colores, iconos) |
| `logo.png` | Icono de app, favicon y avatar de la barra superior |
| `logo-full.png` | Imagen del héroe en la pantalla de contrato |
| `robots.txt`, `sitemap.xml` | Indexación |
| `.github/` | CI: valida HTML, manifest, rutas y CSP en cada push |

El script va en un archivo aparte a propósito: permite una **Content-Security-Policy estricta** (`script-src 'self'`,
sin `unsafe-inline`) y que el navegador lo cachee por separado.

## Correr en local

El service worker necesita un origen `http(s)`, no `file://`:

```bash
node -e "const h=require('http'),f=require('fs'),p=require('path');h.createServer((q,s)=>{let r=q.url==='/'?'/index.html':q.url.split('?')[0];f.readFile(p.join('.',r),(e,d)=>e?s.writeHead(404).end():s.end(d))}).listen(8080,()=>console.log('http://127.0.0.1:8080/'))"
```

Abre `http://127.0.0.1:8080/` y prueba también con el móvil en la misma red.

## Verificar antes de subir

```bash
node --check app.js
node .github/scripts/checks.js
```

## Privacidad y datos

- Todo se guarda en `localStorage` (`brio_app_state_v1`), **en claro y solo en ese dispositivo**. No hay backend ni analítica.
- Aviso importante: `ricanssweets.github.io` es un **origen compartido**. Cualquier otra web publicada bajo esa misma cuenta comparte el mismo almacenamiento, así que conviene no reutilizar ese origen para proyectos con datos sensibles.
- Exporta un respaldo (Perfil → Zona de Datos) antes de cambiar de teléfono o de navegador: los navegadores pueden borrar el almacenamiento de sitios poco visitados.
- Si el navegador no puede guardar (cuota llena, navegación privada), la app lo avisa en pantalla.

## Accesibilidad

Zoom permitido, foco visible en todos los controles, navegación por teclado en las columnas, diálogo con `Escape` y trampa de foco, etiquetas asociadas, ARIA en progreso y botones, y respeto a `prefers-reduced-motion`.

## Despliegue

Copia los archivos a la raíz del repositorio y empuja a `main`. GitHub Pages publica ese contenido en https://ricanssweets.github.io/BRIO/.

Al publicar cambios **no hace falta tocar `sw.js`**: la navegación es *network-first*, así que la versión nueva llega sola (ver `LEEME-CAMBIOS.md`).

## Licencia

Sin `LICENSE` en este repositorio, el código queda con **todos los derechos reservados**, aunque sea público. Si quieres permitir su reutilización, añade una licencia (MIT y Apache-2.0 son las habituales para proyectos así).
