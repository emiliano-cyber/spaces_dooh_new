# Supervisión · ADR 0048, la moneda es de la instancia y no se cambia

- **Rama:** `feat/moneda-por-instancia` (4 commits sobre `integra/ingles` 27047bfe, HEAD e72a410d)
- **Zona:** ROJA (R3 migración + R4 dinero)
- **Fecha:** 2026-11-02 · validador independiente, sin corregir nada

## Veredicto: ÁMBAR

La decisión del dueño se cumple en lo esencial: las instancias existentes se quedan en MXN, la
moneda no se puede cambiar ni desde la base ni desde la API, y el español MXN es idéntico al de
antes (medido en 318 214 comparaciones). Las pruebas y los mutantes muerden.

Quedan cuatro correcciones, ninguna visible en una instancia MXN. Dos tocan instancias USD y una
toca el texto firmado de contratos antiguos en USD.

### Correcciones antes de fusionar

1. **(MEDIA) Un contrato antiguo con `moneda = 'USD'` en una instancia MXN cambia su texto firmado.**
   `lib/contrato-documento.ts:241` ahora llama a `numeroALetras(n, moneda)` con la moneda del
   contrato. Antes la letra decía siempre «PESOS … M.N.», y ahora dice «DÓLARES … USD» para esas
   filas. `firmas-repo.ts:331` vuelve a calcular el hash del documento y `firmas-repo.ts:355` marca
   la firma como alterada si no coincide (`PanelFirmas.tsx:73` lo pinta). Escenario: g500 o DEMO
   tienen un contrato firmado que se dio de alta en USD cuando existía el selector, antes del
   30/09. Al desplegar, su firma aparece como inválida sin que nadie haya tocado nada. Las
   instancias MXN con contratos MXN o 'PEN' no cambian (medido: `PEN` cae a MXN).
   Hace falta medir antes `select count(*) from contratos_arrendamiento where moneda='USD' and congelado_en is not null`
   en cada base. Si sale más de 0, se elige entre conservar la letra vieja para lo ya congelado o
   aceptar la nueva firma.
2. **(BAJA-MEDIA, solo USD) `/api/reportes/rentabilidad` formatea importes sin pedir la moneda.**
   `lib/data/reportes.ts:1902/2226/2384/2548` usa `formatearDineroRedondo` en el servidor, y
   `app/api/reportes/rentabilidad/route.ts` no llama a `monedaDeLaInstancia()`. Lo medí en el
   build: las rutas usan otra copia del módulo `dinero.ts` (id 60046), distinta de la del layout
   y las páginas (id 66224, `chunks/4345.js`). En esa copia la moneda solo queda fijada si antes
   pasó por alguna de las siete rutas que sí la piden. Escenario: en una instancia USD recién
   arrancada, las notas de cobertura de Reportes dicen «$1,235» (el símbolo del peso) en vez de
   «US$1,235». La regla del propio autor (`moneda-instancia.ts:26-30`, «cada una la pide») queda
   incumplida.
3. **(BAJA, solo USD) `app/(app)/propuesta/[id]/page.tsx` no llama a `monedaDeLaInstancia()`.**
   El comentario de `moneda-instancia.ts:27` dice que debe hacerlo. Comparte la copia del módulo
   con el layout (los dos usan `chunks/4345.js`), así que funciona porque la consulta del layout
   termina antes que las tres de la página. Si el proceso acaba de arrancar, no está garantizado.
   Este es el documento que se manda al cliente. Basta con una línea.
4. **(BAJA) Faltan pruebas sobre dos rechazos.**
   - Si se anula `exigirMonedaDeLaInstancia` (`arrendadores-controller.ts:198` y `:287`), el
     mutante **sobrevive** a las 1358 unitarias de `lib/server`. No hay e2e del alta ni de la
     edición de contratos con otra moneda.
   - La prueba «y la app la pinta en dólares» (`bootstrap.e2e.test.ts`) solo comprueba
     `status 200` en `/login/`. No mide ningún `US$`, así que nada prueba de punta a punta que una
     instancia USD pinte dólares.
   - Tampoco hay e2e de `/api/tenants` rechazando otra moneda. Solo está probada la función pura
     `resolverMonedaDeAlta`.

### Observaciones (no bloquean)

