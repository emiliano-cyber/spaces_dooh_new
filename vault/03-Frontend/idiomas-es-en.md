---
tipo: modulo
estado: verificado
actualizado: 2026-11-04
tags: [frontend, i18n, idiomas, ingles, dinero]
archivos:
  - apps/web/components/demo/shell/salir.ts
  - apps/web/lib/i18n/idiomas.ts
  - apps/web/lib/i18n/formato-idioma.ts
  - apps/web/lib/i18n/diccionario.ts
  - apps/web/lib/i18n/dinero.ts
  - apps/web/lib/i18n/moneda-cliente.tsx
  - apps/web/lib/server/moneda-instancia.ts
  - apps/web/lib/server/moneda-alta.ts
  - apps/web/lib/server/idioma-instancia.ts
  - apps/web/lib/server/idioma-alta.ts
  - apps/web/lib/contrato-documento.ts
  - apps/web/components/demo/arrendadores/ConstanciaFirmas.tsx
  - apps/web/lib/i18n/idioma-documentos-cliente.tsx
  - apps/web/lib/server/correo-recordatorios.ts
  - apps/web/lib/server/propuesta-correo.ts
  - apps/web/lib/i18n/servidor.ts
  - apps/web/lib/i18n/contexto.tsx
  - apps/web/lib/server/idioma-cuenta.ts
  - apps/web/lib/server/huella-sesion.ts
  - apps/web/lib/server/idioma-controller.ts
  - apps/web/app/api/perfil/idioma/route.ts
  - apps/web/components/demo/admin/IdiomaCuenta.tsx
  - db/migrations/20261103_usuarios_idioma_preferido.sql
  - apps/web/app/layout.tsx
  - apps/web/app/(app)/login/page.tsx
  - apps/web/components/demo/shell/Sidebar.tsx
  - apps/web/components/demo/ui/SelectorIdioma.tsx
  - apps/web/lib/password.ts
  - scripts/i18n-inventario.mjs
  - apps/web/lib/i18n/guardias-ingles.ts
  - apps/web/lib/i18n/errores-servidor.ts
  - apps/web/lib/i18n/errores-acceso.ts
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
  - apps/web/lib/i18n/textos/compartidos.ts
  - apps/web/lib/i18n/textos/costura.test.ts
  - apps/web/lib/doohmain-programacion.ts
  - apps/web/lib/periodos.ts
  - apps/web/components/demo/razones-sociales/asignacion.ts
  - apps/web/components/demo/finanzas/etiquetas.ts
  - apps/web/components/demo/finanzas/comprobante.ts
  - apps/web/components/demo/finanzas/facturas-lista.ts
  - docs/i18n/revision-costura.md
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

> [!note] 2026-11-03 · Hay un TERCER idioma: el italiano, también apagado
> Ola 0 del italiano ([[italiano-olas]]). Lo que cambió en esta nota:
>
> - El interruptor ya no es uno: cada idioma tiene el suyo (`IDIOMA_INGLES`,
>   `IDIOMA_ITALIANO`) y `idiomasActivos()` (`lib/i18n/idiomas.ts`) dice cuáles
>   están encendidos. `idiomaDeLaPeticion()`, `pages/_error.tsx` y el layout raíz
>   leen esa lista; un idioma apagado se trata **como uno que no hablamos**
>   (`resolverIdioma({ …, permitidos })`). Con todo apagado, lo de siempre:
>   español sin mirar nada.
> - El layout pasa `disponibles={idiomasActivos()}` y `puedeElegir` si hay más de
>   uno; el selector ofrece solo esos.
> - **El formato de cada idioma vive en `lib/i18n/formato-idioma.ts`**
>   (`FORMATO_IDIOMA`): locale, símbolo y su posición, fecha por omisión,
>   porcentaje. `LOCALE_DE_IDIOMA` y los símbolos de `dinero.ts` salen de ahí.
>   Las bifurcaciones `idioma === 'en' ? 'en-US' : 'es-MX'` del árbol pasaron a
>   `localeDe(idioma)` / `numeroEnIdioma()`.
> - `DICCIONARIOS.it` es el inglés con el italiano encima: lo que falta cae al
>   **inglés**. Español e inglés quedaron idénticos byte a byte (medido sobre
>   todo el HTML de las pruebas: `docs/i18n/revision-italiano-base.md` §4).

