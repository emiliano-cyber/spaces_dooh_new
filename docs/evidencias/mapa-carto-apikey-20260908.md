# El mapa decía «API KEY REQUIRED» — 2026-09-08

> Expediente del fallo reportado por Jochelo: «en el mapa está saliendo *apikey
> required*, como si fueran zonas o calles». Se reproduce, se mide y se corrige.
> Rama: `fix/mapa-basemap-sin-clave`.

---

## 1 · Síntoma

Sobre el mapa aparecía, en diagonal y en gris, el texto:

```
API KEY REQUIRED
carto.com/basemaps/apikey
```

**No era un error de la aplicación ni un texto nuestro.** Venía dibujado DENTRO
de la imagen del mapa, en cada mosaico, y por eso se leía como si fuera una
etiqueta más del basemap — el nombre de una avenida o de una colonia. En la
captura de `z9` la marca convive con topónimos reales («Sweetwater», «Merkel»,
«Winters»), que es exactamente lo que hace que se confunda con uno de ellos.

Pantallas afectadas — las cinco que montan `MapView`:

| Pantalla | Quién la ve |
|---|---|
| `app/(app)/(shell)/inicio` | el Dueño, al entrar |
| `app/(app)/(shell)/comercial` | Dueño y Comercial |
| `app/(app)/(shell)/propuestas` | Dueño y Comercial |
| `app/(app)/(shell)/propuestas/[id]` | Dueño y Comercial |
| **`app/(app)/p/[id]`** | **el CLIENTE — propuesta pública, sin sesión** |

La última es la que da gravedad al asunto: la marca de agua se le estaba
enseñando a clientes en el documento que se les manda a aprobar.

---

## 2 · Causa raíz

`apps/web/components/demo/MapView.tsx`, función `buildStyle()`.

El basemap tenía dos caminos, y el que se usa en la práctica es el segundo:

1. **MapTiler**, si existe `NEXT_PUBLIC_MAPTILER_KEY`.
2. **Plan B sin clave**: raster `light_all` de CARTO
   (`{a,b,c}.basemaps.cartocdn.com`).

Ese plan B es el camino real: **la variable no está definida en ningún sitio del
repositorio** — ni en `apps/web/.env`, ni en `.env.local`, ni en
`infra/env/app.env.example`, ni en ningún workflow. Comprobado con `grep` sobre
todo el árbol: las únicas menciones son el propio `MapView.tsx`, la CSP de
`next.config.mjs` y tres notas de la bóveda.

**CARTO empezó a exigir clave para sus basemaps, y su forma de exigirla no es un
error: es una marca de agua.** Responde `200 OK` con el mosaico de siempre y el
aviso estampado encima.

Eso es lo que explica que no lo cazara nada:

| Detector | Por qué no lo vio |
|---|---|
| Consola del navegador | no hay error: la petición devuelve 200 |
| CSP | no bloquea nada: el host estaba autorizado |
| `npm test` | no abre un navegador ni pide mosaicos |
| `npm run test:e2e` | idem |
| Revisión de código | el código es correcto; cambió el tercero |

**El único síntoma posible era mirar el mapa.**

---

## 3 · Medición

Petición directa al mosaico, sin navegador ni aplicación (2026-09-08):

```
GET https://a.basemaps.cartocdn.com/light_all/12/913/1658.png
 -> 200  image/png  9846 bytes   (con la marca encima)
GET https://a.basemaps.cartocdn.com/light_all/9/113/207.png
 -> 200  image/png  5291 bytes   (con la marca encima)
```

Las dos imágenes se conservan, y son la prueba de que el 200 no significa que
esté bien:

- `mapa-carto-apikey-20260908-z12.png`
- `mapa-carto-apikey-20260908-z9.png`

---

## 4 · Corrección

El plan B pasa a **OpenFreeMap**, estilo `positron`
(`https://tiles.openfreemap.org/styles/positron`).

Por qué ese y no otro:

- **Es el mismo gris plano** que se había elegido por encajar con SET. `positron`
  es de la misma familia visual que el `light_all` que se va.
- **No pide clave**, y eso aquí no es comodidad sino un requisito de
  arquitectura — ver §6.
- **Todo sale de UN host** (mosaicos, glifos, sprite y el raster de relieve), así
  que la CSP es una sola entrada.

Se comprobó que el proveedor sirve las cinco piezas que el estilo necesita, no
solo el estilo:

