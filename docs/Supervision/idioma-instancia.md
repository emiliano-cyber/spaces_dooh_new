# Supervisión · ADR 0049, el idioma de los documentos es de la instancia

- **Rama:** `feat/idioma-instancia` (3 commits sobre `integra/idiomas` 6fea374a: 7d4b5290,
  5f23aeda, 9d404205), worktree `.claude/worktrees/idioma-instancia`
- **Zona:** ROJA (R3 migración · firmas y su hash · aprovisionamiento · alta)
- **Fecha:** 2026-11-03 · supervisor, sin corregir nada
- **Árbol medido:** el de la rama (HEAD 9d404205). No hay árbol fusionado distinto: la rama sale
  de la punta de `integra/idiomas` (6fea374a), así que fusionarla es avance rápido.

## Veredicto: ÁMBAR

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

## Lo que medí

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

### Hashes del español, recalculados contra 6779321d

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

### Mutaciones (todas revertidas, `git status` limpio después)

| Mutante | Prueba | Resultado |
|---|---|---|
| `ENCABEZADOS.es.clausulas` → `'CLAUSULAS'` | `contrato-documento-idioma.test.ts` | **16 de 67 fallan** (los 14 hashes + 2) |
| `idiomaDeLaInstancia()` con `.catch(() => null)` (fail-open) | `idioma-instancia.test.ts` | **1 falla** (el FAIL-CLOSED) |
| `/api/signup` deja pasar `idiomaDocumentos` | `cuentas-controller.idioma.test.ts` | **2 fallan** |

Solo unitarias. Las e2e no se mutaron.

## Comprobaciones pedidas

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

## Hallazgos menores

- `provision-instancia.sh` `uso()` pasa de `2,52p` a `2,59p`; el encabezado creció 6 líneas, así
  que ahora imprime una línea de más («del bucket se lee en su URL del panel,»). Cosmético.
- Notas de bóveda: van en los mismos commits que el código (7d4b5290 y 5f23aeda); el ADR, el
  diario y los recuentos en 9d404205. No se añadió ninguna cita `archivo:línea` nueva en la
  bóveda. Ningún valor real: los RFC del diff son ficticios (`…AAA`).
- Comprobación de números en letra en/it (solo cordura, no legal): 21 → «TWENTY-ONE» /
  «VENTUNO», 21000 → «VENTUNMILA», 333 → «TRECENTOTRENTATRÉ», 1 → «UN PESO». En italiano el
  plural queda «PESOS»: decisión de redacción para el abogado.

## Aviso: el worktree cambió durante la auditoría

Al empezar, `git status --short` en el worktree salía vacío. Al terminar (15:54) había trabajo
ajeno sin commitear: `M apps/web/app/api/recordatorios/route.ts` y, nuevos,
`lib/i18n/idioma-documentos-cliente.{tsx,test.ts}` y `lib/server/correo-recordatorios.ts`, con
fecha de 15:50 a 15:52. El typecheck y las unitarias (inicio 15:45:43, 25 s) corrieron **antes**,
sobre HEAD 9d404205 limpio. Mis tres mutaciones tocaron solo `contrato-documento.ts`,
`idioma-instancia.ts` y `cuentas-controller.ts`, ninguno de los que aparecen ahí. Este veredicto
vale para 9d404205, **no** para lo que se está escribiendo encima.

## No verificado

- e2e (`idioma-instancia.e2e`, `bootstrap.e2e`, y las de firmas en `es`): no corridas por orden
  del orquestador (3311 con proceso huérfano y otra tarea).
- La página del contrato en un navegador (es, en, it).
- El volcado HTML completo antes/después (`I18N_VOLCAR_TODO`).
- La calidad jurídica de la traducción: no es medible por mí.