> [!important] 2026-11-03 · el idioma de la interfaz, también POR PERSONA (IDIOMA-USUARIO)
> Decisión del dueño: *«el idioma de papeles y contratos es fijo al crearse la
> app en cada server, pero el idioma de lo demás se debe poder configurar por
> usuario y navegador»*. Rama `feat/idioma-por-usuario`. Los documentos (el
> idioma de la instancia) son **otra tarea**; esto es solo la interfaz.
>
> - **Precedencia** (`resolverIdioma`, pura): `cuenta > cookie > Accept-Language
>   > español`, siempre filtrada por los idiomas ENCENDIDOS. Una preferencia de
>   un idioma apagado se ignora sin error (y no se borra). Sin sesión, cookie >
>   navegador. **Sin preferencia, exactamente lo de antes** —
>   `idioma-cuenta.test.ts` lo recorre combinación por combinación.
> - **Dónde vive**: `usuarios.idioma_preferido` (`null` = sigue al navegador),
>   migración `20261103_usuarios_idioma_preferido.sql`.
> - **Cómo llega a cada petición SIN consultar la base**: en la cookie
>   `spaces_idioma_cuenta` = `<idioma>.<huella del token de sesión>`
>   (httpOnly). La ponen el login, Google, el código de recuperación y
>   `PUT /api/perfil/idioma`; la borra el logout, y el Topbar sale con una
>   **carga completa** (`components/demo/shell/salir.ts`, B64, 04/11): con
>   `router.push` la pantalla de entrar se quedaba en el idioma de la cuenta
>   que acababa de salir. `idiomaDeLaPeticion()` (que
>   sigue siendo **síncrona**: la usan `respuestaError()` y media docena de
>   Server Components) solo la cree si la huella casa con la sesión de ESA
>   petición: otra persona en el mismo navegador, o ninguna sesión, y se
>   ignora. Así también los **errores del servidor** salen en el idioma de la
>   cuenta. `middleware.ts` y `lib/server/auth.ts` **no cambiaron**.
> - **Dónde se elige**: «Mi cuenta → Idioma» (`components/demo/admin/IdiomaCuenta.tsx`
>   en `/configuracion`): «Usar el idioma del navegador» + cada idioma
>   encendido. **Con un solo idioma encendido no se pinta** (hoy, toda la flota):
>   la página queda idéntica. Al guardar, `router.refresh()` y la página vuelve
>   en el idioma nuevo sin recargar.
> - **El selector rápido** (`SelectorIdioma`, pie del login) **sigue escribiendo
>   solo la cookie del navegador**: vive en la pantalla de entrar, donde no hay
>   sesión ni cuenta que guardar. No hay otro selector con sesión.
> - **Tras el login**: si la cuenta trae un idioma encendido distinto del de la
>   pantalla, el login hace una carga completa (`cambiaIdiomaAlEntrar`), porque
>   `router.push` no vuelve a pintar el layout raíz.
> - **Lo que cuesta, y se acepta**: si la persona cambia su preferencia desde
>   OTRO dispositivo, éste no se entera hasta su siguiente inicio de sesión (o
>   hasta guardarla ahí). Y `pages/_error.tsx` (la página de error del Pages
>   Router) sigue con `cookie > navegador`: no puede importar `node:crypto`.
> - **Medido**: 14 mutantes unitarios y 4 e2e (con build por mutante), todos
>   muertos; el HTML de las 15 pruebas de pantallas antes/después difiere
>   **solo** en los 10 estados de `/configuracion` que traen la tarjeta nueva
>   (las pruebas los pintan con `puedeElegir`); e2e
>   `lib/test/idioma-por-usuario.e2e.test.ts`.

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
cuenta (con sesión)  >  cookie spaces_idioma  >  cabecera Accept-Language  >  español
```

(La cuenta entra el 2026-11-03; ver el recuadro de IDIOMA-USUARIO arriba.)

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

> [!note] 2026-11-03 · YA NO SOLO POR NAVEGADOR — el recuadro de abajo es historia
> El dueño pidió la preferencia por persona: ver IDIOMA-USUARIO arriba. La
> cookie sigue siendo la elección del NAVEGADOR y manda cuando la cuenta no
> tiene preferencia.

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

> [!danger] EL IDIOMA NO TOCA EL DINERO — y desde el 02/11 la MONEDA es de la INSTANCIA
> Decisión del dueño (30/09): «el sistema se rige 100 % en pesos mexicanos por
> ahora, después lo moveremos». **El «después» llegó el 2026-11-02**
> ([ADR 0048](../../docs/adr/0048-la-moneda-es-de-la-instancia-y-no-se-cambia.md)):
> cada instancia trabaja en **MXN o USD**, se elige **al crearla** y **no se
> puede cambiar**. Las que ya existían se quedan en MXN.

**De dónde sale la moneda.** Ya no hay constante: `MONEDA = 'MXN'` desapareció.
La moneda vive en `tenants.moneda` (`config_negocio.moneda` es su espejo) y
la app la guarda en `lib/i18n/dinero.ts` (`monedaInstancia()`), **en `globalThis`
y no en un `let` del módulo**: el build empaqueta ese archivo varias veces (una
copia para las rutas de `app/api`, otra para el layout y las páginas; lo midió el
validador el 02/11), y con un `let` fijarla en el layout no la fijaba para una
ruta. La escriben solo dos sitios —lo vigila una guardia, y otra prueba que dos
copias del módulo ven la misma—:

- **Servidor:** `monedaDeLaInstancia()` (`lib/server/moneda-instancia.ts`), que
  lee `select moneda from tenants order by creado_en limit 1` con `qRaw1`
  (`tenants` no tiene RLS fail-closed; es correcto aquí). La llaman el **layout
  raíz** (`app/layout.tsx`), el **documento imprimible de la propuesta**, las
  **rutas que escriben importes** y, como punto común, **`tenantActual()`**
  (`lib/server/tenant.ts`): casi toda petición con sesión pasa por ahí, y no hay
  envoltura de handlers en el repo. **Se cachea por proceso** en cuanto existe
  una organización (es inmutable); sin organizaciones no, y el alta la recuerda
  al crear la primera. Tras una corrección de datos que cambie la moneda, hay
  que reiniciar la aplicación.
- **Navegador:** `ProveedorMoneda` (`lib/i18n/moneda-cliente.tsx`), montado en
  el layout raíz, la fija **durante el render** —no en un efecto— para que el
  primer `formatMonto` del SSR y de la hidratación ya la vean.

Que sea un global de módulo es seguro **solo porque es de la instancia**: la base
impide dos monedas en la misma (`tenants_moneda_unica`), así que todas las
peticiones escriben el mismo valor. El idioma, que sí cambia por petición, sigue
siendo parámetro.

**El símbolo.** El `$` a secas es la moneda local del lector:

| | español | inglés |
|---|---|---|
| **MXN** | `$1,234.50` (igual que antes) | `MX$1,234.50` |
| **USD** | `US$1,234.50` | `$1,234.50` |

`formatearDinero(monto, idioma, decimales?)` **sigue sin aceptar moneda** — el
tercer parámetro son solo los decimales, con valor por omisión
(`formatearDinero.length` sigue siendo 2). `formatMonto(n, idioma?)` y
`formatMontoCorto(n, idioma?)` (`lib/data/derive.ts`) conservan su estilo
(`$ 1,234.50`, negativos entre paréntesis) y solo cambian el símbolo; el idioma
es opcional y las ~250 llamadas que no lo pasan escriben el símbolo español.
`simboloMoneda(idioma?)` y `nombreMoneda(idioma?)` sirven a quien pinta el
símbolo suelto (un adorno de campo, la ficha de Administración).

> [!important] 2026-11-02 · las pantallas en inglés YA pasan su idioma al dinero
> Decisión del dueño: **en inglés, el dinero se escribe con el símbolo de la
> moneda de la instancia, sin ambigüedad**. Hasta ese día las pantallas
> traducidas llamaban `formatMonto(n)` **sin idioma**, así que el inglés de una
> instancia MXN escribía `$ 1,000.00` — que un lector anglosajón lee como
> dólares — y el de una USD, `US$`. Ahora cada llamada de las pantallas
> traducidas recibe el idioma de la pantalla (`useIdioma()` en el cliente,
> `idiomaDeLaPeticion()` en el servidor):
>
> - **Conectadas:** propuestas (lista, alta, duplicar, agregar sitios, ficha,
>   tablero, calculadora y el **documento imprimible**
>   `app/(app)/propuesta/[id]/page.tsx`), campañas (lista, ficha, indicadores,
>   resumen), finanzas (página, estado de cuenta, tablero del periodo,
>   comprobante de pago y su diálogo), comercial (página, ficha del sitio,
>   reserva, Comercial negociación). Y `resumenContratacion` y
>   `resumenReserva` (`lib/periodos.ts`), que ya recibían `idioma`, se lo pasan
>   también al importe. Códigos no pinta importes (solo porcentajes).
> - **NO cambian, a propósito:** correos, CSV, el PDF de contrato, la cantidad
>   con letra (está ligada al hash de las firmas) y los textos de bitácora que
>   arman las rutas de `app/api` y `lib/tarifa-calculada.ts`: siguen en español.
> - **Quedan para su lote** (aún sin traducir, siguen con el símbolo español):
>   inicio, inventario, arrendadores, clientes, reportes, network, paquetes,
>   energía, operaciones (OT), administración, Space Eyes y la página pública
>   `app/(app)/p/[id]`.
>
> **Medido, no supuesto.** `pantallas-propuestas`, `pantallas-campanas-finanzas`
> y `pantallas-comercial` (`.test.ts`) pintan cada estado con **las dos
> monedas y en los dos idiomas** y leen el HTML con `leerDinero`
> (`lib/i18n/simbolo-en-pantalla.ts`): ningún importe puede llevar otro símbolo
> que el de la tabla, y el arnés exige haber encontrado importes. En rojo antes
> del cambio: **88** pruebas (44 estados en inglés × 2 monedas; el español
> pasaba ya con las dos), más **2** que afirmaban el `$` viejo en inglés
> (`pantallas-propuestas` y `compartidos-idioma.test.ts`). `pantallas-compartidos`
> no lleva la comprobación porque no pinta ningún importe (medido: cero).
> Y el español quedó **idéntico**: el HTML español de los 109
> estados de las cuatro pruebas de pantallas (`I18N_VOLCAR` / `VOLCAR_HTML`),
> volcado antes y después, da `diff -rq` vacío.

**Medido, no supuesto:** `dinero.test.ts` y `derive.formato-moneda.test.ts`
llevan una copia LITERAL de la implementación anterior y comparan, en una
instancia MXN, **más de 2000 importes** (bordes y pseudoaleatorios con semilla
fija) en los dos idiomas: `formatearDinero`, `formatearDineroRedondo`,
`formatMonto` y `formatMontoCorto` salen **idénticos** carácter por carácter.

La prueba negativa obligatoria (`dinero.test.ts`) verifica, para cada moneda y
ocho importes, que **el número que se lee de vuelta es idéntico en los dos
idiomas**; que una instancia MXN nunca dice `USD`/`US$` y una USD nunca dice
`MXN`/`MX$`; y que fijar una moneda que no es MXN ni USD **lanza** en vez de
caer a MXN. Las guardias que recorren **todo `apps/web`**:

1. `style: 'currency'` **solo existe en `dinero.ts`**, y ahí con
   `currency: monedaInstancia()`. Hasta el 02/11 se admitía `currency: 'MXN'`
   en cualquier archivo; ya no (había cuatro en `lib/data/reportes.ts` y uno en
   `components/demo/energia/captura.ts`, que ahora usan `formatearDinero*`).
2. Ningún archivo escribe una moneda a mano en un `currency:`.
3. Ningún `currency:` se decide con un ternario sobre el idioma o el locale.
4. Solo `moneda-instancia.ts` y `moneda-cliente.tsx` llaman
   `fijarMonedaInstancia`.
5. Y **ningún diccionario puede llevar dinero dentro**: ni un símbolo, ni un
   código, ni una cifra con separador de miles.

> [!important] 2026-11-02 · los textos ya no dan por hecho el PESO (rama `feat/pesos-neutral`)
> Con la moneda de la instancia, «pesos enteros», «al peso» y «whole number of
> pesos» eran falsos en una instancia USD. **Única excepción autorizada** al
> «el español se queda tal cual» ([[ingles-olas]] §3). Redacción neutra, la
> misma en los dos idiomas: **«cantidad entera» / «whole amount»**, **«sin
> centavos» / «no cents»** y **«exacto» / «exactly»**. Las cuatro
> claves de `lib/i18n/textos/catalogos.ts` que cambiaron:
>
> | Clave | Español | Inglés |
> |---|---|---|
> | `catalogos.paquetes.precio` | Precio del conjunto (cantidad entera, sin centavos) | Price for the set (whole amount, no cents) |
> | `catalogos.paquetes.lista.explicacion.peso` | con exactitud | exactly |
> | `catalogos.paquetes.reparto.cuadra` | — cuadra exacto | — adds up exactly |
> | `catalogos.motivo.paquete.precio-entero` | El precio del paquete tiene que ser una cantidad entera: el reparto… | The bundle price has to be a whole amount: the split… |
>
> La última es también el literal de `motivoPaqueteInvalido` (`lib/paquete.ts`),
> que el servidor manda tal cual: cambiaron juntos. No está en
> `errores-servidor.ts` (llega por `AppError(motivo)` sin entrada propia).
> El nombre de clave `…explicacion.peso` y su hueco `{peso}` se quedan: son
> identificadores, no texto.
>
> **Por qué «exacto» y no «al centavo»** (validación ÁMBAR, H1, decisión del
> orquestador): `repartirPaquete` reparte en unidades enteras, así que «al
> centavo» sugería una precisión que no existe y chocaba con «(cantidad entera,
> sin centavos)» en la misma pantalla. En la explicación va «con exactitud»
> porque el hueco cierra la frase («…da el precio del paquete con exactitud»);
> «exacto» ahí se leía como adjetivo del precio. En inglés, «exactly» en los dos.
>
> **No se tocó, a propósito:** la cantidad con letra del contrato (ya depende de
> la moneda y va ligada al hash de las firmas), los recibos de CFE,
> `nombreMoneda()` («Peso mexicano (MXN)» es correcto: sale de la moneda), el
> «En México el punto…» de `captura-cifra` (formato de número, no moneda),
> comentarios, migraciones, semillas y nombres de pruebas.
>
> **Medido:** el HTML español de los 124 estados de las cinco pruebas de
> pantallas (`I18N_VOLCAR` / `VOLCAR_HTML`), antes y después, solo difiere en
> tres estados de Paquetes y solo en esas frases; `DICCIONARIOS.es` solo
> cambia en esas cuatro claves. Y lo vigila una guardia
> (`textos/costura.test.ts`): **ningún diccionario, en ningún idioma, nombra
> pesos, «M.N.», dólares ni los códigos MXN o USD como palabra suelta** fuera
> de los huecos. «Peso» en el sentido de grosor o importancia («peso de la
> fuente», «peso visual») va en una lista corta de excepciones con su motivo;
> el mutante «(whole MXN)» en el inglés muere.

**Inmutable en dos capas** (ver [[04-Datos/migraciones]] y
[[04-Datos/esquema]]): la migración `20261102_moneda_inmutable_por_instancia.sql`
(CHECK + triggers) y la API (`PATCH /api/config` rechaza `moneda` con 400; el
alta y la edición de contratos rechazan otra moneda). Cómo se elige al crear:
`provision-instancia.sh --moneda MXN|USD` → `POST /api/bootstrap`
(`lib/server/moneda-alta.ts`), ver [[01-Arquitectura/modelo-instancias-soberanas]].

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

> [!success] 2026-11-02 · lote servidor: las plantillas YA se traducen (medido)
> Medido sobre `feat/ingles-servidor` con el mismo extractor de las guardias
> (comentarios tachados, pruebas fuera):
>
> | | Sitios | |
> |---|---:|---|
> | `new AppError(...)` de producción, en 57 archivos | **343** | |
> | · literales (todos en el catálogo; la guardia lo exige) | 219 | 64 % |
> | · **plantillas con `${…}`** | **45** | 13 % |
> | &nbsp;&nbsp;– traducidas por patrón | **44** | |
> | &nbsp;&nbsp;– la composición de `validar()`, que va por partes | 1 | |
> | · por variable (`e.message`, `motivo`, una constante) | 79 | 23 % |
>
> Las **44** se traducen con `PATRONES_ERROR` —la vía que ya usaban los
> motivos de zod con un número—, que pasa de **15 a 53** patrones. El patrón
> aprendió dos cosas: `{n|uno|otros}` (el plural con contador: «1 page» /
> «5 pages») y `huecos` (los pocos valores que traen español armado por el
> propio servidor: periodicidad, etapa del prospecto, datos que faltan, lo que
> bloquea borrar un cliente). `CATALOGO_ERRORES` sigue en **201** entradas y
> gana un hermano, `CATALOGO_LIB` (**27**), que sale del diccionario
> (`textos/servidor.ts`). **`lib/server/errores.ts` no se tocó.** La guardia
> nueva es `errores-servidor-plantillas.test.ts`: arma cada plantilla del árbol
> con valores de ejemplo y exige español idéntico e inglés sin rastro de
> español. Detalle en [[#Lote servidor]].
>
> **Lo que sigue sin medir con certeza son los 79 por variable.** Un barrido
> aproximado de las clases de dominio que los controladores reenvían
> (`PropuestaError`, `CanjeImposible`, `PaqueteImposible`, `ValidacionError`,
> `FacturaError`…) y de los `return` de las funciones `motivo*` da **128
> mensajes distintos**, de los que **20** ya están cubiertos: quedan **~108**
> en español. Es el lote siguiente, y está contado.

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

> [!success] Resuelto por el lote de compartidos y la costura (2026-11-02)
> Todo lo de esta lista que era de un módulo compartido sale traducido desde el
> lote de compartidos; la costura cerró el selector de periodo (una sola fuente
> de claves). Siguen en español `formatMontoCorto` (no tiene texto; la moneda es
> otra tarea) y los mensajes del servidor (I18N-05). Ver «Costura» abajo.

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
ambiguo); por hora → **per hour**; bimestral → every two months; semestral → every
six months (en letra desde el retoque de la costura); espacio del loop → loop slot; prima → premium; zona (del mapa) → area,
como el «Draw area» del piloto, y el verbo del mapa es siempre **click**, nunca
«tap»; selector de periodo → **This month / Last month / This quarter / Last
quarter / This year / Custom range** (Finanzas lo hereda cuando le toque);
trimestre → quarter (etiqueta «Q4 2026»).

**Lo que sigue en español, a propósito:** la periodicidad del contrato en la ficha
en español sigue saliendo del dato (`mensual`); el servidor (`resolverCalculadora`,
`MSJ_APROBAR_CON_PENDIENTE`, los textos de Actividad de `codigo-aprobacion.ts`) y el
selector de periodo de **Finanzas** (`TableroPeriodo`), que es de su lote. La tabla
de revisión está en `docs/i18n/revision-compartidos.md`.

> [!success] Costura (2026-11-02) · el selector de Finanzas ya usa estas claves
> `CLAVE_PERIODO` apunta a `compartidos.periodo.*`, las `finanzas.periodo.<tipo>`
> desaparecieron, y Finanzas pinta la etiqueta del servidor con `etiquetaPeriodo`.

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

> [!success] Costura (2026-11-02) · resuelto
> `resumenReserva` y `etiquetaFrecuencia` (ficha), `textoHorario` y
> `textoReproducciones` (`ProgramacionDoohmain`), `AvisoFranjaCMS`, la etiqueta
> del periodo (`TableroPeriodo`, `EstadoCuenta`), `etiquetaAsignacion` y
> `opcionesDeAsignacion`, el emisor de `armarComprobante` y la fecha en
> `ComprobanteDialog`, y además
> la columna «La emite» de `armarListaFacturas`, que no estaba en esta lista.
> Siguen en español: los avisos de franja que manda el servidor, el CSV del
> estado de cuenta, `PipelineView`/`Stepper`, `KPICard`, `EmptyState`,
> `ConfirmDialog`, `PasoContrasena`, `PagosRentaCard`, `CompromisoRentaCard` y
> los mensajes del servidor. Detalle en «Costura».

### Lote comercial

**2026-11-02, rama `feat/ingles-comercial`** (sale de `integra/ingles`). El inglés
sigue APAGADO; en español no cambia ni una letra.

**Pantallas cubiertas:** `/comercial` (lista, KPI, filtros, «En propuesta»,
mapa y su leyenda) con la ficha del sitio (`SiteFicha`: características,
datos comerciales, arrendador y renta, ubicación, y los cuadros de editar,
tarifas por unidad, pausa legal, reubicar y eliminar), el alta de pantalla, la
reserva y la visión de Space Eye; Comercial negociación (`ComercialOpex`) entera,
y los Códigos de negociación (`/codigos-promocionales` y `GestionCodigos`).

- **559 claves** en dos archivos: `lib/i18n/textos/comercial.ts` (500,
  `comercial.*`) y `textos/codigos.ts` (59, `codigos.*`), esparcidos en
  `diccionario.ts`. Cada uno con su instantánea (`comercial.test.ts`,
  `codigos.test.ts`), que además exige que ningún inglés sea igual al español
  (salvo 11 declaradas), que no lleve acentos, que los huecos coincidan y que no
  haya espacio antes de «%».
- **Espejos de etiquetas compartidas.** `SITIO_LABEL`, `CONTRATO_LABEL`,
  `PAGO_LABEL`, `TIPO_MEDIO_LABEL`, `ETIQUETA_ETAPA` y las etiquetas de
  `lib/negociacion.ts` NO se tocaron. Las pantallas del lote pintan una clave por
  valor (`components/demo/comercial/claves.ts` y los `CLAVE_*` de
  `ComercialOpex.tsx`), y `pantallas-comercial.test.ts` exige que su español
  reproduzca EXACTAMENTE la etiqueta original. Si el lote de esos módulos crea
  sus propias claves, estas se pueden sustituir sin tocar el español.
- **Lo que se guarda no se traduce.** Las vistas cardinales (`Norte`…) siguen
  guardándose en español: solo se traduce lo que se pinta. El nombre por
  omisión de una reserva sin nombre sí sale en el idioma de quien la crea
  («X — campaign»).

**Cómo se demostró el español idéntico:** `pantallas-comercial.test.ts` rinde
**23 estados** (con `useState` forzado, como el piloto, y el reloj fijo con
`vi.setSystemTime` para que «hace 2 h» y la hora de la foto no cambien entre
corridas). Con `VOLCAR_HTML=<carpeta>` escribe el HTML español de cada estado: se
volcó antes de tocar los componentes y después, y `diff -rq` salió vacío (23/23).

**Glosario añadido** (además del de arriba; segunda vuelta del 2026-11-02 con
las decisiones del orquestador, que el dueño puede cambiar): reserva →
**booking** (reservar → *book*, tentativa → *tentative*; el estatus reservado /
reservada → **Booked**, igual en el lote de campañas) · ficha → **profile**,
pero ficha técnica → **Spec sheet** · Comercial (el módulo) → *Sales*, como el
menú · Comercial negociación / OPEX → **Lease negotiation** (también
`nav.comercial-opex`, solo el `en`) · prospección → *prospecting* · predio →
*property* · Valla → **Poster panel** · Mural → *Mural* · Espectacular →
*Billboard* · fija → *static* · catorcenal → **every two weeks** (catorcena →
*two-week period(s)*) · cupo de clientes → *client cap* · tope de usos → *usage
cap* (sin tope: «3 (no cap)») · vigente/próximo/vencido/agotado (códigos) →
*active / upcoming / expired / limit reached* · siempre «Click», nunca «Tap» ni
«press».

> [!note] Segunda vuelta (validación ÁMBAR, `docs/i18n/validacion-comercial.md`)
> Se aplicaron los 4 hallazgos medios y los bajos. El estatus del sitio va en
> minúsculas **solo en español** («Sitio reservado · sin oc · …», como
> siempre); en inglés «Not available to book (status: Booked · no PO)». El
> nombre por omisión de una reserva sin nombre se sigue guardando en el idioma
> de quien la crea, como en los otros lotes. Español: 23/23 estados idénticos
> otra vez.

**Sigue en español dentro de estas pantallas** (de otros lotes): `UNIDAD_LABEL`
(`lib/periodos.ts`, el nombre de la unidad en las tarifas), `periodicidadLabel`,
`textoOrigenDoohmain`, los motivos de `lib/negociacion.ts` (el aviso de «está en
revisión / perdido» y los `title` de los pasos), el motivo de
`interpretarUbicacion`, `SlotsBadge`, `ClientesBadge`, `CalendarioDisponibilidad`,
`FotoUploaderMock`, `RejillaDialog`, el candado y el « (obligatorio)» de `Campo`;
la unidad de la tarifa publicada (`sitio.unidad`, un dato: «mensual»), y los
mensajes del servidor (I18N-05). El dinero sigue por `formatMonto` (otra tarea).

> [!success] Costura (2026-11-02) · resuelto
> `UNIDAD_LABEL` (ahora `etiquetaUnidad`), `periodicidadLabel`,
> `textoOrigenDoohmain`, la unidad de la tarifa publicada, el candado y el
> « (obligatorio)» de `Campo` (ya traducidos por compartidos; la prueba dejó de
> saltárselos) y el plural de `cupo.ahora` («1 client.» está en la lista). Siguen
> en español los motivos de `lib/negociacion.ts`, el de `interpretarUbicacion`,
> `SlotsBadge`, `ClientesBadge`, `CalendarioDisponibilidad`, `FotoUploaderMock`,
> `RejillaDialog` y los mensajes del servidor.

### Costura

**2026-11-02, rama `feat/ingles-costura`** (sale de `integra/ingles`, que junta
los cuatro lotes). El inglés sigue APAGADO; en español no cambia ni una letra.
Cada lote se hizo en su rama sin ver a los demás: la costura los cose. Tabla de
revisión en `docs/i18n/revision-costura.md`.

**1 · Una sola fuente para el selector de periodo.** Finanzas tenía
`finanzas.periodo.<tipo>` y compartidos `compartidos.periodo.<tipo>` para las
mismas seis opciones. `CLAVE_PERIODO` (`components/demo/finanzas/etiquetas.ts`)
apunta ahora a las compartidas, las de Finanzas desaparecen y el tablero de
Propuestas usa `CLAVE_PERIODO`. Las dos pruebas de paridad con
`OPCIONES_PERIODO` se conservan; una tercera exige la fuente única.

**2 · El idioma conectado a lo que ya lo aceptaba, o lo acepta desde hoy.**
Mismo patrón que compartidos: último parámetro `idioma` con `'es'` por
omisión, el español devuelve el literal de siempre y el inglés va a
`textos/compartidos.ts`, cuyo español `compartidos.test.ts` ata al módulo.

| Función | Ganó `idioma` | Quién lo pasa ahora |
|---|---|---|
| `resumenReserva` (`lib/periodos.ts`) | sí (solo la unidad; el importe sigue por `formatMonto`) | ficha de campaña |
| `etiquetaFrecuencia` | ya lo tenía | ficha de campaña |
| `textoHorario`, `textoReproducciones`, `textoOrigenDoohmain` (`lib/doohmain-programacion.ts`) | sí | `ProgramacionDoohmain`, `SiteFicha` |
| `etiquetaUnidad`, `periodicidadLabel` | ya lo tenían | `SiteFicha` (sustituye a `UNIDAD_LABEL`; también la unidad de la tarifa publicada) |
| `etiquetaPeriodo` | ya lo tenía | `TableroPeriodo`, `EstadoCuenta` (con rango a mano, el subtítulo inglés no repite las fechas) |
| `etiquetaAsignacion`, `opcionesDeAsignacion` | sí | Finanzas (cobranza y generar factura) |
| `armarComprobante`, `armarListaFacturas` | sí | `ComprobanteDialog` (y la fecha con `formatFecha` en inglés), Finanzas |
| `etiquetaEstadoCodigo`, `avisoFranja`/`AvisoFranjaCMS` | ya lo tenían | ya estaban conectados: nada que hacer |

Arrendadores e Inventario siguen llamándolas sin idioma: no son de ningún lote
traducido, y el `'es'` por omisión las deja como estaban.

**3 · Lo mismo dicho de la misma manera.** `textos/costura.test.ts` mira los
seis diccionarios juntos: el mismo español en dos lotes lleva el mismo inglés,
salvo ocho textos declarados con su motivo (Folio, Vigencia, Vencido, Por
vencer, Plazo, Horario, Desde, Comercial: significan otra cosa en cada
pantalla); ningún apóstrofo recto; ninguna periodicidad fuera del glosario.
Se unificó «Cada cuándo se paga» → *Payment frequency*; las cuotas de Finanzas →
*twice-monthly / every two months / every six months / yearly*; el apóstrofo →
tipográfico (’) en propuestas y compartidos, como los otros cuatro; y las fotos
del candado → *proof photos* también en Finanzas. «Booked», «negotiation code»,
«Internal ref.», «Invoice no.» y «Click» ya eran uniformes (medido).

**4 · Los avisos de Campañas que no se rinden.** `textos/campanas.test.ts` lee
el fuente de `ValidacionPanel` y `CreativosEnDoohmain` y fija qué clave usa cada
rama, como la gemela de Finanzas. M12 (retirado ↔ bajado) **muere**, y también
invertir el plural de «publicada» y cambiar «pausado» por «reanudado».

**5 · El plural de Comercial.** « client.» en la lista inglesa del cuadro de
editar: invertir `cupo.ahora.uno/.otros` («1 clients.») ya cae.

**Las pruebas de pantallas vigilan ahora los módulos compartidos.** Campañas y
Finanzas, y Comercial, ganan el segundo barrido con el diccionario de
compartidos que ya tenía Propuestas, y dejan de quitar antes del barrido el aviso
de la franja, el horario de DOOHmain, el origen del id y el « (obligatorio)».
Ese barrido encontró la columna «La emite», que no estaba en ninguna lista.

**El español, medido.** Las pruebas de pantallas de propuestas y compartidos
ganan `I18N_VOLCAR` (como la de campañas). Se volcó el HTML español de los
**107 estados** (23 + 6 + 55 + 23) con las fuentes de `integra/ingles` y con las
de la costura, con las mismas pruebas: `diff -rq` **vacío**. Contra la línea
base volcada antes de tocar nada, propuestas, compartidos y comercial salen
idénticos; en campañas y finanzas solo cambian los estados cuyos DATOS de
prueba se ampliaron (la reserva con 12 pases al día, una fila más en lo que se
manda a DOOHmain, un estado nuevo del rango a mano).

Y comparando los diccionarios enteros (`DICCIONARIOS`) antes y después: 17
claves nuevas, 6 retiradas, 32 con el inglés cambiado y **0 con el español
cambiado**.

#### Retoques tras la validación (VERDE con 11 menores, `docs/i18n/validacion-costura.md`)

- **El estado de cuenta vacío con un rango a mano** decía en inglés «No invoices
  or payments in Jan 5, 2026 to Mar 9, 2026.». Ahora, solo en inglés y solo con
  rango, `finanzas.estado-cuenta.vacio-rango`: «No invoices or payments from
  {desde} to {hasta}.». El español sigue con la clave de siempre.
- **Lo que rodea al selector de periodo**, con una sola fuente
  (decisión del orquestador): el aria, el «Elige la fecha de inicio y la de
  fin.» y desde / a / hasta pasan a `compartidos.periodo.aria/.elige/.desde/
  .hasta/.a`. Desaparecen `finanzas.periodo.aria/.elige`,
  `finanzas.comun.desde/.hasta/.a` y `propuestas.tablero.periodo/.a/.elige-fechas`.
- **Los dos mutantes que sobrevivían mueren.** M1b, con un estado nuevo de
  Comercial con un sitio sin id de DOOHmain. M5b, con la tercera gemela «qué
  clave usa cada aviso» en `textos/comercial.test.ts` (SiteFicha, la página de
  Comercial y `GestionCodigos`).
- **Decisiones del orquestador sobre el glosario** (el dueño puede cambiarlas):
  la sección «Comercial» de importes de la ficha de campaña es **Pricing**; las
  periodicidades van **siempre en letra** («every two months», «every six
  months», «twice-monthly»); «in thousands» se queda (expresión fija de una
  unidad de tabla).
- **Forma:** «Don’t have an account?» en el diccionario base; «Bundle
  “{nombre}”»; «internal ref.» en minúscula a media frase. `costura.test.ts`
  mira ahora `DICCIONARIOS.en` ENTERO (no solo los seis lotes) y gana tres
  guardias: comillas rectas que abren, «Internal ref.» a media frase y «every
  <cifra>».
- **Español, otra vez medido:** 109 estados (23 + 6 + 56 + 24) con las fuentes
  de `integra/ingles` y con las de HEAD, mismas pruebas: `diff -rq` vacío.
  `DICCIONARIOS.es` frente a `f2e0a15f`: 23 claves nuevas, 14 retiradas, **0
  valores cambiados**, y ningún texto español retirado se quedó sin clave que lo
  pinte.

### Lote catálogos

**2026-11-02, rama `feat/ingles-operaciones`** (sale de `integra/ingles`). Es la
parte de «catálogos de precio» del lote «operaciones, clientes y catálogos»; la
de operaciones y la de clientes **no** van en esta entrega (ver abajo). El inglés
sigue APAGADO; en español no cambia ni una letra.

**Pantallas cubiertas:** `/paquetes` (`GestionPaquetes`), `/franjas-y-temporadas`
(`GestionRejilla` y el horario de transmisión, `ProgramacionPorFranja`), el
cuadro «Tarifas por franja y temporada» de la ficha de pantalla (`RejillaDialog`)
y `/descuentos-por-volumen` (`GestionVolumen`).

- **194 claves** en `lib/i18n/textos/catalogos.ts` (`catalogos.*`), esparcidas en
  `diccionario.ts` y añadidas a `costura.test.ts`. Instantánea y guardias de forma
  en `textos/catalogos.test.ts`. Los títulos de página reutilizan las claves del
  menú (`nav.paquetes`…): la página se llama como la entrada que lleva a ella.
- **Los motivos de rechazo** de `lib/paquete.ts`, `lib/rejilla.ts` y
  `lib/volumen.ts` (los que la pantalla enseña ANTES de mandar, y que el servidor
  manda igual) ganaron `idioma` con `'es'` por omisión. El servidor no lo pasa.
  `textos/catalogos.fuentes.test.ts` recorre sus 27 ramas (el español del
  diccionario es el literal del módulo) y fija qué clave usa cada aviso que no se
  rinde (el toast de «Tarifas por franja guardadas», los `mensajeSiFalla`, los
  `catch`).
- **Dinero, fechas y cifras:** `formatMonto(n, idioma)` en el reparto del paquete;
  `formatFecha(iso, idioma)` en las temporadas; los ejemplos «180,000» y
  «15,000.50» entran por hueco (ningún diccionario lleva cifras). La unidad de
  venta se pinta en español como siempre y en inglés con `etiquetaUnidad`.
- **Español idéntico, medido:** `pantallas-catalogos.test.ts` rinde 15 estados
  (con `useState` forzado) y con `I18N_VOLCAR` vuelca su HTML; antes y después de
  tocar los componentes, `diff -rq` vacío (15/15). El rojo antes de implementar:
  16 de 32 pruebas.

**Términos nuevos** (decisión del agente; el dueño puede cambiarlos; tabla en
`docs/i18n/revision-catalogos.md`): precio cerrado → *fixed price* · a prorrata /
reparto / parte → *pro rata / split / bundle share* · dar de baja (franja,
temporada) → **deactivate / Deactivated** (baja lógica; decisión del orquestador en
la segunda vuelta, igual que Campañas y compartidos) · tramo / escalón / escala plana →
*tier / step / flat scale* · rejilla → *rate grid* · programar → *schedule* ·
se transmite → *airs* · horario de transmisión → *Broadcast schedule* (como
Campañas) · tarifa de lista → *list rate* · ¿Códigos? / Admite código → *Negotiation
codes* / *Takes negotiation codes* (orquestador). Los errores van sin contracciones
(«Could not…», «cannot»), como el resto de lotes. 194 claves (una más: el botón «Programar» sin marcadas, que en inglés ya no arrastra el doble espacio).

**Sigue en español:** los avisos «se vendió como X y se programa en Y» que manda
el servidor (`a.texto`) y los mensajes del servidor (I18N-05). En el cuadro de
tarifas, la unidad en español se pinta como el dato (`spot`, `programatico`) y en
inglés con su etiqueta (*CPS · cost per play*, *Programmatic*): aceptado así por el
orquestador. `programatico` es una unidad de venta (`lib/modalidades.ts`) que no
está en `UNIDADES`; en inglés usa `comercial.comun.programatico`.

> [!note] Segunda vuelta (validador ÁMBAR, `docs/i18n/validacion-catalogos.md`)
> - **`CampoCifra` y `lib/captura-cifra.ts`:** el motivo de rechazo (el `title`
>   «Escribe solo cifras…» y sus hermanos) salía en español en la pantalla inglesa.
>   `leerCifra` acepta `idioma` en sus opciones con `'es'` por omisión (los
>   literales no cambian) y las claves viven en `compartidos.cifra.*`, con las
>   cifras de ejemplo por hueco. `CampoCifra` toma el idioma de su prop o, sin
>   ella, el de la pantalla (`useIdioma`, que fuera del proveedor es `'es'`): así
>   el barrido de compartidos de Campañas y Finanzas, que lo cazó al aparecer las
>   claves, queda en verde. El HTML español de los 79 estados de Propuestas,
>   compartidos y Campañas y Finanzas salió idéntico con y sin el cambio.
> - Los singulares de la prueba de pantallas se comprueban con su etiqueta de
>   cierre (« · 1 tier</span>»): invertir el plural ya cae sin la instantánea.
> - **«pesos» en el texto** («Precio del conjunto (pesos enteros)», «al peso», «to
>   the peso», «whole number of pesos»): es falso en una instancia USD (ADR 0048),
>   en los dos idiomas. ~~No se tocó: redactarlo neutro es una tarea aparte.~~
>   **Hecho el 02/11** (`feat/pesos-neutral`): «cantidad entera», «sin
>   centavos», «exacto» / «whole amount», «no cents», «exactly». Ver §7.
> - **Los tres menores del validador, cerrados el 02/11** (`feat/pesos-neutral`):
>   las seis claves `compartidos.cifra.*` que no estaban atadas a su literal
>   (`vacia`, `enteras`, `max-decimales.otros`, `grande`, `negativo`, `mayor`) ya
>   lo están en `catalogos.fuentes.test.ts` (el mutante «No puede ser negativa»
>   muere); `compartidos.cifra.mayor` dice en inglés «Must not be greater than
>   {n}», como el patrón del servidor (y `cifra.menor`, «Must not be less than
>   {n}», por estilo: el servidor no manda ese español; su mínimo es «Debe ser
>   mayor o igual a {n}» → «Must be greater than or equal to»). La paridad con el
>   servidor (`costura.test.ts`), medida el 02/11: `traducirError` reconoce
>   **19** textos del diccionario (7 con hueco, por `PATRONES_ERROR`, y 12
>   frases fijas); **10 coinciden** y la prueba los vigila; **9 divergen**, todos
>   de la calculadora (5 con hueco y 4 fijos), declarados clave por clave como
>   de la ola 4, con otra prueba que obliga a quitar cada uno cuando se
>   unifique. Y la cabecera de `catalogos.ts` dice «deactivate / Deactivated».
> - Español: los 15 estados, idénticos otra vez.

> [!warning] Lo que falta del lote: operaciones y clientes
> Operaciones (OT, almacén, imprenta, creativos, disponibilidad, el Dashboard y
> `SlotsBadge`/`ClientesBadge`/`CalendarioDisponibilidad`), Clientes, Comisiones,
> Captación, Energía y Reportes **no se tocaron**: siguen en español. Hay
> borradores de diccionario y de pruebas de pantalla sin conectar a ningún
> componente; no están en la rama.
### Lote administración, cuenta y shell

**2026-11-02, rama `feat/ingles-administracion`** (sale de `integra/ingles`,
`ec427a66`). El inglés sigue APAGADO; en español no cambia ni una letra.

**Pantallas cubiertas.** *admin*: Administración entera (usuarios, crear
usuario, cambiar/restablecer contraseña, roles y permisos con la matriz,
control de cambios, las cuatro familias de configuración, organizaciones,
actualizaciones y soporte), Configuración (Mi cuenta / Empresa),
Integraciones, Network, Novedades, Actividad y Razones sociales. *cuenta*:
códigos de recuperación, `/recuperar/[token]`, la bienvenida y su
cuestionario, el portal del cliente y la propuesta pública `/p/[id]`. *shell*:
los layouts (la descripción de la página), el 404, `global-error`, el `_error`
del Pages Router, la barra superior, el candado de cambios, la campanita, la
banda de la licencia, las novedades de la versión, el error de carga, el módulo
en construcción, y las piezas compartidas `ConfirmDialog` (sus rótulos por
omisión), `FotoUploaderMock`, `PipelineView` y `disponibilidadInventario`.

**Mecanismo.** Tres archivos: `textos/admin.ts` (532 claves), `textos/cuenta.ts`
(115) y `textos/shell.ts` (58), esparcidos en `diccionario.ts` y añadidos a
`costura.test.ts`. Instantáneas y guardias en `textos/admin.test.ts` y
`textos/cuenta.test.ts` (este último cubre también `shell`), que además leen el
fuente y fijan qué clave usa cada toast, `window.confirm` y error de `catch`.
Funciones de `lib/` con texto que ganaron `idioma` (`'es'` por omisión, el
español es el literal de siempre): `rolLabel` (`lib/roles.ts`), la nueva
`etiquetaTipoOt` (`lib/tipos-ot.ts`), las frases de `actualizaciones-ui.ts` y
`tickets-ui.ts`, `loQueFaltaEnElBorrador` (`razones-sociales/gestion.ts`) y
`disponibilidadInventario` (`StatusBadge.tsx`). Espejos con prueba: roles
(`ROLES_ASIGNABLES`), tipos de OT (`TIPO_OT_LABEL`), capacidades (`CAP_LABEL` ↔
`CLAVE_CAP`), grupos de notas de versión (`ETIQUETA_TIPO` ↔
`CLAVE_TIPO_NOVEDAD`) y las áreas de la matriz (`lib/modulos.ts` ↔ `nav.*`, que
`lib/modulos.ts` no se tocó por ser de alto contacto). Las etiquetas que manda
el servidor en español (módulos de la matriz) se pintan tal cual en español y
por `admin.modulo.*` en inglés.

**Server Components y sin contexto.** La banda de la licencia recibe el idioma
del layout del shell (`idiomaDeLaPeticion()`); los dos layouts pasan a
`generateMetadata` para la descripción. `global-error.tsx` no tiene proveedor:
lee `document.documentElement.lang` una vez al montar (en el servidor no hay
`document` y sale español, como siempre). `pages/_error.tsx` decide por la
cookie de la petición en `getInitialProps` y, sin petición, español.

**Cómo se midió el español.** `pantallas-admin.test.ts` (28 estados; fuerza
`useState` por NOMBRE de componente y posición, leídos de la pila, y falla si
un forzado no se consume) y `pantallas-cuenta-shell.test.ts` (32 estados).
Se volcó el HTML español de los 60 estados con las fuentes de `integra/ingles`
(los componentes devueltos a `HEAD` uno por uno) y con las del lote:
`diff -rq` vacío. El reloj va fijo, para que «Hoy», «Ayer» y la hora de la
Actividad no cambien entre corridas.

**Términos nuevos** (decisiones del traductor; el dueño puede cambiarlas):
Administración → *Settings* (el título; su pestaña «Configuración» →
**Business settings**, y la configuración de la cuenta del usuario, página y
menú de usuario → **Account settings**: ya no queda ningún «Settings →
Configuration») · organización → *organization* · ticket → *ticket* (soporte →
*Support*) · control de cambios → *change control* (activar/desactivar → *turn
on/off*) · actualizaciones → *updates* (instalada/disponible → *installed /
available*) · razón social → *legal entity*, su nombre → *legal name*, la
principal → *Main*, dar de baja → *deactivate*, papel → *role* · códigos de
recuperación → *recovery codes* · bienvenida → *welcome* (el cuestionario →
*welcome questionnaire*) · novedades → *What’s new* (notas de versión →
*release notes*) · actividad → **Activity log**, también en el menú
(`nav.actividad`, solo el `en`) · Dueño (rol) → *Owner* · Imprenta como rol →
**Print shop** (el módulo sigue *Printing*) · Organizaciones (CRMs) →
**Platform organizations** (es el panel del super-admin con las organizaciones
—*tenants*— del servidor; «CRM» no le dice nada a quien compra) · código
postal → **Postal code** (también `campanas.facturacion.cp`) ·
Administrador → *Administrator* · Director comercial → *Sales director* ·
Gerente de ventas → *Sales manager* · instancia → *instance* · parte
arrendataria → *lessee* · cupo de clientes → *client cap* · tope de descuento →
*discount cap* · plazos de cobranza → *Payment terms* · tipos de tarea de
cuadrilla → *crew task types* · mano de obra → *labor* · domicilio fiscal →
*tax address* · RFC → *RFC (tax ID)*, como en Campañas · capacidades de la
matriz → *View / Create / Approve / Invoice / Costing*. Tres excepciones nuevas en
`costura.test.ts`: «Actualizar» (*Refresh* / *Update*), «Baja»
(*Decommissioned* / *Low*, la prioridad de un ticket) y «Cargo» (*Charge* /
*Job title*); en la segunda vuelta, «Configuración», «Imprenta» y «Entrar»
(*Sign in* / *Switch to*). Desde la segunda vuelta `costura.test.ts` compara
también contra el diccionario BASE (`nav.*`, login, comunes).

**Sigue en español, a propósito:** los registros de Actividad (`a.accion`, son
bitácora), las notas de cada versión (las escribe un desarrollador: son dato),
las etiquetas del catálogo de papeles de las razones sociales y los campos del
cuestionario (`catalogo_roles_entidad`, vienen de la base), el error del plan
del cuestionario y el resumen para la bitácora (`lib/cuestionario-entidades.ts`,
compartidos con el servidor), el ejemplo del régimen del SAT («601 - General de
Ley Personas Morales», nombre oficial), `etiquetaTipoMedio` cruda en el
renglón de la liga pública (el tipo va como código), `Paginacion` («registros»,
no era de este lote, aunque Actividad ya le pasa su etiqueta traducida), las
tablas de etiquetas de `StatusBadge.tsx` (cada lote las traduce en su punto de
uso con sus espejos) y los mensajes del servidor (I18N-05). Tablas de revisión:
`docs/i18n/revision-admin.md`, `revision-cuenta.md` y `revision-shell.md`.

#### Segunda vuelta (validador ÁMBAR, `docs/i18n/validacion-administracion.md`)

- **Los 4 medios:** la etapa del portal del cliente pasa por `CLAVE_ETAPA` (y
  el estado de la prueba la lista); los conectores de Integraciones se
  traducen por `admin.integ.conector.<clave>.nombre/.descripcion` solo en
  inglés —el servidor sigue mandando su español, que una prueba ata a
  `estadoIntegraciones()`— y la prueba usa los conectores REALES; «Normal»
  (no «Normal priority»), declarado igual; el subtítulo de Razones sociales ya
  no queda colgando.
- **Los bajos, todos:** «of {total} space(s)», la frase del mapa de la liga
  pública, «Held by two or more legal entities: …», «What’s in» / «includes»
  en vez de «brings», «No screens match», «No actions match», «Who did what
  and when» / «Actions», «{nombre}’s role», «(at least 8 characters)», «Sales
  discount cap», «Switch to», el inciso entre paréntesis, la pregunta 2 del
  cuestionario, «who issues invoices» y «Go to the home page».
- **Español, otra vez medido:** 60 de 60 estados idénticos frente a
  `ec427a66` (`diff -rq` vacío).
### Lote servidor

**2026-11-02, rama `feat/ingles-servidor`** (sale de `integra/ingles` en
`0ceacb0b`). Ola 4: lo que el SERVIDOR manda al cliente y seguía en español
con la pantalla en inglés. El inglés sigue APAGADO; en español no cambia ni
una letra. Tabla de revisión en `docs/i18n/revision-servidor.md`.

**1 · Las plantillas de error con huecos.** Contadas otra vez: **44** (más la
composición de `validar()`, que ya se traducía por partes). Dos vías posibles:

- que `AppError` aceptara una clave y sus valores: tocaba los 44 sitios,
  `lib/server/errores.ts` (alto contacto) y el embudo, y reescribía el
  español como plantilla del diccionario;
- **un patrón por plantilla** en `PATRONES_ERROR`, la vía de los motivos de zod:
  reconoce el mensaje ya armado y lo rearma en inglés conservando los valores.

Se eligió la segunda porque toca **un archivo** (`lib/i18n/errores-servidor.ts`)
y deja el español como fuente. `traducirMotivo` ya no usa `String.replace` con
la cadena: un `$n` solo sabe copiar. `armar()` entiende además
`{n|uno|otros}` (plural del hueco n) y `huecos[n]` (una función para el valor).

> [!warning] Los huecos con español dentro
> Casi todos los huecos son cifras, fechas o nombres y se conservan. Cinco
> traen español armado por el propio servidor y se traducen con tablas
> CERRADAS, comprobadas contra el código que las produce: la periodicidad en
> minúscula (en letra: «billed every two weeks»), la etapa del prospecto, los
> faltantes para revisión (`faltantesParaRevision`), las etiquetas de
> `exigir(...)` de `contrato-documento.ts` (las del MENSAJE, nunca el texto
> legal) y lo que bloquea borrar un cliente. Un valor que no está en la tabla
> se conserva: mejor un hueco en español que uno inventado. Los prefijos de
> `uploads.ts` que no son etiqueta (`arte: `, `imagen: `, el nombre de la
> propiedad) también se conservan.

**2 · Los motivos de `lib/` que comparten servidor y pantalla.** Archivo propio
`lib/i18n/textos/servidor.ts` (**31 claves**, prefijo `servidor.*`). Las
funciones ganan `idioma` con `'es'` por omisión y en español devuelven su
literal de siempre; `textos/servidor.test.ts` ata el diccionario al módulo.

| Función | Quién pasa el idioma |
|---|---|
| `motivoEtapaResponsable`, `motivoQuitarLegal`, `motivoPresupuesto`, `motivoCambioOferta`, `motivoEdicion` (`lib/negociacion.ts`) | `ComercialOpex` (el `title` de los pasos y el aviso de la ficha) |
| `interpretarUbicacion` | `ComercialOpex` (el buscador); la tabla de motivos SALE del diccionario, no se repite |
| `motivoHorarioInvalido` | `ProgramacionDoohmain` |
| `avisosDeProgramacion` | `programacionCtrl`, con `idiomaDeLaPeticion()`: el aviso viaja en el cuerpo |
| `MSJ_APROBAR_CON_PENDIENTE` | la ruta lo responde a mano, sin `respuestaError()`: el cliente reconoce `codigoPendiente` (`CodigoPendienteApiError`) y pinta `servidor.codigo.aprobar-con-pendiente` |

Y el servidor dice lo mismo: **`CATALOGO_LIB`** (`errores-servidor.ts`) se
construye con las claves sin huecos de `textos/servidor.ts`. Va aparte de
`CATALOGO_ERRORES` para no tocar la guardia de entradas muertas, que solo ve
literales. Entran también «Periodo inválido», «Cliente inválido» y «El rango
necesita fecha de inicio y de fin», y `Periodo` en `CAMPO_EN`.

**Ya estaba hecho y no se tocó:** la etiqueta del periodo que manda el servidor
(la rearma `etiquetaPeriodo` en la pantalla desde la costura) y los motivos de
`resolverCalculadora` (patrones del ADR 0042; solo se añadió «ninguna» →
«none»).

> [!danger] Lo que es REGISTRO no se tradujo, a propósito
> Los textos de Actividad de `codigo-aprobacion.ts` (`textoReactivacion`,
> `textoAprobacion`, `textoRechazo`, `textoQuitadoAlAceptar`) y
> `textoAccionProgramacion` se GUARDAN en `acciones`: son la bitácora. Siguen
> en español (§8, «lo que es REGISTRO se queda en español»).

**Pantalla y servidor, el mismo inglés** (lo encontró la tarea de «pesos»,
`feat/pesos-neutral`): ocho motivos de la calculadora (`compartidos.calc.motivo.*`
y `propuestas.calc.prima.no-puede`) decían el mismo español con un inglés en la
pantalla y otro en el catálogo y los patrones del servidor. Manda el de la
pantalla, que validaron compartidos y propuestas; «pocos libres» elige además el
plural con `{1|slot|slots}`. Prueba en `textos/servidor.test.ts` («pantalla y
servidor dicen el mismo inglés»), que recorre el diccionario ENTERO. **Al juntar
con `feat/pesos-neutral`, se quita la excepción de `compartidos.calc.motivo.*` y
`propuestas.calc.*` de su prueba de `costura.test.ts`.**

**Términos nuevos:** responsable legal → *legal representative* (como
`comercial.negociacion.responsable.5`); búsqueda del responsable → *finding
the decision-maker*; predio → *property*; recibo de CFE → *CFE bill*; tanda →
*batch*; «sin fecha» → *no date*; «ninguna» (cantidad) → *none*.
**Corregido:** el motivo de Google Maps decía «tap the place» en el catálogo;
ahora «click», como manda el glosario.

**Cómo se midió que el español no cambió:** el HTML de las cuatro pruebas de
pantallas (109 estados) volcado con los archivos de `0ceacb0b` y con los de la
rama: `diff -rq` vacío. Las plantillas, todas: `traducirError(m, 'es') === m`
para cada una armada con valores de ejemplo y para cada clave del catálogo.

**Lo que NO cubre este lote:**

- **Las rutas que responden `{ error: e.message }` a mano** sin pasar por
  `respuestaError()` (`app/api/propuestas/[id]/route.ts` y al menos otras seis): su
  error llega en español. No se tocó `app/api`; el cupón pendiente se resolvió
  en el cliente porque trae bandera.
- **~108 mensajes por variable** de las clases de dominio y de las funciones
  `motivo*` (§8). Es la ola siguiente.
- El nombre del punto que devuelve `geo-buscar` («Punto del enlace de Google
  Maps», «Coordenadas …»), que es dato de respuesta y no error.
### Lote operaciones y clientes

**2026-11-02, rama `feat/ingles-operaciones-clientes`** (sale de `integra/ingles`
en `2e622add`, que ya trae el `MX$` en inglés). El inglés sigue APAGADO; en
español no cambia ni una letra. **El lote quedó A MEDIAS a propósito:** se
cerraron completos (prueba de pantallas, español medido, suites en verde y su
commit) los submódulos de abajo, y el resto no se tocó.

**Hechos, uno por commit:**

- **Clientes** (`/clientes` con su ficha: pipeline y campañas del cliente),
  **Comisiones** y **Captación** → `lib/i18n/textos/clientes.ts`, **220 claves**
  `clientes.*`.
- **Disponibilidad** y las tres piezas que pinta también Comercial
  (`SlotsBadge`, `ClientesBadge`, `CalendarioDisponibilidad`), **Almacén** e
  **Imprenta** → `lib/i18n/textos/operaciones.ts`, **177 claves**
  `operaciones.*`.

**Sin tocar (siguen en español, y hay borradores sin revisar en el scratchpad
de la sesión):** `/operaciones` y la ficha de la OT (`OTVista`), `/creativos`,
el **Dashboard** (`/inicio`, `charts.tsx` y los avisos de `lib/data/derive.ts`),
**Consumo de luz** (`/energia` y `components/demo/energia/*`) y **Reportes**
(`/reportes` y `components/demo/reportes/*`).

- **Espejos.** `ETAPA_CLIENTE_LABEL` (`lib/cliente-pipeline.ts`),
  `ETIQUETA_TIPO` (`lib/captacion.ts`), `ETIQUETA_TIPO_ACTIVO` y
  `ETIQUETA_CAMPO` (`lib/almacen-tipos.ts`) y los mensajes `CP_INVALIDO`,
  `TELEFONO_INVALIDO` y `EMAIL_INVALIDO` (`lib/validacion.ts`) NO se tocaron:
  siguen siendo la verdad en español (el servidor los usa). Las pantallas
  pintan una clave por valor, y `textos/clientes.test.ts` y
  `textos/operaciones.test.ts` exigen que su español sea IDÉNTICO. Los de
  almacén no se exportan (un `page.tsx` de Next no admite exportaciones
  propias): la prueba comprueba la regla de nombres de la clave.
- **Se reusan claves de otros lotes:** las etapas de captación son las de
  Comercial negociación (`CLAVE_ETAPA`, mismas `ETIQUETA_ETAPA`); los estatus y
  etapas de campaña, y las etapas de impresión, las de Campañas
  (`CLAVE_ESTADO_CAMPANA`, `CLAVE_ETAPA`, `CLAVE_IMPRESION`); la contraseña, la
  de compartidos.
- **`faltantesParaRevision` (`lib/captacion.ts`) recibe `idioma`** con `'es'`
  por omisión: `captacion-repo.ts` la sigue llamando sin él y contesta en
  español. Es la única función de `lib/` que cambió de firma.
- **Fechas y dinero.** Las fechas pasan por `formatFecha(…, idioma)`; la
  bitácora de captación usa `en-US` en inglés. Los importes (pipeline del
  cliente, campañas) pasan el idioma: `MX$` en inglés para una instancia MXN.
  La etiqueta de cada periodo de Disponibilidad la arma `lib/data/derive.ts` en
  español («1/3–14/3», «mar 26»); en inglés la página la rehace con las mismas
  fechas («3/1–3/14», «Mar 26»). El calendario toma el mes de `Intl`.
- **Se quedan en español, a propósito:** los regímenes fiscales y usos de CFDI
  del SAT del alta de cliente (son el valor que se guarda), los ejemplos de
  marca/modelo/placas del almacén (solo se traduce el «Ej.»), y los nombres que
  vienen de datos.
- **Un español raro que se conserva:** la imprenta pinta «2 ordenes» SIN tilde
  (`orden{n === 1 ? '' : 'es'}`). La clave `operaciones.imprenta.orden.otros`
  lo copia tal cual, con un comentario; corregirlo es otro cambio. Lo cazó el
  `diff` del HTML español, no la lectura.

**Cómo se demostró el español idéntico:** `pantallas-clientes.test.ts` (25
estados) y `pantallas-operaciones.test.ts` (12 estados) rinden el componente
REAL con `useState` forzado por valor inicial y por el nombre del componente
que lo llama (se lee de la pila). Con `I18N_VOLCAR=<carpeta>` escriben el HTML
español de cada estado; se volcó con las fuentes viejas (`git show HEAD:…`) y
con las nuevas, y `diff -rq` salió vacío en cada submódulo. Con las fuentes
viejas, las dos pruebas fallan (rojo demostrado: 39 en clientes; 6, 6 y 3 en
los tres commits de operaciones).

**Glosario añadido** (además del de arriba): captación → **Prospecting** (como
el menú) · prospecto → *prospect* · bitácora → *log* · comisión → *commission*
· comisión aplicada → *applied commission* · negociación validada →
*negotiation validated* (validar → *Validate*) · razón social → *legal name* ·
C.P. fiscal → *tax ZIP code* · uso de CFDI → *CFDI use* · tasa de cierre →
*close rate* · embudo → *funnel* · disponibilidad → **availability** ·
catorcena → *two-week period* · solo con hueco libre → *Only with
availability* · almacén → **warehouse** · bodega → *depot* · dar de baja (un
artículo) → **Decommission** (el KPI «{n} decommissioned», el estado
*Decommissioned*), como el sitio de Comercial. **No** es la baja lógica de
catálogos («Deactivate»): en el almacén la baja es definitiva
(`MOVS.BAJA = []`), y así lo declara la costura · traslado → *transit* · imprenta
→ **Printing** (el módulo; el proveedor que imprime → *print shop*) · prueba de
color → *color proof* · montaje → *installation*. Pendientes de decidir para los
submódulos que faltan: recibo de luz → *electricity bill*, consumo →
*consumption* (el menú ya dice «Power usage»), rentabilidad → *profitability*.
La ruta de la ayuda del IVA se escribe «Settings → Business settings», como el
lote de administración. El mes de Disponibilidad va con el año entero, «Mar
2026» («Mar 26» se lee como «26 de marzo»).

**Segunda vuelta** (validación ÁMBAR,
`docs/i18n/validacion-clientes-operaciones.md`): se aplicaron los 4 hallazgos
medios (la baja, un solo nombre para ella, la prueba de clave de los avisos de
almacén e imprenta —M4a y M4c ahora mueren— y «Mar 2026») y los 10 bajos.
Español otra vez medido: 37/37 estados idénticos a `2e622add`.

**Costura.** Siete españoles nuevos que se dicen distinto a propósito, cada uno
con su motivo en `DISTINTOS_A_PROPOSITO`: «Aprobada» (estatus frente a la
columna con fecha «Approved on»), «RFC» (cabecera corta frente a «RFC (tax
ID)»), «Validada» y «Validar» (un creativo revisado frente a una negociación
validada), «Vista» (hacia dónde mira una cara frente al selector de la
rejilla), «Movimiento» (renglón del estado de cuenta frente a traslado del
almacén) y «Dar de baja» (la baja lógica de catálogos, «Deactivate», frente a la
definitiva de un artículo del almacén, «Decommission»).
### Lote Space Eyes

**2026-11-02, rama `feat/ingles-space-eyes`** (sale de `integra/ingles`,
`ec427a66`). El inglés sigue APAGADO; en español no cambia ni una letra. Tabla
de revisión en `docs/i18n/revision-spaceeyes.md`.

**Pantallas cubiertas:** todo `/space-eyes/*` — la lista de equipos, la ficha
de un equipo con sus cuatro pestañas (fotos con el veredicto de la IA, pantalla
y fallas, creativos, equipo: datos del sitio, programa, ajustes de imagen y
registros), el histórico, la vista en vivo, la galería y su visor, las fallas
de la flota, las campañas de verificación, la programación de fotos, la
verificación, las gráficas, ajustar texto, el alta de un dispositivo, la
demostración para quien no tiene el módulo, el aviso «sin respuesta» y las
solicitudes de activación del padre; y la página `/space-eyes/[id]` con un id
inválido.

- **992 claves** `spaceeyes.*` en `lib/i18n/textos/spaceeyes.ts`, esparcidas en
  `diccionario.ts`, con su instantánea y sus guardias en
  `textos/spaceeyes.test.ts` (ningún inglés igual al español salvo 10
  declaradas —11 desde la segunda vuelta, con «Vincular»—, sin acentos, mismos huecos, sin espacio antes de «%», apóstrofo y
  comillas tipográficos, nunca «tap»/«press», frecuencias en letra y plurales
  `.uno/.otros` siempre en pareja). El lote entra en `costura.test.ts`.
- **Funciones con texto ganaron `idioma` con `'es'` por omisión:** en
  `piezas.tsx` `hace`, `calidadSenal` y `fechaHora` (en inglés,
  `formatFechaHora(…, 'en')`), más `haceSinPrefijo` (sustituye a
  `hace(x).replace('hace ', '')`, que en inglés no quitaba nada); y
  `comoSeActualiza` (`lib/space-eyes-actualizacion.ts`). El servidor
  (`lib/server/space-eye.ts`) la sigue llamando sin idioma: español de siempre,
  y `space-eyes-actualizacion.test.ts` lo fija letra por letra.
- **El veredicto de la foto** usa las claves `comercial.eye.*` («Correct ad ·
  confidence 93%», «Does not match the creative»): la misma foto dice lo mismo
  en la ficha comercial y en la de Space Eyes.
- **Los avisos que no se rinden** (toasts de Programación y de la vista en
  vivo, avisos de la galería, de ajustar texto, de las fallas y del equipo, el
  `window.confirm` de descartar la marca) se fijan leyendo el fuente en
  `textos/spaceeyes.test.ts`, rama por rama, como la gemela de Finanzas.

**Cómo se midió el español:** `lib/i18n/pantallas-spaceeyes.test.ts` rinde
**95 estados** (con `useState` forzado y el reloj fijo). Como `Button` lleva su
propio `useState(false)`, el envoltorio lo reconoce en la pila y no le da
valores de la cola. Con `I18N_VOLCAR=<carpeta>` vuelca el HTML español: se
volcó con las fuentes de `ec427a66` y con las del lote, con la misma prueba, y
`diff -rq` salió vacío (95/95). La prueba barre además el diccionario del lote,
el de compartidos y `comun.*` contra el HTML inglés de todas las pantallas.

**Glosario del lote** (decisiones del traductor; el dueño puede cambiarlas):
equipo / dispositivo → **device** (como el menú, «Devices»); falla → **fault**
(menú «Faults»); vista en vivo → **live view**; verificación →
**verification**; solicitud de activación → **activation request**; flota →
**fleet**; gabinete → *cabinet*; creativo / creatividad → *creative*; encuadre
→ *framing*; vigilancia → *monitoring*; código de vinculación → *pairing code*;
la marca de la foto → *label* (menú «Photo label»); programación de fotos →
*scheduling*; franja → *daypart* (glosario); zona → *area*; sin comunicación →
*not reporting*. «Pide un toque en el teléfono» → *someone has to confirm on
the phone* (nunca «tap»). Las frecuencias en letra: *every half hour, every
two hours, every twelve hours*. Tres divergencias declaradas en la costura:
«Actualizar» (*Refresh* una lista / *Update* el programa del equipo),
«Estado» (*Status* / *State* en la dirección) y «Ganancia» (*Profit* / *Gain*
de la cámara).

**Lo que NO se traduce, a propósito:** el ticket que abre «Solicitar
activación» (es un dato que lee soporte), la marca que se graba EN la foto
(`lib/space-eyes-marca*`: es la evidencia), el nombre del `.zip` del álbum y
del archivo de la microSD, el CSV de telemetría, el comando de instalación, y
lo que manda el servidor o Space Eye: el nombre, la zona y la nota de una falla,
las alertas de telemetría, el `mensaje` de pedir una foto, el
`actualizacion.texto` de la lista (solo sale en un `title`) y los errores de
los errores de `lib/space-eyes-marca.ts` (la descarga de la foto con su marca).

#### Segunda vuelta (validador ÁMBAR, `docs/i18n/validacion-spaceeyes.md`)

- **«Vincular» en los dos idiomas** (decisión del dueño, 02/11: la app Android
  de Space Eye solo está en español). El paso dice «On the phone, open the app,
  confirm with **Vincular** and scan the QR»; la clave está declarada igual.
- **«Space Eye respondió N» ya no sale en español en la pantalla inglesa.**
  `ErrorSE` marca cuándo su mensaje es el genérico (Space Eye no mandó motivo)
  y `textoDeError(e, idioma)` / `textoRespondio(status, idioma)`
  (`lib/data/space-eyes-se.ts`, `'es'` por omisión) lo dicen en el idioma de
  quien lo lee; lo que manda Space Eye sigue siendo un dato. Lo usan todos los
  manejadores de error del módulo y la exportación del CSV de `Graficas`.
- **Los motivos de la vista en vivo son interfaz** (decisión del orquestador):
  `VisorWhep` recibe `idioma` (`'es'` por omisión) y sus cuatro motivos salen
  de `spaceeyes.whep.*`. La marca de la foto sigue SIN traducirse.
- **Guardias nuevas en el barrido inglés:** `(?<!MX)\$ ?\d` y
  `\d{2}/\d{2}/\d{4}` (las mismas expresiones que prepara el lote de
  inventario para su ayudante común, que aún no está en esta base; aquí van
  locales), más el mes abreviado y el «a. m.» de es-MX. Se quita antes la marca
  de la foto, y otra prueba exige que en inglés esa marca SIGA en es-MX. La
  nueva `lib/space-eyes-marca-idioma.test.ts` fija `lineasMarca` y
  `renglonesMarca` en es-MX y que ninguno de los dos módulos sepa de idiomas.
  Mutantes: quitar el idioma de un `fechaHora` (M3), traducir la marca (M6,
  M7), quitar el idioma de `textoDeError` y de `VisorWhep` — **mueren los
  cinco**.
- **Glosario (orquestador):** Administración › Configuración › Soporte →
  *Settings › Business settings › Support*; folio de un ticket → *ticket*;
  el padre → *parent server*. Además: «Updates: …» → *Update mode: …*; el lote
  de códigos en inglés natural; *manually* en vez de *by hand*; *On demand* en
  los dos sitios; *checksum*; posesivos; plurales `.uno/.otros` en «of {n}
  devices», «Applies to the {n} devices» y «Cabinets {lista}»; la próxima foto
  y el pie del visor de la galería con el formato inglés de la aplicación.
- **Español, otra vez medido:** 95/95 estados idénticos frente a `ec427a66`.
### Lote inventario y arrendadores

**2026-11-02, rama `feat/ingles-inventario-arrendadores`** (sale de
`integra/ingles`, ec427a66). El inglés sigue APAGADO; en español no cambia ni una
letra. Tablas de revisión en `docs/i18n/revision-inventario.md` y
`docs/i18n/revision-arrendadores.md`.

**Pantallas cubiertas:** `/inventario` (la tabla con indicadores y chips, el
cambio masivo de tarifa y de renta, las celdas editables y sus cuadros de
contraseña, el asistente «Contrato + pantalla», el alta manual y la carga
masiva con su resumen y la «Información añadida»); `/arrendadores` (filtros,
indicadores, contratos, pagos de renta, cuadre, rentabilidad, la lista con su
alta y su baja, las razones sociales del arrendador y el consolidado), la ficha
del contrato con sus cuadros (completar, quién paga, registrar pago y adjuntos,
reportar incidencia, renovar), los cambios al contrato y las versiones firmadas,
licencias y permisos; lo que RODEA al documento del contrato (`/contrato/[id]`:
la barra y el panel de firmas), la firma pública (`/firmar/[token]`) y la página
`/razones-sociales`. `CompromisoRentaCard` y `PagosRentaCard` también salen en
Finanzas.

- **807 claves** en dos archivos: `lib/i18n/textos/inventario.ts` (360,
  `inventario.*`) y `textos/arrendadores.ts` (447, `arrendadores.*`),
  esparcidos en `diccionario.ts`, cada uno con su instantánea y las guardias
  de siempre (inglés ≠ español salvo las declaradas, sin acentos, huecos
  iguales, sin espacio antes de «%», sin comillas ni apóstrofos rectos, sin
  «tap»/«press»). `costura.test.ts` mira ahora ocho lotes.
- **Espejos con prueba de paridad.** `medioLabel`, `disponibilidadInventario`,
  `textoVencimiento`, `faltaEnContratos`, `LICENCIA_LABEL` y el «Sin arrendador
  asignado» de `conciliacionRenta` NO se tocaron: `components/demo/inventario/
  etiquetas.ts` y `components/demo/arrendadores/etiquetas.ts` repiten su
  decisión con claves, y `textos/inventario.test.ts` / `textos/arrendadores.test.ts`
  exigen que en español digan exactamente lo mismo, caso por caso. Los estatus
  del contrato, del pago y del sitio y los tipos de medio reutilizan las claves
  de Comercial (`comercial/claves.ts`).
- **Qué clave usa cada aviso** (la cuarta y quinta gemelas): las dos pruebas de
  textos leen el fuente y fijan la rama de cada toast que no se rinde (tarifa ↔
  renta en el cambio masivo, predio / asignada / creados en el asistente,
  adjuntos ↔ pago, firmado / enviado / historial al editar términos…).
- **El `id` de `PagosRentaCard` no cambia con el idioma**: es la clave donde se
  guarda si está plegada; con el título por omisión se queda en español y solo
  se traduce lo que se pinta.

> [!danger] EL CONTRATO NO SE TRADUCE
> Ni su texto (`lib/contrato-documento.ts`, fijado byte a byte por una huella
> sha256 en `textos/arrendadores.test.ts`), ni la cantidad con letra, ni lo que
> entra en el hash de las firmas, ni lo que forma parte del documento impreso:
> los encabezados DECLARACIONES / CLÁUSULAS, el bloque de firmas con sus sellos
> «FIRMADO ELECTRÓNICAMENTE» / «FIRMA INVALIDADA» y el aviso de borrador. Se
> traduce lo que lo rodea: la barra y el panel de firmas (`doc-no-print`), la
> firma pública (con `idiomaDeLaPeticion()` y el contexto; el texto congelado
> que se firma se pinta tal cual) y, **desde la segunda vuelta, la constancia**.
> Las pruebas de firmas (`contrato-documento`, `firmas-repo.*`) siguen en verde
> sin tocarlas.

> [!important] 2026-11-02, decisión del dueño · la constancia va en el idioma configurado
> Revierte la primera vuelta, que la dejaba en español. Antes de traducirla se
> comprobó que **no entra en ningún hash ni se guarda como texto**: lo que se
> sella es `documentoATexto(generarContrato(…))` (`lib/server/firmas-repo.ts`),
> y `ConstanciaFirmas` solo la monta la página `/contrato/[id]`, que le pasa
> `idioma={idiomaDeLaPeticion()}` (prop, `'es'` por omisión: es un Server
> Component). La guardia de `textos/arrendadores.test.ts` pasó de prohibir el
> diccionario en la constancia a exigirlo, y además fija que el hash de las
> firmas no la mira. Mismo criterio para la casilla de consentimiento de la
> firma pública: en el idioma configurado, como ya estaba.

**Cómo se demostró el español idéntico:** `lib/i18n/pantallas-inventario-arrendadores.test.ts`
rinde **81 estados**. Fuerza `useState` por **componente y ordinal** (el nombre
de la función que llama, leído de la pila, y el número de llamada): aquí hay
demasiados `useState(false)` seguidos para acertar por orden de render. Con
`I18N_VOLCAR=<carpeta>` vuelca el HTML español: se volcó con la prueba final y
los componentes de ec427a66 (`git checkout` de los 22 archivos, sin tocar el
resto) y con los del lote, y `diff -rq` salió **vacío (81/81)**.
`I18N_VOLCAR_EN` vuelca el inglés para revisarlo a ojo.

**Segunda vuelta (validador ÁMBAR, `docs/i18n/validacion-inventario-arrendadores.md`).**
Los tres medios: (1) `lib/i18n/guardias-ingles.ts` (`huellasDeFormatoEspanol`,
para cualquier lote) busca en el HTML inglés dinero sin `MX$` y fechas
`dd/mm/aaaa` fuera de los `value=`; la prueba de pantallas la corre sobre los
81 estados y el mutante de `PagosRentaCard` sin idioma **muere** (dinero y
fecha, cada uno por separado). (2) La frase del lote a medias se arma con claves
en `InventarioTabla` (`fraseDeLote`) y una prueba exige que en español sea
`crearLote().frase()`. (3) `valorParaMostrar` (`lib/contrato-cambios.ts`) ganó
`idioma = 'es'`, y el historial de cambios lo pasa (`MX$` en inglés). Además, la
etiqueta de cada campo del historial y los faltantes / «dónde» de la barra del
documento se pintan por clave en inglés (mapas en `arrendadores/etiquetas.ts`
atados por prueba a `CAMPOS` y a `contrato-documento.ts`); en español, el dato.
Español otra vez medido: 81/81 idénticos contra los componentes de ec427a66.

**Glosario añadido** (decisiones del traductor y, en la segunda vuelta, del
orquestador; el dueño puede cambiarlas):
contrato → **contract** (y **lease agreement** cuando dice «contrato de
arrendamiento», en títulos) · renta → *rent* · depósito (en garantía) →
**security deposit** · conciliación / cuadre de renta → **Rent reconciliation**
· licencia / permiso → **Permit** como genérico (*license* solo en «Municipal
license» y en el título) · un permiso vigente → **Valid** (un contrato o código
vigente sigue siendo *Active*) · firma → *signature* (firmar → *sign*) ·
constancia → **certificate** («Electronic signature certificate») ·
arrendataria (nosotros) → **lessee** (se queda) · predio → *property* ·
emplazamiento → **Placement** (no *location*, que es *ubicación*) · RFC / RUC →
**RFC (tax ID)** / **RUC (tax ID)** · fija → **Static** · medio (filtro) →
**Medium** · pantalla suelta → *individual screen* · razón social (del
arrendador) → **Legal name**; las razones sociales propias → **Legal entities** · régimen fiscal → *tax regime* · domicilio → *address* · domicilio
fiscal → *tax address* · alta manual → **manual entry** · carga masiva → **bulk
upload** · dar de baja → **deactivate** · congelar (el documento) → *freeze* ·
sello SHA-256 → *SHA-256 seal* · vence (un contrato) → *Expires* frente a vence
(un pago) → *Due* · próximo (pago) → *Next* · actualizar (en la carga) → *Update*.
Esas tres y «Vigente» (*Valid* / *Active*) entran en `DISTINTOS_A_PROPOSITO` de
la costura.

**Sigue en español dentro de estas pantallas, a propósito o de otro módulo:** el
documento del contrato (arriba); el motivo de `pantallasFueraDelGrupo`
(`lib/predio-cercania.ts`); un faltante o un «dónde» de la barra que no esté en
el mapa (se pinta tal cual); la etiqueta guardada de un campo del historial que
no esté en `CAMPOS`; el error de formato de `CampoCifra`
(`lib/captura-cifra.ts`); `Paginacion` («de»); los nombres de columna de la
plantilla (`renta_arrendador`, `costo_compra`, la hoja «Sitios»); la unidad de
cada modalidad en «Información añadida» (un dato); el importe que recita el
paso de revisión de firmas (`$10,000.00 MXN`, es el dato que se congela);
`GestionEntidadesFiscales` (la gestión dentro de `/razones-sociales`, que no
estaba en la lista del lote) y los mensajes del servidor (I18N-05).

### Costura 2

**2026-11-02, rama `feat/ingles-costura-2`** (sale de `integra/ingles`,
00815aa3). Junta los tres lotes de la tercera ola que faltaban, en este orden y
con `git merge --no-ff`: clientes y operaciones, Space Eyes, e inventario y
arrendadores. El inglés sigue APAGADO; en español no cambia ni una letra
(medido, abajo).

**1 · Los choques de las uniones.** `diccionario.ts`, `costura.test.ts` y esta
nota son la unión de los lados. En `costura.test.ts`, `baseDelDiccionario`
descuenta ahora los cinco ámbitos nuevos (clientes, operaciones, spaceeyes,
inventario, arrendadores). «Actualizar» estaba declarado tres veces (admin,
Space Eyes, inventario): queda **una** entrada que junta los tres motivos.

**2 · `/razones-sociales`, traducida dos veces.** Administración (ya integrado)
y arrendadores tradujeron la MISMA página con claves distintas. Manda
`admin.razones.*`. Las tres claves de arrendadores que quedaron sin uso
(`arrendadores.entidades.sin-acceso`, `.no-cargar`, `.sub`) se retiran; su
español lo sigue pintando la clave de admin. Los avisos de
`GestionRazonesSociales` («Razón social agregada / actualizada / eliminada»)
dicen ahora **Legal entity added / updated / deleted**, como admin: el registro
es una *legal entity* (la tarjeta se titula «Legal entities»), su nombre sigue
siendo *legal name*. La prueba del estado «razones sociales · cargando» espera
el subtítulo que de verdad se pinta.

**3 · Divergencias que ningún lote podía ver** (cada uno salía de una base sin
los demás). Unificadas, solo en inglés:

| Español | Antes | Ahora | Por qué |
|---|---|---|---|
| Código postal inválido (5 dígitos) · C.P. fiscal | *ZIP code* (clientes) | *postal code* | como el servidor, admin y campañas; «ZIP» es de EE. UU. |
| Para enviarlo a revisión falta: … | *it still needs* (clientes) | *this is missing* | como el servidor |
| Calle, número, colonia, CP, … (ejemplo) | *ZIP code* (arrendadores) | *postal code* | como admin |
| No puede ser negativo | *Can’t be negative* (arrendadores) | *It cannot be negative* | como compartidos |
| La licencia no puede vencer antes de expedirse. | *can’t* | *cannot* | como el servidor |
| Razón social agregada / actualizada | *Legal name* (arrendadores) | *Legal entity* | como admin (§2) |

Y declaradas en `DISTINTOS_A_PROPOSITO`, porque significan otra cosa: «Dada de
baja» (*Deactivated* / *Decommissioned*), «Equipo» (*Team* / *Device*),
«Operador» (*Operator* / *Carrier*), «Volver» (*Back* / *Revert*) y «Registrar»
(*Register* un artículo / *Record* un pago).

**4 · Un solo ayudante de huellas de formato español**
(`lib/i18n/guardias-ingles.ts`, `huellasDeFormatoEspanol`). Inventario lo creó
con dos huellas y Space Eyes tenía en su prueba una copia local con dos más.
Queda uno con las seis: dinero sin `MX$`, `dd/mm/aaaa`, la fecha larga («20 de
octubre de 2026»), el mes corto («02 nov»), el corto con guion («02-nov») y el
«a. m.». Mira también los `title`, `aria-label`, `placeholder` y `alt`, y
`permitidos` se prueba contra el **trozo** encontrado (el importe se lleva el
código de moneda que lo sigue), no contra 60 caracteres de contexto. Lo usan
las pruebas de pantallas de **los once ámbitos con pantallas** (propuestas,
compartidos, campañas y finanzas, comercial, catálogos, admin, cuenta y shell,
clientes, operaciones, Space Eyes, inventario y arrendadores). **Cero huellas**
en los lotes ya integrados; un mutante de control (la fecha del tablero de
Propuestas sin idioma) cae con «02/11/2026». Mueren el **E** de inventario
(`PanelFirmas` con la fecha larga en español) y el **M10** de Space Eyes (la
fecha de Programación siempre en es-MX).

**5 · Los menores de los validadores.**

- Space Eyes: `alta.tel.3` dice «choose {vincular}» (no «confirm with»); el
  respaldo «No se pudo hablar con Space Eyes» de `lib/data/space-eyes-api.ts`
  va con idioma (`spaceeyes.comun.sin-hablar`, *Could not reach Space Eyes*),
  con `'es'` por omisión como `textoDeError`.
- Inventario: `fraseDeLote` y `avisoDeLote` se exportan y la prueba de paridad
  las **llama**; una guardia de fuente fija la unidad del subtítulo. Mueren D1 y
  D2. Constancia: «kept as circumstantial evidence».
- Servidor: el inglés exacto de «…Subelos en varias veces.» (muere el mutante
  del ancla `$` del mensaje corto); «promo codes» → **negotiation codes**, y en
  esos dos mensajes «package» → **bundle**, con comillas tipográficas.
- Administración: el singular de Network se exige con su cierre
  (`'>of 1 space<'`); muere N4.
- Captación: «2 ordenes» en la imprenta se queda así; es un dato del español.

**El español, medido.** Se volcó el HTML español de **todas** las pruebas de
pantallas (`I18N_VOLCAR` / `VOLCAR_HTML`) con `integra/ingles` más cada lote
por separado (la línea base de cada uno; para inventario, con SU versión de
`/razones-sociales`) y con el resultado final: **397 estados**, `diff -rq`
vacío (184 de los siete lotes ya integrados, 25 + 12 de clientes y
operaciones, 95 de Space Eyes, 81 de inventario y arrendadores). Y
`DICCIONARIOS.es` frente a la unión de las líneas base: 1 clave nueva, 3
retiradas (su texto lo sigue pintando otra clave), **0 valores cambiados**.
Inventario de lo que falta: `node scripts/i18n-inventario.mjs` baja de 1270
textos en 112 archivos (`integra/ingles`) a 357 en 95.

> [!success] 2026-11-02 · las confirmaciones de APROBAR, ya en inglés (`feat/ingles-confirmaciones`)
> Lo que el validador dejó como «la mezcla más llamativa»: los dos 409 que
> `PATCH /api/propuestas/[id]` responde a mano en el flujo de aprobar. **Una vía
> por respuesta**, la que menos toca en cada caso:
>
> - **Aprobar en $0** (`requiereConfirmacionCero`, el `window.confirm`): la
>   bandera y `ConfirmacionCeroError` ya existían, así que **la ruta no se
>   tocó**. Las dos pantallas (`propuestas/page.tsx` y `propuestas/[id]/page.tsx`)
>   pintan `servidor.propuesta.aprobar-en-cero` con
>   `{total}` = `formatearDineroRedondo(0, idioma)`: «$0» en español —el literal
>   del servidor— y «MX$0» en inglés. **No `formatMonto`**: daría «$ 0.00» y el
>   español dejaría de ser idéntico. Confirmar sigue reintentando con
>   `confirmarCero: true`.
> - **Descuento sobre el tope vigente** (`descuentoSobreTope`, un toast): la
>   frase de `mensajeTopeVigente` lleva cuatro cifras que solo tiene el
>   servidor, y pintar una clave en la pantalla obligaba a mandarlas y a
>   rehacer la cuenta en el cliente. La ruta pasa el `error` por
>   `traducirError(e.message, idiomaDeLaPeticion())` —lo mismo que hace el
>   embudo— y `PATRONES_ERROR` gana **tres patrones** (las tres formas
>   alcanzables de la frase). En español `traducirError` devuelve el mensaje tal
>   cual; el 409 y la bandera no cambian. `lib/server/errores.ts` no se tocó.
>
> Prueba: `lib/i18n/confirmaciones-aprobar.test.ts` (12, primero en rojo: 8).
> Afirma el confirm español entero contra el literal de `propuestas-repo.ts`,
> el inglés exacto, y la ruta con mocks: mismo status, misma bandera y
> `confirmarCero` llegando al repo. Las pruebas que afirman el español
> (`tope-descuento.e2e`, `propuestas-repo-tope-vigente`, `descuento.tope`)
> pasan sin tocarse; solo se regeneró la instantánea de `textos/servidor`
> (una clave más, sin cambiar ninguna).
>
> **Sigue en español en ese flujo, y no es una confirmación:** «La negociación
> con la agencia … no está validada» (el 400 genérico de la misma ruta) y la
> frase del tope en la **edición** del descuento (la otra rama del `PATCH`).
> La liga pública dice `MSJ_TOPE_VIGENTE_PUBLICO`, otra ruta.

### Lote operaciones (parte 2)

**2026-11-02, rama `feat/ingles-operaciones-2`** (sale de `integra/ingles`,
`34022673`). El inglés sigue APAGADO; en español no cambia ni una letra. Tabla
de revisión en `docs/i18n/revision-operaciones-2.md`.

**Pantallas cubiertas:** `/operaciones` y la ficha de la OT (`OTVista`,
escritorio y móvil), `/creativos`, el **Dashboard** (`/inicio`, solo los
textos: su diseño está aprobado y ni una clase cambia) y `/energia` (Consumo
de luz, solo la interfaz).

- **463 claves** (471 tras la segunda vuelta) en tres archivos: `textos/operaciones2.ts` (202, OT y
  Creativos), `textos/inicio.ts` (141) y `textos/energia.ts` (120), cada uno con
  su instantánea, sus guardias y su «qué clave usa cada aviso que no se rinde».
- **Funciones con `idioma` (`'es'` por omisión):** `lib/costo-ot-captura.ts`;
  `construirAlertas` vía `dashboardMetrics` y `useDashboard(idioma)`;
  `pipelineComercial`; y las de texto de `energia/captura.ts` y
  `energia/recibos.ts`. Las alertas del Dashboard se comprueban sobre
  `lib/i18n/estado-alertas.fixture.ts`, un estado que dispara todas las ramas:
  en español, idénticas con y sin idioma.
- **Tipos de OT:** clave propia (`components/operaciones/claves.ts`) atada a
  `TIPO_OT_LABEL`; **se unifica con `etiquetaTipoOt`** del lote de
  administración al juntar los lotes.
- **Español idéntico, medido:** HTML volcado con `I18N_VOLCAR` antes y después
  de tocar los componentes, `diff -rq` vacío en 24 + 7 + 11 estados. Las tres
  pruebas importan la página PRIMERO y fuerzan `useState` DESPUÉS (lección del
  validador de clientes: un estado que agota el tiempo no se come los forzados
  del siguiente).
- **Costura:** «Baja» (prioridad «Low» frente a sitio «Decommissioned») y
  «{n} meses» (el singular de Comercial) quedan declarados.

**Términos nuevos** (decisión del agente salvo donde se dice; el dueño puede
cambiarlos): cuadrilla → *crew* · fecha compromiso → *due date* · responsable
→ *assignee* · frenar el candado → *keep the billing lock closed* ·
fotografía comprobatoria → *proof photo* · sello de ubicación → *location
stamp* · costo real → *actual cost* · rentabilidad → *profitability*
(orquestador) · ingreso → *revenue* · tasa de cierre → *close rate* · hueco →
*gap* · cara libre → *free face* · por cobrar por antigüedad → *receivables by
age* · pausa legal → *legal hold* · recibo de luz → *electricity bill* y
consumo → *consumption* (orquestador) · predio → *property* · medidor →
*meter* · pantalla suelta → *standalone screen* · recibo BIMESTRAL → *bill
issued EVERY TWO MONTHS*. El título de `/energia` es el del menú (*Power
usage*).

> [!note] Segunda vuelta (validación ÁMBAR, `docs/i18n/validacion-operaciones-2.md`)
> - Los 5 medios y los 10 bajos aplicados (detalle en la tabla de revisión).
>   Plurales de la lectura de PDF por total; el tipo de incidencia del
>   Dashboard (`CLAVE_INCIDENCIA`) y el tipo de campaña de Creativos
>   (`CLAVE_TIPO_CAMPANA`) salen por clave solo en inglés, con el dato crudo en
>   español como siempre; «Ending {fecha}: {campana} ({cliente})».
> - **El diseño del Dashboard queda protegido por prueba**: el mock de
>   `CardColapsable` pinta sus clases y una instantánea guarda el HTML español
>   de los 7 estados. Un mutante de clase (`lg:col-span-2` → `lg:col-span-3`)
>   pone las 7 en rojo.
> - Glosario del orquestador: pausa legal → *legal restriction* · cara libre →
>   *available face* · tipos de alerta → *Rent issues / Contract issues /
>   Blocked or paused sites…* · dictamen estructural → *Structural inspection
>   report* · en Creativos lo reservado es un *slot* (el *spot* es el anuncio).
> - 471 claves. Español, otra vez medido: los 42 estados idénticos.

**Sigue en español:** los avisos que manda el servidor (el error del
autoguardado del checklist, los avisos de cada PDF de CFE, I18N-05), los datos
(puntos del checklist de una OT nueva, nombres de cuadrilla de la demo,
«Creativo (código)»), los ejes de la gráfica de ocupación (`etiquetaBucket`,
compartida con Reportes), `FotoUploaderMock` y `ConfirmDialog`. **Reportes
no se tocó**: `/reportes` y `components/demo/reportes/*` quedan para otra
entrega.

### Lote reportes

**2026-11-02, rama `feat/ingles-reportes`** (sale de `integra/ingles` en
`00815aa3`). Reportes de rentabilidad (`/reportes`): la página, los filtros, la
tabla con su desglose, los avisos y las notas que redacta el motor. El inglés
sigue APAGADO; en español no cambia ni una letra. **148 claves**
(`lib/i18n/textos/reportes.ts`, prefijo `reportes.*`). Tabla de revisión en
`docs/i18n/revision-reportes.md`.

**Los catálogos siguen mandando en español.** `DIMENSIONES_UI`,
`GRANULARIDADES_UI`, `COLUMNAS`, `PRIMERA_COLUMNA`, `COLUMNAS_DESGLOSE` y
`SUSTANTIVO_FILA` no se tocaron; cada uno ganó su mapa de claves
(`CLAVE_DIMENSION`, `CLAVE_COLUMNA`…) y `textos/reportes.test.ts` exige que el
diccionario diga exactamente lo mismo, como el menú con `nav.ts`. Las funciones
puras (`cuenta`, `motivoInvalido`, `estadoDeReporte`, `columnasDeDimension`,
`formatoCelda`, `formatoPorcentaje`, `notaDeArrendador`, `subtituloDeConteo`,
`resumenVisitasPorTipo`, `avisosDelReporte`) ganan `idioma` con `'es'` por
omisión.

> [!important] Las notas del motor: el servidor las manda en español, la pantalla las rearma
> Las seis notas de `lib/data/reportes.ts` (`notaDeCostosOt`,
> `notaDeExclusiones`, `notaDeAtribucion`, `notaDeTarifas`, `notaDeVendedores`,
> `notaDeCobertura`) se arman ahora con el diccionario y se exportan con
> `idioma` (`'es'` por omisión). La ruta no pasa idioma, así que **lo que viaja
> en el JSON sigue en español**. En español la pantalla pinta la nota verbatim,
> como siempre; en inglés `avisosDelReporte` la vuelve a armar con LA MISMA
> función desde los números que viajan con ella (`r.cobertura.faltantes`, …):
> no hay una segunda redacción que pueda divergir. Medido: las seis, en 5225
> combinaciones de sus números, dicen lo mismo que el motor de `00815aa3`.
> Tres notas tienen una variante `una-de-varias` además de `.uno/.otros`: el
> inglés concuerda con dos contadores a la vez («1 of the 5 bookings … has»).

**Lo que escribe el motor y se traduce en la pantalla:** las dos filas con la
clave vacía («Sin asignar», «Sin vendedor», con su detalle) y la etiqueta de
cada periodo («T1 2026» → «Q1 2026», «ene» → «Jan»), que `etiquetaDePeriodo`
rearma desde la CLAVE estable del bucket (`2026-T1`, `2026-03`). Todo lo demás
de una fila es DATO y no se traduce: el nombre de la pantalla, de la razón
social o de la persona, su cargo, y los papeles de `catalogo_roles_entidad`
(«Vende publicidad»).

**El eje de la gráfica de ocupación.** `etiquetaBucket` gana `idioma`
(`'es'` por omisión: la rama española es la de siempre). En inglés: `Q1 2026`,
el mes con `en-US` («Jan») y la semana como «Jan 12» (un `12/01` lo lee un
lector de EE. UU. como 1 de diciembre). `ocupacionSerie` y `useOcupacionSerie`
pasan el idioma. **Falta una línea al juntar con el lote de operaciones
(parte 2)**, que tradujo el Dashboard: en `app/(app)/(shell)/inicio/page.tsx`,
`useOcupacionSerie(gran)` → `useOcupacionSerie(gran, idioma)`. No se hizo aquí
porque en esta base la página no tiene `idioma` y ese lote la reescribió.

**Dinero y números.** `formatMonto(n, idioma)` en la página y la tabla
(`MX$ 600.00` en inglés en una instancia MXN); las notas, con
`formatearDineroRedondo(v, idioma)`. Los porcentajes en inglés sin espacio
(«55.0%»); el español conserva el «55.0 %». La columna «Margen bruto %» es
«Gross margin (%)» para no dejar un espacio delante del `%`.

**La red caída.** La página ya no guarda la frase en el estado (quedaría en el
idioma del momento del fallo): deja `mensaje: null` con `status: 0` y la pone
`estadoDeReporte` con `reportes.error.red`. En español, la misma frase.

**Lo que NO se traduce, a propósito:** lo que manda el servidor (notas,
etiquetas de periodo, filas del motor), el CSV y lo que se exporte, y los datos.
El importe de los recibos sin destino va CRUDO en la nota española («por 350»,
sin moneda), como siempre lo escribió el motor; en inglés sale formateado. Es un
defecto viejo del español que no se corrigió aquí para no cambiarlo.

**Cómo se midió que el español no cambió:** los 16 estados de
`lib/i18n/pantallas-reportes.test.ts` volcados con `I18N_VOLCAR` con los
componentes de `00815aa3` y con los de la rama: `diff -rq` vacío. La prueba
importa la página PRIMERO y fuerza los `useState` después, justo antes de
rendir.

**Términos nuevos:** rentabilidad → *profitability*; ocupación → *occupancy*;
ingreso → *revenue*; costo del espacio / de operación / de la luz → *space /
operations / electricity cost*; margen bruto → *gross margin*; superficie →
*area*; cara → *face*; razón social (columna) → *Legal name* (contada: *legal
entity*); saldo atribuido → *attributed balance*; tarifa publicada / neto
comparable / tarifa de lista → *published rate / comparable net / list rate*;
comprobante con emisora → *invoice from an issuing entity*; horas en sitio →
*hours on site*; trimestre (columna) → *Quarter* (declarado en
`costura.test.ts` frente al «This quarter» del selector de periodo); en curso →
*in progress*; con movimiento → *with activity*; desglose → *breakdown*;
contrato de arrendamiento → *lease contract*; propia → *owned*; bitácora →
*log*; de dos caras → *double-sided* (nunca «two-faced», que es «hipócrita»).

> [!success] 2026-11-02, segunda vuelta · validación ÁMBAR atendida
> (`docs/i18n/validacion-reportes.md`). «two-faced» → «double-sided» en los dos
> avisos del m²; nueve retoques de redacción («has been recorded since»,
> «hasn’t been recorded», «The period’s only visit», «is costed at the per-type
> estimate», «all … bills», «missing its width or height», «overlaps», «% of
> published rate») y el tooltip del desglose con `formatFecha` en inglés. El
> idioma del eje de ocupación ya tiene prueba
> (`lib/data/ocupacion-idioma.test.ts`): etiquetas inglesas y los mismos números
> que en español; los dos mutantes que sobrevivían (quitar el idioma en
> `ocupacionSerie` o en `useOcupacionSerie`) mueren. La clave
> `reportes.nota.ot.reales.uno` escribe el «1» literal en español en vez del
> hueco, porque el inglés no lleva cifra: mismo español. Español medido otra
> vez: 16 estados idénticos y las seis notas iguales al motor de `00815aa3`. El
> «por 350» y la línea de `inicio` siguen fuera, a propósito.

### Ola 5 · cierre (recorrido en navegador)

Rama `feat/ingles-ola5`. La tabla completa, con las pantallas recorridas, está en
`docs/i18n/revision-ola5.md`.

**Lo que apareció en el navegador** y ninguna prueba veía, porque los barridos solo
buscan las frases de su propio diccionario:

- El galón de `CardColapsable`. Su `aria-label` era «Minimizar {título}», un
  literal en plantilla. Ahora usa `compartidos.plegar.minimizar/expandir`.
- Los fallos de `/login` y `/recuperar/[token]`. Las rutas de acceso responden su
  JSON sin `respuestaError()` y son zona roja, así que se traducen **en la
  pantalla** con `lib/i18n/errores-acceso.ts` (`mensajeDeAcceso`, 10 claves
  `login.error.*`). El resto pasa a `traducirError`.
- El aria-label del panel móvil del menú lateral (`Sidebar.tsx`).
- La periodicidad cruda de la renta en el alta de propuesta.
- Las fechas `dd/mm` del pipeline de campaña. `usePipeline` pasa ahora `iso` y
  `PipelineView` la formatea en inglés.
- La exhibición `fijo`. Es el dato real; el mapa solo conocía `fija`.
- El tipo de medio crudo en la liga pública `/p/[id]`.

**Términos.** *legal entity* en toda la tarjeta de razones sociales de
Arrendadores, también en `arrendadores.comun.sin-razon`. «it still needs:» en
lugar de «this is missing:», que no concordaba con varios faltantes (servidor y
captación a la vez). Los errores, sin contracción: «Cannot be earlier than the
issue date».

**Guardia de formato** (`guardias-ingles.ts`), siete huellas:

- fechas `d/m/aa(aa)` sin relleno;
- el `$` partido entre elementos;
- `US$` en modo MXN, que ya no da falso positivo;
- en modo USD, una huella nueva para el `US$`, que es el símbolo del español de
  esa instancia.

**El inventario no basta.** `i18n-inventario.mjs` siguió en 211 tras siete
correcciones reales. No mira los archivos de `YA_HECHO` (login, Sidebar), ni los
literales en plantillas, ni los datos crudos. Declarar el inglés terminado pide
el recorrido, no solo el contador.

**Siguen en español y van a decisión del dueño:**

- las notificaciones de la campanita, que se guardan como dato;
- los papeles de `catalogo_roles_entidad`;
- la lista de comprobación por omisión de una OT nueva;
- además de lo ya declarado: Actividad, las notas de versión, los catálogos del
  SAT y el texto legal del contrato.

### Ola 6 · lo que se guarda en español, traducido al pintarlo

Rama `feat/ingles-ola6`. Tabla completa en `docs/i18n/revision-ola6.md`. La regla
común: **el dato no cambia**. La pantalla reconoce el texto guardado y lo pinta
en el idioma de quien lee; lo que no reconoce lo pinta tal cual.

- **Notificaciones** (`lib/i18n/notificaciones.ts`, `textos/notificaciones.ts`). El
  español de cada clave es la plantilla exacta del servidor, con huecos, y de ella
  sale el patrón. Cada título lleva las plantillas que puede tener su detalle. El
  saldo se reformatea con `MX$`. «No se pudo generar la campaña» pasa su detalle
  por `traducirError`. `notificaciones.test.ts` ata cada plantilla al literal de su
  archivo y cuenta las fuentes del servidor.
- **Papeles** (`lib/i18n/papeles.ts`, `admin.papel.*`). La etiqueta se traduce solo
  si es la de la migración: una renombrada en la instancia es dato. El código lleva
  un nombre inglés corto para la bienvenida.
- **Checklist de una OT nueva** (`lib/i18n/checklist-ot.ts`): solo el texto exacto
  de los tres puntos por omisión. Al marcar, se manda el texto guardado.
- **Mensajes de venta**: cinco patrones más en `PATRONES_ERROR` (el tope al editar y
  la agencia sin validar), y `traducirError` en dos respuestas a mano del `PATCH`.
- **Acceso**: «Cuerpo inválido» y «Falta el enlace de restablecimiento.» en
  `errores-acceso.ts`. **Pipeline**: `isoDePaso` lee una fecha sin hora como día
  local (antes salía un día antes, en los dos idiomas).

**Términos nuevos:** ODC → *PO*; cobranza (aviso) → *collection*; saldo →
*balance*; al aire → *on air*; contrato sin capturar → *contract not entered*; un
espacio (sin nombre) → *a space*. Papeles: *Pays rent to landlords* (RENT), *Buys
assets and equipment* (ASSETS), *Government permits and licenses* (PERMITS),
*Operations and payroll* (OPERATIONS), *Sells advertising* (SALES). Checklist:
*Structure and hardware inspection*, *Installation / execution*, *Proof photo
with geolocation*. Cuerpo inválido → *Invalid request*.

## 12 · Los DOCUMENTOS van en el idioma de la INSTANCIA (ADR 0049, 03/11)

Decisión del dueño (03/11): «el idioma de papeles y contratos es fijo al
crearse la app en cada server, pero el idioma de lo demás se debe poder
configurar por usuario y navegador». **Sustituye** a la regla de las olas del
inglés de que «el texto legal del contrato no se traduce»: ahora se redacta en
el idioma de los documentos de la instancia. Rama `feat/idioma-instancia`,
[ADR 0049](../../docs/adr/0049-el-idioma-de-los-documentos-es-de-la-instancia.md).

- **Dónde vive:** `tenants.idioma_documentos` (`es` | `en` | `it`, DEFAULT
  `es`), al lado de la moneda y con sus mismas reglas: se elige en el bootstrap
  (`idiomaDocumentos`, `provision-instancia.sh --idioma`), lo heredan las demás
  organizaciones y la base impide cambiarlo
  (`20261103_idioma_documentos_por_instancia.sql`). Todas las instancias que ya
  existían quedan en `es`.
- **Lectura:** `idiomaDeLaInstancia()` (`lib/server/idioma-instancia.ts`),
  cacheada en `globalThis` y **fail-closed** (si la base no contesta, lanza; no
  cae al español). La pide **solo** `datosContrato()` y la mete en los datos,
  así que la página, la huella de revisión, el congelado y el cotejo de firmas
  redactan en el mismo idioma.
- **Qué sigue la instancia:** el contrato (texto, cantidad con letra
  —`numeroALetras(n, moneda, idioma)`—, cifras, fechas), lo que la página
  `/contrato/[id]` **imprime** alrededor (encabezados, sellos de firma, aviso del
  pie, de la tabla `encabezadosDocumento`) y la **constancia de firmas**, que
  del 02/11 al 03/11 seguía a la petición. Lo que no se imprime (barra de
  faltantes, panel de firmas) sigue a la persona.
- **Lo que cambió en el HTML de las pruebas** (volcado completo
  `I18N_VOLCAR_TODO` antes/después, `diff -rq`): **solo** la constancia del
  contrato renderizado en inglés, que ahora sale en español porque la instancia
  de la prueba es española. Dos casos nuevos (instancia `en` e `it`). La
  etiqueta inglesa de la parte arrendadora en la constancia pasa de «THE
  LANDLORD» a «THE LESSOR», la del contrato inglés.
- **El español, byte a byte:** el camino `es` de `generarContrato` no se tocó;
  `contrato-documento-idioma.test.ts` fija 14 hashes medidos sobre el código de
  antes (`6779321d`).
- **La traducción del contrato al inglés y al italiano es una PLANTILLA DE
  EJEMPLO** (D13, contestada por el dueño el 04/11: «cada cliente los irá
  armando según contrate la app»): el contrato de derecho mexicano en otro
  idioma, no uno adaptado a otra ley. Ya no se espera revisión de abogado para
  dar de alta en `en`/`it`.
- **Segunda vuelta (03/11), decisión del dueño: «todo debe salir en el idioma
  que se configuró el programa».** También siguen la instancia la propuesta
  imprimible (`/propuesta/[id]`, el papel con su QR), la liga `/p/[id]` y el
  portal `/portal/[token]` (cada uno con un `layout.tsx` que re-provee el
  idioma), el comprobante de cobranza y los correos de propuesta, invitación y
  recordatorios de contratos. **Excepción:** el CSV del estado de cuenta sigue
  la pantalla. El correo de restablecer contraseña, pendiente entonces por ser
  ruta de auth, se hizo el 04/11 con aprobación del dueño (`feat/idiomas-cierre`).
- **Mecanismo en el navegador:** `lib/i18n/idioma-documentos-cliente.tsx` — el
  layout raíz deja el idioma de la instancia en `ProveedorIdiomaDocumentos` y
  `EnIdiomaDeLosDocumentos` re-provee `ProveedorIdioma` para el papel. Sin
  proveedor no impone nada (por eso los volcados de las pruebas de siempre no
  cambian).
- **Correos:** en español la plantilla literal de siempre, byte a byte
  (`correos-idioma.test.ts`); en inglés e italiano, claves nuevas
  `cuenta.correo.*`, `propuestas.correo.*` y `notificaciones.correo.*`, atadas a
  la plantilla española por la misma prueba. El italiano de esas claves llegó
  al integrar con `integra/idiomas` (04/11, B67): ver [[italiano-olas]] §8.
- **`lang` (B68, 04/11):** el `<html lang>` sigue siendo el de la petición —lo
  pone el layout raíz, que no sabe la ruta sin tocar `middleware.ts`—, pero los
  layouts de `/p/[id]` y `/portal/[token]` envuelven el contenido en un
  `<div lang={idioma de la instancia} style="display:contents">` (WCAG 3.1.2):
  los lectores de pantalla leen el papel con la voz correcta.

## Enlaces

- [[ingles-olas]] — el tablero de la traducción: qué lote, en qué rama, qué validador y qué falta
- [[italiano-olas]] — el tercer idioma (2026-11-03): `IDIOMA_ITALIANO`, la tabla de formatos por idioma (`formato-idioma.ts`), la caída al inglés y los lotes
- [[acceso-y-sesion-ui]] — la pantalla de entrar, que es la traducida
- [[shell-y-navegacion]] — el menú lateral
- [[convenciones]] — el español como idioma del código
- [[zonas-de-riesgo]] — por qué no se tocó `middleware.ts`
- [[preguntas-abiertas]] — las tres decisiones que faltan
