---
tipo: contrato
estado: verificado
actualizado: 2026-08-07
tags: [agentes, coordinacion, obligatorio]
archivos:
  - apps/web/lib/server/
  - apps/web/app/
  - db/migrations/
---

# AGENTES — contrato de trabajo en paralelo

> [!warning] Léelo entero antes de escribir la primera línea
> Junto con [[MOC-Proyecto]] y [[zonas-de-riesgo]], es lo mínimo para empezar sin
> romper nada.

## Las cinco reglas

1. **Reclama tu zona en [[tablero]] antes de escribir.** Si está tomada, elige
   otra tarea; no esperes.
2. **Una rama por agente.** Nunca commitees en la rama de otro. Nunca hagas
   rebase de trabajo ajeno.
3. **Commits pequeños.** Un commit por cambio coherente.
4. **La nota de la bóveda se actualiza en el MISMO commit que cambia el código.**
5. **Si tu cambio toca sesión, tenant, migración o dinero → es ROJO.** Para y
   pide aprobación humana.

---

## Particionado en zonas

Derivado de las fronteras reales del código: cada zona agrupa los archivos que
cambian juntos. **Dueño único a la vez.**

| Zona | Backend | Frontend | Nota |
|---|---|---|---|
| **Z1 · Auth** | `lib/server/{auth,cambios,google-oauth,identidades-repo,password-reset-repo,perfil-controller,usuarios-controller,usuarios-repo}.ts`, `app/api/auth/**`, `app/api/signup/`, `app/api/perfil/`, `app/api/usuarios/**` | `app/(app)/login/`, `app/(app)/recuperar/`, `lib/auth-real.ts` | 🔴 [[autenticacion-y-sesion]] |
| **Z2 · Tenant** | `lib/server/{db,tenant,config-repo,config-fiscal}.ts`, `app/api/{tenants,tenant-activo,config,organizacion}/` | `components/demo/admin/` | 🔴 [[multi-tenancy-y-rls]] |
| **Z3 · Inventario** | `lib/server/{sitios-repo,sitios-controller,almacen-repo,space-eye}.ts`, `app/api/{sitios,predios,incidencias,almacen,licencias}/**` | `/inventario`, `/comercial`, `/network`, `/disponibilidad`, `components/demo/inventario/`, `components/demo/comercial/` | 🟡 [[inventario-y-sitios]] |
| **Z4 · Arrendadores** | `lib/server/{arrendadores-repo,arrendadores-controller,contratos-sitio,firmas-repo,contrato-expediente,operaciones-eventos}.ts`, `app/api/{arrendadores,contratos,pagos-renta,razones-sociales}/**` | `/arrendadores`, `/contrato/[id]`, `/firmar/[token]`, `components/demo/arrendadores/` | 🔴 [[arrendadores-y-contratos]] |
| **Z5 · Comercial** | `lib/server/{propuestas-repo,propuestas-controller,campanas-repo,campanas-controller,creativos-repo,creativos-controller,reservas-controller,clientes-*}.ts`, `app/api/{propuestas,campanas,clientes,reservar,reservas,creatividades,creativos}/**` | `/propuestas`, `/campanas`, `/clientes`, `/creativos`, `/p/[id]`, `components/demo/campanas/` | 🟡 [[comercial-propuestas-campanas]] |
| **Z6 · Operaciones** | `lib/server/{ot-repo,ot-controller,impresion-repo,impresion-controller}.ts`, `app/api/{ot,impresion}/**` | `/operaciones`, `/imprenta`, `/m/ot/[id]`, `components/operaciones/` | 🟡 [[operaciones-y-ot]] |
| **Z7 · Finanzas** | `lib/server/{finanzas-repo,finanzas-controller,ordenes-compra-repo}.ts`, `app/api/{cobranzas,ordenes-compra}/`, `app/api/campanas/[id]/facturar/` | `/finanzas`, `/comisiones` | 🔴 [[finanzas-y-cobranza]] |
| **Z8 · Integraciones** | `lib/server/{doohmain,playlogs-repo,integraciones,storage,email,portal-repo}.ts`, `app/api/{integraciones,portal,logo,recordatorios}/` | `/integraciones`, `/portal/[token]` | 🟡 [[integraciones-externas]] |
| **Z9 · Datos** | `db/schema.sql`, `db/migrations/` | — | 🔴 [[migraciones]] |
| **Z10 · UI base** | — | `components/demo/ui/`, `components/demo/shell/`, `app/(app)/**/layout.tsx` | 🟡 [[shell-y-navegacion]] |
| **Z11 · Utilidades** | — | `apps/web/lib/*.ts` puros con `.test.ts` | 🟢 zona de entrada |
| **Z12 · Docs** | `docs/`, `DESPLIEGUE_*.txt`, `vault/` | — | 🟢 |

---

## Archivos de alto contacto — claim EXCLUSIVO

Tocarlos bloquea a los demás. Reclámalos **por separado**, aunque estés en otra
zona, y suéltalos en cuanto acabes.