- `provision-instancia.sh`: `--moneda USD` sin `--bootstrap` se ignora sin aviso (la validación
  de la línea 206 pasa). Un operador podría creer que eligió dólares.
- `/api/signup` acepta `moneda`. Con `AUTOREGISTRO=1` y una instancia vacía, un visitante
  anónimo elegiría la moneda de toda la instancia, que es una decisión que el ADR reserva al
  bootstrap. Está apagado por omisión.
- `semilla-catalogo-demo.mjs:1376` y `apps/web/scripts/bootstrap-auth.mjs:182` insertan
  organizaciones en MXN fijo. En una instancia USD fallan por el trigger (fail-closed, correcto).
- El repositorio tiene 14 `desktop.ini` versionados en `vault/`. Vienen de 2bfd1102, que ya está
  en la base: no es de esta rama.

## Evidencia por punto

### 1 · La migración `20261102_moneda_inmutable_por_instancia.sql`
- **En LF:** 0 `\r`, y sha256 en disco = `git show HEAD:` = `bcc0e7e7…b8d1`.
- **Orden:** es la última (`ls db/migrations | tail`), así que no necesita entrada en
  `ANTES_DE` (`scripts/migrar.mjs:67`).
- **Transaccional:** lleva `begin`/`commit`. **Idempotente:** usa `drop … if exists`,
  `create or replace` y el `update` con `is distinct from`. La e2e la vuelve a aplicar y pasa
  (`moneda-instancia.e2e`, «la migracion es idempotente»).
- **No toca nada aplicado:** `git diff --name-status 27047bfe..HEAD -- db/` = solo
  `A db/migrations/20261102_…`. `db/schema.sql` no se toca.
- **Qué había antes:** `tenants.moneda` nace en `20260715_arr_m1_columnas.sql:31` como
  `not null default 'MXN'` y nunca tuvo 'PEN'. Las columnas con 'PEN' son las de
  campanas/facturas/contratos y `config_negocio`. `20260724_n6` ya puso `config_negocio` en MXN.
  Ninguna corrección de `docs/datos/` inserta otra moneda (eyro: 'MXN'; la carga de g500 copia
  `config_negocio`). Conclusión: en DEMO, g500 y el PADRE el paso 0 no debería parar. El paso 1
  solo realinearía un `config_negocio` que alguien hubiera cambiado por `PATCH /api/config` (texto
  libre hasta hoy). Nadie lo leía para pintar, y la migración lo anuncia con `raise notice`. **No
  lo pude comprobar contra esas bases** (no hay acceso, por regla). Antes de aplicar, conviene
  correr `select moneda, count(*) from tenants group by 1` y lo mismo sobre `config_negocio`.
- **Triggers:** `tenants` no tiene RLS (no hay `enable row level security` sobre ella en ninguna
  migración), así que la comprobación de unicidad ve todas las organizaciones también con el rol
  de la app.
  - Pasa reescribir el mismo valor (e2e «reescribir el MISMO valor si pasa»). Los upserts de
    `semilla-demo.mjs:1152` y `carga_g500_4` escriben el mismo valor. `excluded` recibe el valor
    ya corregido por el trigger espejo.
  - Pasa el alta heredada: `bootstrap.e2e` y la e2e «config_negocio nace con la moneda de su
    organizacion».
  - Se bloquea un UPDATE con el superusuario y con el rol de la app (e2e NEGATIVO ×3), una
    organización nueva en otra moneda (e2e) y EUR aunque se apague el trigger de unicidad (CHECK).

### 2 · La inmutabilidad, de punta a punta
- Busqué con `grep moneda` en `lib/server`, `app/api`, `components`, `scripts` e `infra`.
  Lo que todavía escribe `moneda`:
  - `tenant.ts:109` escribe la que resuelve `resolverMonedaDeAlta`.
  - Los contratos usan `coalesce(…, tenants.moneda)` en `arrendadores-repo.ts:556` y
    `contratos-sitio.ts:237/355`.
  - `editarContrato` usa `patch.moneda` (`arrendadores-repo.ts:1245`), y lo filtra
    `exigirMonedaDeLaInstancia`.
  - Las campañas y facturas heredan del tenant.
  - Ninguna ruta hace `UPDATE tenants set moneda`.
