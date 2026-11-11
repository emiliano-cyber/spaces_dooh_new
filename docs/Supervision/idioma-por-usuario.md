# Supervisión · IDIOMA-USUARIO, el idioma de la interfaz por persona

- **Rama:** `feat/idioma-por-usuario`, worktree `.claude/worktrees/idioma-por-usuario`.
  Commits b5b79257 (migración + repo), 4b6134f3 (precedencia, cookie, login/Google/código/logout),
  dd547287 (Mi cuenta y `GET/PUT /api/perfil/idioma`), af03b410 (e2e) y el merge 85d838fc de
  `integra/idiomas` (6fea374a).
- **Zona:** ROJA (R1 sesión: cookie atada al token y los tres sitios donde nace una sesión ·
  R2 RLS: `usuarios` fail-closed · R3 migración nueva).
- **Decisión del dueño que implementa (03/11):** «el idioma de lo demás (la interfaz) se debe poder
  configurar por usuario y navegador». Los papeles van en el idioma de la instancia (ADR 0049, otra
  rama).
- **Fecha:** 2026-11-03/04 · supervisor, sin corregir nada.
- **Árboles medidos:** (1) el de la rama, HEAD 85d838fc; (2) **el fusionado**: 85d838fc +
  `integra/idiomas` @ 67b736c4, en un worktree desechable del scratchpad con `npm ci` propio
  (commit local d3c1b9c2, sin rama, ya desregistrado). `integra/idiomas` siguió avanzando mientras
  medía (5b825aed al cerrar); `git merge-tree` contra 5b825aed sigue sin conflictos.

## Veredicto: ÁMBAR

Aterriza con deuda declarada. Lo de seguridad está bien hecho y lo comprobé por lectura y por
mutación: el token no se filtra, la cookie no da poder sobre nadie más que uno mismo, `middleware.ts`
y `lib/server/auth.ts` **no se tocaron**, la migración es la que debe ser y está en LF, `q`/`qConTenant`
con `tenant_id` explícito y ningún `qRaw` nuevo. Typecheck limpio y unitarias en verde en el árbol
fusionado salvo una roja que **no es de esta rama**.

Lo que lo deja en ámbar, por orden de importancia. Son cuatro; **la que importa es la 1**:

1. **Las e2e no las corrí** (orden del orquestador: procesos huérfanos en 3311 y 3312). Es zona
   ROJA y lo decisivo —que la RLS deje leer y escribir la columna con el rol `spaces_app`, que el
   login ponga la cookie, que el logout la borre, que otra empresa no toque la fila— **solo se ve
   contra Postgres real**. Lo único que hay es el log del autor (abajo), y sus 4 mutantes e2e
   **no dejaron salida en disco**.
2. **El rojo del TDD no está en el historial.** Las unitarias nuevas van en el mismo commit que su
   implementación (4b6134f3, dd547287) y la e2e llega **después** de la implementación (af03b410).
   Los cinco commits tienen hora 15:13:19–15:13:45: se escribieron juntos y se commitearon de golpe.
   Lo compensan las mutaciones que medí yo (5 de 5 muertas), pero el rojo no se ve.
3. **No miré nada en un navegador.** La tarjeta de «Mi cuenta», la recarga tras el login y lo que
   pasa al cerrar sesión los conozco por el HTML de las pruebas y por lectura, no por verlos.
4. **Dos fusiones pendientes chocan** (con L5 del italiano y con `feat/idioma-instancia`). Son
   resolubles y abajo está cómo, pero alguien tiene que hacerlas y medir otra vez.

## Lo que medí

### En el árbol de la rama (85d838fc)

```
cd apps/web && npm run typecheck
> web@0.1.0 typecheck
> tsc --noEmit
exit 0

cd apps/web && npm test        (1.ª corrida)
 Test Files  1 failed | 386 passed (387)
      Tests  1 failed | 7030 passed (7031)
 FAIL lib/i18n/pantallas-campanas-finanzas.test.ts > … ficha de la campana
 Error: Test timed out in 5000ms.

npx vitest run lib/i18n/pantallas-campanas-finanzas.test.ts      (sola)
 Test Files  1 passed (1)
      Tests  399 passed (399)

cd apps/web && npm test        (2.ª corrida, con otra carga en la máquina: 24 node.exe)
 Test Files  10 failed | 377 passed (387)
      Tests  19 failed | 7012 passed (7031)
 (10 «Test timed out in 5000ms» y 9 aserciones de texto en las mismas pantallas)

npx vitest run <los 10 archivos que fallaron>                     (solos)
 Test Files  10 passed (10)
      Tests  1323 passed (1323)
```

