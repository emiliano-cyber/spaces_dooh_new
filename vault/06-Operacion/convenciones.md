---
tipo: operacion
estado: verificado
actualizado: 2026-08-31
tags: [convenciones, estilo, pruebas]
archivos:
  - apps/web/lib/server/errores.ts
  - apps/web/lib/test/README.md
  - docs/DEPENDENCIAS.md
  - docs/Registro_Cambios.md
---

# Convenciones

## Idioma

**Todo en español**: nombres de archivo, funciones, variables, columnas,
comentarios y mensajes de error. `crearSesion`, `exigir`, `arrendadores-repo`,
`fecha_inicio`. Los únicos anglicismos son los del framework (`page.tsx`,
`layout.tsx`, `route.ts`) y los términos de dominio ya asentados (DOOH, spot).

## Capas

```
route.ts  →  *-controller.ts  →  *-repo.ts  →  db.ts
guard        zod + reglas        SQL           tenant + pool
```

| Regla | Por qué |
|---|---|
| Los controllers **lanzan** `AppError` | El route solo hace `respuestaError(e)` en el catch |
| La validación de entrada va con `validar(schema, body)` | Traduce zod a español y humaniza el campo |
| El SQL vive en el repo, nunca en el route | Y siempre parametrizado |
| Toda operación por `id` lleva `and tenant_id = $n` | Segunda capa sobre la RLS |

## Comentarios: se explica el **porqué**, no el qué

Es la convención más fuerte del repo y hay que respetarla. Los comentarios
documentan **la decisión y el fallo que la motivó**, con evidencia:

```ts
// OJO con la RLS: este archivo importa `qRaw` bajo el nombre `q`, y `qRaw`
// NO fija `app.tenant_id`. `sesiones` está exenta, pero `usuarios` es
// fail-closed + FORCE, así que un subconsulta … devuelve CERO filas y el
// update queda en un no-op silencioso …
```
— `lib/server/cambios.ts:115-123`

> [!tip] Si arreglas un fallo sutil, deja escrito por qué era sutil
> Media docena de comentarios de este repo son lo único que impide que el mismo
> error vuelva. No los borres al refactorizar.

## Pruebas

| Tipo | Comando | Config | Cuándo |
|---|---|---|---|
| Unitarias | `npm test` | `vitest.config.ts` | Siempre; no necesitan Docker |
| Integración | `npm run test:e2e` | `vitest.e2e.config.ts` | Auth, tenant, dinero, migraciones |

> [!warning] No copies un recuento de aquí — mídelo, y estas cifras caducan igual
> Esta tabla decía **«~729 unitarias / ~55 de integración»** desde el 07/08.
> Medido el **28/08** en `feat/servidor-padre-instancias`: **1005 unitarias en 94
> archivos** (`cd apps/web && npm test`, 9,4 s) y **29 archivos e2e**. El día
> anterior eran **997 en 92**: los dos archivos nuevos son
> `lib/pista-archivada.test.ts` y `lib/tipografia.test.ts`. Casi el doble que en
> agosto, y nadie tocó la cifra en veinte días.
>
> **Cuenta también en qué rama estás**: la raíz del repo y este worktree son
> ramas distintas con recuentos distintos. Y para el número de **casos** e2e hay
> que correrlas, que exige `npm run build` antes (ver [[entorno-y-despliegue]]);
> aquí van los **archivos**, que sí se cuentan sin arrancar nada.

Las e2e:
- corren **en serie** (`fileParallelism: false`) porque comparten base;
- levantan un **Next real** en el puerto 3311 y hablan por HTTP, para pasar por
  el middleware y los guards en su orden real (`lib/test/servidor-e2e.ts`);
- usan dos roles: `spaces` (superusuario, siembra) y `spaces_app`
  (`nosuperuser nobypassrls`, para todo lo que deba respetar RLS);
- se niegan a apuntar a una base cuyo nombre no acabe en `_e2e` o `_test`.

> [!danger] 2026-08-31 · el arnés e2e era dependiente de plataforma, y nadie lo sabía
> **Las e2e nunca habían corrido en Linux** hasta la primera corrida de
> `release.yml`. Ese día **11 de 295 salieron rojas**, y ni uno solo de los
> mensajes hablaba de la causa.
>
> `servidor-e2e.ts` lanzaba `next start` **sin `detached`**, así que en POSIX el
> hijo heredaba el grupo de procesos del runner. `pararServidor()` mata el grupo
> con `process.kill(-pid)`, que **exige que el hijo sea líder de su grupo**: sin
> `detached` se va en ESRCH, el `catch` mata solo a `npx` y el servidor
> **sobrevive con el puerto 3311 tomado**. El archivo siguiente lanza su
> `next start`, muere por puerto ocupado, y su bucle de espera **recibe un 200
> del servidor viejo y sigue como si nada**.
>
> Consecuencia: los 29 archivos hablaban con el servidor del primero. Las
> variables que cada archivo pone antes del spawn —`ORG_NOMBRE`,
> `BOOTSTRAP_TOKEN`, `FLOTA_TOKEN`— no llegaban nunca, y el limitador de
> intentos (`lib/server/rate-limit.ts:13`, un `Map` en memoria) acumulaba los
> cubos de todos, así que los archivos tardíos recibían **429 donde esperaban
> 401**.
>
> **En Windows no pasa** —allí se mata con `taskkill /F /T`— y por eso pasó
> siete semanas sin verse. La decisión de plataforma salió a
> `lib/test/proceso-e2e.ts`, que **se prueba con `npm test`, sin Docker**: es lo
> único que hace que un defecto de Linux se pueda cazar desde una máquina
> Windows.
>
> **La lección, y es la de siempre en este repo**: el verde local no medía lo
> que decía medir. Medía Windows.