- `PATCH /api/config`: lo rechaza en `route.ts:149` antes de guardar nada, también con el mismo
  valor, y `moneda` ya no está en el `map`. La pantalla de Administración nunca lo manda: sus
  `guardar({...})` son parciales.
- `CambiosContrato.tsx:535` deja la moneda de solo lectura. `ContratoWizard` manda
  `monedaInstancia()`.
- `/api/tenants` y `/api/signup` → `crearOrgConDueno` lee la moneda de la instancia dentro de la
  transacción (`cuentas-controller.ts:84`), y el trigger serializa con un advisory lock. El
  callback de Google no pasa moneda y la hereda.

### 3 · El bootstrap
- `provision-instancia.sh`: por omisión `MONEDA="MXN"` (`:93`). El `case` de `:206` rechaza
  cualquier valor que no sea `MXN|USD` con salida 64, antes de tocar el servidor. Va en el cuerpo
  en `:621`.
  `bash infra/scripts/pruebas-provision.sh` → **39 escenarios · 140 comprobaciones · 0 fallos**
  (incluye EUR y `usd`).
- `POST /api/bootstrap`: `monedaPedida` valida antes de crear nada. e2e: sin moneda → MXN/MXN,
  USD → USD/USD, EUR → 400 con 0 tenants y 0 usuarios, `usd` → 400.
- Valores reales: ninguna línea añadida (`^\+`) contiene IP, dominio, registry ni token.

### 4 · El español MXN queda idéntico (comparación mecánica)
Saqué la versión vieja con `git archive 27047bfe apps/web/lib` a un espejo en el scratchpad y la
importé junto a la nueva desde una prueba vitest, con alias `@` separados para cada árbol.
Comparé 22 748 importes: 0, -0, decimales en el borde de redondeo (0.005, 2.675, 999.995,
999999.5…), 1e15, 1e18, 1e21, MAX_SAFE_INTEGER, MIN_VALUE, NaN, ±Infinity, cada uno con su
negativo, y 40 000 pseudoaleatorios de 1e-3 a 1e11. Probé `formatMonto` (con y sin `'es'`),
`formatMontoCorto`, `formatearDinero` y `formatearDineroRedondo` en `es` y en `en`, y
`numeroALetras` (vieja frente a nueva sin moneda, con `'MXN'` y con `'PEN'`):

```
comparaciones=318214 diferencias_es_y_letras=0 diferencias_en=0
```

(La prueba se cortó a los 5 s por el tiempo límite de vitest, después de imprimir el resultado.)
La letra del contrato en MXN no cambia. Cambia para contratos en USD: es el hallazgo 1.

### 5 · La moneda global en un módulo
- **Fuga entre peticiones:** la base impide que haya dos monedas en una instancia, así que todas
  las peticiones escriben el mismo valor. Con varios tenants en una instancia no hay fuga posible.
- **E2E:** `bootstrap.e2e` vacía la base y crea una instancia USD dentro del mismo proceso. Las
  rutas que no piden la moneda conservan el último valor, pero ninguna prueba depende del símbolo.
- **Rutas que no pasan por el layout:** son el hallazgo 2. El build tiene dos copias del módulo
  (ids 60046 para las rutas y 66224 para el RSC), así que una ruta que formatea y no pide la
  moneda usa MXN por omisión.
- **Un `formatMonto` en el servidor antes de fijar la moneda:** usa MXN (`dinero.ts`
  `monedaVigente = MONEDA_POR_OMISION`). No falla: sale el símbolo equivocado en silencio, solo
  en una instancia USD.
- **Fail-closed:** lo veo correcto. Sin base no se puede iniciar sesión, y caer a MXN en una
  instancia USD sería justo el fallo silencioso que el ADR quiere evitar. Coste: no hay
  `app/global-error.tsx`, así que con la base caída `/login` y el 404 dan la página 500 genérica
  de Next. `/api/salud` y las demás rutas no pasan por el layout y no se ven afectadas.

### 6 · Rendimiento y caché
- Con `noStore()` en el layout raíz, **todas** las páginas quedan dinámicas (`ƒ`), incluido
  `/_not-found`. El build pasa (`npm run build` rc=0, solo los avisos de lint que ya había). Ojo:
  lo corrí con Postgres levantado, así que no comprobé el build sin base. El razonamiento del
  autor (que `noStore` evita prerenderizar) es correcto, pero la CI es la que lo demostrará.
