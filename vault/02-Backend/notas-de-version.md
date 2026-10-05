---
tipo: modulo
estado: verificado
actualizado: 2026-10-05
tags: [backend, instancias, despliegue, actualizaciones, novedades]
archivos:
  - apps/web/novedades.json
  - apps/web/lib/novedades-reglas.mjs
  - apps/web/lib/novedades.ts
  - scripts/verificar-novedades.mjs
  - .github/workflows/release.yml
  - db/migrations/20261005_notas_de_version.sql
  - scripts/actualizaciones.mjs
  - infra/scripts/update.sh
  - Dockerfile
  - apps/web/lib/server/novedades.ts
  - apps/web/app/api/novedades/route.ts
  - apps/web/app/api/actualizaciones/route.ts
  - apps/web/components/demo/novedades/NotasDeVersion.tsx
  - apps/web/components/demo/shell/NovedadesDeVersion.tsx
  - apps/web/components/demo/admin/ActualizacionesPanel.tsx
  - apps/web/app/(app)/(shell)/novedades/page.tsx
  - apps/web/app/(app)/(shell)/layout.tsx
  - apps/web/components/demo/admin/actualizaciones-ui.ts
---

# Notas de versión

> **Pedido del dueño, 2026-10-01.** «Por cada versión nueva, los desarrolladores
> escriben qué cambió, para que cada cliente sepa qué se hizo.» Las dos
> decisiones que tomó él:
>
> - **Quién las ve:** **todo** usuario, después de instalarse la versión, en un
>   diálogo que sale **una sola vez por versión y por usuario**. El **Dueño** y
>   el **Administrador** las ven además **antes** de instalar, en el panel de
>   Actualizaciones.
> - **Tipos de nota:** exactamente tres, `NUEVO` · `AJUSTADO` · `CORREGIDO`
>   («Nuevo», «Ajustado», «Corregido»).

Hermana de [[actualizaciones-instancia]] (ADR 0037): las notas viajan por **el
mismo buzón** —la base de la instancia— y la instancia sigue **sin hablar con el
PADRE**.

## Cómo escribe un desarrollador las notas de una release

**Se edita `apps/web/novedades.json` en el MISMO PR que el cambio.** No al
publicar, no en otro commit: el PR que añade la función es el que mejor sabe
contarla, y es el único momento en que alguien la tiene fresca.

El archivo es una lista, **de la versión más nueva a la más vieja**:

```json
[
  {
    "version": "v0.9.3",
    "fecha": "2026-10-08",
    "items": [
      { "tipo": "NUEVO",     "texto": "Lo que el cliente puede hacer que antes no podía." },
      { "tipo": "AJUSTADO",  "texto": "Lo que ya existía y ahora funciona distinto." },
      { "tipo": "CORREGIDO", "texto": "Lo que fallaba y ya no." }
    ]
  },
  { "version": "v0.9.2", "fecha": "2026-10-02", "items": [ … ] }
]
```

> [!note] 2026-10-05 · la v0.9.2 lleva fecha **2026-10-02**, no 01/10
> Así está hoy en `apps/web/novedades.json:4` (commit `7044082b`, «la v0.9.2
> sale el 02/10»). El ejemplo de arriba decía `2026-10-01`, el día en que se
> escribió esta nota; es la única entrada que tiene el archivo a esta fecha.

- **Se escribe para el cliente, no para el equipo.** En español llano, sin
  nombres de archivo ni de tabla. «Ahora puedes…», no «se añadió el endpoint…».
- Si el PR no trae nada que el cliente note, **no añade item** — pero la
  versión que se publique tendrá que traer al menos uno (ver la puerta).
- Si la entrada de la versión siguiente aún no existe, la crea el primer PR que
  la necesite, **arriba del todo**.

### Lo que hace válido el archivo

Lo decide **una sola copia** de las reglas, `apps/web/lib/novedades-reglas.mjs`
(por qué es `.mjs` y no `.ts`: su cabecera — la usan la aplicación y el script
de la release, que corre sin TypeScript). `apps/web/lib/novedades.ts` la
reexporta con tipos.

