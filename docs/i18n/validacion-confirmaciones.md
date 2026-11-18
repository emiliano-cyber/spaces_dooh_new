# Validación independiente · las confirmaciones de aprobar una propuesta en inglés

- **Rama:** `feat/ingles-confirmaciones`, commit `61b6eb24`, sobre `integra/ingles` `00815aa3`
- **Validado el:** 2026-11-02, entre las 23:05 y las 23:20 hora local (ya era el 2026-11-03 en UTC)
- **Validador:** sesión aparte de la del autor. No corrige nada. Este informe es lo único que escribe, y no se commitea.

## Veredicto: **VERDE**

En la zona de dinero no cambió nada: ni cuándo se pide confirmar, ni qué pasa al confirmar, ni el 409, ni las banderas, ni el tope. En la ruta solo cambió el texto del `error` del 409 del tope. El español sale idéntico en todo lo que se midió. Los tres patrones nuevos no casan con ningún otro texto del árbol y cubren las tres formas alcanzables. Los 10 e2e en rojo fallan igual sin este commit, y se deben a un defecto de las pruebas que depende de la hora del día.

No hay correcciones obligatorias. Hay dos observaciones menores (H1 y H2) y una decisión para el dueño (D1).

---

## 1 · Zona de dinero

`git diff 00815aa3..HEAD -- app/api/propuestas/[id]/route.ts` tiene **un solo cambio de comportamiento**, en la rama `TopeVigenteError` (`route.ts:179-184`):

```diff
-      return NextResponse.json({ error: e.message, descuentoSobreTope: true }, { status: 409 })
+      return NextResponse.json(
+        { error: traducirError(e.message, idiomaDeLaPeticion()), descuentoSobreTope: true },
+        { status: 409 },
+      )
```

Lo demás son los dos `import` y comentarios. Lo que se comprobó en concreto:

- **Cuándo se pide confirmar:** no cambió. `PropuestaCeroError` lo sigue lanzando `lib/server/propuestas-repo.ts:1890` con el mismo literal, y la ruta sigue respondiendo `{ error: e.message, requiereConfirmacionCero: true }` con 409 (`route.ts:164-166`). Ninguna de las dos líneas aparece en el diff.
- **Qué pasa al confirmar:** no cambió. Las dos pantallas siguen con `return cambiar(estatus, true)`, y la ruta sigue pasando `{ confirmarCero: body.confirmarCero }` al repositorio. El mutante M6 lo comprueba: si se fuerza `confirmarCero: false`, una prueba falla.
- **Status y banderas:** 409 y `descuentoSobreTope: true` en el tope; 409 y `requiereConfirmacionCero` en $0; 409 y `codigoPendiente` en el cupón. El 400 genérico tampoco cambió.
- **Lógica del tope:** el diff no toca `lib/descuento.ts` ni `propuestas-repo.ts`.
- **¿Puede lanzar `idiomaDeLaPeticion()`?** No:
  - `lib/i18n/servidor.ts:73` devuelve el español de entrada si `IDIOMA_INGLES` no vale `1`.
  - `cookies()` y `headers()` van dentro de `leerSeguro` (`servidor.ts:59-65`), que atrapa la excepción y devuelve `null`.
  - `resolverIdioma`, `normalizarIdioma` e `idiomaDeCabecera` (`idiomas.ts:96-160`) son puras. Comprueban `typeof` y tratan cualquier `q` ilegible como 1.
  - `traducirError` tampoco lanza: en español devuelve la entrada sin tocarla (`errores-servidor.ts:1072-1073`).

## 2 · El español, idéntico

- **El confirm en $0 en una instancia MXN:**
  - Antes, el `window.confirm` mostraba el `e.message` que manda el servidor, o sea el literal de `propuestas-repo.ts:1890`.
  - Ahora muestra `t('servidor.propuesta.aprobar-en-cero', { total: formatearDineroRedondo(0, 'es') })`.
  - `formatearDineroRedondo(0,'es')` da `$0` con MXN. Medido con `Intl` en Node 24: `es-MX MXN → [{currency:"$"},{integer:"0"}]`.
  - La prueba del autor compara los dos textos completos, incluida la segunda línea `aprobar-igual`. El mutante M2 (quitar una tilde: «Estás» → «Estas») hace fallar 3 pruebas, la instantánea entre ellas.