- El coste es una consulta de una fila por cada render del layout. No hay páginas
  `force-static`, `revalidate` ni `generateStaticParams` que se rompan.

### 7 · Pruebas (corridas por mí)
- `npm run typecheck` → limpio.
- `npm test` → **322 archivos, 4305 pruebas, todas en verde**.
- `npm run build` → rc=0.
- e2e dirigidas (`moneda-instancia`, `bootstrap`, `aislamiento`) → **3 archivos, 43 en verde
  y 1 omitida** (la omisión ya estaba en `aislamiento:212`).
- e2e completa → **85 archivos: 83 en verde, 1 omitido, 1 en rojo. Pruebas: 1177 en verde,
  21 omitidas, 1 en rojo.** La que falla es `grants-rol-app.e2e` (`ECONNREFUSED :55471`): usa
  `docker run`, y esta máquina no tiene Docker. Es un fallo conocido del entorno y lo corre la CI.
- **Mutantes** (todos restaurados; los archivos coinciden byte a byte con el estado anterior):

| # | Mutante | Build antes | Resultado |
|---|---|---|---|
| M1 | Quitar `create trigger trg_tenants_moneda_inmutable` | no hacía falta: el SQL lo aplica el arnés desde disco y no entra en `.next` | **MUERE**: 2 e2e en rojo |
| M2 | Anular el rechazo de `moneda` en `PATCH /api/config` | sí | **MUERE**: 3 e2e en rojo |
| M3 | Aceptar `usd` (`toUpperCase`) en `monedaPedida` | sí | **MUERE**: 1 e2e y 2 unitarias en rojo |
| M4 | Anular `exigirMonedaDeLaInstancia` en contratos | — (solo unitarias) | **SOBREVIVE** a 1358 unitarias: hallazgo 4 |

  Después hice el build final (`BUILD_ID 5_RWVHHBq23j193gBlje-`). Postgres está detenido y el
  árbol limpio (`git status` sin cambios, aparte de los `desktop.ini` sin versionar).

### 8 · Invariantes
- `aislamiento.e2e.test.ts` y `servidor-e2e.ts`: sin cambios en el diff.
- Ningún `desktop.ini` añadido por esta rama.
- No hay marcadores de conflicto (`git grep "^<<<<<<< "`).
- `node scripts/recuentos.mjs` cuadra con CLAUDE.md: 123 migraciones, 66 tablas, ADR 0048,
  112 notas, 1609 enlaces, 3 rotos y 0 huérfanas.

## Lo que debe decidir el dueño

1. **`MX$` en las pantallas en inglés.** Recomiendo **sí, pero aparte**. Hoy `formatMonto(n)` sin
   idioma pinta `$` también en inglés, y para un lector en inglés `$` es el dólar. Es el mismo
   riesgo que el ADR quiere evitar, solo que al revés. Hoy solo es ambiguo, no está mal: el
   importe es correcto y la moneda es MXN. Conviene que sea una tarea propia que pase el idioma
   en las pantallas traducidas, no que se cuele en este cambio ROJO.
2. **Recibos de CFE en una instancia USD.** Recomiendo **apagar el módulo de energía/CFE en las
   instancias USD**, o etiquetar sus importes como MXN de forma explícita. Pintar un recibo en
   pesos con `US$` sería un error de un factor de ~20 a la vista. Hoy no aplica a ninguna
   instancia.
3. **Corregir la moneda de una instancia ya creada solo con una corrección de datos.** Recomiendo
   **sí**, como dice el ADR: corrección en `docs/datos/` con rollback, conversión con un tipo de
   cambio decidido por una persona y el trigger apagado a propósito. Antes hay que decidir si
   esa corrección también reescribe la letra de los contratos ya firmados (ver hallazgo 1).
4. **Fail-closed.** Recomiendo **mantenerlo**, añadiendo un `app/global-error.tsx` mínimo para
   que la caída de la base no muestre la página genérica de Next.

Y además, por el hallazgo 1: **¿qué se hace con los contratos firmados en USD de una instancia
MXN, si existen?** Primero hay que medirlo en g500 y DEMO.

---

