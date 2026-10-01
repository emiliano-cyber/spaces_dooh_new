---
tipo: modulo
estado: verificado
actualizado: 2026-09-30
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
---

# La aplicación en dos idiomas (I18N-01)

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

- `diccionario.test.ts` exige que **las 26 entradas y los 5 grupos** existan en
  los dos idiomas, y que **el español del diccionario reproduzca exactamente el
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

## 8 · Los mensajes de error del SERVIDOR siguen en español

**Dicho a propósito, no olvidado.** Ver el porqué y la cuenta en
[[02-Backend/_indice]] y abajo:

- El embudo es `respuestaError(e)` (`lib/server/errores.ts`, **archivo de alto
  contacto**), con **137 llamadas**, y **no recibe la petición**.
- Los textos se construyen **en el sitio donde se lanzan**: hay **253
  `new AppError(...)` en 42 archivos**, cada uno con su frase en español.
- Y **11 archivos de prueba** afirman ese texto exacto.

O sea: es un lote propio, y grande. Lo que sí se hizo es dejar el camino:
`next/headers` **sí** está disponible dentro de `respuestaError()` (es
request-scoped), así que el día que se haga no hace falta cambiar 137 firmas.

**Consecuencia honesta, y hay que saberla:** un usuario con la interfaz en
inglés verá el formulario en inglés y, **si algo falla del lado del servidor, el
mensaje en español**. Justo en el peor momento.

Lo que sí quedó cubierto es lo que valida **el navegador** antes de enviar: la
regla de contraseña y la del correo. `lib/password.ts` ganó
**`motivoPassword()`**, que devuelve un **código** (`'corta'`, `'sin-letra'`,
`'sin-numero'`, `'con-espacios'`); `validarPassword()` no cambió ni de firma ni
de texto y sigue sirviendo al servidor, que no tiene idioma.

## 9 · Lo que falta, contado

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

## Enlaces

- [[acceso-y-sesion-ui]] — la pantalla de entrar, que es la traducida
- [[shell-y-navegacion]] — el menú lateral
- [[convenciones]] — el español como idioma del código
- [[zonas-de-riesgo]] — por qué no se tocó `middleware.ts`
- [[preguntas-abiertas]] — las tres decisiones que faltan