> [!danger] Las unitarias no ven los fallos de RLS
> Simulan la base. Los dos peores fallos de aislamiento del proyecto pasaron las
> unitarias sin despeinarse. **Todo lo que toque tenant o sesión necesita e2e.**

Las semillas usan fechas **relativas a hoy** (`enDias()`), nunca literales.

## Nombres

| Cosa | Patrón | Ejemplo |
|---|---|---|
| Repo | `<dominio>-repo.ts` | `campanas-repo.ts` |
| Controller | `<dominio>-controller.ts` | `perfil-controller.ts` |
| Prueba unitaria | `<archivo>.test.ts` o `<archivo>.<caso>.test.ts` | `sitios-repo.modalidades-tenant.test.ts` |
| Prueba e2e | `<tema>.e2e.test.ts` | `aislamiento.e2e.test.ts` |
| Migración | `YYYYMMDD_descripcion.sql` | `20260806_identidades_externas.sql` |
| Nota de despliegue | `DESPLIEGUE_<TEMA>.txt` en la raíz | `DESPLIEGUE_GOOGLE.txt` |
| ADR | `docs/adr/NNNN-titulo-kebab.md` | `0012-acceso-con-cuenta-de-google.md` |

## Commits

Convencionales, **en español, sin acentos** (por compatibilidad del terminal):

```
feat(auth): entrar con Google — las dos rutas del ADR 0012
fix(seguridad): el desbloqueo leia `usuarios` sin contexto de tenant
docs(cambios): por que el tablero tardaba, y por que no era la base
test(integracion): el flujo de Google de punta a punta
```

El cuerpo del commit se usa **de verdad**: explica el porqué, lo que apareció al
hacerlo, y qué se verificó.

## La bitácora es parte del trabajo

`docs/Registro_Cambios.md` — entrada más reciente arriba, agrupada por fecha.
Está escrita **para quien no programa**: explica el impacto y el porqué en
lenguaje llano, no el diff.

> [!tip] Patrón habitual
> Un commit de código va seguido de un `docs(cambios):` que lo registra. Si tu
> cambio se nota desde la aplicación, tiene entrada en la bitácora.

## Dependencias

`docs/DEPENDENCIAS.md`: nunca tocar `package.json` sin regenerar el lockfile;
nada de rangos flotantes en lo crítico. Añadir una dependencia se justifica por
escrito. Ver [[stack-y-dependencias]].

## Documentación

| Documento | Para qué |
|---|---|
| ADR (`docs/adr/`) | Una decisión de diseño, con alternativas descartadas |
| Runbook (`DESPLIEGUE_*.txt`) | Pasos de un despliegue, marcados cuando se ejecutan |
| Bitácora | Qué cambió, para el negocio |
| Esta bóveda | Cómo funciona el sistema, para quien va a tocarlo |

## Validar la bóveda contra el código

La bóveda **caduca**. Se escribió el 07/08 y en cinco horas quedaron obsoletas
cuatro afirmaciones. Estos cuatro chequeos son mecánicos y detectan la mayoría de
la deriva. Correrlos al retomar el proyecto tras unos días, y siempre después de
un lote grande de commits.

### 1 · Los recuentos siguen cuadrando

```powershell
"endpoints: $((Get-ChildItem apps\web\app\api -Recurse -Filter route.ts).Count)"
"migraciones: $((Get-ChildItem db\migrations\*.sql).Count)"
"tablas: $(Select-String db\schema.sql,db\migrations\*.sql -Pattern '^create table' | Measure-Object).Count"
```
Contrastar con [[MOC-Proyecto]], [[api-endpoints]], [[esquema]] y
[[migraciones]].

### 2 · Todo wikilink resuelve y nada queda huérfano

Extraer los enlaces internos (dobles corchetes) de cada nota y comprobar que
existe un `.md` con ese `BaseName` — o con esa ruta relativa, para los que van
con carpeta, tipo `02-Backend/_indice`. Al 10/08: **395 enlaces, 0 rotos, 0
huérfanas**. Al 17/08, con el diario recuperado: **606 enlaces, 0 rotos, 0
huérfanas** sobre 48 notas. Al 27/08: **726 enlaces, 0 rotos, 0 huérfanas**
sobre 56 notas — tras arreglar los tres de la tercera trampa, abajo. Al
**28/08**: **753 enlaces, 0 rotos, 0 huérfanas** sobre **57** notas.

