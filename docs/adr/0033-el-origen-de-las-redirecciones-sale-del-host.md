# ADR 0033: El origen de las redirecciones del middleware sale de la cabecera `Host`

- **Fecha:** 2026-09-17
- **Estado:** Aceptada (2026-09-17, por Emiliano)
- **Relacionado:** [ADR 0022](0022-instancia-dedicada-por-owner.md) — es su modelo de **una
  imagen idéntica para toda la flota** lo que prohíbe la salida fácil (un valor por
  instancia en el build), igual que en el [ADR 0030](0030-el-basemap-de-la-flota-no-lleva-clave.md)

## Contexto

Esta decisión existe por **dos fallos en producción, y el segundo nació del arreglo del
primero**. El orden importa más que cualquiera de los dos por separado.

### El 09/09 · el redirect mandaba al cliente a `localhost`

Medido en la instancia `g500`: cualquier ruta protegida abierta sin sesión contestaba

```
HTTP/2 307
location: https://localhost:3000/spaces-dooh/login/
```

El navegador se iba a `localhost` y no llegaba a ninguna parte. **Sólo entraba quien
tecleara a mano la URL del login.** No era nginx —la misma petición directa al contenedor
con el `Host` correcto daba lo mismo— ni `APP_URL`, que estaba bien puesta.

El mecanismo: `request.nextUrl` **no toma su origen de la cabecera `Host`**, sino de la
dirección donde escucha el propio servidor (`HOSTNAME` y `PORT` de la imagen,
`Dockerfile:72-73`), que Next presenta como `localhost:3000`.

El arreglo de entonces cambió el redirect por una **`Location` relativa**, y descartó
explícitamente las dos alternativas: el `Host`, por riesgo de open redirect, y
`process.env.APP_URL`, porque en el middleware puede quedar horneado en el build.

### El 17/09 · la relativa devolvía 500, en toda la flota

`v0.5.0` llegó al canal `estable` el 17/09. Medido el mismo día en **g500 y en DEMO**,
cualquier ruta protegida sin sesión pasó a devolver **HTTP 500**:

```
TypeError: Invalid URL
    at new URL (node:internal/url:806:29)
    ...
  code: 'ERR_INVALID_URL',
  input: '/spaces-dooh/login/'
```

El mecanismo, **verificado en el propio Next y no deducido**
(`node_modules/next/dist/server/web/adapter.js:242-248`):

```js
const redirect = response?.headers.get("Location");
if (response && redirect && !isEdgeRendering) {
    const redirectURL = new _nexturl.NextURL(redirect, { ... });
```

El adaptador de middleware **siempre** parsea la cabecera `Location` que devuelve el
middleware, y `NextURL` pasa por `new URL()` **sin base**. Una ruta relativa no es una URL
absoluta. **En Next 14.2.29 un middleware no puede devolver `Location` relativa**: no es una
preferencia de estilo, es que ese camino no existe.

> El RFC 7231 §7.1.2 sí permite `Location` relativas. El párrafo que las defendía era
> correcto sobre HTTP y falso sobre este framework. Es la clase de afirmación que sólo se
> desmiente ejecutándola.

### Por qué nada lo atrapó, que es la parte cara

Tres comprobaciones distintas dieron verde sobre una aplicación que devolvía 500:

| Comprobación | Qué mira | Por qué no lo vio |
|---|---|---|
| `middleware.test.ts` | Llama a `middleware()` a pelo | El `new URL()` que revienta está en el **adaptador**, por encima del middleware |
| Smoke de `promover.yml:245` | `/login/` y `/api/auth/metodos/` | **Las dos son rutas públicas**: el gate de sesión no se dispara en ninguna |
| Salud de `update.sh` | `/api/auth/metodos/` | La misma ruta pública |

El arreglo tocó **exclusivamente** el camino del redirect, y **ninguna de las tres pasa por
ese camino**. DEMO validó `v0.5.0` en verde sin ejecutar una sola vez la línea que rompía.

