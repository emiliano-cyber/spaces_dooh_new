# Supervisión · ADR 0049, el idioma de los documentos es de la instancia

- **Rama:** `feat/idioma-instancia`, worktree `.claude/worktrees/idioma-instancia`
- **Zona:** ROJA (R3 migración · firmas y su hash · aprovisionamiento · alta · correos)
- Supervisor, sin corregir nada. Lo escrito aquí es lo único que tocó.

---

## Segunda pasada · 2026-11-04 · HEAD 873ac6dc (7 commits sobre 9d404205)

### Veredicto: ÁMBAR (aterriza; la deuda queda declarada abajo)

B58 queda cerrada: medí yo las e2e y salen 1206 en verde. El único rojo es el entorno (grants-rol-app no tiene Postgres efímero en esta máquina). En una instancia es+es, los correos son byte a byte los de antes (6 hashes recalculados por mí) y el HTML existente no cambia (volcado completo, diff vacío). B59 y B60 quedan cerradas.

Sigue en ámbar por dos cosas. La primera: no miré la liga, el portal ni el comprobante en un navegador. La segunda, que es la que importa: hoy una instancia en italiano manda el contrato en italiano y la propuesta y los correos en inglés (B67). Eso cae dentro de D13 y es una decisión de alta, no un defecto que impida fusionar.

### Lo que medí

```
npm test (con I18N_VOLCAR_TODO)   -> Test Files 390 passed (390) · Tests 7124 passed (7124)
bash infra/scripts/pruebas-provision.sh -> 47 escenarios · 164 comprobaciones · 0 fallos
provision-instancia.sh --ayuda    -> termina en la línea «SPACES_REGION … OBLIGATORIA» (B60 cerrada)
npm run build                     -> BUILD_ID SVonTAZJZofIvInrFjfV2
PUERTO_E2E=3341 PUERTO_DOBLE_GOOGLE=3342 (el 3312 estaba ocupado)
DATABASE_URL_TEST(_APP) -> spaces_instancia_e2e · npm run test:e2e
 Test Files  1 failed | 84 passed | 1 skipped (86)
      Tests  1 failed | 1206 passed | 21 skipped (1228)   Duration 359.41s
 FAIL grants-rol-app.e2e > si NO existe ninguno de los dos, ABORTA…
   Error: connect ECONNREFUSED 127.0.0.1:55471   (Postgres efimero que esta maquina no levanta: entorno)
(el archivo omitido no aparece en la salida; space-eyes.e2e es el unico con skip condicional: no verificado que sea ese)
```

**Correos en español, byte a byte.** Saqué de 9d404205 `email.ts`, `propuesta-correo.ts` y
`recordatorios-contratos.ts`, y de f434e6f1 `correo-recordatorios.ts`. Comprobé además que
f434e6f1 mueve la plantilla de `app/api/recordatorios/route.ts` sin cambiar ni un carácter (está
en el diff). Ejecutados con Node 24 sobre los datos de `correos-idioma.test.ts`, los 6 hashes
coinciden con los fijados:

```
invitacion          54ca1167…66c4c9   propuestaCompleta 9265cb5e…d78e6
propuestaMinima     16c0222a…cbcea    asunto            5d6b7478…7fb
recordatorios       031208fe…341b     asuntoRecordatorios c6565c5b…4878
```

**Páginas: el volcado.** `I18N_VOLCAR_TODO` con la suite unitaria completa en un árbol temporal en
9d404205 (3037 archivos) y en HEAD (3053). `diff -rq`: **ningún HTML existente cambia**. Las cinco
diferencias son pruebas nuevas: `idioma-documentos-cliente.test.ts`, `papeles-idioma-instancia.test.ts`,
dos casos ADR 0049 en `pantallas-propuestas.test.ts` y uno en `pantallas.test.ts`.
**Ojo, esto es igual en parte por construcción:** `pantallas-propuestas.test.ts` simula que el
idioma de la instancia es el de la cookie (`instancia.idioma ?? cabeceras.cookie ?? 'es'`). Así
que demuestra que «instancia es + persona es» no cambia, no que «instancia es + persona en» siga
igual. Ese caso cambia **a propósito** (el papel sale en español) y lo fija su propia prueba.

