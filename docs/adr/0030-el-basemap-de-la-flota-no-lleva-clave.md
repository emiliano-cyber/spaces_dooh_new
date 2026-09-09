# ADR 0030: El basemap de la flota no lleva clave

- **Fecha:** 2026-09-08
- **Estado:** Aceptada (2026-09-08, por Emiliano)
- **Relacionado:** [ADR 0022](0022-instancia-dedicada-por-owner.md) — es su modelo de una
  imagen para toda la flota lo que fuerza esta decisión

## Contexto

El **2026-09-08** se reportó que el mapa mostraba «API KEY REQUIRED» en diagonal sobre los
mosaicos. Expediente completo, con capturas y mediciones:
`docs/evidencias/mapa-carto-apikey-20260908.md`. Lo que manda sobre esta decisión:

- **El basemap sin clave era el raster `light_all` de CARTO**, y CARTO pasó a exigir clave.
  Su forma de exigirla **no es un error**: responde `200 OK` con el mosaico de siempre y el
  aviso estampado dentro de la imagen. Medido: `z12` → 200, `image/png`, 9846 bytes, con la
  marca. Ninguna suite podía verlo; el único detector era mirar el mapa.

- **Ese camino sin clave es el camino REAL, no un respaldo.** `MapView.tsx` usa MapTiler solo
  si existe `NEXT_PUBLIC_MAPTILER_KEY`, y esa variable **no está definida en ningún sitio**:
  ni en `apps/web/.env`, ni en `.env.local`, ni en `infra/env/app.env.example`, ni en un
  workflow. Ninguna instancia ha tenido nunca clave de mapas.

- **Y no puede tenerla por instancia.** `NEXT_PUBLIC_*` lo inlinea Next **al compilar**, así
  que una clave así entra en la imagen y **toda la flota comparte la misma**. No hay forma
  de darle una propia a cada instancia desde su `.env`. Es exactamente la trampa que se
  corrigió con `AUTOREGISTRO` en F2.6, y está documentada en
  `infra/env/app.env.example:76-80`.

- **Alcance del fallo: cinco pantallas, y una de ellas es pública.**
  `app/(app)/p/[id]` es la propuesta que se le manda al cliente sin sesión. La marca de agua
  se le estaba enseñando a clientes.

La restricción, entonces, no es de presupuesto: es del modelo de despliegue. **Mientras el
artefacto sea uno para todos, el basemap tiene que ser bueno sin clave.**

## Decisión

**El basemap de la flota es OpenFreeMap, estilo `positron`**
(`https://tiles.openfreemap.org/styles/positron`), servido sin clave.

Se declara en `apps/web/components/demo/MapView.tsx` como `ESTILO_SIN_CLAVE`, y su host
único en el `connect-src` de `apps/web/next.config.mjs`. Los tres subdominios de CARTO salen
de la CSP.

**La rama de MapTiler se conserva** para quien compile su propio artefacto con clave, pero
deja de tratarse como «lo bueno» y el plan B como «lo de emergencia»: se invierte el criterio
— el camino sin clave es el que tiene que estar sano, y el otro es la excepción.

Dos afirmaciones quedan fijadas por `apps/web/lib/entorno.test.ts` (MAPA-01): que no volvemos
a apuntar al basemap de CARTO sin clave, y que todo host que pide `MapView` está autorizado
en `connect-src`.

## Alternativas consideradas

**1 · CARTO o MapTiler con clave, metida en el build.**
Sería lo más parecido a lo que ya había, y las dos tienen plan gratuito suficiente para esta
escala. Se descarta por el mecanismo de §Contexto: `NEXT_PUBLIC_*` se congela al compilar, así
que la clave sería **la misma para toda la flota**, viajaría dentro de la imagen del registro
y estaría en el bundle que descarga cualquier visitante de una propuesta pública. Rotarla
obligaría a reconstruir y volver a promover la imagen a todas las instancias. Es la
contradicción que F2.6 ya resolvió una vez.

**2 · Proxy de mosaicos por el BFF** (`/api/mapa/{z}/{x}/{y}`), con la clave del lado del
servidor, leída del `.env` de cada instancia.
Es la única opción que permite **una clave por instancia** y no expone nada al navegador, y
por eso es la salida natural el día que se necesite un basemap con contrato. Se descarta
**ahora** por coste y por riesgo: es un endpoint nuevo en el camino caliente de cinco
pantallas, con su caché, su límite de peticiones y su autorización que decidir —y la propuesta
pública no tiene sesión, así que sería un endpoint abierto por diseño—. Para un fallo que se
arregla cambiando una cadena, es desproporcionado. Queda escrito como el paso siguiente si
llega el motivo.

**3 · Raster estándar de OpenStreetMap** (`tile.openstreetmap.org`).
Tentador porque **no exige ni un cambio de CSP**: el host ya está autorizado, y
`components/maps/SitiosMap.tsx` ya lo usa. Se descarta por dos razones concretas. La política
de uso de mosaicos de la OSMF **no contempla el uso comercial ni el tráfico sostenido de un
producto**, así que sería construir sobre algo que pueden cortarnos con razón; y su estilo es
el mapa de colores de OSM, que no es el gris plano que se eligió por encajar con SET.

