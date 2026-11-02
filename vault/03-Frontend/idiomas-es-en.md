---
tipo: modulo
estado: verificado
actualizado: 2026-11-02
tags: [frontend, i18n, idiomas, ingles, dinero]
archivos:
  - apps/web/lib/i18n/idiomas.ts
  - apps/web/lib/i18n/diccionario.ts
  - apps/web/lib/i18n/dinero.ts
  - apps/web/lib/i18n/servidor.ts
  - apps/web/lib/i18n/contexto.tsx
  - apps/web/app/layout.tsx
  - apps/web/app/(app)/login/page.tsx
  - apps/web/components/demo/shell/Sidebar.tsx
  - apps/web/components/demo/ui/SelectorIdioma.tsx
  - apps/web/lib/password.ts
  - scripts/i18n-inventario.mjs
  - apps/web/lib/i18n/errores-servidor.ts
  - apps/web/components/demo/inventario/ContratoWizard.tsx
  - apps/web/lib/i18n/textos/propuestas.ts
  - apps/web/lib/i18n/nodos.ts
  - apps/web/lib/i18n/pantallas-propuestas.test.ts
  - apps/web/components/demo/propuestas/estatus.ts
  - docs/i18n/revision-propuestas.md
  - docs/i18n/validacion-propuestas.md
  - apps/web/lib/i18n/textos/propuestas.test.ts
  - apps/web/lib/data/derive.ts
  - apps/web/lib/data/derive.fecha-idioma.test.ts
  - apps/web/components/demo/MapView.tsx
---

# La aplicación en dos idiomas (I18N-01)

> [!danger] 2026-09-30, tarde · EL INGLÉS ESTÁ APAGADO — solo español por ahora
> Pedido del dueño el mismo día, al probarlo: *«le puse en español pero se está
> mezclando y está en ambos idiomas; cámbialo para que solo por ahora esté en
> español»*. **La causa:** con ~1300 cadenas en la interfaz, solo estaban
> traducidas la pantalla de entrar, el menú lateral y los errores del servidor
> (§9). En cuanto la aplicación decidía «inglés» —por la cookie de una elección
> anterior, o por un navegador/Windows en inglés—, esas partes salían en inglés
> y todo lo demás en español.
>
> **Qué se hizo** (nada de la traducción se borró):
> - `inglesActivo()` en `lib/i18n/idiomas.ts`: lee `IDIOMA_INGLES` del entorno
>   del proceso; **solo el valor exacto `1` enciende**. Sin él, apagado.
> - `idiomaDeLaPeticion()` (`lib/i18n/servidor.ts`) devuelve **siempre español**
>   con el inglés apagado: ignora la cookie y el `Accept-Language`. Es el único
>   sitio que decide el idioma —lo usan el layout raíz y `respuestaError()`—, así
>   que una línea apaga las dos fuentes de la mezcla.
> - El layout pasa `puedeElegir={inglesActivo()}` al proveedor; `SelectorIdioma`
>   no se pinta y `cambiarIdioma` no hace nada sin él. Un selector que cambia algo
>   que el servidor ignora sería mentirle a quien lo usa.
>
> **Las pruebas de la traducción se conservan** y encienden el interruptor en su
> `beforeEach`: describen lo que pasará al reactivarlo. Las nuevas fijan el
> apagado —cookie `en` + navegador en inglés → español, `lang="es"`, sin
> selector— y mueren con los dos mutantes (quitar la línea del servidor: 6 rojas;
> quitar la guarda del selector: 1).
>
> **Para reactivarlo**, cuando la traducción esté completa: `IDIOMA_INGLES=1` en
> el entorno del proceso (en el PADRE, `/etc/space-os/padre.env`; en una
> instancia, `app.env`), y reiniciar.

> [!important] Traducir la interfaz NO es traducir el código
> El repositorio **sigue escribiéndose en español** — archivos, funciones,
> variables, columnas, comentarios ([[convenciones]]). El inglés es una **capa
> de presentación** que entra por `lib/i18n/diccionario.ts` y no sale de ahí.
> Ni un identificador, ni un archivo, ni una columna se renombró.

Pedido por Jochelo el **2026-09-30**. Entregado: el mecanismo completo, **dos
pantallas** traducidas de punta a punta (la de entrar y el menú lateral) y el
inventario contado de lo que falta.

## 1 · Cómo se elige el idioma

```
cookie spaces_idioma  >  cabecera Accept-Language  >  español
```

Esa es la regla entera, y vive en **una función pura**:
`resolverIdioma()` (`lib/i18n/idiomas.ts`). No sabe de HTTP ni de React, así
que se puede probar y mutar sin levantar nada.

| Señal | Qué es | Quién la pone |
|---|---|---|
| `spaces_idioma` | Una persona que **eligió a mano** | El selector de la pantalla |
| `Accept-Language` | Preferencia del **sistema operativo** | El navegador, en cada petición |
| español | El idioma original y el único completo | El respaldo |

Dos matices que costaron una prueba cada uno:

- **Una cookie con basura se comporta como si no hubiera cookie**, no como
  «español». Si no, escribir `spaces_idioma=fr` desde la consola del navegador
  apagaría la detección para quien lo tuviera así.
- **Una cabecera de un idioma que no hablamos cae al español, no al inglés.**
  El español es el que está completo; caer al inglés enseñaría media aplicación
  traducida a quien no pidió ninguno de los dos.

## 2 · Por qué NO hay rutas `/en/…` ni se tocó el middleware

Es **la** decisión de esta tarea, y la que la mantuvo fuera de zona roja.

La forma de libro sería un segmento de idioma en la ruta. Se descartó porque:

- El **App Router de Next 14 no trae i18n de rutas** (`i18n` en
  `next.config.mjs` solo funciona en el Pages Router). Habría que moverlo todo a
  `app/(app)/[idioma]/`, o sea **renombrar ~40 `page.tsx`**.