| Archivo | Por qué |
|---|---|
| `apps/web/middleware.ts` | CSRF, gate de sesión y ruteo de **toda** la app |
| `apps/web/next.config.mjs` | `basePath`, headers, alias de webpack |
| `apps/web/lib/server/db.ts` | Las cuatro puertas a la base |
| `apps/web/lib/server/errores.ts` | Contrato de errores de todos los handlers |
| `apps/web/lib/server/auth.ts` | Lo usan 65 de 86 handlers |
| `apps/web/lib/server/uploads.ts` | Punto único de validación de subidas |
| `apps/web/lib/server/folios.ts` | Todos los folios consecutivos |
| `apps/web/lib/modulos.ts` | Catálogo del ADR 0010 |
| `apps/web/components/demo/shell/nav.ts` | Menú **y** control de acceso a la vez |
| `apps/web/components/demo/ui/*` | Importados por decenas de pantallas |
| `apps/web/app/providers.tsx` | Parches de `fetch` + React Query |
| `packages/types/src/*`, `packages/utils/src/*` | Tipos compartidos |
| `db/schema.sql` | Base de todo el esquema |
| `package.json`, `package-lock.json` | Regla del lockfile |
| `docs/Registro_Cambios.md` | Editado por todos; conflicto casi seguro |
| `vault/07-Agentes/tablero.md` | El propio tablero |

> [!tip] `db/migrations/` no necesita claim, pero sí coordinación de nombre
> Cada agente crea **su propio archivo**, así que no hay conflicto de contenido.
> Pero mira el directorio antes de nombrarlo: el orden es lexicográfico y ya hay
> varias del mismo día. Y comprueba el mapa `ANTES_DE` de
> `apps/web/lib/test/db-e2e.ts` ([[migraciones]]).

---

## Protocolo de claim

**Antes de escribir:**

1. Abre [[tablero]].
2. ¿Tu zona está `LIBRE`? Añade una fila:
   ```
   | Z5 · Comercial | TOMADA | agente-3 | lib/server/propuestas-repo.ts | feat/propuesta-descuento | 07/08 14:20 | descuento por volumen |
   ```
3. ¿Tomada? **Elige otra tarea.** No esperes, no negocies, no trabajes «con
   cuidado» en la misma zona.
4. ¿Necesitas un archivo de alto contacto? Reclámalo en su propia fila.

**Al terminar:** pon la fila en `LIBRE` (o bórrala) en el mismo commit que cierra
el trabajo.

**Si te interrumpen a medias:** deja la fila como `PAUSADA` y anota en Notas
**dónde exactamente** te quedaste. Eso mismo va al diario del día.

---

## Ramas

```
main
 ├── feat/<zona>-<que>     ej. feat/comercial-descuento-volumen
 ├── fix/<zona>-<que>      ej. fix/auth-cookie-tenant-activo
 └── docs/<que>            ej. docs/vault-flujos
```

- Una rama por agente **y por tarea**.
- Rebase solo sobre **tu propia** rama.
- Nunca `push --force` a una rama que no sea tuya.
- `main` está protegida por `ci.yml` (typecheck + test + build).

---

## Conflictos: quién cede

| Situación | Resolución |
|---|---|
| Dos agentes en la misma zona | **Cede quien reclamó después.** La hora del tablero manda |
| Conflicto en un archivo de alto contacto | Cede quien **no** lo tenía reclamado |
| Conflicto en `docs/Registro_Cambios.md` | **Nadie cede: se fusionan las dos entradas.** Es un log, no código |
| Conflicto en una migración | **Ninguno reescribe la del otro.** Renombra la tuya con sufijo posterior |
| Dos agentes necesitan la misma zona ROJA | **Para los dos.** Va a revisión humana |

**Nunca** resuelvas un conflicto en zona ROJA descartando el lado ajeno. Si no
entiendes el otro cambio, para y pregunta.

---

## Obligación de documentar

El commit que cambia código **incluye** la actualización de su nota en `vault/`:

| Cambias | Actualizas |
|---|---|
| Un endpoint | [[api-endpoints]] + la nota del módulo |
| El esquema | [[esquema]] + [[migraciones]] |
| Un flujo de negocio | La nota de `05-Flujos/` |
| Una decisión de diseño | Un ADR en `docs/adr/` + [[decisiones]] |
| Algo visible para el usuario | `docs/Registro_Cambios.md` |
| El nivel de riesgo de una zona | [[zonas-de-riesgo]] |

Y en `frontmatter`, sube `actualizado:` a la fecha del commit.

---

## Antes de pedir merge

- [ ] Zona liberada en [[tablero]]
- [ ] `npm run typecheck` limpio
- [ ] `npm test` en verde
- [ ] `npm run test:e2e` si tocaste auth, tenant, dinero o migraciones
- [ ] Nota de la bóveda actualizada en el mismo commit
- [ ] Bitácora, si se nota desde la aplicación
- [ ] Ningún secreto en el diff (`git diff | grep -i -E 'secret|key|password|token'`)

## Relacionadas
[[tablero]] · [[zonas-de-riesgo]] · [[convenciones]] · [[_plantilla-diaria]] ·
[[MOC-Proyecto]]