Las 19 rojas son **de carga**, no de código: todas en `lib/i18n/pantallas*.test.ts` y `textos/`,
todas verdes al correrlas solas. Ver B62 en `ABIERTOS.md`.

### En el árbol FUSIONADO (85d838fc + integra/idiomas 67b736c4)

```
cd apps/web && npm run typecheck
> tsc --noEmit
exit 0

cd apps/web && npm test
 Test Files  1 failed | 388 passed (389)
      Tests  1 failed | 7476 passed (7477)
 FAIL lib/i18n/textos/costura.test.ts > costura del italiano · … el mismo espanol en dos lotes
      lleva el mismo italiano
   «Guardar pantalla» → «Salva schermo» (spaceeyes) / «Salva impianto» (inventario)
   «Hasta» → «Al» (spaceeyes) / «Fino a» (arrendadores)
   «Siguiente» → «Successiva» (spaceeyes) / «Avanti» (inventario)
   «Pantalla suelta» → «Impianto singolo» (arrendadores) / «Impianto isolato» (energia)
```

**Esa roja NO es de esta rama:** la misma prueba, corrida en el worktree `integra-ingles` en
`integra/idiomas` @ 67b736c4 **sin esta rama**, da `1 failed | 15 passed (16)` con las mismas cuatro
divergencias. Es el choque L1 (Space Eyes) × L3 (inventario). Al cerrar este informe ya hay un
commit que dice arreglarlo, 90f36986 «fix(i18n): costura del italiano tras juntar L1 y L3»; **no lo
medí** (el worktree tenía cambios sin commitear de otro agente en esos mismos archivos).

```
node scripts/recuentos.mjs        (idéntico en la rama y en el fusionado)
  endpoints 160 · tablas 66 · migraciones 124 · ADR 48 (hasta 0048)
  notas 115 · enlaces 1641 · wikilinks rotos 3 (los tres ADR de siempre) · huérfanas 0

git grep -l "^<<<<<<< HEAD$"      → vacío
```

Cuadra con lo que afirman `CLAUDE.md:42` (1641/115), `CLAUDE.md:133` (160) y `:135` (124) y el MOC
(`vault/00-Indice/MOC-Proyecto.md:30` y `:32`).

### La migración, en disco

```
sha256 en disco            a3f1266a2715f89e…
sha256 sin CR              a3f1266a2715f89e…
git show HEAD:<ruta>       a3f1266a2715f89e…
grep -c $'\r'              0
git check-attr eol         eol: lf
git diff --name-status integra/idiomas HEAD -- db/   → A db/migrations/20261103_usuarios_idioma_preferido.sql
```

Solo se **añade** una migración; ninguna aplicada se edita y `db/schema.sql` no aparece.

### Archivos protegidos

```
git diff --stat integra/idiomas HEAD -- apps/web/middleware.ts apps/web/lib/server/auth.ts
   apps/web/lib/server/auth-*.ts apps/web/lib/test/aislamiento.e2e.test.ts
   apps/web/lib/test/servidor-e2e.ts db/schema.sql
→ (vacío)
```

`middleware.ts`, `lib/server/auth.ts`, `aislamiento.e2e.test.ts`, `servidor-e2e.ts` y
`db/schema.sql` **intactos**, como dice el autor.

### Mutaciones que medí yo (unitarias, árbol fusionado, revertidas con `git checkout`)

Contra `idioma-cuenta.test.ts`, `servidor-cuenta.test.ts`, `idioma-controller.test.ts` e
`IdiomaCuenta.test.ts` (43 pruebas):