## Segunda pasada (2026-11-02, sobre e72a410d..92668a45)

Revisé `git diff e72a410d..HEAD`: los commits 33178ab6 (firmas), 9bba1659 (`globalThis` + `tenantActual`), d48f44eb (solo el bootstrap elige la moneda; `--moneda` exige `--bootstrap`) y 92668a45 (`global-error.tsx`). fa0664a5 es el informe de la primera pasada.

### Veredicto: VERDE

Las cuatro correcciones de la primera pasada están hechas y las comprobé por mi cuenta: comparaciones mecánicas contra el código real de 27047bfe, dos mutantes con un build por mutante y el error global visto en un navegador real. Quedan tres observaciones de severidad baja que no bloquean (al final).

### 1 · Firmas (`hashParaCotejar`, `lib/contrato-documento.ts:501-512`; `firmas-repo.ts:333-343`)
Probé contra el texto real de 27047bfe. Saqué el `contrato-documento.ts` de 27047bfe con `git archive` a un espejo y lo importé junto al nuevo. Fueron 3240 contratos: MXN, USD, PEN y `''`; renta de 0 a 999 999 999.99 y nula; depósito nulo, 0 o con decimales; con y sin fecha de firma; además de 3000 al azar.

- **La regla vieja regenera byte a byte lo de 27047bfe**, en todas las monedas.
- **En MXN, PEN y `''`, las dos reglas dan el mismo texto**, idéntico al viejo, en todos los casos.
- **Un contrato USD congelado con el texto de 27047bfe no queda invalidado.** `hashParaCotejar(datos, sha256(texto_27047bfe))` devuelve ese mismo hash en los 3240 casos. Hay 1090 contratos USD cuya letra cambia con la regla nueva, y aun así cotejan.
- **No abre huecos.** Probé 12 960 alteraciones: renta +1, depósito +10, otro nombre de arrendador, y cambiar la moneda USD↔MXN. Ninguna devuelve el hash guardado, ni cuando el congelado es de la regla vieja ni cuando es de la nueva. La regla vieja no puede «perdonar» un congelado nuevo en USD: su letra dice PESOS y la nueva DÓLARES, y la cifra lleva el código de moneda.
  - La única excepción son 8 casos sin renta y sin depósito, en los que cambiar la moneda no cambia el texto: la moneda no aparece en ningún sitio. Eso ya era así en 27047bfe, no lo introduce este cambio.
- Mutante MA (abajo): quitar el recurso a la regla vieja lo detecta la e2e.

### 2 · La moneda en `globalThis`, cacheada y fijada por `tenantActual`
- **¿Se mezcla entre bases o tenants en las e2e?** No. `vitest.e2e.config.ts` no desactiva el aislamiento por archivo, y cada archivo arranca y para su propio `next start` (`servidor-e2e.ts:31` y `:119`). Dentro de un mismo proceso solo hay una moneda por base, y la base impide que haya dos.
  - Lo que sí puede pasar dentro de un archivo es que la base se vacíe con `vaciarTenants` y la caché se quede con la moneda anterior hasta el siguiente alta. En producción no ocurre, porque nunca se vacía `tenants`.
- **¿La caché se queda vieja tras el bootstrap?** No. Sin organizaciones no se cachea (`moneda-instancia.ts:69-72`), y el alta la fija después del commit (`cuentas-controller.ts:106`). Lo confirma el mutante MB.
- **¿Hay rutas que formatean sin pasar por `tenantActual`?** Las rutas que formatean dinero en el servidor son siete (`grep` sobre `lib/server` y `app/api`). Todas piden la moneda explícitamente, y ahora también `reportes/rentabilidad` y la página de la propuesta.
  - Además `q()` pasa por `tenantActual`, que la fija, y `globalThis` la comparte entre las copias del módulo.
  - Un grafo de imports da 158 rutas que alcanzan `dinero.ts`; todas alcanzan también `tenant.ts` o `moneda-instancia.ts`. No es una prueba de ejecución, pero no encontré ningún camino sin cubrir.
  - El hueco que queda es teórico: la primera petición de un proceso recién arrancado, si es una ruta pública sin consultas que formatee dinero en el servidor. No encontré ninguna.