- **`mensajeTopeVigente` con `traducirError(m,'es') === m`:** se comprobaron **512 combinaciones** con una prueba temporal, ya borrada:
  - `pedido` ∈ {0.01, 0.5, 5, 12.345, 20, 33.33, 99.99, 100}
  - `tope` ∈ {0, 0.01, 5, 8, 10, 12.5, 50, 99.5}
  - `volumen` ∈ {0, 0.004, 0.5, 10, 12.25, 50, 99, 100}
  - Las 512 se devuelven idénticas en español. También salen las tres formas: 64 sin volumen, 184 con volumen y 264 con el volumen solo por encima del tope.
- **Las pruebas que afirman el español:** `git diff 00815aa3..HEAD --name-only | grep -E "tope|descuento"` no devuelve nada. `tope-descuento.e2e`, `propuestas-repo-tope-vigente` y `descuento.tope` no se tocaron, y las unitarias pasan en verde (§7).

## 3 · Los patrones nuevos

- **No casan con ningún otro mensaje.** La prueba temporal juntó **36 029 textos** y probó contra ellos los tres patrones: **0 coincidencias**. Los textos eran:
  - las claves de `CATALOGO_ERRORES` y `CATALOGO_LIB`;
  - todos los valores de `DICCIONARIOS.es` y `DICCIONARIOS.en`;
  - todos los literales entre comillas simples, dobles y acentos graves de `app/`, `lib/` y `components/`.
- **El mensaje de la edición no casa.** Se probaron las tres formas del mensaje de `DescuentoSobreTope` (`descuento.ts:95` en adelante) y ninguna casa con los patrones nuevos, porque los tres exigen empezar por «El descuento de esta propuesta,».
- **Una sola coincidencia por mensaje.** En las 512 combinaciones, el primer patrón de `PATRONES_ERROR` que casa es siempre uno de los tres nuevos, y casa exactamente uno. Ningún patrón anterior se adelanta.
- **Cubren todas las formas de la función.** `mensajeTopeVigente` (`descuento.ts:449-468`) arma la cabecera, con o sin la parte del volumen, y le añade una de dos colas: el volumen sobre el tope o «Ajusta». La cuarta combinación, sin volumen y con el volumen sobre el tope, no puede darse: con `volumenPct = 0`, `volumenSuperaTope` exige `0 - tope > 1e-9`, y `topeDescuentoValido` acota el tope a [0, 100]. Las cifras salen de `pct()` (`descuento.ts:169-171`), `String(Number(n.toFixed(2)))`, que solo da enteros o decimales cortos; `\d+(?:\.\d+)?` los cubre todos. En el rango [0, 100] no aparecen ni signo negativo ni notación exponencial.

## 4 · El inglés en contexto

- El confirm en $0 en inglés: «You are about to approve a proposal with a total of MX$0. Confirm explicitly to continue.» Medido: `en-US MXN → MX$`.
- La frase del tope respeta el glosario (`vault/03-Frontend/idiomas-es-en.md`):
  - «tope de descuento» como *discount cap* (`:1261-1262`);
  - Administración como *Settings* y nunca como sujeto, en la fórmula «an admin … raise the cap in Settings» (`:721`), la misma de `propuestas.ficha.descuento.tope-aviso`;
  - *commercial discount* y *volume discount* (`:710`).
- El `%` va sin espacio en las tres frases. En las 512 combinaciones el inglés no contiene « %», «descuento», «tope», «organizaci» ni «Administraci».
- El apóstrofo curvo de «organization’s» coincide con el que ya usan otros textos en inglés (`textos/comercial.ts:942`).

## 5 · Lo que sigue en español en el mismo flujo