| Regla | Por qué |
|---|---|
| `version` es `vX.Y.Z` a secas | Las notas son de una versión, no de cada precandidata. `v0.9.2-rc1` **lee** las de `v0.9.2` |
| `fecha` es una fecha **real** `AAAA-MM-DD` | `2026-02-30` casa con el patrón y no es ningún día |
| Solo los tres tipos | Decisión del dueño |
| Texto no vacío | Un item vacío pinta una viñeta sin nada |
| Al menos un item por versión | Sin eso, la puerta de la release se cumpliría sin decir nada |
| **Ningún campo de más** | Un typo (`fehca`) ignorado en silencio deja la entrada sin fecha |
| Sin versiones repetidas, la más nueva primero | El orden compara **números**: `v0.10.0` va antes que `v0.9.2` |

Se juntan **todos** los errores de una vez: quien arregla el archivo en un PR
prefiere verlos juntos que descubrirlos de uno en uno.

## La puerta: no se publica una versión sin sus notas

`release.yml`, job `pruebas`, **lo primero tras tener node y antes del
`npm ci`**: `node scripts/verificar-novedades.mjs "$VERSION"`
(`.github/workflows/release.yml:174`; el `npm ci` va en `:181`).

- Sale con **0** si el archivo entero es válido y trae la entrada del tag.
- Sale con **1** si falta la entrada, si el archivo no se lee, no es JSON o no
  es válido — y el error dice qué entrada añadir y dónde.
- Sale con **2** si la versión no es `vX.Y.Z[-sufijo]` (error de uso).

Va **antes** de la suite a propósito: es la comprobación más barata del
workflow y la que más fácil se olvida. Detrás de las e2e costaría hasta 45
minutos descubrir que faltaba un párrafo. Y valida el archivo **entero**, no solo
que exista la entrada: un archivo inválido llegaría a la imagen y la aplicación
—con las mismas reglas— lo descartaría en silencio.

Probado como **proceso** (`scripts/verificar-novedades.test.ts`), igual que el
runner de migraciones: lo que mira el `set -e` del CI es el código de salida. La
misma prueba lee `release.yml` y falla si el paso desaparece o se mueve detrás
del `npm ci`.

## Cómo llegan a la instancia ANTES de instalar

La instancia **nunca habla con el PADRE** (ADR 0037): las notas de la versión
disponible viajan **dentro de la imagen nueva**, y el actualizador las deja en
el buzón de siempre.

1. **El `Dockerfile` copia el archivo** a `/app/apps/web/novedades.json`, con
   una `COPY` **explícita** (`Dockerfile:132`). Medido el 2026-10-01 tras `npm run build`: hoy
   `.next/standalone/apps/web/novedades.json` **sí existe**, porque el trazado
   de Next sigue el `import` de `lib/server/novedades.ts`
   (`.next/server/app/api/novedades/route.js.nft.json`). La `COPY` va igual: eso
   es un efecto lateral de cómo lo importa la app, no un contrato. La ruta vive
   en un solo sitio, `RUTA_NOVEDADES` de `scripts/actualizaciones.mjs:51`, y
   `scripts/actualizaciones.test.ts` exige que la `COPY` case con ella.
2. **La sonda de estado de `update.sh`** (`guion_estado()`, `infra/scripts/update.sh:1773`, el guion node que
   corre con la imagen **nueva** en cada `--comprobar`) lee ese archivo con
   `notasParaVersion()` (`scripts/actualizaciones.mjs:69`) y escribe `notas_disponibles` **en la misma sentencia**
   que `version_disponible` y `digest_disponible`.
3. **`GET /api/actualizaciones`** la devuelve como `notasDisponibles`,
   revalidada con las mismas reglas del archivo (inválida → `null`).

### Las dos reglas de la sonda

- **Las notas NUNCA tumban una actualización.** `notasParaVersion()` no lanza:
  archivo ausente (una imagen anterior), JSON roto, versión sin entrada o una
  «versión» que es el nombre del canal — todo es `null`, se dice en el log y se
  sigue. Y se escribe **siempre**, también `null`: las notas de la versión
  anterior no pueden quedarse pegadas a la nueva. `null` es NULL de SQL, nunca
  el JSON `null`.
- **Mira si la columna existe antes de escribirla.** La sonda corre con la
  imagen nueva contra la base **vieja**: las migraciones de la nueva se aplican
  al instalar, después. La primera `--comprobar` tras publicar la versión que
  crea `notas_disponibles` la encontraría sin crear; a ciegas sería `42703`, la
  sonda saldría con 9 en cada corrida y **la instancia no podría instalar nunca
  la versión que trae la columna**. Coste aceptado: esa primera vez el dueño no
  ve las notas antes de instalar.