- Y arrastraría **`middleware.ts`**, que es archivo de **alto contacto** y donde
  viven el gate de sesión y el CSRF: compara rutas literales
  (`normalizedPath === '/login'`, `startsWith('/api/')`, el 308 de `/demo/*`) y
  con un segmento delante ninguna casaría. Eso es [[zonas-de-riesgo|ROJO]].
- Encima hay `basePath: '/spaces-dooh'` y `trailingSlash: true`, y `nav.ts`
  guarda rutas literales que `AuthGate` empareja por `href`.

**En su lugar:** el idioma se resuelve **en el servidor**, en el layout raíz
(`app/layout.tsx` → `idiomaDeLaPeticion()`), y baja por contexto de React.
**`middleware.ts` no cambió ni una línea.**

## 3 · Por qué no parpadea

> [!warning] `navigator.language` NO se mira en ninguna parte
> Leerlo en el cliente obliga a pintar español primero y corregirlo después del
> primer render. **Se ve el salto**, y en una demostración se ve fatal.

`Accept-Language` llega **en la misma petición** que pide la página, así que el
HTML sale ya en el idioma correcto y la hidratación encuentra el mismo texto.
Es la misma información —el navegador deriva la cabecera de la misma
preferencia que expone en `navigator`— solo que **llega a tiempo**.

Lo comprueba `lib/i18n/pantallas.test.ts`: rinde el componente real del login
con `renderToStaticMarkup` y verifica que el `<option>` del idioma pedido sale
**ya seleccionado desde el servidor**.

Coste medido: `cookies()` y `headers()` marcan el árbol como dinámico. **Aquí
no cuesta casi nada**, y se comprobó antes: todas las páginas cuelgan de
`app/(app)/`, que **ya** declaraba `export const dynamic = 'force-dynamic'`
desde el 26/08. Lo único que deja de prerrenderizarse es `/_not-found`.

## 4 · El cambio a mano

`components/demo/ui/SelectorIdioma.tsx`, al pie de la tarjeta de acceso — la
primera pantalla que ve cualquiera, que es donde hay que poder arreglar una
detección que no acertó.

- Escribe la cookie (**un año**, `SameSite=Lax`, **sin `httpOnly`**: es una
  preferencia de presentación, no una credencial) y llama a `router.refresh()`,
  que reejecuta los Server Components **conservando el estado del cliente**.
  `location.reload()` haría lo mismo con un parpadeo blanco.
- Cada idioma se nombra **en sí mismo** («Español», «English»). Quien no
  entiende la pantalla en la que está tiene que poder reconocer el suyo.
- **Sin bandera.** Una bandera nombra un país, no un idioma.

> [!warning] La preferencia es POR NAVEGADOR, no por persona
> Una cookie vive en un dispositivo. Quien elija inglés en su portátil seguirá
> viendo español en su teléfono. Hacerlo por persona pide **una columna nueva en
> `usuarios`**, o sea una migración, y **ninguna aterriza sin aprobación del
> dueño**. Está en [[preguntas-abiertas]].

## 5 · La convención de claves

**Claves en español**, `ambito.elemento[.matiz]`, minúsculas y sin acentos:
`login.titulo.login`, `nav.grupo.patrimonio`, `password.sin-numero`.

Y **la clave NO es la frase en español**. Es la decisión que más paga:

> Usar la frase como clave es cómodo el primer día; después, cada retoque de
> redacción deja huérfana la traducción **en silencio**. Este repositorio tiene
> el caso escrito: `nav.ts` cuenta que un grupo del menú se llamó **«Vender»,
> luego «Ventas» y hoy «Comercial»** — tres renombrados de un rótulo, y las
> claves internas (`vender`) se dejaron quietas justamente por esto.

**El español manda y `tsc` lo obliga:** `ClaveTexto` se deriva del diccionario
`es` y el `en` se declara `Record<ClaveTexto, string>`. Una clave inglesa que
falte es **un error de compilación**, no un hueco que se descubra en producción.

## 6 · El menú se traduce sin tocar `nav.ts`

`components/demo/shell/nav.ts` es **archivo de alto contacto** y **no se tocó**.

El truco: cada entrada ya tiene una clave estable (`NAV[].key`, `GRUPOS[].key`)
que usan `AuthGate` y `nav.test.ts`. El diccionario cuelga de **esa misma
clave**, y `Sidebar.tsx` hace `t(\`nav.${n.key}\`)` con respaldo al `label`.

Hay dos arneses encima:

- `diccionario.test.ts` exige que **todas las entradas y los grupos con título**
  existan en los dos idiomas (recorre `NAV` y `GRUPOS`, no una cifra fija:
  `diccionario.test.ts:173-190`; al 2026-10-05, **26 entradas y 5 grupos con
  título**, el de `inicio` va sin él), y que **el español del diccionario reproduzca exactamente el
  `label` de `nav.ts`** — si alguien renombra un rótulo allí (ya pasó tres
  veces), la prueba obliga a traerlo aquí en el mismo commit.
- `pantallas.test.ts` **rinde el menú** en los dos idiomas y comprueba que en
  inglés **no queda ni un rótulo en español**.

## 7 · El dinero

> [!danger] EL IDIOMA NO TOCA EL DINERO
> Decisión del dueño (30/09, literal): **«el sistema se rige 100 % en pesos
> mexicanos por ahora, después lo moveremos»**.

La moneda se declara **una sola vez**: `MONEDA = 'MXN'` en `lib/i18n/dinero.ts`.
`formatearDinero(monto, idioma)` **no acepta moneda como parámetro** — no se
puede pasar la equivocada si no se puede pasar.

Lo único que cambia con el idioma es la escritura:

