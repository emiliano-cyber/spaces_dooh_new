# Entrega — el módulo Space Eyes dentro de SPACE OS

Para el equipo de `spaces_dooh_new`. Fecha: 2026-09-21.

Esto no se commiteó en su repo: su `CLAUDE.md` pide rama por agente y reclamar
zona en el tablero, así que va como parche. Todos los archivos están en el árbol
de trabajo del clon local `C:\Users\hm284\spaces_dooh_new`, sin commitear.

**Maqueta aprobada antes de codificar:** https://claude.ai/artifact/AFPonzhL7h1RagUk21CL5B

---

## 1. Qué es

Space Eyes pasa de ser una sección dentro de la ficha comercial (202 líneas en
`SpaceEyeVision.tsx`, que **siguen intactas y funcionando**) a ser un módulo del
menú con dos pantallas:

- **Listado** — los equipos de la instancia como centro de monitoreo: indicadores
  arriba, filtros, y una tarjeta por equipo con su última captura.
- **Ficha** — la fotografía de protagonista, con la barra de estado encima de la
  imagen, las dos procedencias de foto separadas (captura del equipo / foto del
  cliente / comparar), y lo técnico a la derecha.

## 2. Lo que cambió del lado de Space Eye (ya desplegable, nuestro repo)

| Ruta | Para qué | Notas |
|---|---|---|
| `POST /api/eyes/devices/:id/captura` | pedir una foto **ahora** | lo ÚNICO que una llave puede escribir |
| `GET /api/devices/:id/telemetry` | histórico por hora | ya existía; **se abrió** a llaves y ahora **filtra por dueño** |

Tres decisiones que conviene conocer antes de consumirlo:

1. **La captura tiene ruta propia, no `POST /api/devices/:id/command`.** Esa
   acepta ocho tipos de orden (reiniciar la app, abrir la transmisión, cambiar
   configuración, actualizar el programa): dejar entrar una llave ahí sería dar
   las ocho para conseguir una, y la novena que se agregue vendría de regalo.
   Aquí el tipo de orden **no es un parámetro**.
2. **La marca `escritura` de una llave alcanza exactamente esa ruta.** Es la
   única de la lista blanca que no es GET. Una llave con escritura no puede
   tocar nada más — comprobado en la prueba, punto 5.
3. **`en_linea: false` no es un error.** La orden queda encolada y el equipo la
   recoge al volver. La interfaz lo dice en vez de fingir que la foto viene en
   camino.

La llave que necesita la instancia:

```bash
curl -X POST https://<space-eye>/api/llaves \
  -H "Authorization: Bearer <token admin>" -H 'Content-Type: application/json' \
  -d '{"nombre":"instancia g500","uso":"lectura","owner":"g500","escritura":true}'
```

`escritura: true` solo si esa instancia debe poder pedir fotos. Sin ella el
módulo funciona completo en modo consulta.

## 3. Lo que hay que aplicar del lado de SPACE OS

**Modificados** (tres archivos):

| Archivo | Cambio |
|---|---|
| `lib/server/space-eye.ts` | `SPACE_EYE_KEY` en vez de usuario/contraseña (ver §5), y `listarEquipos`, `equipoDetalle`, `pedirCaptura`, `telemetriaDeEquipo` |
| `components/demo/shell/nav.ts` | grupo `ojos` con la entrada **Space Eyes**, entre Inventario y Comercial |
| `app/api/sitios/[id]/space-eye/route.ts` | sin cambios (queda como está) |

**Nuevos:**

```
app/api/space-eyes/route.ts                      lista
app/api/space-eyes/[id]/route.ts                 ficha (equipo + pantalla + galería)
app/api/space-eyes/[id]/captura/route.ts         pedir foto
app/api/space-eyes/[id]/telemetria/route.ts      histórico
lib/data/space-eyes-api.ts                       cliente
components/demo/space-eyes/piezas.tsx            umbrales y pastillas compartidas
components/demo/space-eyes/ListaEquipos.tsx      listado
components/demo/space-eyes/FichaEquipo.tsx       ficha
components/demo/space-eyes/Historial.tsx         gráficas de batería y señal
app/(app)/(shell)/space-eyes/page.tsx            pantalla
app/(app)/(shell)/space-eyes/[id]/page.tsx       ficha
lib/test/space-eyes.e2e.test.ts                  11 casos e2e (ver §6)
```

**No hace falta ninguna migración.** Es deliberado, ver §4.

Los quince archivos van juntos en **`docs/space-eyes-modulo.patch`**, al lado de
este documento. Se aplica desde la raíz de `spaces_dooh_new`:

```bash
git apply --stat docs/space-eyes-modulo.patch   # qué toca, sin tocar nada
git apply --check docs/space-eyes-modulo.patch  # si aplica limpio
git apply docs/space-eyes-modulo.patch
```

El parche **no incluye** `next.config.mjs`: ese cambio es de desarrollo y se
explica aparte en §7, para que su equipo decida.

