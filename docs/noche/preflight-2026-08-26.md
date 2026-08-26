# Preflight de la corrida nocturna

- **Fecha y hora:** 2026-08-26 01:09 (hora local)
- **Rama:** `feat/servidor-padre-instancias`
- **Hashes de árbol** (`git rev-parse HEAD:apps HEAD:db HEAD:package.json HEAD:package-lock.json`):

  | Qué | Hash |
  |---|---|
  | `apps` | `17fe60c8dd532435c41c56d183d509c79eee240c` |
  | `db` | `fc5db218014efb2facf2a00eefc21fe1819c6f97` |
  | `package.json` | `37ebef7f99060b2fd289cd65a529a063fc085d19` |
  | `package-lock.json` | `7b1ee799937e6c87c13d4e19faa411f3cbf2b641` |

  **Por qué estos cuatro y no el hash de HEAD.** El hash de HEAD cambia con **cualquier** commit,
  incluido uno que solo toque documentos — y este archivo vive en `docs/`, así que el commit que lo
  guarda **invalidaba su propia línea**. Un lazo sin salida: ningún archivo puede contener el hash
  del commit que lo contiene. Estos cuatro identifican **lo que las pruebas de verdad miden**: el
  código, el esquema y las dependencias. Un commit que solo toca `docs/`, `.claude/` o `vault/` los
  deja intactos, y las cifras de abajo siguen siendo válidas.
- **`apps/web/.next/BUILD_ID`:** existe — `3F-4Imte15WSoSyjdKh81`
- **git status:** `nothing to commit, working tree clean`
- **node:** v24.16.0 · **npm:** 11.13.0
- **Postgres de pruebas:** arriba — contenedor `spaces_db`, Postgres 16 en el 5433, `healthy`; base `spaces_e2e` presente

**npm test: 858 verde · npm run test:e2e: 216 verde (1 saltada)**

---

## Estado real de las tareas al 26/08

El v3 es del **13/08** y el repo siguió avanzando después (F2.6 se aplicó el 14/08 sin que el plan
se enterara). Esto es lo que hay hoy, comprobado con `rg` y `ls`, tarea por tarea.

| Tarea | Qué se buscó | Estado |
|---|---|---|
| **F5.1** | `withTxBootstrap` en `apps/web` | **No hay nada.** Cero resultados en todo `apps/web` |
| **F5.2** | `apps/web/app/api/bootstrap/` | **No hay nada.** El directorio no existe. La única mención de «bootstrap» en `middleware.ts:41` es un comentario sobre el CSRF de login/signup/logout — *bootstrap de sesión*, otra cosa |
| **F5.3** | `infra/env/instancia.env.example`, `infra/nginx/instancia.conf.tpl` | **No hay nada.** Ninguno de los dos existe |
| **F5.4** | `infra/scripts/provision-instancia.sh`, `docs/runbook-alta-de-owner.md` | **No hay nada.** Ninguno de los dos existe |
| **F5.5** | los 4 scripts de la pista archivada | **Los 4 existen** (`deploy.sh`, `migrate-all-tenants.sh`, `new-tenant.sh`, `setup-first-tenant.sh`). La tarea es *retirarlos*, así que está pendiente — y sigue bloqueada por F3.6, que es de la persona |
| **F5.8** | `FLOTA_TOKEN`, `X-Flota-Token`, `timingSafeEqual` | **No hay nada.** Cero resultados en `apps/web` e `infra/scripts` |
| **F6.1** | `apps/web/app/api/version/` | **No hay nada.** El directorio no existe |
| **F6.2** | `apps/flota/` | **No hay nada.** El directorio no existe |
| **F6.4** | `apps/flota/reporte.mjs`, `apps/flota/estado/` | **No hay nada** (consecuencia de F6.2) |
| **F8.1** | `docs/adr/0014-instancia-dedicada-por-owner.md` | **Desfasada, ver abajo** |
| **F8.3** | bóveda al día | **A medias, ver abajo** |

### F8.1 — el contenido falta, pero el número está ocupado

La ficha del v3 pide crear `docs/adr/0014-instancia-dedicada-por-owner.md` y afirma: *«La
numeración se verificó: la última es `0013-altas-que-no-se-pueden-duplicar.md`»*. Eso **ya no es
cierto**. Hoy hay ADR hasta la **0019**, y la **0014 está tomada** por otra decisión:

```
0014-postgres-en-el-droplet-o-base-administrada.md
0015-demo-dentro-del-padre.md
0016-demo-se-queda-en-su-droplet.md
0017-todo-se-concentra-en-el-padre.md
0018-establecer-password-tras-entrar-con-google.md
0019-demo-arranca-con-systemd.md
```

El **contenido** de F8.1 sí está sin escribir: ninguno de sus cinco elementos distintivos aparece en
`docs/adr/` («instancia dedicada por owner», «no se le dice \[tenant\]», los slugs reservados,
«defensa en profundidad», la fila «El padre se cae» de la tabla de promesas). Cero coincidencias.

Su **comando de verificación** (`ls docs/adr/ | tail -3` → muestra la 0014) tampoco sirve ya:
`tail -3` devuelve 0017, 0018 y 0019.

### F8.3 — dos de sus tres pasos ya están hechos

- **Paso 1**, corregir «21 tablas» → **ya hecho**: `vault/02-Backend/multi-tenancy-y-rls.md:209`
  dice «**23 tablas** —no 21—». Lo que **falta** de ese paso es el marco nuevo arriba del archivo
  («una instancia por owner; la RLS es defensa en profundidad dentro de la instancia»): la nota
  menciona «instancia» **una sola vez**, y de pasada, en la línea 230.
- **Paso 2**, reescribir `entorno-y-despliegue.md` como flota → **parece hecho**: 74 menciones a
  instancia/flota.
- **Criterio de aceptación** → **se cumple**. El comando del v3 da 2 resultados, pero los dos están
  en `vault/08-Manuales/manual-tecnico.md:872,882` y hablan de que **las pruebas e2e** comparten una
  base, no de que las empresas compartan proceso. Son falsos positivos del comando, no del criterio.
- Existe además `vault/01-Arquitectura/modelo-instancias-soberanas.md`, que el v3 no menciona.

### Bitácora desde el 13/08

`docs/Registro_Cambios.md` tiene entradas del 13, 14, 19, 20, 21, 24 (×2) y 25 de agosto. Ninguna
usa los identificadores `FX.Y` del v3, así que **la bitácora no sirve para saber qué tarea del plan
se aplicó**: hay que comprobarlo contra el código, como se hizo arriba.
