# Supervisión · ajustes de verificación: B70, B71 y la vigencia (B84) — 04/11 noche

- **Rama:** `feat/verificacion-ajustes`, worktree `.claude/worktrees/verificacion-ajustes`.
  7 commits `1bca9944..aed31579` sobre `verificacion` @ `a91580bb`.
- **Árbol fusionado = este árbol:** `verificacion` sigue en `a91580bb` y es ancestro de HEAD
  (`git merge-base --is-ancestor verificacion HEAD` → sí). Fusionar es un avance rápido.
- **Zona:** AMARILLA-ROJA. La vigencia toca la aceptación de una propuesta por la liga pública
  (compromiso con un cliente) y la fecha que se le promete por correo. Sin migración, sin sesión,
  sin `tenant`.
- **Autorización:** el dueño el 05/11 (B70 y B71 cambian el español a propósito).
- **Medido:** 2026-11-04 entre 22:20 y 22:45 hora de México (04:20–04:45 UTC del 05/11): **la
  ventana en que el día de México y el de UTC son distintos**, que es justo donde vive el defecto.
- **Supervisor, sin corregir nada.** Lo único escrito: este archivo y `ABIERTOS.md`.

## Veredicto: ÁMBAR

Aterriza. El arreglo de la vigencia es correcto, el rojo existe y mide el defecto por aserción, la
e2e muerde en la ventana mala, ningún archivo prohibido se tocó, y el español solo cambia donde se
autorizó (30 estados de `pantallas-admin`, todos por los dos `aria-label`/`title` nuevos; 0 valores
del diccionario cambiados).

**Pasa de tres ámbares; el que de verdad importa es uno:** la premisa del arreglo —«en g500 la base
va en UTC y la aplicación en `TZ=America/Mexico_City`»— **no está medida en el servidor**, y en el
propio código hay dos comentarios que afirman lo contrario (§3, H1). El arreglo es seguro si la
aplicación tiene `TZ` puesta, se diga lo que se diga de la base; **solo empeora las cosas en una
instancia sin `TZ`**. Lo cierra una persona con dos comandos en g500 (B88). Lo demás es deuda menor
o anterior a la rama.

## 1 · Lo que medí

### Typecheck (HEAD `aed31579`)

```
$ cd apps/web && npx tsc --noEmit; echo "tsc exit=$?"
tsc exit=0
```

### Unitarias — tres corridas completas, sin cambiar nada entre ellas

```
1.ª  Test Files  1 failed | 413 passed (414)
     Tests  1 failed | 8672 passed | 1 skipped (8674)
     FAIL ../../scripts/semilla-catalogo-demo.test.ts > … el calendario se mueve con el ancla
          y la demo es coherente CUALQUIER día hasta 2028
     Error: Test timed out in 5000ms.
2.ª  idéntica: el mismo archivo, la misma prueba, «Test timed out in 5000ms».
3.ª  (con el volcado I18N_VOLCAR_TODO)  Test Files  414 passed (414)
                                         Tests  8673 passed | 1 skipped (8674)
```

La prueba que cae, sola: `29 passed (29)`, y ella misma `2197ms`. La rama no toca `scripts/`
(`git diff --stat a91580bb..HEAD -- scripts/` vacío). Es B62 (rojo por carga), con otro archivo:
anotado ahí. La base `a91580bb`, medida en otro árbol: `411 passed (411)`, `8649 passed | 1 skipped`.
**+24 pruebas, +3 archivos**, que son las tres pruebas nuevas.

### Build y e2e (base `spaces_ajustes_e2e`, puertos 3391/3392, build antes)

```
$ npm run build            → BUILD_ID 0xy9uwYmYk_BauX64SM_g (22:38–22:40)
$ date -u                  → Thu Nov  5 04:40:06 UTC 2026   (en México: 04/11 22:40)
$ … vitest.e2e.config.ts lib/test/propuesta-vigencia.e2e.test.ts
      Tests  11 passed (11)
$ … aislamiento, codigo-aprobacion, codigo-promocional, propuesta-sin-cliente,
    propuestas-gestion, propuestas-tablero, vendedor-en-propuesta
 Test Files  7 passed (7)
      Tests  120 passed | 1 skipped (121)
```

`node -e` en esta máquina: `America/Mexico_City`, así que el Next de pruebas corrió con el día de
México (04/11) y la base de pruebas con el de UTC (05/11) — la combinación de g500 según el autor.
No corrí la suite e2e entera: la tarea pedía la de vigencia y lo que la rodea.