| Mutante | Resultado |
|---|---|
| M1 · `idiomaDeCookieCuenta` deja de comparar la huella (otra sesión hereda el idioma) | **muere** · 3 rojas |
| M2 · la cuenta se resuelve sin filtrar por idiomas encendidos | **muere** · 3 rojas |
| M3 · `preferenciaDeIdioma` acepta un idioma apagado | **muere** · 2 rojas |
| M4 · la cookie deja de ser `httpOnly` | **muere** · 1 roja |
| M5 · la cookie del navegador pasa por delante de la cuenta | **muere** · 2 rojas |

(El primer intento de M5 no aplicó por CRLF en el checkout y dio 43/43 en verde; repetido con una
expresión que admite `\r`, aplicó y murió. Lo apunto porque es exactamente la trampa de la regla 4.)

**No muté contra e2e** (sin puerto). El autor dejó el guion en
`scratchpad/idioma-usuario/mutar-e2e.py` —cuatro mutantes: el login sin cookie, guardar con `qRaw`,
el PUT sin cookie y el logout sin borrarla, con `npm run build` por mutante, que es la regla—, pero
**su salida no está en ningún archivo**: no puedo confirmar «los cuatro muertos».

### El HTML de las pantallas, antes y después (español)

Volqué con `I18N_VOLCAR` las 16 suites `lib/i18n/pantallas*.test.ts`, **una por una y cada una en su
carpeta** (en paralelo, varias suites escriben `NN-es.html` con el mismo nombre y el diff sale con
falsos positivos — me pasó en el primer intento), en `integra/idiomas` @ 67b736c4 (antes) y en el
fusionado (después):

```
538 estados volcados en cada lado
diff -rq antes despues
  pantallas-admin/configuracion_mi_cuenta_empresa_y_contrasena_temporal.html  differ
  pantallas-admin/configuracion_solo_mi_cuenta_con_contrasena_actual.html     differ
```

En español cambian **solo dos estados, los dos de `/configuracion`**, por la tarjeta nueva («Idioma» +
el selector), que las pruebas pintan con `puedeElegir: true` (`pantallas-admin.test.ts:235`). El
autor dice «10 estados de `/configuracion`»: mi medición cubre **solo el español**; el inglés y el
italiano no los volqué (no hay `I18N_VOLCAR_EN` salvo en una suite). Las dos corridas de inventario y
operaciones que fallaron por tiempo en la primera pasada se repitieron y dieron 247/247 y 123/123.

## Hallazgos, por severidad

### Seguridad de la cookie `spaces_idioma_cuenta` — sin hallazgo, con su porqué

- **¿Filtra el token?** No. El valor es `<idioma>.<huella>` y la huella es
  `sha256("idioma:" + token)` truncado a 32 hex = 128 bits
  (`apps/web/lib/server/huella-sesion.ts:29`). El token son 32 bytes aleatorios
  (`apps/web/lib/server/auth.ts:108`); volver del resumen al token es inviable. El prefijo
  `idioma:` separa el dominio: la huella no coincide con ningún otro hash del sistema.
- **¿Se puede falsificar?** Sí, pero solo para uno mismo. Para forzar el idioma de **otra** persona
  hay que conocer la huella de **su** token, o sea su token. El efecto máximo es el idioma de la
  pantalla: guardar pasa por `PUT` con sesión, CSRF del middleware (`/api/perfil/` no está en la
  lista de exentos, `middleware.ts:119-131`) y la lista de encendidos. La cookie del navegador
  `spaces_idioma` ya permitía lo mismo antes de esta rama.
- **¿Comparación segura?** Es `!==` de cadenas (`apps/web/lib/i18n/idiomas.ts:308`), **no** en tiempo
  constante. No es explotable: compara la cookie que manda el propio cliente con la huella de **su
  propia** sesión, así que una fuga por tiempos solo le dice algo que ya tiene. No hace falta
  `timingSafeEqual`; lo dejo escrito para que nadie lo «arregle» creyendo que era un agujero.
- **Atributos:** `httpOnly: true`, `sameSite: 'lax'`, `secure: cookieSecure()`, `path: '/'`
  (`apps/web/lib/server/idioma-cuenta.ts:31-34`), los mismos que `cookieSesion`
  (`apps/web/lib/server/auth.ts:256-265`). Vida de un año (`idiomas.ts:232`) contra 30 días de la
  sesión: sobrevive a la sesión, pero muerta, porque la huella ya no casa.