```
formatearDinero(1234.5, 'es')  ->  $1,234.50
formatearDinero(1234.5, 'en')  ->  MX$1,234.50
```

Y eso explica por qué **no se fuerza el locale mexicano en la rama inglesa**: en
`es-MX` el peso se escribe `$`, que un lector anglosajón lee como **dólar**; en
`en-US`, ICU escribe `MX$`. **El inglés desambigua la moneda en vez de
oscurecerla.**

La prueba negativa obligatoria (`dinero.test.ts`) verifica, para ocho importes,
que **el número que se lee de vuelta es idéntico en los dos idiomas** y que
ninguno menciona otra divisa. Más dos guardias que recorren **todo `apps/web`**:

1. Todo `style: 'currency'` declara `currency: 'MXN'` (o la constante).
2. Ningún `currency:` se decide con un ternario sobre el idioma o el locale.
3. Y **ningún diccionario puede llevar dinero dentro**: ni un símbolo, ni un
   código, ni una cifra con separador de miles. Una cifra escrita en un
   diccionario es una cifra que nadie recalcula.

> [!warning] Hallazgo que contradice el «100 % en pesos», y hay que decidirlo
> Medido el 30/09, **el código de hoy no es de una sola moneda**:
> `components/demo/inventario/ContratoWizard.tsx:498-501` deja elegir **MXN o
> USD** al capturar un contrato; `lib/data/derive.ts:277` (`totalizarMoneda`)
> suma **por moneda** y se declara «mixto»; y `db/schema.sql` tiene **cuatro
> columnas `moneda` con `default 'PEN'`** —herencia de una encarnación anterior—
> y `config_negocio.moneda` con `default 'MXN'`.
>
> **Nada de eso se tocó** en esta tarea. Queda anotado en
> [[preguntas-abiertas]]: si de verdad hay una sola moneda, ese selector y esos
> `default` sobran; si no la hay, `formatearDinero` tendrá que recibirla.

> [!success] 2026-10-05 · el selector MXN/USD ya NO existe
> Se decidió el mismo 30/09 por la tarde («deja todo en pesos») y salió en
> `23a79bc2`. En `ContratoWizard.tsx` la moneda dejó de ser estado y sale de la
> misma constante que el formato: `const moneda = MONEDA`
> (`ContratoWizard.tsx:117-119`); el comentario donde estaba el selector cuenta
> por qué (`:503-516`). **La columna `moneda` y sus `default 'PEN'` siguen en
> `db/schema.sql` (`:110`, `:245`…)** a propósito: se cerró la puerta de entrada,
> no el almacén. `totalizarMoneda` (`lib/data/derive.ts:277`) también sigue.
> Medido antes del cambio en la base del 5433: ni un USD ni un PEN.

## 8 · Los mensajes de error del SERVIDOR (I18N-05, 2026-09-30)

> [!success] Ya NO se quedan en español
> En la primera entrega quedaron fuera a sabiendas. El dueño decidió el
> **2026-09-30** que entran, y entraron.

### Dónde se traduce, y por qué ahí

En **`respuestaError()`** (`lib/server/errores.ts`, **archivo de alto contacto**
— ver [[02-Backend/_indice]]) — el **único embudo** por donde salen los
**253 `new AppError(...)`** de los 42 archivos. El catálogo va del **español
canónico al inglés** (`lib/i18n/errores-servidor.ts`).

Es el único cambio funcional en ese archivo: cuatro llamadas envueltas en
`alIdiomaDelCliente()`. Nada más se tocó.

**El español es la FUENTE y no se tocó ni una letra.** `traducirError(m, 'es')`
devuelve `m` idéntico, así que este lote **no puede alterar ninguna respuesta de
las de hoy** — y por eso los **once archivos de prueba que afirman el texto
exacto en español siguen en verde sin tocarse**. Esa red es justo lo que impide
que, al traducir, se cambie lo que un error *dice*.

### «Pero si en §5 dice que la frase no se usa de clave»

Cierto, y sigue siendo cierto para la interfaz. Lo que hace peligroso ese patrón
**no es la frase: es el SILENCIO** — se retoca una redacción y la traducción
queda huérfana sin que nadie se entere.

**Aquí el silencio está quitado.** `errores-servidor.test.ts` recorre el
repositorio, saca todos los mensajes literales de `new AppError(...)` y exige
que cada uno esté en el catálogo o declarado en `SIN_TRADUCIR`. Un mensaje
nuevo, o uno reescrito, **pone la prueba en rojo**.

La otra mitad del motivo es que aquí no se podía elegir: una clave por sitio
toca **253 lugares** y obliga a reescribir el español.

### La guardia que no se ve, y es la que importa

> [!danger] `cookies()` y `headers()` LANZAN fuera de una petición
> Medido contra Next 14.2.29 el 30/09:
> ```
> Error: `cookies` was called outside a request scope.
> ```
>
> Daba igual mientras el único lector era el layout raíz. Dejó de dar igual con
> `respuestaError()`, que corre **en el `catch` de cada ruta**: sin guardia, un
> error nacido en un script o un trabajo de fondo haría que el manejador de
> errores lanzara **otro** error, y el original se perdería.
>
> **El manejador de errores no puede ser una fuente de errores.**
> `idiomaDeLaPeticion()` (`lib/i18n/servidor.ts`) envuelve las dos lecturas y
> cae al español. Hay prueba, y es uno de los tres casos negativos.

### La regla de idioma es LA MISMA, y está declarada una sola vez

`resolverIdioma()` en `lib/i18n/idiomas.ts`. La interfaz y los errores leen la
misma función: `cookie > Accept-Language > español`. **No hay una segunda
función que decida el idioma** — eso habría sido crear el problema que este
módulo vino a resolver.

### Lo que NO se traduce, a propósito

