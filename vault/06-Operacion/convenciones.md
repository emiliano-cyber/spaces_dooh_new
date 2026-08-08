---
tipo: operacion
estado: verificado
actualizado: 2026-08-07
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
| Unitarias (~729) | `npm test` | `vitest.config.ts` | Siempre; no necesitan Docker |
| Integración (~55) | `npm run test:e2e` | `vitest.e2e.config.ts` | Auth, tenant, dinero, migraciones |

Las e2e:
- corren **en serie** (`fileParallelism: false`) porque comparten base;
- levantan un **Next real** en el puerto 3311 y hablan por HTTP, para pasar por
  el middleware y los guards en su orden real (`lib/test/servidor-e2e.ts`);
- usan dos roles: `spaces` (superusuario, siembra) y `spaces_app`
  (`nosuperuser nobypassrls`, para todo lo que deba respetar RLS);
- se niegan a apuntar a una base cuyo nombre no acabe en `_e2e` o `_test`.

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

## Relacionadas
[[zonas-de-riesgo]] · [[AGENTES]] · [[migraciones]] ·
[[stack-y-dependencias]] · [[MOC-Proyecto]]