- **Logout:** la borra (`apps/web/app/api/auth/logout/route.ts:29`), igual que borra la de sesión
  en `:24`.
- **Otra sesión en el mismo navegador:** se ignora (`apps/web/lib/i18n/servidor.ts:94-100`), lo
  prueba `servidor-cuenta.test.ts:96-100` y lo muerde el mutante M1.

### Lo que se tocó en la autenticación — sin cambio de comportamiento de sesión

Diff completo de `app/api/auth/**` (no hay cambios en `lib/server/auth*.ts`):

- **login** (`app/api/auth/login/route.ts`): la consulta que ya existía lee además
  `idioma_preferido` (`select solo_google, idioma_preferido … and tenant_id = $2`, con `qConTenant`);
  añade `idioma` a la respuesta JSON y una cookie más en `:146`. No cambia el orden de las comprobaciones
  (bloqueos, `solo_google`, contraseña) ni la creación de sesión ni la del CSRF.
- **código de recuperación** (`app/api/auth/codigo/route.ts`): ídem, en la consulta que ya existía; cookie en `:114`.
- **Google** (`app/api/auth/google/callback/route.ts`): `abrirSesion` recibe el `tenantId` y hace
  **una consulta más** (`idiomaPreferidoAlEntrar`, `qConTenant` con `tenant_id = $2`) **después** de
  `crearSesion` (`:87-88`); cookie en `:93`. Si esa consulta lanzara, quedaría una fila de sesión
  creada sin cookie que la use y el usuario vería un error: no es un agujero (la sesión no sale del
  servidor), es un caso de error nuevo. Menor.
- **logout**: solo la línea que borra la cookie.

### `GET/PUT /api/perfil/idioma` — correcto

`usuarioActual()` → 401 sin sesión (`app/api/perfil/idioma/route.ts:22-23` y `:38-39`); el id sale de
`u.id`, nunca del cuerpo (la e2e lo intenta con `id` y `usuarioId` ajenos en el cuerpo); el repo usa
`q1`/`q` con `tenantOblig()` y `and tenant_id = $n` (`apps/web/lib/server/usuarios-repo.ts:395-423`);
ningún `qRaw` nuevo (el único `+…qRaw` del diff es un comentario); solo idiomas encendidos, 400 si no
(`idioma-controller.ts`, mutante M3). Usa `usuarioActual()` y no `exigir()` **a propósito**, como
`PATCH /api/perfil`, para que quien está encerrado con contraseña temporal pueda usarlo.

### La migración — correcta

`20261103_usuarios_idioma_preferido.sql`: `begin`/`commit`; `add column if not exists idioma_preferido text`
sin default y nullable; el CHECK `idioma_preferido is null or in ('es','en','it')` dentro de un
`do $$ … if not exists (pg_constraint …)`: idempotente. No toca la RLS ni las funciones `auth_*`.
**No la ejecuté contra un Postgres** (sin puerto/base libre a mi cargo); la e2e del autor la aplica
al recrear el esquema.

### Precedencia — correcta, y cómo choca con L5

`resolverIdioma` = cuenta > cookie > Accept-Language > es, todo filtrado por `permitidos`
(`idiomas.ts:204-228`); sin preferencia es la regla de antes (`idioma-cuenta.test.ts:56-64` lo
recorre combinación por combinación; mutantes M2 y M5).

**Choque con `feat/italiano-l5-armazon`** (medido con `git merge-tree`):

- `idiomas.ts` **se fusiona solo** y el resultado es coherente: L5 cambia el valor por omisión de
  `permitidos` a `idiomasPorOmision()` (italiano solo si está encendido) y esta rama añade la línea
  de la cuenta, que **ya** pasa `permitidos` explícito.
- **Efecto semántico tras fusionar:** login, código y Google llaman `normalizarIdioma(x)` **sin**
  lista para poner la cookie (`login/route.ts:146`, `codigo/route.ts:114`, `google/callback/route.ts:88`).
  Con L5, una persona con preferencia `it` en un servidor con el italiano apagado **no recibe
  cookie** (antes la recibía y `resolverIdioma` la ignoraba). El resultado en pantalla es el mismo y
  la base no se toca; al encender el italiano la recupera en su siguiente inicio de sesión. Inocuo,
  pero conviene que quien fusione lo sepa.