> [!warning] Lo que es REGISTRO se queda en español, siempre
> Un registro escrito en dos idiomas según quién provocó el fallo es un registro
> **inservible**: quien lo lee después no puede saber si «Not found» y
> «No encontrado» son el mismo suceso.
>
> Se traduce **solo lo que viaja al cliente en el cuerpo de la respuesta**. Los
> `console.error` de `respuestaError()`, la bitácora de acciones y los
> expedientes quedan intactos — y sale gratis por construcción, porque este
> módulo solo lo usa el `NextResponse.json`. **Hay prueba que lo vigila.**

### Cuánto quedó cubierto, medido

De los **251** `new AppError(...)` de producción (los otros 2 están en pruebas):

| | Sitios | |
|---|---:|---|
| **Cubiertos con certeza** | **179** | **71 %** |
| · literales (115 mensajes distintos) | 165 | |
| · por constante catalogada | 14 | |
| Dependen del valor en ejecución | 28 | 11 % |
| **NO cubiertos — plantillas con `${…}`** | **44** | **18 %** |

Los **28** son `e.message`, `motivo`, `r.error`…: se traducen **si** ese texto
está catalogado, y a menudo lo está (son reenvíos de mensajes que sí figuran).
La incertidumbre juega a favor, no en contra.

Los **44** son plantillas con interpolación —`Son ${n} archivos y el máximo por
tanda es ${m}`— y **no las cubre un catálogo de frases**: necesitan claves con
huecos. **Es el lote siguiente, y está contado.**

El catálogo tiene **142 entradas**: 115 de `new AppError` + 27 del embudo, del
mapa de Postgres, de los motivos de zod y de las constantes compartidas.

> [!note] 2026-10-05 · esas cifras son del 30/09 y el catálogo ya creció
> Tres commits posteriores añadieron entradas a `lib/i18n/errores-servidor.ts`
> al lanzar mensajes nuevos —el cupón pendiente (`aa165725`), la tarifa
> calculada (`17fbd252`) y la calculadora de spots (`43082ac4`)—, obligados por
> la guardia de `errores-servidor.test.ts`. Los 142 / 251 / 179 no se volvieron
> a medir: tómalos como la foto de la entrega, no como el estado de hoy.

### Detalles que costaron una medición

- **El archivo se generó leyendo el código.** Las claves en español no se
  tecleron: se extrajeron del árbol y un generador comprobó, una por una, que
  cada traducción corresponde a un mensaje que de verdad se lanza y que no falta
  ninguno. **Un typo en el español es una entrada que nunca casa y que no da
  error** — el fallo más caro que podía tener ese archivo.
- **Los mensajes partidos en dos literales** (`'...' + '...'`) obligan a juntar
  los trozos antes de catalogarlos. Guardar solo el primero deja una entrada que
  no casa nunca. El extractor y la guardia hacen la concatenación.
- **La guardia tacha los comentarios antes de buscar.** Su primera versión se
  puso roja por un comentario que decía «115 mensajes de `new AppError('...')`».
  Es el mismo fallo que este repositorio ya pagó —un `toContain` que casa con un
  comentario—, esta vez del lado del arnés.
- **Los mensajes de validación se traducen por PARTES.** `validar()` compone
  `${Etiqueta}: ${motivo}`, y la combinatoria es campos × motivos. Se parte por
  el primer `': '` **solo si la izquierda es una etiqueta de campo conocida**; si
  no, un mensaje normal con dos puntos dentro —y hay varios— se trocearía mal.
- **Los motivos de zod con un número dentro van por patrón**, no por frase: el
  número sale del esquema y se conserva.
- **Las cinco validaciones compartidas** (correo + las cuatro de contraseña)
  dicen **lo mismo** en inglés vengan del navegador o del servidor, y hay prueba:
  si divergieran, el usuario vería dos mensajes distintos para el mismo fallo
  según lo rápido que escriba.

## 9 · Lo que falta, contado

> [!note] 2026-11-02 · tras el lote piloto de PROPUESTAS (§11)
> `node scripts/i18n-inventario.mjs` en la rama `feat/ingles-propuestas`:
> **antes 149 archivos / ~2204 textos; después 142 / ~2035**. Lo que el
> inventario sigue contando en los archivos del lote (7 + 1 + 1) son falsos
> positivos —clases de Tailwind como `space-y-3 text-[13px]`—, comprobado
> uno por uno. Las cifras de la tabla de abajo son las del 30/09.

```
node scripts/i18n-inventario.mjs            # resumen por área
node scripts/i18n-inventario.mjs --detalle  # archivo por archivo
```

Medido el **2026-09-30** en este árbol: **100 archivos `.tsx`** con texto
pendiente, **~1261 textos distintos**. Las cinco áreas más pesadas concentran
casi todo:

| Textos | Archivos | Área |
|---:|---:|---|
| 533 | 29 | `app/(app)/(shell)` — las pantallas |
| 153 | 5 | `components/demo/inventario` |
| 101 | 10 | `components/demo/arrendadores` |
| 99 | 4 | `components/demo/comercial` |
| 64 | 8 | `components/demo/campanas` |

> Es una **estimación por expresiones regulares**, no un analizador de
> TypeScript: sirve para repartir el trabajo, **no** para declarar una pantalla
> terminada. Eso lo dice una prueba que la rinda en los dos idiomas.

## 10 · Lo que NO se verificó

> [!danger] Nadie abrió un navegador
> Todo lo de arriba está medido con `tsc`, `vitest` y `next build`. **El
> selector no se pulsó nunca en una pantalla real**: que `router.refresh()`
> repinte, que la cookie viaje y que no haya un salto visible **está razonado y
> probado en el servidor, no visto**. `renderToStaticMarkup` corre sin DOM: no
> ejecuta efectos, no hidrata, no hace clic.

