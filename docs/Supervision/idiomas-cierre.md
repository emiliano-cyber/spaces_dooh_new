# Supervisión · cierre de idiomas (04/11)

- **Rama:** `feat/idiomas-cierre`, worktree `.claude/worktrees/idiomas-cierre`. 7 commits
  `40858d7a..94f0da4b` sobre `integra/idiomas` @ `cb116dde`.
- **Árbol fusionado = este árbol:** `integra/idiomas` sigue en `cb116dde` y es ancestro de HEAD
  (`git merge-base --is-ancestor` → sí). La fusión es un avance rápido; no hay otro árbol que medir.
- **Zona:** ROJA (R1: `app/api/auth/forgot/route.ts`, aprobada por el dueño el 04/11).
- **Tres cambios autorizados por el dueño el 04/11:** (1) el correo de restablecer contraseña en
  el idioma de la instancia; (2) «provvigione» en el italiano; (3) D13 contestada (los contratos
  en/it son plantillas de ejemplo).
- **Fecha:** 2026-11-04 · supervisor, sin corregir nada. Lo único escrito: este archivo y
  `ABIERTOS.md`.

## Veredicto: ÁMBAR

Aterriza. Lo que es ROJO está bien hecho y lo medí: la ruta de autenticación solo cambia la lectura
del idioma y el paso a la plantilla; el correo español es byte a byte el de `cb116dde` (hash
recalculado por mí desde el código de `cb116dde`); fail-closed y escapes muerden por mutación;
ningún archivo prohibido tocado; español e inglés, 0 bytes en el volcado HTML; typecheck limpio,
8457 unitarias y 1220 e2e en verde (las dos rojas, ajenas a la rama, explicadas abajo).

**La deuda, y es pequeña:** B76, dos citas `archivo:línea` de la bóveda que la rama dejó una línea
corridas y el recuento de enlaces de `CLAUDE.md` (1656, medido 1657). La cierra el ejecutor en esta
misma rama antes de fusionar; son tres números. Aparte, una pregunta para el dueño (D17) que no
bloquea la fusión.

## 1 · Lo que medí

### Typecheck y unitarias (en este worktree, HEAD 94f0da4b)

```
> web@0.1.0 typecheck
> tsc --noEmit
(sin salida: limpio)

 Test Files  404 passed (404)
      Tests  8457 passed | 1 skipped (8458)
```

### Build y e2e

```
npm run build → exit 0, BUILD_ID ppAHl3mIgJ3onMGaY6WQw (hecho por mí, antes de las e2e)
PUERTO_E2E=3371 PUERTO_DOBLE_GOOGLE=3372 DATABASE_URL_TEST=…/spaces_cierre_e2e npm run test:e2e
 ❯ lib/test/grants-rol-app.e2e.test.ts (7 tests | 1 failed)
     × si NO existe ninguno de los dos, ABORTA en vez de no conceder nada
       Error: connect ECONNREFUSED 127.0.0.1:55471      ← levanta un Postgres con `docker run`
 ❯ lib/test/reaplicacion.e2e.test.ts (4 tests)
   FAIL … Error: Hook timed out in 60000ms  (afterAll, reaplicacion.e2e.test.ts:148: drop database)
 Test Files  2 failed | 84 passed | 1 skipped (87)
      Tests  1 failed | 1220 passed | 21 skipped (1242)
   Duration  699.21s

Repetidas aparte reaplicacion.e2e + password-reset.e2e, mismos puertos y base:
 Test Files  2 passed (2)
      Tests  12 passed (12)
Puertos 3371/3372 libres al terminar (netstat sin LISTEN).
```

- `grants-rol-app`: la prueba usa `docker` (`grants-rol-app.e2e.test.ts:119-126`) y esta máquina no
  tiene Docker. Es la misma roja que declara el autor; la corre el CI.
- `reaplicacion`: sus 4 pruebas pasaron; lo que venció fue el `afterAll` que borra la base temporal,
  en la corrida completa. Sola pasa. **El autor no la reporta**; la rama no toca migraciones ni ese
  archivo. La anoto como inestabilidad del arnés bajo carga, no como defecto de la rama.