```
estilo positron            -> 200  application/json                    25153 B
tile vectorial z12 (CDMX)  -> 200  application/vnd.mapbox-vector-tile  18085 B
glifos «Noto Sans Regular» -> 200                                      76580 B
glifos «Noto Sans Bold»    -> 200                                      81170 B
glifos «Noto Sans Italic»  -> 200                                      79907 B
sprite                     -> 200  application/json                    27737 B
natural earth (raster)     -> 200  image/png                          129902 B
```

> Los tres fontstacks se leyeron **del propio estilo**. El primer intento pidió
> `noto_sans_regular` y dio 404 — nombre inventado por quien probaba, no un
> problema del proveedor. Queda anotado porque el mismo error, con los glifos,
> deja el mapa sin ni una etiqueta y con 200 en todo lo demás.

Archivos:

- `apps/web/components/demo/MapView.tsx` — `buildStyle()` y el porqué.
- `apps/web/next.config.mjs` — `connect-src`: entra `tiles.openfreemap.org`,
  salen los tres subdominios de CARTO.
- `apps/web/lib/entorno.test.ts` — MAPA-01, dos casos.

---

## 5 · Verificación

| Qué | Resultado |
|---|---|
| `cd apps/web && npm run typecheck` | limpio |
| `cd apps/web && npm test` | **1091 en 101 archivos**, verde (eran 1089) |
| MAPA-01 contra el código ANTERIOR | **rojo**, como debe: `expected … not to match /basemaps\.cartocdn\.com/` |
| Las siete URLs del §4 | 200, medido |

> [!warning] Lo que NO está verificado, y hay que hacerlo con un navegador
> **Nadie ha visto todavía el mapa nuevo pintado.** La extensión de Chrome no
> estaba conectada en la sesión que hizo el cambio, así que la comprobación que
> falta es la única que cazaba el fallo original: abrir una pantalla con mapa y
> mirarla.
>
> Para eso se dejó `scripts/probar-basemap.mjs`, que sirve una página con
> MapLibre y **la CSP real de la aplicación** leída de `next.config.mjs`:
>
> ```powershell
> node scripts/probar-basemap.mjs   # -> http://localhost:4319
> ```
>
> En la consola del navegador tienen que salir `[MAPA-OK]` y `[MAPA-IDLE]`, y
> **ningún** `Refused to connect`. Si el mapa sale en blanco, falta un host en
> `connect-src`.

---

## 6 · Lo que este fallo dejó al descubierto

**La rama de MapTiler no puede funcionar en la flota, y no por un defecto:** por
cómo compila Next. `NEXT_PUBLIC_*` se inlinea AL COMPILAR, así que una
`NEXT_PUBLIC_MAPTILER_KEY` entraría en la imagen y **toda la flota compartiría la
misma clave** — no hay forma de darle una por instancia desde su `.env`.

Es exactamente la trampa que ya se corrigió con `AUTOREGISTRO` en F2.6, y está
documentada en `infra/env/app.env.example:76-80`.

Consecuencia: mientras el modelo sea una imagen para todos, **el basemap tiene
que ser bueno SIN clave**. El plan B no es un respaldo de emergencia, es el
camino. Decisión y salidas en el **ADR 0030**.

### Dos cosas más que aparecieron de paso

1. **`apps/web/components/maps/SitiosMap.tsx` no lo monta ninguna pantalla.**
   `grep -rl SitiosMap --include=*.tsx` solo lo encuentra a sí mismo y un
   comentario de `MapView`. Pide mosaicos a `tile.openstreetmap.org` a pelo, y su
   host sigue autorizado en la CSP. No se retira en este commit —es otro cambio—
   pero conviene decidirlo: si se queda, hereda el mismo problema de proveedor;
   si se va, sale también su host de la CSP.
2. **Tres documentos atribuyen `NEXT_PUBLIC_MAPTILER_KEY` al archivo
   equivocado.** Dicen `components/maps/SitiosMap.tsx`, y quien lee esa variable
   es `components/demo/MapView.tsx`; `SitiosMap` no la ha leído nunca. Está en
   `vault/00-Inventario/inventario-2026-08-11.md:527`,
   `vault/01-Arquitectura/entorno-y-despliegue.md:1611` y
   `vault/08-Manuales/manual-tecnico-2026-08-11.md:987`. Corregido en la bóveda;
   los dos manuales con fecha en el nombre se dejan como el retrato que son.