Las dos están probadas **ejecutando el guion de verdad**, extraído de
`update.sh`, con un `pg` doble que anota cada consulta
(`scripts/actualizaciones.test.ts`, «la sonda de estado anota
notas_disponibles»). El arnés `infra/scripts/pruebas-update.sh` no puede verlas:
dobla el `docker run` entero y nunca ejecuta el guion node.

La columna: `20261005_notas_de_version.sql` ([[migraciones]], [[esquema]]).
**Ningún `grant` nuevo**: el `select` de tabla ya la cubre y el `update` de la
app es por columna, así que la app la lee y no la puede escribir.

## En la aplicación

### Antes de instalar — el panel de Actualizaciones (Dueño y Administrador)

`ActualizacionesPanel.tsx`, cuando hay novedad: **«Qué trae {versión}»**
(`tituloNotasDisponibles()`, `actualizaciones-ui.ts`) con las notas agrupadas
por tipo, **al lado del botón de instalar**. Sin notas: «Esta versión no trae
notas». Sale en los dos modos — en automática también conviene saber qué entra
de madrugada. Lo ve quien ve el panel: `GET /api/actualizaciones` exige
`administracion:ver` (el negativo está en `actualizaciones.e2e.test.ts`).

### Después de instalar — el diálogo, una vez por versión y usuario (todos)

- **De dónde sale la versión:** `SPACE_OS_VERSION`, sellada en la imagen
  (`Dockerfile:78-79`, `ARG VERSION`), leída en cada petición por
  `GET /api/novedades`. En desarrollo (`NODE_ENV` distinto de `production`), sin
  versión o con `desconocida` (el valor por omisión del `Dockerfile`):
  **`null`, y el diálogo no sale nunca** (`versionInstaladaDe()`).
- **De dónde salen las notas:** el `novedades.json` **empaquetado en el build**,
  importado **solo** en `lib/server/novedades.ts` (`server-only`). Medido tras
  `npm run build`: el texto de las notas **no** aparece en `.next/static` (el
  bundle del navegador), solo en `server/app/api/novedades/route.js`. Importarlo
  en un componente de cliente lo filtraría a cualquiera sin sesión, y dice qué
  versión corre la instancia (P6).
- **`/api/novedades` exige sesión, sin módulo** (`exigir()` a secas): lo ve
  cualquier rol — la prueba entra con IMPRENTA, sin un permiso de
  `administracion` — y sin sesión da 401 sin decir la versión
  (`lib/test/novedades.e2e.test.ts`).
- **Cuándo sale:** `debeMostrarNovedades()` (`lib/novedades.ts`) — nunca para
  una versión sin notas, y no si este usuario ya la vio. «Visto» vive en
  `localStorage`, **por usuario** (`claveVistas()`), con un tope de 20 versiones,
  y **todo acceso va en `try/catch`**: si el almacenamiento falla, el diálogo
  vuelve a salir en la próxima carga, que es preferible a no salir nunca. No
  hay estado por usuario en la base, a propósito.
- **Se marca visto al cerrar**, de cualquier forma (botón, X, Escape, clic
  fuera), no al abrir.
- Montado en `app/(app)/(shell)/layout.tsx:92`, junto a `SondeoNotificaciones` (`:88`):
  todo usuario con sesión pasa por el shell. Botones según la regla de
  [[convenciones]]: «Entendido» en azul (`primary`, aceptar) y «Ver todas las
  novedades» neutro (`ghost`, navegar).

### La página «Novedades»

`app/(app)/(shell)/novedades/page.tsx`: todas las versiones del archivo, de la
más nueva a la más vieja, con la instalada marcada. **Sin entrada en el menú ni
en `nav.ts`** (alto contacto): una ruta que el NAV no conoce no tiene puerta en
`AuthGate`, que es justo lo que se quiere — la ve todo rol con sesión. Se llega
desde el diálogo.

Las tres vistas pintan con **el mismo componente**,
`components/demo/novedades/NotasDeVersion.tsx` (con prueba de render): orden
fijo Nuevo → Ajustado → Corregido, sin grupos vacíos, y el texto como texto,
nunca como HTML.

## Relacionadas
[[actualizaciones-instancia]] · [[02-Backend/_indice|Índice de Backend]] ·
[[entorno-y-despliegue]]