- `password-reset.e2e` pasa, pero corre **sin correo configurado**: no ejerce la línea nueva (ver
  «no verificado»).

### Archivos que no se podían tocar

```
git diff --stat cb116dde..HEAD -- apps/web/middleware.ts apps/web/lib/server/auth.ts db/ \
  apps/web/lib/test/aislamiento.e2e.test.ts apps/web/lib/test/servidor-e2e.ts \
  apps/web/lib/server/password-reset-repo.ts apps/web/lib/server/rate-limit.ts
(vacío)
```

Ni migraciones, ni `db/schema.sql`, ni `aislamiento.e2e.test.ts`, ni `servidor-e2e.ts`, ni el
repo de tokens, ni el limitador.

### Cambio 1 · el correo de restablecer (ROJO)

**La ruta solo cambia la lectura del idioma y el paso a la plantilla.** `git diff cb116dde..HEAD --
apps/web/app/api/auth/forgot/route.ts`: +1 import (`asuntoCorreoReset`), +1 import
(`idiomaDeLaInstancia`), y dentro del `try` del envío `const idioma = await idiomaDeLaInstancia()`
(`route.ts:59`) y `subject`/`html` con `idioma` (`route.ts:62-63`). Sin cambios: el apagado por
`NEXT_PUBLIC_RECUPERAR_PASSWORD`, los dos `limitar(...)`, `crearReset`, el `mensaje` genérico, el
`enlaceDev` solo fuera de producción y la respuesta final. Ninguna línea de sesión.

**El correo `es` es byte a byte el de `cb116dde`.** Lo medí yo con el código de `cb116dde`, no con
la prueba: extraje `escaparHtml` + `htmlCorreoReset` de `git show cb116dde:apps/web/lib/server/email.ts`
y los ejecuté con node:

```
Ana<b> x?t=1&u=2 : c4fc89ba71a8aaf114cefb478dd67b4639ab689928c565cfc0b1a0e45a0cf13a
Ana tok-1        : b1d89817477e263238e21edd81975560fb6128cee119cd31f213bc27a1507b30
```

Coinciden con `HASH_ES.reset` de `correos-idioma.test.ts` y con `HASH_ES` de
`correo-reset-idioma.test.ts`, que pasan en HEAD. El asunto de `cb116dde`
(`route.ts:56` entonces: `'Restablece tu contraseña · Space OS'`) es el literal que devuelve
`asuntoCorreoReset('es')` (`email.ts:111`). El literal de la plantilla vive en un template string:
JavaScript normaliza CRLF a LF dentro de él, así que el hash no depende del checkout.

**Escapes en en/it.** `email.ts:123` escapa cada texto ya interpolado (el nombre una sola vez) y
`email.ts:130` escapa el enlace del `href`. En español el `href` sigue sin escapar, como estaba
(token hexadecimal y base `APP_URL`).

**Fail-closed.** `idiomaDeLaInstancia` lanza si la base no contesta (`idioma-instancia.ts`, cabecera
y función) y la llamada está DENTRO del `try` interior: el correo no sale y la respuesta es la
genérica. Sin organizaciones devuelve `es` y no cachea, que es el idioma en el que nacería.

**El rojo del TDD existe y mide.** Repuse en el worktree `route.ts`, `email.ts` y `cuenta.ts` de
`40858d7a` (el commit rojo), corrí las dos pruebas y restauré (`git status` limpio después):

```
× en: en ingles, sin una frase espanola
  AssertionError: expected 'Restablece tu contraseña · Space OS' to be 'Reset your password · Space OS'
× it: en italiano, sin ingles ni espanol
× si leer el idioma falla, el correo NO sale en otro idioma y la respuesta no cambia
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
× (11 de correos-idioma.test.ts) TypeError: asuntoCorreoReset is not a function
Failed Tests 14
```