**4 · Servir nuestros propios mosaicos** (Protomaps o similar, en el bucket de Spaces).
Elimina la dependencia de terceros por completo, que es la queja de fondo de este ADR.
Se descarta por tamaño y por operación: el planeta son decenas de GB, y aunque se recortara a
México habría que decidir cada cuánto se regenera y quién lo hace. No hay ningún problema hoy
que justifique volverse proveedor de mapas.

## Consecuencias

**Positivas**

- El mapa vuelve a verse bien, y **la propuesta pública deja de llevar una marca de agua** a
  los clientes.
- **No hay ninguna clave de mapas que administrar**: ni que poner en el `.env` de cada
  instancia, ni que rotar, ni que se pueda filtrar. Menos superficie y menos ceremonia en el
  alta de una instancia.
- El artefacto **sigue siendo idéntico para toda la flota**, que es el invariante del ADR
  0022. Una decisión que exigiera clave lo habría roto.
- La CSP queda con **un solo host de mapas** en lugar de tres, y MAPA-01 impide que se
  desincronice en silencio.

**Negativas**

- **Cambiamos una dependencia de terceros por otra**, y esta no tiene contrato ni SLA:
  OpenFreeMap es un proyecto financiado por donaciones. Si se cae, el mapa sale en blanco con
  los pines encima — degradado, no roto, pero visible. **Es el riesgo real de este ADR**, y se
  asume sabiendo que lo alterno también era de terceros y ya nos falló.
- El fallo de origen **puede repetirse con cualquier proveedor** y ninguna prueba automática
  lo verá, por la misma razón de siempre: 200 y foto equivocada. La mitigación no es técnica:
  es `scripts/probar-basemap.mjs` y que alguien mire.
- Se pasa de raster a **vectorial**, así que el mapa depende ahora de glifos y sprite además
  de los mosaicos. Son tres cosas que pueden faltar en vez de una — y si faltan los glifos,
  el mapa pierde todas las etiquetas **con 200 en todo lo demás**. Están medidas en el
  expediente, y su host es el mismo.
- **Queda una incoherencia a propósito**: `SitiosMap.tsx` sigue pidiendo mosaicos a OSM. Hoy
  no lo monta ninguna pantalla, así que no se toca en este cambio, pero es el mismo problema
  esperando.

**Implicaciones de seguridad**

- **Superficie que se quita:** dos orígenes externos menos autorizados en `connect-src`
  (quedan los tres subdominios de CARTO fuera), y **ningún secreto nuevo**.
- **Dónde viven los secretos y quién los rota:** no hay. Es el punto central del ADR — la
  alternativa 1 habría puesto una clave compartida por la flota **en el bundle del
  navegador**, legible por cualquier visitante de una propuesta pública, y rotable solo
  reconstruyendo la imagen.
- **Autenticación/autorización:** ninguna implicación. El basemap es lectura anónima de
  cartografía pública, igual que antes.
- **Datos sensibles:** el basemap **no recibe datos nuestros**. Los mosaicos se piden por
  coordenada `z/x/y`, y las pantallas y los pines los dibuja el navegador encima. Lo que sí
  ocurre —y ocurría igual con CARTO— es que **el proveedor ve la IP del visitante y la zona
  que está mirando**, incluido el cliente que abre una propuesta pública. No cambia con esta
  decisión, pero queda anotado porque la alternativa 2 (proxy por el BFF) **sí lo
  eliminaría**, y ese es un argumento a su favor que no es de claves.
- **Dependencias nuevas:** ninguna de código. No entra ni un paquete a `package.json`: el
  cambio es una cadena de texto y una línea de CSP. `maplibre-gl` ya estaba.
- **Superficie de auditoría:** no queda registro de nada de esto, ni lo había antes. Las
  peticiones al basemap las hace el navegador del visitante y la aplicación no las ve.

## Cómo revertir

Barato, y a propósito. Son dos archivos y ningún dato:

1. `ESTILO_SIN_CLAVE` en `apps/web/components/demo/MapView.tsx` — la URL del estilo.
2. La línea `connect-src` de `apps/web/next.config.mjs`, con el host del proveedor nuevo.
3. MAPA-01 en `apps/web/lib/entorno.test.ts` avisará si (1) y (2) no cuadran, que es el fallo
   silencioso de este cambio.

**No hay migración, ni estado, ni datos.** Un cambio de proveedor de basemap es una cadena de
texto; lo caro no es deshacerlo, es darse cuenta de que hay que hacerlo — y para eso está
`scripts/probar-basemap.mjs`.

Si lo que se quiere revertir es la premisa entera —tener clave— eso **no es volver atrás**:
es la alternativa 2, y necesita su propio ADR.