Tampoco se comprobó cómo quedan los textos ingleses **en el ancho real** del
menú lateral («Volume discounts» y «Dayparts and seasons» son más largos que su
original) ni con el menú colapsado.

**Y de I18N-05 (los errores del servidor), lo que tampoco se vio:**

- **Ninguna de las 142 traducciones la revisó un hablante nativo.** Son correctas
  en el sentido de que dicen lo mismo, no necesariamente en el de que suenen
  como las escribiría alguien de allí.
- **Las e2e no ejercen el idioma**: pasan porque el español es el camino
  identidad, no porque comprueben la traducción. Ninguna petición de la suite
  manda `Accept-Language: en` ni la cookie.
- **Los 28 sitios que dependen del valor en ejecución no se midieron uno por
  uno**: se sabe que se traducen *si* el texto está catalogado, no cuántos lo
  están de hecho en cada camino.

## 11 · Lote piloto: PROPUESTAS (2026-11-02, rama `feat/ingles-propuestas`)

El primer lote de pantallas de negocio. **El inglés sigue APAGADO**
(`IDIOMA_INGLES` no se tocó): esto deja la traducción lista para cuando se
encienda, y en español no cambia ni una letra.

**Pantallas cubiertas:** la lista de propuestas (con la fila desplegada, el
embudo y los filtros), el formulario de alta / duplicar / agregar sitios con la
calculadora de spots, la ficha de la propuesta, el bloque del código de
negociación, condiciones y vigencia, enviar por correo, elegir cliente, el
tablero por periodo, la entrada pública por código (`/propuesta`) y el documento
imprimible (`/propuesta/[id]`, que es un Server Component).

### Lo que se añadió al mecanismo, y por qué

- **Un archivo de textos por área**: `lib/i18n/textos/propuestas.ts` exporta
  `ES_PROPUESTAS` (`as const`) y `EN_PROPUESTAS: Record<ClavePropuestas, string>`.
  `diccionario.ts` los esparce dentro de `ES` y `EN`. `ClaveTexto` sigue saliendo
  de `ES` y una clave inglesa que falte sigue sin compilar. El motivo es de
  integración: cada lote lo hace un agente en su rama, y todos escribiendo en el
  mismo objeto serían conflictos en las mismas líneas en cada merge.
- **`interpolarNodos()`** (`lib/i18n/nodos.ts`): huecos `{nombre}` que reciben un
  ELEMENTO (un `<b>`, un `<span>` con el importe). Sin esto, una frase con una
  negrita en medio había que partirla en trozos, y eso congela el orden de la
  frase española en el inglés. Prueba en `nodos.test.ts`.
- **El Server Component** (`app/(app)/propuesta/[id]/page.tsx`) traduce con
  `traducir(idiomaDeLaPeticion(), clave)`: la MISMA función que decide el idioma
  del layout raíz. No hay segundo mecanismo.
- **`CLAVE_ESTATUS`** en `components/demo/propuestas/estatus.ts`: la clave de cada
  estatus. `EST[e].label` se queda como la verdad en español y una prueba exige
  que el diccionario lo reproduzca, igual que el menú con `nav.ts`.

### Cómo se demostró que el español no cambió

`lib/i18n/pantallas-propuestas.test.ts` rinde **20 estados de pantalla** con
`renderToStaticMarkup`. Para rendir lo que solo aparece tras un clic (el diálogo
de alta, una fila desplegada, el tablero con datos) la prueba **fuerza el valor
inicial de `useState`** —no hay jsdom—, y lo explica en su cabecera. El HTML
español de los 20 estados se volcó **antes** de tocar los componentes y
**después**, y los 20 archivos salieron **idénticos byte a byte** (`diff -rq`).
La prueba que queda en el repositorio comprueba (a) frases españolas presentes
en `es`, (b) ninguna de ellas en `en`, y además barre el diccionario entero del
lote contra el HTML inglés de todas las pantallas.

> [!important] 2026-11-02, segunda vuelta · el diccionario entero, CONGELADO
> El validador (`docs/i18n/validacion-propuestas.md` §5) midió que **121 de 437
> claves no salen en ninguno de los 20 estados** (avisos emergentes,
> `window.confirm`, el Roadblock, los singulares) y que 3 de 8 mutantes
> sobrevivían. Desde la segunda vuelta, `lib/i18n/textos/propuestas.test.ts`
> guarda una **instantánea de las 440 entradas en los dos idiomas** y exige que
> ninguna inglesa sea igual a la española (salvo 6 declaradas) ni lleve acentos.
> Los tres mutantes que sobrevivían (es de `tablero.sin-costo.uno`, es de
> `calc.rb.prima`, en de `calc.rb.prima` en español) **mueren** con ella. Cambiar
> un texto a propósito obliga a regenerarla (`npx vitest run -u`) y el diff de
> `__snapshots__/` enseña qué cambió. Tras la segunda vuelta se volvió a volcar el
> HTML español de los 20 estados: **idéntico** al de `main`.

### Las fechas SÍ cambian de formato; el dinero NO se toca

**Fechas (decisión del dueño, 2026-11-02).** `formatFecha` y `formatFechaHora`
(`lib/data/derive.ts`) aceptan un segundo parámetro `idioma` con **`'es'` por
omisión**. La rama española es la de siempre, así que los ~80 llamadores que no
lo pasan pintan exactamente lo mismo (`01/12/2026`, `01/12/2026 15:45`). En
inglés salen **«Dec 1, 2026»** y **«Dec 1, 2026, 3:45 PM»**: `01/12/2026` un
lector de EE. UU. lo lee como 12 de enero. Una fecha inválida en inglés da «—»
(`Intl` lanzaría). Lo fija `derive.fecha-idioma.test.ts` (4 rojas sin el cambio).
Las pantallas del lote pasan el idioma del contexto (`useIdioma()`), y el
documento imprimible el de `idiomaDeLaPeticion()`. **No se usó `formatearFecha`
de `dinero.ts`**: su español es «01 dic 2026», o sea que habría cambiado el
español.