> [!tip] Quinta trampa: los enlaces a un ancla de la propia nota no son enlaces a notas
> `manual-tecnico` usa 19 enlaces del tipo dobles-corchetes-almohadilla-título
> para su índice interno. Un extractor que corte por la almohadilla se queda con
> la cadena vacía y los declara **rotos**: son 19 falsos positivos y aparecen
> todos en la misma nota. Descuéntalos antes de comparar con la cifra de arriba
> —753 son enlaces a notas; 772, con las anclas dentro—. Y la huérfana que
> aparece cada vez es **la entrada del diario del día**: se cierra enlazándola
> desde [[MOC-Proyecto]], no dejándola suelta.

> [!warning] Dos `_indice.md` distintos rompen los verificadores ingenuos
> `02-Backend/_indice.md` y `03-Frontend/_indice.md` comparten `BaseName`. Un
> script que indexe por nombre y no por ruta colapsa los dos en uno y declara
> **huérfana** a la que pierda el sorteo. Pasó el 17/08 y el falso positivo
> parecía real. Resuelve por ruta cuando el enlace la traiga.

> [!tip] Ojo con los ejemplos de sintaxis
> Un extractor ingenuo también captura los dobles corchetes escritos como
> ejemplo dentro de una nota, aunque estén entre backticks, y los reporta como
> rotos. Por eso esta sección los describe en palabras en vez de escribirlos.

> [!warning] Tercera trampa: un wikilink NO puede salir de la bóveda
> Encontrada el **27/08**, y eran tres a la vez. `entorno-y-despliegue`,
> `vision-general` y `verificacion-de-produccion` enlazaban al ADR 0021 con
> dobles corchetes y ruta `../../docs/adr/...`. El archivo **existe**, pero
> Obsidian solo resuelve wikilinks dentro de la bóveda: los tres quedaban muertos
> al hacer clic. **Fuera de `vault/` se cita con enlace Markdown normal**, que es
> lo que ya hacían el MOC y el resto de la tabla de `entorno-y-despliegue`.
> Un verificador que solo busque el archivo en disco **no los ve**: hay que
> comprobar que el destino esté dentro de `vault/`.

> [!warning] Cuarta trampa: no todo recuento de endpoints cuenta lo mismo
> Al 27/08 convivían tres cifras —88, 89 y 90— y ninguna era mentira: **90** son
> los `route.ts` de hoy, **89** era la cifra buena antes de que naciera
> `/api/version` (26/08), y los **«72 endpoints censados»** de los commits del
> 26/08 son el subconjunto que **recibe cuerpo**, del censo de validación de
> entrada. Antes de corregir una cifra, averigua **qué** contaba.

### 3 · Toda ruta citada existe

Tanto las de `archivos:` en el frontmatter como las de los cuerpos entre
backticks. **Dos avisos** si automatizas esto:

- las rutas se escriben relativas al **repo** (`apps/web/lib/…`) o a
  **`apps/web`** (`lib/server/…`); hay que probar las dos bases;
- `Test-Path` trata `[token]` y `[id]` como comodines — usa **`-LiteralPath`** o
  darán falsos negativos en todas las rutas dinámicas de Next.

> [!warning] Segunda trampa de la misma familia: los paréntesis de los *route groups*
> Un verificador que recorte la puntuación final de la cadena se come el `)` de
> `apps/web/app/(app)/(shell)/` (frontmatter de [[modulos-internos]]) y la marca como
> rota. **Es un falso positivo**: el directorio existe. Trata `(`, `)`, `[` y `]` como
> **literales**, no como sintaxis ni como puntuación a limpiar.
> Descubierto en la auditoría del 17/08, que también tropezó con el caso contrario:
> exigir la ruta completa marca como rotas todas las migraciones y los ADR, porque la
> bóveda los cita por nombre a secas (`20260720_hard1_usuarios_rls.sql`, sin
> `db/migrations/`). Hace falta resolver también por sufijo y por nombre de archivo.

### 4 · Los números de línea no han derivado

Es el chequeo que más deriva encuentra y el único que no es binario. Por cada
cita `archivo.ts:N`, leer la línea N y comprobar que dice lo que la nota afirma.

> [!warning] Un archivo que crece invalida todas sus citas de golpe
> `lib/server/auth.ts` pasó de 188 a 230 líneas al añadir `passwordAleatoria()`,
> y con eso **ocho** citas de cinco notas distintas apuntaron a la línea
> equivocada. Ninguna daba error: simplemente mandaban al sitio erróneo.

### Y lo que ningún script detecta

Que una nota describa correctamente algo que **ya se decidió de otra forma**. El
ADR 0012 pasó de «Google no da de alta» a lo contrario en una tarde, y las rutas,
los enlaces y los recuentos seguían perfectos. Para eso: leer
`git log --since` y `docs/Registro_Cambios.md` desde la fecha del último
`actualizado:`.

## Relacionadas
[[zonas-de-riesgo]] · [[AGENTES]] · [[migraciones]] ·
[[stack-y-dependencias]] · [[MOC-Proyecto]]