## 4. Las tres decisiones de diseño que conviene no deshacer

**El permiso se reutiliza: `inventario.ver` para mirar, `inventario.crear` para
pedir una foto o subirla.** No se creó un módulo `space_eyes` porque el catálogo
de permisos viaja en *sus* migraciones y `tienePermiso` es fail-closed: un módulo
nuevo sin su fila en `rol_permisos` deja la pantalla en 403 **para todo el
mundo**, incluido el Dueño. Si más adelante quieren separarlo (dar Space Eyes sin
dar Inventario), es una migración suya y dos líneas nuestras.

La distinción `ver` / `crear` sí importa: encender una cámara gasta datos del
plan del sitio y despierta el teléfono. Quien solo consulta el inventario no
debería poder hacerlo. Y queda registrado en Actividad —«Pidió una foto a Space
Eyes»— porque dentro de un mes la pregunta será quién encendió esa cámara.

**La «foto del cliente» NO es almacenamiento nuevo: es la galería de la pantalla
(`sitios.fotos`).** Ya existe, el cliente ya la llena desde Inventario, y subir
desde Space Eyes agrega ahí y deja la nueva como principal — la misma regla que
ya aplica su ficha. Inventarle un almacén propio a este módulo habría dejado dos
galerías de la misma pantalla contradiciéndose.

**El menú lleva grupo propio.** Es la convención de su `nav.ts`: el encabezado
nombra la fase y la entrada es su pantalla principal (pasa igual con Inventario,
Comercial, Operaciones y Finanzas). Colgarlo de Inventario lo haría parecer un
accesorio de la ficha de una pantalla, que es justo lo que deja de ser.

## 5. El parche pendiente de antes, que sigue siendo lo más importante

`lib/server/space-eye.ts` entraba con **usuario y contraseña de administrador**
de Space Eye. **Mientras eso siga así, el aislamiento entre instancias es
decorativo**: esa cuenta ve la flota completa, o sea las cámaras de todos los
clientes.

Demostrado en local: una organización sin relación con esas cámaras, con un sitio
de código `05599-D01`, veía **«PATRIOTISMO Y PENSILVANIA - G500» con su foto**.
Su RLS aguantó lo suyo (el sitio ajeno dio 404), pero no puede proteger datos que
no están en su base. Con la llave de esa instancia: `sin_camara`.

Se van `login()`, el caché de token y el reintento por 401 (37 líneas menos, 20
más). También `?device=` → `?device_id=`: con el primero el backend ignoraba el
filtro y devolvía fotos de la flota entera — lo salvaba solo el filtro en
cliente.

Falta además meter `SPACE_EYE_BASE_URL` y `SPACE_EYE_KEY` en
`infra/env/instancia.env.example`, donde no están.

## 6. Cómo verificarlo

**Del lado de Space Eye** (nuestro repo, con el backend arriba):

```bash
cd backend && npm run prueba:captura-instancia
```

Crea sus propias llaves, prueba los seis caminos y las revoca. Lo que comprueba:
el dueño pide la foto; una llave de solo lectura y un testigo de alta **no**;
**un equipo ajeno da 404** aunque la llave tenga escritura; el histórico respeta
el dueño; y `command`, `logs`, el export CSV, `schedules`, `llaves` y
`reaprender` **siguen cerradas**.

**Del lado de SPACE OS** (necesita el backend de Space Eye en marcha):

```bash
cd apps/web
SPACE_EYE_BASE_URL=http://127.0.0.1:4000 \
SPACE_EYE_KEY=se_... \
SPACE_EYE_OWNER_CODIGO=05599-D01 \
npx vitest run --config vitest.e2e.config.ts lib/test/space-eyes.e2e.test.ts
```

Once casos con sesión y RLS de verdad: 401 sin sesión, el emparejamiento por
código, que un equipo sin pantalla **no desaparece** de la lista, que la pantalla
de otro tenant no se filtra, que un rol de solo consulta **no** enciende la
cámara, que la captura queda en Actividad, y que un equipo inventado da 404 y no
500. **Sin las variables de entorno los casos se reportan SALTADOS, no
aprobados**: la primera versión devolvía temprano en cada caso y salían once en
verde sin haber hablado con nadie.

## 7. Un parche de desarrollo que NO va en la entrega

Su CSP (`next.config.mjs`) es una constante sin rama de desarrollo y no lleva
`'unsafe-eval'`, que react-refresh necesita. Con `next dev` la página **nunca
hidrata**: se pinta el HTML, ningún botón responde, y el único rastro es un error
en la consola del navegador. Está parcheado en el clon local para poder trabajar,
con la política de producción intacta:

```js
process.env.NODE_ENV === 'production'
  ? "script-src 'self' 'unsafe-inline'"
  : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

Es un arreglo de su lado y lo decide su equipo; aquí queda dicho porque cuesta
una hora la primera vez que pasa.