**El rojo del TDD sí está en el historial.** Corrí los cinco archivos nuevos en 70dc61ff (árbol
temporal): 5 archivos en rojo y 15 pruebas. En correos y en la propuesta el rojo es por
**aserción** (`expected 'Propuesta comercial: …' to be 'Commercial proposal: …'`,
`… to contain 'PROPUESTA COMERCIAL'`). En `idioma-documentos-cliente`, `papeles-idioma-instancia`
y `pantallas` es `Cannot find module`, que es un rojo débil. B60 tiene su rojo propio (94189547).

**Mutaciones** (en el árbol temporal en 873ac6dc, revertidas):

| Mutante | Resultado |
|---|---|
| `htmlCorreoInvitacion` en/it sin `escaparHtml` | 2 en rojo («los datos van tal cual, y escapados», en y en it) |
| `href` de la propuesta sin `escaparHtml` | 4 en rojo (los 2 hashes del español y los 2 de escapes) |

### Las preguntas del orquestador

- **¿Qué pasa si la base no responde al pintar la liga pública o el portal?** No aparece ningún
  modo de fallo nuevo. El layout raíz ya llamaba a `monedaDeLaInstancia()`, también fail-closed y
  sin `catch`, desde el ADR 0048 (`git show 9d404205:apps/web/app/layout.tsx` línea 90). Con la
  base caída y el proceso en frío, el layout raíz lanza **antes** que el de `/p` o `/portal`, y
  se sirve `app/global-error.tsx`. `login-sin-base.e2e.test.ts:122` comprueba ese caso
  («GET … con la base caida sirve el error global PROPIO»). Las dos páginas necesitan la base
  para sus datos de todos modos. Una vez leída, el idioma queda en caché y no vuelve a consultar.
  El cliente externo ve el error global, no un texto en un idioma equivocado: eso es lo correcto.
- **Escapes en los correos en/it.**
  - `htmlCorreoInvitacion`, la propuesta traducida y los recordatorios traducidos escapan el
    texto **ya interpolado** (`escaparHtml(traducir(…))`), una sola vez.
  - La fecha de vigencia se inserta escapada en un hueco `\u0000FECHA\u0000` que `escaparHtml` no
    toca.
  - `interpolar` (`lib/i18n/diccionario.ts:582-585`) usa un replacer de función, así que un `$&`
    en un nombre no se expande.
  - El asunto quita `\r\n`.
  - Las dos mutaciones de arriba muerden.
- **Correo de restablecer contraseña:** `htmlCorreoReset` no está en el diff de `email.ts`, y
  `app/api/auth/forgot/` tampoco aparece en `git diff --stat`. Sigue en español, fuera de alcance.
- **Archivos protegidos:** el diff 9d404205..HEAD sobre `aislamiento.e2e.test.ts`,
  `servidor-e2e.ts`, `db-e2e.ts`, `db/`, `middleware.ts`, `nav.ts` y `app/api/auth/forgot` está
  vacío.
- **B59:** se cerró documentándolo. `bootstrap-auth.mjs` y `entorno-y-despliegue.md` dicen que es
  la ruta de desarrollo, solo en español y MXN.
- **B60:** cerrada, con `uso()` en `2,58p`.

### Hallazgos nuevos

1. **(MEDIA, producto · B67) Hoy, una instancia en italiano sale en dos idiomas.** El contrato y la
   constancia salen en italiano. La propuesta, su liga, el portal, el comprobante y los tres
   correos caen al **inglés**: `IT_PROPUESTAS`, `IT_CUENTA` e `IT_NOTIFICACIONES` no tienen
   ninguna clave `correo.` (contadas con `awk`), y el commit a354eee0 lo dice («cae al ingles
   hasta el lote L2»). No es un fallo silencioso de datos, pero es un cliente italiano recibiendo
   correos en inglés. Se suma a D13 (no dar de alta `it` todavía).