1. **El 400 de aprobar sin validar la negociación con la agencia** (`propuestas-repo.ts:1821-1823`: «La negociación con la agencia X no está validada; no se puede aprobar la propuesta»).
   - Al crear la propuesta, la pantalla de alta ya avisa con su clave (`propuestas.alta.negociacion.titulo`), así que en el camino normal no se crea una propuesta con la negociación sin validar.
   - Sí puede salir si la negociación pierde la validación entre la creación y la aprobación.
   - **Visibilidad: baja.** Puede ir en otra ola; es un patrón con un hueco, el nombre de la agencia.
2. **La frase del tope al EDITAR el descuento**: la rama `actualizarPropuesta` del `PATCH`, `route.ts:93-96`, que responde `e.message` sin traducir.
   - La pantalla de detalle (`propuestas/[id]/page.tsx:156`) solo compara el número tecleado contra el tope, sin el volumen. Cuando la propuesta lleva descuento por volumen, un comercial por debajo del tope pero que compuesto lo supera llega al servidor, y el toast sale en español con la frase larga («Esta propuesta ya lleva 10 % por volumen, así que…»). Comprobado: hoy `traducirError(m,'en')` la devuelve sin cambios.
   - **Visibilidad: media.** Basta con tener escalas de volumen y teclear un descuento cerca del tope.
   - **Recomendación: siguiente ola, no esta.** Son cuatro formas más, con 3 o 4 huecos, en otra rama del `PATCH`, y esa rama ya no es «confirmar una aprobación». Meterla aquí ensancha un cambio que hoy es mínimo y limpio en zona de dinero.

## 6 · Los 10 e2e en rojo: no vienen de este cambio, y son un defecto de las pruebas

**Cómo se midió:**

- Postgres portátil en el 5433. El puerto estaba libre, y se dejó detenido al terminar. `timezone = 'America/Mexico_City'` en `postgresql.conf:722`.
- Se corrieron solo los tres archivos, `codigo-promocional`, `estado-campanas` y `plazos-cobranza`, con `npm run build` antes de cada versión:

| Versión | BUILD_ID | Resultado |
|---|---|---|
| HEAD `61b6eb24` | `dGgni2yYs__9-hkPPWVhp` | `Test Files 3 failed (3) · Tests 10 failed \| 60 passed (70)` |
| `00815aa3` (los 6 archivos de `apps/web` del diff devueltos a la base con `git checkout 00815aa3 --`) | `TH8HDXXQWzDE9fjiugMEM0` | `Test Files 3 failed (3) · Tests 10 failed \| 60 passed (70)` |

La lista de pruebas `FAIL` de las dos corridas es idéntica: `diff` no encontró diferencias. **No vienen de este commit.**

**La causa: depende de la hora del día.** Las pruebas calculan «hoy» en **UTC** y Postgres lo calcula en **hora de México**. Entre las 18:00 y las 24:00 locales, las dos fechas no coinciden:

- `apps/web/lib/test/semillas-e2e.ts:22-26`. `enDias()` hace `setDate(getDate()+n)` en hora local y después `toISOString().slice(0,10)`, que pasa la fecha a UTC. La usan `codigo-promocional` y `plazos-cobranza`.
- `apps/web/lib/test/estado-campanas.e2e.test.ts:67-71`. `dia()` es la misma construcción.

La salida lo muestra:

- `{"error":"El codigo \"SOLOHOY\" todavia no esta vigente: empieza el 2026-11-03."}` cuando para Postgres `current_date` aún era el 2026-11-02 (`codigo-promocional.e2e.test.ts:306`);
- `expected '2026-12-17' to be '2026-12-18'` (`plazos-cobranza.e2e.test.ts:159`);
- `expected 'ACTIVA' to be 'COMPLETADA'` (`estado-campanas.e2e.test.ts:144`).

`plazos-cobranza.e2e.test.ts:132-135` ya avisa del problema contrario, en el lado de SQL, pero `enDias()` sigue con él. En el CI, que corre en UTC, no se ve. **Va aparte, y no bloquea esta rama.** La corrección sería formatear la fecha local (`getFullYear/getMonth/getDate`) o pedirle `current_date + n` a Postgres.