**Dinero: NO se toca en este lote (decisión del dueño, 2026-11-02).** Los
importes siguen por `formatMonto`: en inglés salen todavía como `$ 1,234.50`. El
dueño pidió que la moneda (MXN o USD) **se elija al crear una instancia nueva**;
eso es una tarea aparte y ROJA (dinero), no un retoque de traducción. El
diccionario no lleva ninguna cifra: los importes entran por hueco.

### Glosario (obligatorio para los lotes siguientes)

| Español | Inglés |
|---|---|
| campaña | campaign |
| propuesta | proposal |
| sitio | site |
| pantalla | screen |
| arrendador / propietario | landlord |
| cliente | client |
| anunciante | advertiser |
| agencia | agency |
| OT / orden de trabajo | work order |
| cobranza | collections |
| tarifa | rate |
| vigencia | validity (period) / valid until |
| vendedor | sales rep |
| cupón / código promocional / código de negociación | **negotiation code** (dueño, 2026-11-02; como el menú «Negotiation codes») |
| borrador / enviada / aprobada / rechazada | draft / sent / approved / rejected |
| enviar / reenviar | send / resend |
| liga | link |
| folio / referencia | **Internal ref.** — un solo término en todo el lote (dueño, 2026-11-02) |
| bruto / neto | gross / net |
| IVA · c/IVA · sin IVA | VAT · incl. VAT · excl. VAT |
| comisión de agencia | agency commission |
| descuento comercial / por volumen | commercial discount / volume discount |
| paquete cerrado | bundle (como el menú, «Bundles») |
| franja | daypart (como el menú) |
| renta | rent |
| predio | property |
| prima (de Roadblock) | premium |
| salidas / pases | plays |
| rotaciones / spots por hora del loop | **loops/h** (dueño, 2026-11-02) |
| millar / millares (CPM) · impactos | **thousand**, invariable tras un número: «2 thousand», nunca «2 thousands» (orquestador, 2026-11-02) · impressions |
| embudo / tasa de cierre | funnel / close rate |
| ganancia / margen | profit / margin |
| Administración (el módulo) | Settings (como el menú). **Nunca como sujeto que actúa**: «Administración tiene que subir el tope» → «an admin has to raise the cap in Settings» |
| IVA / porcentajes | sin espacio en inglés: «20%», «VAT 16%» (el español conserva el «20 %» que ya tenía) |
| DOOH, spot, Roadblock, loop, Space Eyes | no se traducen |

> [!success] 2026-11-02 · el choque con el menú está resuelto
> En la primera vuelta el lote decía «promo code» y el menú «Negotiation codes».
> **Decidió el dueño: «negotiation code»**, como el menú. Las frases de «devolver
> el uso» se reescribieron para que tengan sentido con un solo término («the use
> it consumed is available again»), y el renglón del desglose ya no repite el
> término («Negotiation code VERANO20 (20%) · pending approval»).

**Estilo:** todo en sentence case (rótulos, botones, cabeceras y frases), como el
menú. Solo van en mayúsculas las cabeceras que ya lo estaban en español (el
documento imprimible). Contadores: nada de «1 of 2 screens have…» ni «The 1
screen…»; donde el inglés necesita singular hay claves `.uno/.otros` (el español
de las dos es el de siempre, aunque diga «1 pantallas»).

### Lo que sigue en español dentro de estas pantallas (y no es de este lote)

Textos que llegan de módulos compartidos, que se traducen en su propio lote:
las unidades y sus abreviaturas (`UNIDADES`, `unidadCorta`, `resumenContratacion`,
`etiquetaFrecuencia` de `lib/periodos.ts`), `etiquetaCalculadora` y el motivo de
rechazo de la calculadora (`lib/calculadora-spots.ts`), las periodicidades de
renta (`lib/renta-periodicidad.ts`), la etiqueta del estado del cupón
(`etiquetaEstadoCodigo`, `lib/codigo-aprobacion.ts`), el aviso de la franja
(`AVISO_FRANJA_NO_VIAJA_AL_CMS`, `AvisoFranjaCMS`), los periodos del tablero
(`OPCIONES_PERIODO` de Finanzas y la `etiqueta` que manda el servidor), el
el resto de la barra de dibujo de `MapView` («Cerrar zona», «Limpiar zona»,
«Cancelar» y la indicación), `formatMontoCorto`, el « (obligatorio)» para lector
de pantalla de `components/demo/ui/Campo.tsx:58` (lo encontró el validador; no
estaba declarado) y los mensajes del servidor (I18N-05). La periodicidad del
contrato se pinta en minúsculas desde el dato (`mensual`).

El botón **«Dibujar zona»** de `MapView` SÍ se tradujo en la segunda vuelta, con
la MISMA clave que la ayuda de «Nueva propuesta» que lo nombra
(`propuestas.alta.mapa.dibujar`): si se tradujeran por separado, la ayuda
mandaría a pulsar un rótulo que no está en pantalla. Español idéntico.

### Lote compartidos

(2026-11-02, rama `feat/ingles-compartidos`.) Los textos de módulos COMPARTIDOS
que la lista de arriba dejaba en español dentro de Propuestas. **El inglés sigue
apagado** y el español no cambia ni una letra.

**El mecanismo es el mismo, con una regla más:** las funciones de `lib/` que
devuelven texto ganaron un último parámetro `idioma` con **`'es'` por omisión**,
así que el servidor, el PDF, los correos y las pantallas de otros módulos (que no
lo pasan) siguen en español sin tocarlos. Textos en
`lib/i18n/textos/compartidos.ts` (72 claves `compartidos.<módulo>.<elemento>`),
esparcidos en `diccionario.ts` como los de propuestas.