## Decisión

**El origen de las redirecciones del middleware se construye a partir de la cabecera
`Host`**, con el esquema que anuncie `x-forwarded-proto`.

La construye `origenPublico()` en `apps/web/lib/host.ts`, que **sólo admite lo que tiene
forma de nombre de máquina** (`/^[a-z0-9.-]+(:\d{1,5})?$/` tras `trim` y `toLowerCase`).
Cualquier otra cosa devuelve `null` y `redirigir()` cae al origen interno.

## Alternativas descartadas

| Opción | Por qué no |
|---|---|
| **`Location` relativa** | Imposible: `ERR_INVALID_URL` en el adaptador de Next. Es el fallo del 17/09 |
| **`process.env.APP_URL`** | El middleware se compila a un bundle donde `process.env` puede quedar horneado **en el build**. Sería un valor por instancia congelado en el artefacto de toda la flota: exactamente el error de `NEXT_PUBLIC_AUTOREGISTRO` (F2.6) y el del basemap (ADR 0030) |
| **`NextResponse.rewrite()` en vez de redirect** | Funciona y evita la cabecera por completo, pero deja la dirección del navegador en la ruta protegida: quien abre `/inicio/` ve el login **bajo la URL de `/inicio/`**. Se descartó por eso, no por riesgo |

## Implicaciones de seguridad

El riesgo que motivó descartar el `Host` en el arreglo del 09/09 —**un open redirect**— es
real y sigue siéndolo. Se acota en cuatro capas, y conviene tenerlas todas presentes porque
ninguna basta sola:

1. **El `Host` decide el ORIGEN, nunca el DESTINO.** La ruta a la que se redirige es siempre
   una ruta interna fija y literal (`/login/`, `/inicio/`, la subruta de `/demo`). No hay
   ningún camino por el que un valor de la petición elija a dónde va el usuario.
2. **nginx filtra por `server_name`** antes de que la petición llegue a la aplicación.
3. **`origenPublico()` sólo acepta un nombre de máquina.** Caen el userinfo
   (`usuario:clave@evil.com`), la barra y la contrabarra que algunos parsers leen como
   separador de autoridad (`evil.com/@robado.com`), la query, el fragmento y los espacios.
4. **El fallo es visible, no silencioso.** Si el `Host` no vale, la redirección se rompe
   —vuelve el `localhost` del 09/09— pero **no manda a nadie al dominio de un tercero**. Se
   eligió a propósito: entre romper de forma que se ve y desviar de forma que no se ve, esto
   rompe.

> [!warning] Lo que esta decisión NO concede
> El `Host` **no entra en la cadena de datos** y **no resuelve tenant ni organización**. El
> modelo de subdominios por tenant está muerto (ADR 0022) y sigue estándolo: si algo
> necesita el host para saber quién es quién, está mal planteado. `etiquetaDeHost()` mantiene
> ese mismo alcance y su comentario lo dice desde antes.

## Consecuencias

- **Vuelve a haber una `Location` absoluta**, así que el adaptador de Next la parsea sin
  reventar y el navegador va al dominio por el que entró.
- **La regla de prueba que faltaba, y es lo que impide la repetición:** toda prueba de una
  redirección comprueba que su `Location` **sobrevive a `new URL()`**, que es exactamente lo
  que hace el adaptador. Está escrita en `middleware.test.ts` con el bloque
  «la Location sobrevive al adaptador de Next».
- **Queda pendiente, y es de la misma familia:** el smoke de `promover.yml` debería pedir
  una **ruta protegida sin cookie esperando 307**. Mientras mire sólo rutas públicas, puede
  volver a promover una imagen rota. No entra en este cambio: toca un workflow de despliegue
  y se decide aparte.
- **`v0.5.0` queda marcada como rota** para cualquier usuario sin sesión. La sustituye la
  versión que salga de esta rama.