**Mutante contra la e2e, con build** (la regla de `CLAUDE.md`: mutar → build → e2e → restaurar →
build): devolver `aceptarPropuestaPublica` a `vigente_hasta < current_date` →

```
     × la liga dice «vencida» y aceptar da 409 sin tocar la propuesta
     × el ÚLTIMO día todavía vale: con vigencia de hoy se acepta
     × sin vigencia (lo enviado antes del 29/10) se sigue aceptando como siempre
      Tests  3 failed | 8 passed (11)
```

Restaurado con `git checkout`, árbol limpio, **reconstruido** (`BUILD_ID YqM7AvSub4RtXz24cKsJw`) y
vuelta a correr: `11 passed (11)`. **Ojo:** la e2e solo muerde entre las 18:00 y las 24:00 de
México; el resto del día los dos días coinciden y este mutante sobreviviría. La red de todas las
horas es la unitaria, con el reloj fijo a las 19:00 (la de abajo).

Ningún servidor quedó escuchando: `netstat -ano | grep -E ":(3391|3392|3393) "` vacío al cerrar.

### El rojo del TDD, repetido por mí en un árbol aparte en cada commit de prueba

| Commit | Prueba | Resultado | ¿Por aserción? |
|---|---|---|---|
| `22e30e5f` | `propuesta-vigencia-hora.test.ts` | `4 failed \| 2 passed (6)` | 3 sí; 1 débil (`TypeError: hoyDeVigencia is not a function`, la función no existía). **La que importa, sí:** `expected Error: Esta propuesta venció el 2026-11-0… to not be an instance of PropuestaVencidaError` — el 409 con el botón a la vista |
| `1bca9944` | `librerias.test.ts` | `9 failed (9)` | sí, las 9 (el commit trae un `librerias.ts` vacío a propósito) |
| `de578024` | `cerrar-accesible.test.ts` | `7 failed \| 2 passed (9)` | sí; la guardia lista `administracion/page.tsx:1103`, `:1128`, `Modal.tsx:53`, `Sheet.tsx:36` |

### Mutantes propios contra unitarias — 14, mueren 12

Aplicados con un guion que sustituye texto, corre las pruebas, **restaura con `git checkout`** y
comprueba `git diff` vacío. Árbol limpio al final (`git status` sin cambios fuera de `desktop.ini`).

| # | Mutante | Pruebas | Resultado |
|---|---|---|---|
| M1 | `hoyDeVigencia` → `ahora.toISOString().slice(0,10)` (día UTC) | vigencia | **muere** (4 rojas) |
| M2 | aceptar: `vigente_hasta < $2::date` → `< current_date` | vigencia | **muere** (2) |
| M3 | enviar: `$4::date + $3::int` → `current_date + $3::int` | vigencia | **muere** (2) |
| M4 | correo de «Enviar»: `vigenciaDesde(hoyDeVigencia(), …)` → día UTC de Node | `lib/server` entero (1442) | **SOBREVIVE** |
| M5 | «Enviar»: el `$3` de `vencida` → día UTC de Node | `lib/server` entero (1442) | **SOBREVIVE** |
| M6 | `propuestaVencida`: `<` → `<=` (el último día deja de valer) | `lib` | **muere** (2) |
| M7 | aceptar: el parámetro `hoyDeVigencia()` → día UTC de Node | vigencia | **muere** (1) |
| M8 | `Sheet`: quitar `aria-label` | B70+B71 | **muere** (3) |
| M9 | Administración: quitar `aria-label`/`title` de la X de plazos | B70+B71 | **muere** (1) |
| M10 | `SelectorUbicacion`: quitar `locale` | B70+B71 | **muere** (1) |
| M11 | `closeButtonAriaLabel` → `'Close toast'` | B70+B71 | **muere** (1) |
| M12 | quitar `Marker.Title` del mapa de claves | B70+B71 | **muere** (4) |
| M13 | layout: quitar `{...propsAvisos(idioma)}` del `Toaster` | B70+B71 | **muere** (1) |
| M14 | `Modal`: `title` fijo en «Cerrar» | B70+B71 | **muere** (2) |

**M4 y M5 sobreviven** (H3): la mitad «Enviar» de la regla única no tiene prueba de comportamiento.
Solo la vigila la guardia de texto contra `current_date`, que no ve otra forma de leer el día mal.

### El español, repetido contra `a91580bb`

Volcado `I18N_VOLCAR_TODO` de toda la suite en los dos árboles y `diff -rq`:

```
33 líneas: 31 «Files … differ» + 2 «Only in v-head»
  30  lib_i18n_pantallas-admin.test.ts
   1  _italiano.txt            (+2 líneas: los dos estados italianos de cerrar-accesible)
  Only in v-head: components_demo_ui_cerrar-accesible.test.ts
  Only in v-head: lib_i18n_librerias.test.ts
```

Los 30 de `pantallas-admin`, quitando con `sed` **solo** los `aria-label="(Quitar|Remove|Rimuovi)…"
title="…"` nuevos: **30/30 idénticos** a la base. Lo que aparece, contado:

```
 5 «Quitar IVA 16%» · 5 «Quitar IVA 8%» · 5 «Quitar plazo 30 días» · 5 «Quitar plazo 60 días»
20 «Remove VAT 16%» · 20 «Remove VAT 8%» · 20 «Remove 30-day term» · 20 «Remove 60-day term»
 5 «Rimuovi IVA 16%» · 5 «Rimuovi IVA 8%» · 5 «Rimuovi termine di 30 giorni» · 5 «… 60 giorni»
```

Coincide con lo que midió el autor (30 estados, 5 es / 20 en / 5 it).

**Diccionario** (cargado con `jiti` desde los dos árboles):

```
es 5633 -> 5657 cambiados 0 quitadas 0 nuevas 24
en 5633 -> 5657 cambiados 0 quitadas 0 nuevas 24
it 5633 -> 5657 cambiados 0 quitadas 0 nuevas 24
en avisos: Close notification | Notifications | es: Cerrar aviso | Notificaciones | it: Chiudi notifica
```

«Close toast» → «Close notification» no es un valor del diccionario que cambie: es el valor por
omisión de sonner (`node_modules/sonner/dist/index.mjs:442`, `closeButtonAriaLabel = 'Close toast'`)
que ahora se sustituye. Sonner 2.0.7 admite las dos props (`index.d.ts:88` y `:117`; el
`closeButtonAriaLabel` de `toastOptions` llega al botón en `index.mjs:1164` → `:780`).

### Lo intacto

```
$ git diff --name-only a91580bb..HEAD | grep -E "middleware|auth|db/|migrations|aislamiento|servidor-e2e|db-e2e|schema.sql|next.config|package"
(nada)
$ git diff a91580bb..HEAD | grep qRaw
+  qRaw1: vi.fn(async () => ({ tenant: 'T1' })),      ← solo el simulacro de la prueba
$ git grep -l "^<<<<<<< HEAD$"                         ← nada
```

Ningún valor real en el diff (barrido de IPs, dominios `.com`/`space-os.io`, forma de RFC, `token`,
`sk_`/`pk_`: vacío). Los comentarios nombran «g500», que es el nombre de la instancia, no un dominio.

### Recuentos (`node scripts/recuentos.mjs`)

| | `a91580bb` | HEAD |
|---|---|---|
| endpoints / tablas / migraciones | 160 / 66 / 125 | 160 / 66 / 125 |
| notas / enlaces | 117 / 1671 | 117 / **1674** |
| rotos / huérfanas | 3 (ADR) / 0 | 3 (ADR) / 0 |

El diario dice 1674 (bien). **`CLAUDE.md:42` sigue diciendo 1671** (H6).

## 2 · La vigencia, revisada punto por punto

- **Una sola regla.** `hoyDeVigencia()` (`lib/propuesta-vigencia.ts:50-52`) es la única fuente de
  «hoy». La usan: la ficha y la liga a través de `armarPropuesta` (`propuestas-repo.ts:278`,
  `propuestaVencida` con su valor por omisión, `propuesta-vigencia.ts:55`); aceptar
  (`propuestas-repo.ts:953-957`); la vigencia al enviar (`:1924-1933`); y el correo de «Enviar»
  (`propuestas-envio.ts:59-65` y `:85-87`). Las tres pantallas leen el `vencida` del servidor, no
  calculan nada: `app/(app)/p/[id]/page.tsx:176`, `app/(app)/propuesta/[id]/page.tsx:81`,
  `app/(app)/(shell)/propuestas/[id]/page.tsx:411-416`. `grep` de `current_date` en
  `propuestas-repo.ts` y `propuestas-envio.ts`: solo en comentarios.
- **El día lo decide el servidor.** `aceptarPropuestaPublica` recibe del cliente solo el nombre y la
  IP; el día sale de `new Date()` en el proceso de Next (`propuestas-repo.ts:957`). Un reloj
  manipulado en el navegador no entra por ningún lado. M2 y M7 lo confirman por mutación.