| Módulo | Qué se hizo |
|---|---|
| `lib/periodos.ts` | `unidadCorta`, `etiquetaCantidad`, `resumenContratacion`, `etiquetaFrecuencia` aceptan `idioma`; nueva `etiquetaUnidad(u, idioma)` para el selector. En español siguen leyendo `UNIDADES` |
| `lib/calculadora-spots.ts` | `etiquetaCalculadora(p, idioma)` y `previsualizarCalculadora(e, idioma)`. `resolverCalculadora` (servidor) sigue en español; la frase «la cantidad no cuadra» solo la usa él y no entró al diccionario |
| `lib/renta-periodicidad.ts` | `periodicidadLabel(p, vacío, idioma)` |
| `lib/codigo-aprobacion.ts` | `etiquetaEstadoCodigo(e, quién, idioma)` |
| `lib/rejilla.ts` | `avisoFranja(idioma)`. La **constante** `AVISO_FRANJA_NO_VIAJA_AL_CMS` se queda en español: es la que se congela en el snapshot de la propuesta |
| `lib/finanzas-periodo.ts` | `etiquetaPeriodo(p, idioma)`: la etiqueta la manda el servidor en español y en inglés se **rearma desde ella** («Noviembre 2026» → «November 2026», «4.º trimestre 2026» → «Q4 2026», el rango con `formatFecha`). Lo que no reconoce se deja como llegó |
| `OPCIONES_PERIODO` | se queda en `TableroPeriodo.tsx` (Finanzas no es de este lote); el tablero de propuestas usa `compartidos.periodo.<tipo>` |
| `MapView`, `Campo`, `CampoContrasena`, `Breadcrumbs`, `candado`, `AvisoFranjaCMS` | `useTexto()` / `useIdioma()`. `AvisoFranjaCMS` pasa a `'use client'` (todos sus llamadores ya lo eran). `Modal` y `Sheet` no tienen texto propio |
| `formatMontoCorto` | **no se tocó**: no tiene texto («k» y «M» no son palabras) y la moneda es otra tarea |

**Cómo se demostró que el español no cambió.** Antes de tocar nada se volcó el HTML
español de **27 estados**: los 21 de `pantallas-propuestas.test.ts` (uno nuevo, la
ficha con líneas de la calculadora y una renta) y 6 piezas sueltas de la nueva
`pantallas-compartidos.test.ts` (el mapa dibujando y con la zona cerrada, `Campo`,
migas, el cuadro del candado y el aviso). Después del cambio: **idénticos byte a
byte**. Para que así fuera, «Cerrar zona ({n})» va con `interpolarNodos` (la cifra
sigue siendo su propio nodo, como antes). Además, donde el módulo conserva su tabla
española, `textos/compartidos.test.ts` exige que el diccionario diga exactamente lo
mismo (como el menú con `nav.ts`), y guarda la instantánea de los dos idiomas.

**Lo que miden las pruebas en inglés.** `pantallas-propuestas.test.ts` lleva frases
de estos módulos en las listas de cada pantalla y un **segundo barrido** con el
diccionario de compartidos entero (umbral de 4 letras y palabra completa, porque
aquí los textos son cortos: «Rango», «semana»). Se quitó la excepción que el piloto
hacía con el aviso de la franja: ya está traducido. Siete mutantes (quitar el
`idioma` en tres llamadas, el «(obligatorio)» a mano, dos letras del español y el
plural invertido) mueren los siete.

> [!important] 2026-11-02, segunda vuelta · validador ÁMBAR (`docs/i18n/validacion-compartidos.md`)
> **El mutante M10 sobrevivía:** ningún estado enseñaba un motivo de rechazo de la
> calculadora, así que quitar el `idioma` de `previsualizarCalculadora` en el alta
> no lo veía nadie. Ahora hay un estado con una línea inválida (9 espacios en una
> pantalla de 8) que espera «Loop slots go from 1 to 8.», y M10 **muere**. Otro
> estado nuevo, el tablero con un rango a mano: en inglés el subtítulo ya no repite
> las fechas (la etiqueta del rango YA son las fechas); en español sigue como
> siempre. Se volvió a volcar el HTML español, ahora de **29 estados**, con las
> fuentes de `integra/ingles` y con las nuevas: **idénticos byte a byte**.

**Términos nuevos** (además del glosario de arriba; decisiones del orquestador del
2026-11-02, el dueño puede cambiarlas): CPS · cost per play; CPM · cost per
thousand impressions; millar → **thousand** invariable («2 thousand × …»); catorcena
→ **two-week period(s)** (no «14-day»: «3 14-day periods» se lee «314»); catorcenal →
**every two weeks**; quincenal → **twice a month** (no «biweekly», que en EE. UU. es
ambiguo); por hora → **per hour**; bimestral → every 2 months; semestral → every 6
months; espacio del loop → loop slot; prima → premium; zona (del mapa) → area,
como el «Draw area» del piloto, y el verbo del mapa es siempre **click**, nunca
«tap»; selector de periodo → **This month / Last month / This quarter / Last
quarter / This year / Custom range** (Finanzas lo hereda cuando le toque);
trimestre → quarter (etiqueta «Q4 2026»).

**Lo que sigue en español, a propósito:** la periodicidad del contrato en la ficha
en español sigue saliendo del dato (`mensual`); el servidor (`resolverCalculadora`,
`MSJ_APROBAR_CON_PENDIENTE`, los textos de Actividad de `codigo-aprobacion.ts`) y el
selector de periodo de **Finanzas** (`TableroPeriodo`), que es de su lote. La tabla
de revisión está en `docs/i18n/revision-compartidos.md`.
### Lote campañas y finanzas

**2026-11-02, rama `feat/ingles-campanas-finanzas`.** El inglés sigue APAGADO;
en español no cambia ni una letra.