## 7 · Pruebas y mutantes

`cd apps/web && npm run typecheck && npx vitest run --testTimeout=60000`:

```
> tsc --noEmit                      (sin errores)
 Test Files  345 passed (345)
      Tests  5357 passed (5357)
```

Los mutantes se corrieron contra las **unitarias**: `confirmaciones-aprobar.test.ts`, `errores-servidor*.test.ts`, la instantánea de `textos/servidor` y la prueba temporal del validador. **Contra las e2e no se mutó.** Cada mutante se restauró con `git checkout --`.

| # | Mutante | Resultado |
|---|---|---|
| M1 | Ruta: `traducirError(e.message, idiomaDeLaPeticion())` → `e.message` | **MUERE** (1 falla: «tope en ingles…») |
| M1b | Ruta: idioma fijo `'es'` | **MUERE** (1) |
| M2 | ES de la clave: «Estás» → «Estas» | **MUERE** (3, la instantánea entre ellas) |
| M4 | Pantalla de detalle: `formatearDineroRedondo(0, 'es')` en vez de `idioma` | **MUERE** (1) |
| M5 | Ruta: 409 → 400 en el tope | **MUERE** (2) |
| M6 | Ruta: `confirmarCero: false` hacia el repositorio | **MUERE** (1) |
| M3e | Patrón 2 ensanchado: cualquier cola tras la cabecera, de modo que se traga la forma 3 | **MUERE** (2: el caso «el volumen solo ya pasa el tope» del autor y la rejilla) |
| M3a | Patrón 1: `$1` → `(.+?)` | sobrevive, **equivalente** (ver H1) |
| M3b | Patrón 1 sin el ancla `^` | sobrevive, **equivalente** (ver H1) |

Estado final:

- El árbol quedó en HEAD: `git status` solo muestra los `desktop.ini` sin seguimiento y este informe.
- `.next` reconstruido desde HEAD, BUILD_ID `h2or0POxYgxWGEZuhMvjk`, para no dejar el build de la base.
- Postgres detenido, puerto 5433 libre.

## Hallazgos

| # | Severidad | Dónde | Escenario |
|---|---|---|---|
| H1 | Baja (informativa) | `confirmaciones-aprobar.test.ts:83-115` | Nada fija que los patrones sean estrictos: con `(.+?)` o sin el `^`, las pruebas siguen en verde. Hoy no existe ningún texto que distinga esos mutantes (0 coincidencias en 36 029 literales), así que no hay defecto. Si alguien ensancha un patrón mañana, solo lo frena una revisión. Un caso negativo barato sería afirmar que `traducirError(new DescuentoSobreTope(...).message, 'en')` no cambia. |
| H2 | Baja (informativa) | `propuestas/page.tsx:416`, `propuestas/[id]/page.tsx:324` | En una instancia **USD** el confirm en español pasa de «$0», el literal del servidor, a «US$0». Es lo correcto según la tabla de `dinero.ts:128-131`, y la instancia MXN queda idéntica, pero en USD el español no es letra por letra el de antes. |
| H3 | Media (fuera de esta rama) | `lib/test/semillas-e2e.ts:22-26`, `lib/test/estado-campanas.e2e.test.ts:67-71` | Las e2e de fechas fallan entre las 18:00 y las 24:00 de México: «hoy» se calcula en UTC contra el `current_date` de Postgres. Produce 10 rojos falsos que no dicen nada del código. |

## Para que decida el dueño

- **D1 · ¿La frase del tope al editar el descuento entra ya o en la siguiente ola?** Recomiendo la siguiente ola (§5.2): es visible con descuento por volumen, pero es otra rama del `PATCH` y no una confirmación de aprobar. El 400 de la negociación con la agencia (§5.1) es menos visible y puede ir en la misma ola.
- **D2 · ¿Se abre una tarea para H3?** Las e2e dependen de la hora del día. No toca dinero ni sesión: es un cambio en el código de pruebas (`semillas-e2e.ts`), que no figura en la lista de archivos intocables.