- **Atómica y segura — igual que antes, ni mejor ni peor.** La comprobación de vencida
  (`:985`) va **fuera** de la transacción y antes del `for no key update` (`:1020`): ya era así el
  29/10 con `current_date`. Ventanas que quedan, las dos estrechas y anteriores a la rama: un
  vendedor que acorta la fecha en el mismo instante en que el cliente acepta, y una aceptación que
  pasa la comprobación a las 23:59:59 y hace commit a las 00:00. Ninguna deja aceptar una propuesta
  vencida de verdad.
- **`q` con `tenant_id`.** Las dos consultas tocadas que llevan `id` llevan `and tenant_id = $2`
  (`propuestas-envio.ts:63`) o van por `qConTenant` con el tenant del token
  (`propuestas-repo.ts:951-957`, ruta pública, igual que antes). Sin `qRaw` nuevo. **Anterior a la
  rama:** el `update` de `cambiarEstatusPropuesta` sigue con `where id=$1` sin `tenant_id`
  (`propuestas-repo.ts:1928`); la rama solo cambió el `case` de encima. Queda dicho, no es de aquí.
- **«Enviar» lee el reloj dos veces** (el correo en `propuestas-envio.ts:87` y el `update` en
  `propuestas-repo.ts:1933`). Si la medianoche cae entre las dos, el correo y la base difieren un
  día. Milisegundos; lo apunto para que no se diga que la regla es «una lectura».
- **`TZ` ausente o rara (lo que preguntaba el orquestador).** `hoyDeVigencia()` es
  `fechaLocalISO(new Date())`: getters locales del proceso, o sea la `TZ` del contenedor. **No hay
  ningún aviso si falta**: `grep process.env.TZ` en `lib/` y `app/` solo da pruebas. La `TZ` viene de
  `infra/env/app.env.example:186` (desde `09ac35dd`, 26/08), que `instalar-hijo.sh:85` y
  `provision-instancia.sh:86` copian como plantilla y `update.sh:2637` pasa con `--env-file`. Una
  instancia sin esa línea corre en UTC **en silencio**: sus propuestas vencen a las 18:00 de México
  del último día. Antes de la rama pasaba lo mismo en la ficha; lo que cambia es que ahora también
  aceptar y el correo siguen a la aplicación, así que en una instancia **sin `TZ` y con la base en
  hora de México** la rama empeora: antes aceptar contaba bien y ahora no. Por eso B88.
- **La e2e cambiada sigue probando lo que debe.** Sustituye `current_date ± n` por
  `vigenciaDesde(hoyDeVigencia(), n)` (`propuesta-vigencia.e2e.test.ts:69-71`) y la columna `dias`
  por `vigente_hasta - $2::date`. El servidor de pruebas hereda la `TZ` del proceso de prueba, así
  que los dos hablan del mismo día. Muerde (mutante de arriba) **solo** en la ventana de 18 a 24 h.

## 3 · Hallazgos, por severidad

**H1 · 🟠 La premisa del arreglo no está medida, y el código afirma lo contrario en dos sitios.**
El autor dice «en g500 la base va en `Etc/UTC`». Lo que hay escrito es la **zona del sistema**
(`docs/evidencias/30-mudar-g500-a-droplet-limpio-20261104.md:140` y `:145`), no el `show timezone`
de Postgres; y la `TZ` de la aplicación en `app.env` está descrita, no impresa. En cambio,
`lib/server/finanzas-repo.ts:319-320` dice «El día lo pone la BASE (zona America/Mexico_City en
producción): el reloj del servidor de la app está en UTC», y `lib/server/notificaciones-repo.ts:64-66`
dice que la base de producción «está en America/Mexico_City». **Uno de los dos lados es falso**, y
el arreglo de la vigencia apuesta por uno. Lo cierra B88 (dos comandos en g500).

**H2 · 🟠 B84 «resto»: hay dinero con el mismo defecto de dos relojes, hoy, y no lo introdujo la
rama.** Si la base de g500 está en UTC (H1):
- **Cupones.** El panel de Códigos decide «vigente» con el día del navegador
  (`components/demo/codigos/GestionCodigos.tsx:73-77`, usado en `:210`, `:218`, `:307`) y el canje
  con el `current_date` de la base (`lib/server/codigos-repo.ts:368`, regla en
  `lib/codigo-promocional.ts:209-215`, extremos inclusivos). Desde las 18:00: el **último día** el
  panel ofrece «Asignar a propuesta» y el canje dice «venció»; y la **víspera** del inicio el panel
  dice «próximo» y el canje **ya lo acepta** — un descuento cobrable seis horas antes de lo que
  configuró el dueño.