**Pantallas cubiertas:** la lista de campañas (indicadores, cola «Por validar»,
filtros, vacíos), la ficha de la campaña con sus once secciones, la validación
de publicación y sus tres diálogos, lo que se manda a DOOHmain y el horario
propio, los creativos en DOOHmain, el candado, los datos de facturación, el
horario de transmisión, extender campaña y sus extensiones, el proof of play,
la galería de evidencias, el alta rápida de creativos y el menú lateral. En
Finanzas: la página (listas para facturar, cobranza agrupada por factura,
facturas), generar factura con parcialidades, registrar pago, pagos y
comprobantes, el estado de cuenta, el resumen del periodo y el comprobante.

**Mecanismo, igual que el piloto:** `lib/i18n/textos/campanas.ts` (396 claves) y
`textos/finanzas.ts` (175), esparcidos en `diccionario.ts`, cada uno con su
instantánea (`textos/*.test.ts`). Las etiquetas de estado cuya verdad está en
un módulo compartido que el lote NO toca (`CAMPANA_LABEL`, `ETAPA_LABEL`,
`COBRANZA_LABEL`, `ETIQUETA_ESTADO_REMOTO`, `AVISO_PANTALLA_DOOHMAIN`,
`OPCIONES_PERIODO`, `PERIODICIDAD_LABEL`, `etiquetaVencimiento`,
`AVISO_NO_ES_CFDI`…) se traducen en el punto de uso con mapas de claves
(`components/demo/campanas/etiquetas.ts`, `components/demo/finanzas/etiquetas.ts`)
y una prueba exige que su español sea IDÉNTICO al del módulo.

**Cómo se midió el español:** `lib/i18n/pantallas-campanas-finanzas.test.ts`
rinde **54 estados**. Para abrir las secciones plegadas de la ficha fuerza
`useState` reconociendo en la PILA que la llamada sale de `Seccion` (el orden de
los demás `useState(false)` no es estable). Con `I18N_VOLCAR=<carpeta>` vuelca
el HTML español; se volcó antes y después y los 54 archivos salieron
**idénticos** (`diff -rq`). La prueba barre además los dos diccionarios enteros
contra el HTML inglés de todas las pantallas.

**Términos nuevos** (tabla completa en `docs/i18n/revision-campanas-finanzas.md`):
candado de facturación → *billing lock* · lista para facturar → *ready to
invoice* · OC → *PO* · enviada al dominio → *submitted for publishing* (el
«dominio» es el CMS de destino, no siempre DOOHmain) · validación de publicación
→ *publication review* · evidencia → **evidence** (física; lo digital sigue
*proof of play*) · testigos = fotografías comprobatorias → *proof photos* (en
el código son lo mismo) · cuotas / parcialidades → *installments* · abono →
*partial payment* · liquidar → *record full payment* · saldo → *balance* · folio
de factura → *Invoice no.* (*Internal ref.* solo para propuestas y campañas) ·
folio fiscal → *CFDI UUID* · comprobante de la factura → *payment receipt*;
el archivo adjunto de un pago → *proof of payment* · plazo de cobranza →
*payment terms* · hilo conductor → *demo storyline* · etapa reservada →
*Booked* (como Comercial) · HIBRIDA → *Hybrid* · razón social → *legal name* /
*legal entity* · selector de periodo → *This month / Last month / This quarter
/ Last quarter / This year / Custom range* (glosario del lote de compartidos).

**Segunda vuelta (validador ÁMBAR, `docs/i18n/validacion-campanas-finanzas.md`):**
los 6 hallazgos medios y los 12 bajos aplicados. El mutante M7 (el aviso de
liquidar con la clave del abono) sobrevivía: ahora lo mata
`textos/finanzas.test.ts`, que lee del fuente QUÉ clave usa cada aviso que no
se rinde. El español se volvió a medir: 54 de 54 estados idénticos.

**Sigue en español dentro de estas pantallas (otro lote o el servidor):**
`resumenReserva` y `etiquetaFrecuencia` (`lib/periodos.ts`), `textoHorario` y
`textoReproducciones` de `lib/doohmain-programacion.ts` («Todo el día (sin
franja)», «Las que quepan»), `etiquetaFranja` (solo nombre y horas), los avisos
de franja que manda el servidor y `AvisoFranjaCMS`, la `etiqueta` del periodo
que manda el servidor («Noviembre 2026»), `etiquetaAsignacion` y
`opcionesDeAsignacion` de razones sociales («Sin asignar»), los campos de
`armarComprobante` (emisor «Sin asignar», fecha en formato español), el CSV del
estado de cuenta y su nombre de archivo, `PipelineView`/`Stepper`, `KPICard`,
`EmptyState`, `ConfirmDialog` (su «Cancelar»), `PasoContrasena`,
`PagosRentaCard` y `CompromisoRentaCard`, y los mensajes del servidor (I18N-05).
El dinero sigue por `formatMonto` (lote de moneda). Al juntar con el lote de
compartidos: si traduce `OPCIONES_PERIODO`, `TableroPeriodo` y `EstadoCuenta`
ya pintan con `CLAVE_PERIODO` (claves `finanzas.periodo.*`), y las llamadas a
`resumenReserva`, `etiquetaFrecuencia` (ficha de campaña) y a
`textoHorario`/`textoReproducciones` (`ProgramacionDoohmain`) son las que
tendrían que recibir el idioma.

## Enlaces

- [[acceso-y-sesion-ui]] — la pantalla de entrar, que es la traducida
- [[shell-y-navegacion]] — el menú lateral
- [[convenciones]] — el español como idioma del código
- [[zonas-de-riesgo]] — por qué no se tocó `middleware.ts`
- [[preguntas-abiertas]] — las tres decisiones que faltan