Las tres de la ruta fallan por aserción (rojo fuerte). Las de `correos-idioma.test.ts` fallan por
`TypeError` de una función que no existía (rojo débil, aceptable: lo fuerte está en la otra).

**Mutantes (unitarias; cada uno revertido con `git checkout HEAD --`, `git status` limpio al final):**

| Mutante | Resultado |
|---|---|
| M1 · fail-open: `idiomaDeLaInstancia().catch(() => 'es')` en `route.ts` | **MUERE**: `si leer el idioma falla…` en rojo (1 failed / 7) |
| M2 · sin `escaparHtml` en el texto de la plantilla en/it (`email.ts:123`, solo esa línea) | **MUERE**: `expected … to contain 'Ana &lt;b&gt;'` (2 failed / 22) |
| M3 · `href: link` sin escapar en en/it | **MUERE**: 2 failed / 14 |
| M4 · una letra del literal español (`contraseña`→`contrasena` en el `<h2>`) | **MUERE**: 4 failed / 22, incluido el hash byte a byte |

**¿Leer el idioma solo cuando el correo existe abre una diferencia de tiempo medible?** No una
nueva. Por lectura del código:

- `idiomaDeLaInstancia` cachea en `globalThis` tras la primera lectura con éxito: cuesta **una**
  consulta por proceso, no una por petición. En régimen, la rama `existe` no hace nada más que antes.
- La diferencia de tiempo **ya existía en `cb116dde` y es mucho mayor**: con el correo registrado
  la ruta hace `insert into password_resets` (`password-reset-repo.ts:76-80`) y espera la llamada
  HTTP a Resend (`email.ts:52`, `await enviarEmail` en la ruta); sin correo, solo un `select`
  (`password-reset-repo.ts:65-69`). La primera consulta del idioma se suma a una diferencia que ya
  era de una ida y vuelta de red. **No la medí con un cronómetro** (ver «no verificado»). La dejo
  registrada como **B75**, preexistente y no de esta rama.

### Cambio 2 · «provvigione» en el italiano

`git diff cb116dde..HEAD` sobre `clientes.ts`, `propuestas.ts`, `reportes.ts`: **25 valores**
cambiados (10 + 11 + 4), todos dentro de `IT_*` (los hunks empiezan en las líneas 577–643, 1171–1564
y 575–681; `IT_CLIENTES` abre en `clientes.ts:519`, `IT_PROPUESTAS` en `propuestas.ts:1075`,
`IT_REPORTES` en `reportes.ts:498`). Ningún hunk en `ES_*` ni `EN_*`. `cuenta.ts`: solo líneas
añadidas (5 claves `cuenta.correo.reset.*` por idioma), ningún valor existente cambiado.
`diccionario.ts` y `errores-servidor.ts` no aparecen en el diff.

Rojo reproducido: con `clientes/propuestas/reportes.ts` de `b4dfeab5`,
`provvigioni.test.ts` → `Tests 26 failed | 4 passed (30)` (25 claves + «ninguna clave italiana dice
commissione»). En HEAD, `30 passed`. La prueba se protege contra el vacío
(`claves.length > 20`).

### Cambio 3 · D13

`git diff cb116dde..HEAD -- apps/web/lib/contrato-documento.ts`, filtrando las líneas que empiezan
por `//`: **vacío**. Solo comentarios. Los hashes del texto legal en
`contrato-documento-idioma.test.ts` no cambiaron (su diff es un comentario) y pasan. La huella de
`arrendadores.test.ts` normaliza CRLF (`leer`, `arrendadores.test.ts:23-24`) y la medí sobre el
canónico de git: `git show HEAD:apps/web/lib/contrato-documento.ts | sha256sum` →
`94b4ce17…`, el valor nuevo de la prueba. No es verde-solo-en-mi-árbol.

### Volcado HTML es/en contra `cb116dde`