- **Facturas.** `fecha_emision = current_date` (`finanzas-repo.ts:219`): la emitida el día 30 a las
  19:00 queda con fecha del 1 del mes siguiente, en el periodo equivocado. Y el primer vencimiento
  de un cobro único, `current_date + plazo` (`:266`).
- **Abonos.** Sin fecha explícita, el abono se registra con el día de la base (`:321-323`).
- **Tablero de finanzas** y resumen de propuestas cortan el periodo con `hoyDeLaBase()`
  (`finanzas-repo.ts:503-504`, `finanzas-controller.ts:198` y `:205`,
  `propuestas-resumen-controller.ts:41`).
Leído, no ejecutado contra una base en UTC. Las otras ~20 (campañas activas, OT, arrendadores,
Space Eyes) son de estado y no de dinero. → D20.

**H3 · 🟡 La mitad «Enviar» de la regla única no tiene prueba que muerda.** M4 y M5 sobreviven a
las 1442 unitarias de `lib/server`: si alguien escribe el día del correo con `toISOString()`, el
correo vuelve a prometer un día distinto del que guarda la base y nada se pone rojo. Se cierra con
un caso en `propuesta-vigencia-hora.test.ts` que llame a `enviarPropuestaCtrl` con el reloj a las
19:00 y compare la fecha del correo con la del `update`. Lo cierra el ejecutor; no bloquea. → B89.

**H4 · 🟡 `TZ` ausente = UTC sin aviso.** Detalle en §2. Va en B88.

**H5 · 🔵 `npm test` rojo 2 de 3 veces por tiempo**, en `scripts/semilla-catalogo-demo.test.ts`
(2,2 s sola, más de 5 s con la suite). Ajeno a la rama. Anotado en B62.

**H6 · 🔵 `CLAUDE.md:42` dice 1671 enlaces y son 1674.** La rama añade tres (el diario) y no tocó
`CLAUDE.md`. Un número; lo cierra el ejecutor en esta rama. → B90.

**H7 · 🔵 Citas de la bóveda corridas — anteriores a la rama.** P. ej.
`vault/05-Flujos/flujo-propuesta-a-campana.md:149` cita `cambiarEstatusPropuesta()` en
`propuestas-repo.ts:1432`; ya en `a91580bb` esa línea era otra cosa (`/** El estatus y el periodo de
una propuesta … */`) y la función está hoy en `:1790`. La rama corre dos líneas más todo lo de
después de `:979`. No es deuda de esta rama, pero ya son muchas: va con el próximo barrido de citas.

**Observaciones sin severidad.** La guardia de B71 solo ve botones cuyo único hijo es un componente
que se cierra solo (`<X />`); un `<svg>` a mano o un icono con texto oculto se le escaparían. La de
B70 fija la lista de los tres mapas a mano; hoy son todos (`grep "\.Map("`: `SelectorUbicacion.tsx:53`,
`MapView.tsx:174`, `SitiosMap.tsx:71`), y un cuarto no la pondría en rojo.

## 4 · Preguntas para el dueño

**D20**, en `ABIERTOS.md` §A, literal. Resumen: ¿se unifica el «hoy» de cupones, facturas y cobros
con el día de México, como ya se hizo con las propuestas?

## 5 · Qué NO pude verificar, y por qué

- **La zona horaria real de la base de g500 y la `TZ` de su aplicación.** No hay `ssh` para mí, por
  regla. Es lo que decide si H1 y H2 son reales en producción. Comandos en B88 para una persona.
- **Los textos de MapLibre y sonner en un navegador.** No los miré: el intento de levantar un
  `next start` en el 3393 para pedir la página fue denegado por el sistema de permisos, y no insistí.
  Lo que sí está medido: las props llegan (`librerias.test.ts`, 9 pruebas, y 7 mutantes que mueren),
  el HTML del `Toaster` rendido en servidor lleva `aria-label="Notificaciones alt+T"`, y el inglés
  del mapa sale del paquete instalado. **Cómo se ven** los botones del mapa con su `title` en
  español, no lo he visto.
- **La suite e2e completa.** Corrí 8 archivos (131 pruebas, 1 omitida). El resto no lo toca la rama
  por el diff, pero no lo medí.
- **Un mutante contra la e2e fuera de la ventana de 18 a 24 h.** Por construcción sobreviviría
  (§1); no lo corrí.