- **Conflictos reales**, los dos aditivos:
  `apps/web/lib/i18n/diccionario.ts` (las 5 claves `idioma.cuenta.*` en italiano contra las claves
  `marca`/`login`/`nav` de L5: **quedarse con las dos**) y
  `apps/web/lib/i18n/cobertura-italiano.test.ts` (la rama fija `traducidas` a 11; L5 lo calcula como
  `traducidasAntes - …` y ordena la lista: **quedarse con la de L5**, que no depende del número de
  claves, y volver a correr la prueba).

**Choque con `feat/idioma-instancia`**: `CLAUDE.md`, `vault/00-Indice/MOC-Proyecto.md`,
`vault/04-Datos/esquema.md` y `vault/07-Agentes/diario/2026-11-03.md`. Las dos ramas dicen
«124 migraciones» y cada una añade una distinta: juntas son **125**. Se resuelve **corriendo
`node scripts/recuentos.mjs`**, no eligiendo un lado.

### Hallazgos menores

- **Al cerrar sesión, la pantalla de entrar puede quedarse en el idioma de la cuenta hasta recargar**
  (deducido, **no visto**). `Topbar.tsx:27-31` cierra con `router.push('/login')`, y el propio autor
  escribe que `router.push` no vuelve a pintar el layout raíz, que es quien lleva el idioma
  (`app/(app)/login/page.tsx:162-166`). La e2e lo prueba con una petición nueva, que no es lo que hace
  el navegador. En un equipo compartido, la siguiente persona vería la pantalla de entrar en el idioma
  de la anterior hasta recargar; nada más.
- **`pages/_error.tsx` sigue con cookie > navegador**: lo declara la nota de la bóveda. Una página de
  error puede salir en otro idioma que el resto. Menor.
- **No hay entrada en `docs/Registro_Cambios.md`** (`git diff --stat` vacío). Con un solo idioma
  encendido no se ve nada; en cuanto se encienda un segundo, se ve.
- **Los textos italianos de la tarjeta no están validados** (`diccionario.ts:508`, lo dice el propio
  comentario).
- **Las notas de la bóveda van en el mismo commit que su código** en b5b79257, 4b6134f3 y dd547287; no
  añaden citas `archivo:línea` nuevas, así que no hay citas que derivar.

## Preguntas para el dueño

**D16** — en `ABIERTOS.md`, literal. Advertencias abiertas por esta supervisión: **B61** (e2e sin medir, la que importa), **B62** (unitarias rojas por carga), **B63** (choques de fusión), **B64** (logout y la pantalla de entrar), **B65** (bitácora e italiano sin validar), **B66** (rojo del TDD fuera del historial).

## Qué NO pude verificar, y por qué

- **Ninguna e2e**, ni las 14 de `idioma-por-usuario.e2e.test.ts` ni que `aislamiento.e2e.test.ts`
  pase: los puertos 3311 y 3312 tienen procesos huérfanos (orden del orquestador). Lo único que hay es
  el log del autor, `scratchpad/idioma-usuario/e2e3.log` (15:44 del 03/11, posterior al merge):
  `Test Files 1 failed | 84 passed | 1 skipped (86) · Tests 1 failed | 1200 passed | 21 skipped (1222)`;
  la roja es `grants-rol-app.e2e.test.ts` con `ECONNREFUSED 127.0.0.1:55471` (su Postgres
  desechable no levantó: entorno). Es la palabra del autor con su log, no una medición mía.
- **Los 4 mutantes e2e del autor**: el guion existe, la salida no.
- **La migración contra Postgres real** (14 ni 16).
- **Nada en un navegador**: ni la tarjeta, ni la recarga tras el login, ni el cierre de sesión.
- **El HTML en inglés e italiano** antes/después: solo medí el español.
- **El arreglo 90f36986 de la costura del italiano** en `integra/idiomas`.
- **Que hoy ninguna instancia tenga dos idiomas encendidos** (lo afirma el autor; no miro servidores).
