#!/usr/bin/env node
// ============================================================================
//  probar-basemap.mjs — ver el mapa con la CSP REAL de la aplicación
// ----------------------------------------------------------------------------
//  Existe por el fallo del 2026-09-08: el basemap sin clave de CARTO empezó a
//  servir sus mosaicos con «API KEY REQUIRED» estampado encima, con 200 en cada
//  petición. Ninguna suite lo vio, y no podía verlo: las pruebas no abren un
//  navegador. El único detector era mirar el mapa.
//  Expediente: `docs/evidencias/mapa-carto-apikey-20260908.md`.
//
//  Esta página sirve MapLibre con:
//   · el estilo que declara `MapView.tsx` (se LEE del componente, no se copia), y
//   · la CSP que emite la aplicación (se LEE de `next.config.mjs`),
//  para poder ver el mapa sin levantar Next, Postgres ni una sesión.
//
//  Qué mirar en la consola del navegador:
//   · `[MAPA-OK]` y `[MAPA-IDLE]`  -> el basemap carga y pinta.
//   · `Refused to connect`         -> falta un host en `connect-src`. Ese es el
//     otro fallo silencioso del mapa: sale EN BLANCO con los pines encima.
//   · un texto raro SOBRE el mapa  -> el proveedor pide clave. Es el fallo de
//     origen, y solo se ve con los ojos.
//
//  No es parte del producto y no lo importa nada: se corre a mano.
//
//    node scripts/probar-basemap.mjs        # -> http://localhost:4319
// ============================================================================
import http from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUERTO = Number(process.env.PUERTO ?? 4319)

// ── La CSP, leída de donde vive ────────────────────────────────────────────
// Se extrae el arreglo `POLITICA_CSP` en vez de importar `next.config.mjs`,
// que no la exporta. Si el arreglo se renombra, esto falla RUIDOSAMENTE, que es
// lo que se quiere: una CSP a medias haría pasar por bueno un mapa que en la
// aplicación real saldría en blanco.
const configNext = readFileSync(join(RAIZ, 'apps', 'web', 'next.config.mjs'), 'utf8')
const inicio = configNext.indexOf('const POLITICA_CSP = [')
if (inicio === -1) {
  console.error('No encuentro `POLITICA_CSP` en apps/web/next.config.mjs. ¿Se renombró?')
  process.exit(1)
}
const CSP = [...configNext.slice(inicio, configNext.indexOf(']', inicio)).matchAll(/"([^"]+)"/g)]
  .map((m) => m[1])
  .join('; ')

// ── El estilo, leído del componente ───────────────────────────────────────
const mapView = readFileSync(
  join(RAIZ, 'apps', 'web', 'components', 'demo', 'MapView.tsx'),
  'utf8',
)
const estilo = mapView.match(/const ESTILO_SIN_CLAVE = '([^']+)'/)?.[1]
if (!estilo) {
  console.error('No encuentro `ESTILO_SIN_CLAVE` en MapView.tsx. ¿Cambió `buildStyle()`?')
  process.exit(1)
}

// MapLibre se sirve desde ESTE origen a propósito: la CSP de la aplicación dice
// `script-src 'self'`, así que traerlo de un CDN lo bloquearía y el fallo
// parecería del mapa cuando sería del arnés.
const DIST = join(RAIZ, 'node_modules', 'maplibre-gl', 'dist')

const HTML = `<!doctype html><html lang="es"><meta charset="utf-8">
<title>Basemap con la CSP de la aplicación</title>
<link rel="stylesheet" href="/maplibre.css">
<style>
  html,body{margin:0;height:100%;font:14px system-ui}
  #mapa{position:absolute;inset:0}
  #aviso{position:absolute;z-index:2;left:12px;top:12px;background:#fff;padding:8px 12px;
         border-radius:8px;box-shadow:0 1px 4px #0003;max-width:60ch;line-height:1.45}
</style>
<div id="aviso"><b>Mira el mapa, no la consola.</b> Si hay un texto en diagonal
ENCIMA del mapa, el proveedor está pidiendo clave. Si sale todo blanco, falta un
host en <code>connect-src</code>.</div>
<div id="mapa"></div>
<script src="/maplibre.js"></script>
<script>
  const map = new maplibregl.Map({
    container: 'mapa',
    style: ${JSON.stringify(estilo)},
    center: [-99.1332, 19.4326], // CDMX, el mismo centro que MapView
    zoom: 12,
  })
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
  map.on('error', (e) => console.log('[MAPA-ERROR] ' + (e.error && e.error.message)))
  map.on('load', () => console.log('[MAPA-OK] estilo cargado, capas=' + map.getStyle().layers.length))
  map.on('idle', () => console.log('[MAPA-IDLE] mosaicos pintados'))
</script>`

http
  .createServer((req, res) => {
    try {
      if (req.url === '/maplibre.js') {
        res.writeHead(200, { 'content-type': 'text/javascript' })
        return res.end(readFileSync(join(DIST, 'maplibre-gl.js')))
      }
      if (req.url === '/maplibre.css') {
        res.writeHead(200, { 'content-type': 'text/css' })
        return res.end(readFileSync(join(DIST, 'maplibre-gl.css')))
      }
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-security-policy': CSP,
      })
      res.end(HTML)
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      res.end(String(e && e.message))
    }
  })
  .listen(PUERTO, () => {
    console.log('[ESTILO] ' + estilo)
    console.log('[CSP]    ' + CSP)
    console.log('[LISTO]  http://localhost:' + PUERTO + '   (Ctrl+C para parar)')
  })