`I18N_VOLCAR_TODO` en HEAD y en el mismo árbol con los 7 fuentes no-prueba de `cb116dde`
repuestos (`route.ts`, `email.ts`, `cuenta.ts`, `clientes.ts`, `propuestas.ts`, `reportes.ts`,
`contrato-documento.ts`; el resto del árbol es idéntico entre los dos commits), y restaurado:

```
4667 .html antes · 4667 después · 103 difieren (+ _italiano.txt, que solo cambia de orden)
103 de 103 idénticos tras sustituir commissione→provvigione en el «antes»; 0 sin explicar
101 están en _italiano.txt; los 2 restantes son la propuesta imprimible de una instancia
ITALIANA abierta por una persona en español (el papel va en italiano: ADR 0049)
```

Español e inglés: **0 bytes**.

### Bóveda

- Nota en el mismo commit que el código: `bb924830` lleva `autenticacion-y-sesion.md`,
  `idiomas-es-en.md` y el ADR; `4018ef06` lleva `italiano-olas.md`; `3316ba09` el ADR, el runbook,
  `ABIERTOS.md` y cuatro notas.
- `node scripts/recuentos.mjs` en este árbol: 160 endpoints · 66 tablas · 125 migraciones · ADR
  hasta 0049 · 116 notas · **1657 enlaces** · 3 rotos (los tres ADR de siempre) · 0 huérfanas.
- `git grep -n "^<<<<<<< HEAD$"`: vacío.
- Ningún valor real nuevo en el diff (busqué IP y URL en las líneas añadidas: solo `127.0.0.1`,
  `10.71.0.*` y `https://x/` de las pruebas).

## 2 · Hallazgos

1. **(menor, bóveda) Dos citas `archivo:línea` derivadas por esta rama.** `forgot/route.ts` creció
   una línea arriba (el import). `vault/01-Arquitectura/entorno-y-despliegue.md:2250` cita
   `forgot/route.ts:50` para `APP_URL` (ahora `:51`; en `cb116dde` era `:50`) y `:2255` cita
   `:18` para `NEXT_PUBLIC_RECUPERAR_PASSWORD` (ahora `:19`). No dan error: mandan una línea arriba.
2. **(menor, bóveda) `CLAUDE.md:42` dice 1656 enlaces; medido 1657.** La rama añade un wikilink neto
   (dos `[[03-Frontend/idiomas-es-en]]`/`[[italiano-olas]]` añadidos, uno quitado) y no toca
   `CLAUDE.md`. Es el vicio que el propio `CLAUDE.md` denuncia.
3. **(preexistente, no de la rama) B75: `/api/auth/forgot` ya distinguía por tiempo** si el correo
   existe (insert + Resend contra un select). Ver arriba. Mitigan: el límite de 5 por IP cada 15
   min y que la recuperación está apagada en producción. No bloquea.
4. **(decisión) D17:** «cada cliente irá armando su contrato» choca con dónde vive la plantilla:
   en el código común a todas las instancias. Tarjeta en `ABIERTOS.md`.

## 3 · Qué NO verifiqué, y por qué

- **El camino real del correo con la base de verdad.** Las e2e corren sin correo configurado
  (`emailHabilitado()` exige `RESEND_API_KEY` y `EMAIL_FROM`, `email.ts:28-30`; ni `.env` ni
  `.env.local` del worktree traen `RESEND_API_KEY` y `servidor-e2e.ts` no lo pone), así que `idiomaDeLaInstancia()` dentro de la ruta solo lo ejercen
  las unitarias, con la función simulada. Que la consulta real funcione en esa ruta se apoya en
  que la misma función ya la usan el contrato y los otros correos.
- **La diferencia de tiempo, con cronómetro.** La conclusión sale de leer el código (caché por
  proceso y una llamada HTTP a Resend que ya existía). No cronometré peticiones.
- **No miré nada en un navegador.** El cambio visible es texto italiano; lo cubre el volcado HTML,
  que compara lo que rinden las pruebas, no la pantalla. Con la máquina justa de memoria no levanté
  servidor.
- **Mutantes contra e2e:** ninguno; los cuatro fueron contra unitarias.