2. **(BAJA · B68) El `<html lang>` de `/p` y `/portal` sigue el idioma de la petición**, mientras el
   contenido va en el de la instancia. Lo declaran los propios layouts. Afecta a lectores de
   pantalla y traductores automáticos, no a lo que se ve.

### No verificado

- La liga, el portal y el comprobante en un navegador real.
- La calidad de las traducciones.

---

## Primera pasada · 2026-11-03 · HEAD 9d404205 — ÁMBAR

> Este informe se escribió el 03/11 en el worktree `integra-ingles` (`integra/idiomas`) y se
> commiteó allí; la rama trae un resumen de él. Al fusionar (04/11) se conserva entero.

### Veredicto: ÁMBAR

El español no cambia ni un byte (14 hashes recalculados por mí con el código de 6779321d,
idénticos), la migración cumple el patrón del ADR 0048, los archivos protegidos no se tocaron,
`PUERTO_E2E` ya existía, y tres guards muerden por mutación. Typecheck limpio, 7094 unitarias en
verde, arnés de aprovisionamiento 46/160/0.

Lo que lo deja en ámbar, por orden de importancia:

1. **Las e2e no las corrí** (orden del orquestador: 3311 ocupado). En zona ROJA es lo que más
   pesa: los triggers, el `qRaw1` sobre `tenants`, el cotejo en inglés de punta a punta y el 400
   de `/api/tenants` solo se ven contra Postgres real. La afirmación del autor («e2e completas en
   verde salvo grants-rol-app») está sin medir por mí. **Esto es lo que importa de los cuatro.**
2. **El rojo del TDD no está en el historial**: cada commit trae prueba e implementación juntas,
   y el rojo declarado de 7d4b5290 es «las unitarias nuevas fallaban sin los módulos» — un
   `Cannot find module`, rojo débil. Lo compensan las mutaciones (abajo), pero no se ve.
3. **No miré la página `/contrato/[id]` en un navegador.** La regla de la constancia cambia y la
   probé solo por HTML de prueba (snapshot y `pantallas-inventario-arrendadores.test.ts`).
4. **`apps/web/scripts/bootstrap-auth.mjs:182`** sigue siendo un camino de alta documentado
   (`vault/01-Arquitectura/entorno-y-despliegue.md:402`) que no puede elegir idioma (ni moneda):
   inserta `tenants (nombre, slug)` y la instancia nace `es` para siempre.

### Lo que medí

```
cd apps/web && npm run typecheck
> web@0.1.0 typecheck
> tsc --noEmit
(sin errores)

cd apps/web && npm test
 Test Files  387 passed (387)
      Tests  7094 passed (7094)

bash infra/scripts/pruebas-provision.sh
46 escenarios · 160 comprobaciones · 0 fallos
(incluye los 6 escenarios «ADR 0049 ·»: es por omisión, --idioma en, --idioma=it,
 fr → 64 sin cuerpo-bootstrap, EN → 64, --idioma sin --bootstrap → 64)

node scripts/recuentos.mjs
  endpoints 159 · tablas 66 · migraciones 124 · ADR 49 (hasta 0049)
  notas 115 · enlaces 1642 · wikilinks rotos 3 (los tres ADR de siempre) · huérfanas 0
```

Cuadran con `CLAUDE.md` y el MOC del commit 9d404205 (1642/115, 124 migraciones, ADR 0049).
`git grep -l "^<<<<<<< HEAD$"`: vacío.

#### Hashes del español, recalculados contra 6779321d

`git show 6779321d:apps/web/lib/contrato-documento.ts` (sin imports) ejecutado con Node 24 sobre
los mismos datos de `contrato-documento-idioma.test.ts`:

```
completo        fc94ef81…78fbbc   otro     a62cf977…243f3a   vacio  3855015c…162419
usd             d19db10d…0fba88   usdPesosSiempre 84b04613…406d35  huella 48116cd6…8ca8398
SEMANAL 3e91af9b…  CATORCENAL 570abbd6…  QUINCENAL 27be248d…  MENSUAL 7793484a…
BIMESTRAL 3bf1b314…  TRIMESTRAL 5e5b23a1…  SEMESTRAL 402a55d8…  ANUAL a62cf977…
```

Los 14, idénticos a los fijados en la prueba. Además, `git diff 6779321d 6fea374a` sobre
`contrato-documento.ts` está vacío, y las únicas líneas quitadas del archivo en la rama son
firmas de función y la tabla de encabezados, que sigue dando `DECLARACIONES`/`CLÁUSULAS`
(`contrato-documento.ts:609-619`).

#### Mutaciones (todas revertidas, `git status` limpio después)

| Mutante | Prueba | Resultado |
|---|---|---|
| `ENCABEZADOS.es.clausulas` → `'CLAUSULAS'` | `contrato-documento-idioma.test.ts` | **16 de 67 fallan** (los 14 hashes + 2) |
| `idiomaDeLaInstancia()` con `.catch(() => null)` (fail-open) | `idioma-instancia.test.ts` | **1 falla** (el FAIL-CLOSED) |
| `/api/signup` deja pasar `idiomaDocumentos` | `cuentas-controller.idioma.test.ts` | **2 fallan** |

Solo unitarias. Las e2e no se mutaron.

### Comprobaciones pedidas

1. **Migración.** `begin`/`commit`, `add column if not exists`, `drop constraint if exists` +
   `add`, `create or replace function`, `drop trigger if exists` + `create`: idempotente.
   `default 'es'` → g500/DEMO quedan en `es`. CHECK es/en/it. Trigger de inmutabilidad
   `before update of idioma_documentos` (reescribir el mismo pasa) y de unicidad `before insert`
   con `pg_advisory_xact_lock`, igual que la moneda. `tenants` no tiene RLS: el bucle de
   `20260720_hard1_rls_todas_tablas.sql:90-95,123` solo cubre tablas con columna `tenant_id`, así
   que el `select` del trigger ve todas las filas. No toca `db/schema.sql` ni migraciones
   anteriores (`git diff 6fea374a..HEAD -- db/ scripts/` = solo el archivo nuevo). `ANTES_DE`
   (`scripts/migrar.mjs:67-74`) no la afecta: va última por orden lexicográfico. Archivo en LF en
   índice y disco (`git ls-files --eol`: `i/lf w/lf attr/text eol=lf`).
2. **Firmas.** Ver hashes. `hashParaCotejar` (`contrato-documento.ts:555-568`) sigue probando la
   letra vieja solo en `es`; en/it cotejan en su idioma porque `datosContrato()` inyecta
   `idioma` (`contrato-expediente.ts:117`) y los cuatro caminos pasan por ahí
   (`firmas-repo.ts:42,227,335`; la página). La e2e que lo recorre en inglés existe
   (`idioma-instancia.e2e.test.ts:133-213`), **no la corrí**.
3. **Fail-closed y caché.** `idioma-instancia.ts:51-67`: sin filas devuelve `es` sin cachear;
   valor fuera de es/en/it lanza; error de base se propaga (mutación lo confirma). Caché por
   proceso en `globalThis` con `Symbol.for`, no por tenant. Riesgo multi-organización: ninguno
   mientras el trigger de unicidad esté activo (todas comparten valor). Si una corrección de datos
   lo deshabilita y deja dos idiomas, el proceso servirá el de la organización más antigua a todas
   hasta reiniciar — documentado en el ADR y en el comentario del módulo. Las pruebas unitarias
   borran la clave en `beforeEach` (`idioma-instancia.test.ts:24-28`); la e2e cambia el idioma
   **antes** de `arrancarServidor()` (`idioma-instancia.e2e.test.ts:137-166`).