- **¿Es aceptable reiniciar tras una corrección de datos?** Sí. Es inmutable por diseño y corregirla ya exige apagar el trigger a propósito. Está documentado en `moneda-instancia.ts` y en el ADR. Conviene que la ficha de esa corrección en `docs/datos/` lleve el reinicio como paso obligatorio.

### 3 · Signup sin moneda
El rechazo está en el controlador (`registrarCuentaCtrl`) y llega antes de cualquier consulta. La prueba unitaria basta para esa lógica. Lo que no cubre es el cableado: si alguien pasara `eligeMoneda: true` en `app/api/signup/route.ts`, ninguna prueba lo vería. **Severidad baja**, y además está apagado por omisión (`AUTOREGISTRO`).

### 4 · `app/global-error.tsx`, verificado de verdad
Levanté un `next start -p 3399` del build actual con `DATABASE_URL` apuntando a `127.0.0.1:1`, es decir, sin base. Lo abrí en Chrome (chrome-devtools, contexto aislado):
- `/spaces-dooh/login/` → el árbol de accesibilidad muestra el título «El sistema no está disponible en este momento», el párrafo en español y el botón «Intentar de nuevo».
- `/spaces-dooh/ruta-que-no-existe/` → redirige a `/login/` y muestra la misma página propia.

Después cerré la pestaña y detuve el servidor; el puerto 3399 quedó libre.

### 5 · Mutantes, uno por build
La secuencia fue mutar → `npm run build` → e2e → restaurar → `npm run build`.

| # | Mutante | e2e | Resultado |
|---|---|---|---|
| MA | `hashParaCotejar` devuelve siempre la regla de hoy (`contrato-documento.ts:511`) | `moneda-instancia` | **MUERE**: «el hash vigente es el que se firmo, y ninguna firma queda invalidada» |
| MB | Caché vieja tras el bootstrap: cachear también sin organización y quitar el `recordar…` del alta | `bootstrap` | **MUERE**: «`US$` de verdad en el HTML del documento» |

Los archivos restaurados son idénticos byte a byte a la copia de antes de mutar (`cmp`). Build final: `BUILD_ID ynndxvUA7vZpjKCkwy64-`.

### 6 · El español MXN sigue idéntico
Repetí la comparación de la primera pasada con el código nuevo, ya con `globalThis`: **318 214 comparaciones, 0 diferencias** en español, en inglés y en la cantidad con letra.

### 7 · Cifras
- `npm run typecheck` → limpio.
- `npm test` → **324 archivos, 4325 pruebas, todas en verde**.
- `npm run build` → rc=0.
- e2e completa → **85 archivos: 83 en verde, 1 omitido, 1 en rojo. Pruebas: 1186 en verde, 21 omitidas, 1 en rojo.** La roja es `grants-rol-app` (`ECONNREFUSED`, necesita Docker y esta máquina no lo tiene; es el mismo fallo del entorno que en la primera pasada). `login-sin-base`, `moneda-instancia`, `bootstrap` y `aislamiento` pasan.
- `pruebas-provision.sh` → **40 escenarios, 143 comprobaciones, 0 fallos**, incluido «`--moneda` sin `--bootstrap` se para».
- `recuentos.mjs` cuadra con CLAUDE.md: 1610 enlaces, 112 notas, 123 migraciones, 159 endpoints.
- `aislamiento.e2e` y `servidor-e2e.ts` sin tocar. Ningún `desktop.ini` añadido. Ninguna migración editada.
- No usé `git stash`. Postgres está detenido y `git status` limpio, aparte de este informe y los `desktop.ini` sin versionar.

### Observaciones que quedan (baja, no bloquean)
1. **La pantalla del contrato muestra otra letra que la firmada.** `app/(app)/contrato/[id]/page.tsx:67` regenera el documento con la regla de hoy. Para un contrato USD congelado antes del ADR, la pantalla muestra «DÓLARES … USD» mientras el texto firmado (`documento_congelado`) dice «PESOS … M.N.». La firma no aparece alterada, que era lo grave. Esta pantalla ya regeneraba el documento con la fecha de hoy, así que no es nuevo en su forma.
2. **Nada prueba el cableado de `/api/signup`** (punto 3).
3. **El reinicio tras una corrección de datos** tiene que ir escrito como paso en la plantilla de `docs/datos/` que cambie una moneda (punto 2).