4. **Alta.** Bootstrap pasa `eligeIdiomaDocumentos: true` (`app/api/bootstrap/route.ts:137-138`);
   `/api/signup` 400 si llega el campo (`cuentas-controller.ts`, mutación lo confirma);
   `/api/tenants` hereda y rechaza otro (`idioma-alta.ts:108-119`). La lectura y el INSERT van en
   la misma transacción de `withTxBootstrap`. RLS: no hay consulta nueva sobre tablas con
   `tenant_id`; `qRaw1` sobre `tenants` está justificado y es el patrón de la moneda.
5. **`PUERTO_E2E`** ya existía: `apps/web/lib/test/servidor-e2e.ts:25`
   (`Number(process.env.PUERTO_E2E ?? 3311)`), último commit que lo tocó d6a15772, anterior a la
   rama. `git diff 6fea374a..HEAD -- apps/web/lib/test/servidor-e2e.ts apps/web/lib/test/db-e2e.ts`
   vacío. **No hay hallazgo.**
6. **Cambio de la constancia y LESSOR.** El snapshot inglés cambia en una sola línea
   (`THE LANDLORD` → `THE LESSOR`); la clave solo la usa `ConstanciaFirmas.tsx:39`. Las trece
   claves de la constancia existen en es/en/it. Cambio de regla confirmado en
   `contrato/[id]/page.tsx` (`idioma={idiomaDoc}`). El volcado HTML antes/después que cita el
   autor **no lo repetí**.
7. **Revisión legal.** Marcada en `contrato-documento.ts` (cabecera y bloque de `redactarEnOtroIdioma`),
   en el ADR 0049 («REQUIERE REVISIÓN DE UN ABOGADO») y en `docs/runbook-alta-de-owner.md:194`.
   **Pero nada lo impide técnicamente**: `--idioma en` funciona hoy. Va como D13.
8. **Intactos:** `git diff 6fea374a..HEAD --` sobre `aislamiento.e2e.test.ts`, `servidor-e2e.ts`,
   `db-e2e.ts`, `db/schema.sql`, `middleware.ts` y `components/demo/shell/nav.ts`: vacío.

### Hallazgos menores

- `provision-instancia.sh` `uso()` pasa de `2,52p` a `2,59p`; el encabezado creció 6 líneas, así
  que ahora imprime una línea de más («del bucket se lee en su URL del panel,»). Cosmético.
- Notas de bóveda: van en los mismos commits que el código (7d4b5290 y 5f23aeda); el ADR, el
  diario y los recuentos en 9d404205. No se añadió ninguna cita `archivo:línea` nueva en la
  bóveda. Ningún valor real: los RFC del diff son ficticios (`…AAA`).
- Comprobación de números en letra en/it (solo cordura, no legal): 21 → «TWENTY-ONE» /
  «VENTUNO», 21000 → «VENTUNMILA», 333 → «TRECENTOTRENTATRÉ», 1 → «UN PESO». En italiano el
  plural queda «PESOS»: decisión de redacción para el abogado.

### Aviso: el worktree cambió durante la auditoría

Al empezar, `git status --short` en el worktree salía vacío. Al terminar (15:54) había trabajo
ajeno sin commitear: `M apps/web/app/api/recordatorios/route.ts` y, nuevos,
`lib/i18n/idioma-documentos-cliente.{tsx,test.ts}` y `lib/server/correo-recordatorios.ts`, con
fecha de 15:50 a 15:52. El typecheck y las unitarias (inicio 15:45:43, 25 s) corrieron **antes**,
sobre HEAD 9d404205 limpio. Mis tres mutaciones tocaron solo `contrato-documento.ts`,
`idioma-instancia.ts` y `cuentas-controller.ts`, ninguno de los que aparecen ahí. Este veredicto
vale para 9d404205, **no** para lo que se está escribiendo encima.

### No verificado

- e2e (`idioma-instancia.e2e`, `bootstrap.e2e`, y las de firmas en `es`): no corridas por orden
  del orquestador (3311 con proceso huérfano y otra tarea).
- La página del contrato en un navegador (es, en, it).
- El volcado HTML completo antes/después (`I18N_VOLCAR_TODO`).
- La calidad jurídica de la traducción: no es medible por mí.
