---
tipo: tablero
estado: verificado
actualizado: 2026-08-14
tags: [agentes, coordinacion, vivo]
archivos: []
---

# Tablero de zonas

> [!warning] Reclama antes de escribir
> Protocolo completo en [[AGENTES]]. Si tu zona está `TOMADA`, **elige otra
> tarea** — no esperes.

**Estados:** `LIBRE` · `TOMADA` · `PAUSADA` · `REVISION`

## Zonas

| Zona | Estado | Agente | Archivos | Rama | Desde | Notas |
|---|---|---|---|---|---|---|
| Z1 · Auth 🔴 | LIBRE | — | — | — | — | **F2.6 hecha (14/08), ROJA:** el autoregistro sale del build y **cambia de polaridad**. La bandera pasa de `NEXT_PUBLIC_AUTOREGISTRO` a `AUTOREGISTRO` y ahora **solo `=1` enciende**: ausente = APAGADO, al revés que antes (`!== '0'`). Si tocas esto, el fail-closed es el punto, no un detalle. Estaba roto en dos mitades opuestas: el SERVIDOR ya funcionaba en runtime (503/400 con la misma imagen), pero el CLIENTE venía horneado y horneado ENCENDIDO — `/login` se prerrenderiza y su HTML traía el botón «Crear cuenta» dentro, así que cada instancia habría enseñado un botón que contesta 503. Arreglado por `/api/auth/metodos/`, que ahora devuelve `{"google":…,"autoregistro":…}`; **la vía de props desde el layout NO sirve**, se resolvería en el mismo render de build. `aislamiento.e2e.test.ts` pasó SIN TOCARSE: su bloque `:200-213` ya está obsoleto pero se retira en un release posterior (expand → contract). El arnés `servidor-e2e.ts` fija `AUTOREGISTRO: '0'` explícito aunque ausente ya bastaría. **T-02 hecha (13/08):** `bootstrap-auth.mjs` ya **no tiene base por omisión**. Caía en `postgresql://spaces:spaces@localhost:5433/spaces` — la base de desarrollo con DATOS REALES, con el rol `spaces` **superusuario y `rolbypassrls`** (verificado en `pg_roles`), o sea saltándose hasta la RLS `FORCE` de `usuarios`. Era inerte mientras el insert moría con 42P10; **T-01 lo volvió operativo y con eso lo activó**. Ahora `DATABASE_URL` es obligatoria: si falta, aborta con salida 1 diciendo qué falta y cómo pasarla (bash y PowerShell). Apuntar a `spaces` sigue siendo legítimo, pero hay que **decirlo**. Probado en una base desechable (`spaces_t02_test`, ya destruida): dos corridas, 1 usuario en `rgb`, 36 permisos. **T-01 hecha (13/08):** `bootstrap-auth.mjs` estaba roto de antes, no a punto de romperse — fallaba SIEMPRE con 42P10 porque `on conflict (email)` no infiere el índice funcional `usuarios_email_lower_uidx` (`db/schema.sql:72`). Aislado eso, salía el 23502 por `tenant_id`. Se arreglaron las dos en el mismo insert: el conflicto va por `lower(email)` y la organización se resuelve por SLUG (`select … from tenants where slug='rgb'`), nunca por uuid. Si el tenant falta, **aborta con salida 1**: esa forma de insert afecta 0 filas y termina con éxito, el no-op silencioso de R2. Sesión externa cerró el 07/08 y **commiteó todo** (`e7c3517`). Google verificado en producción; ADR 0012 enmendado; `/login` ya redirige con sesión. **DESPLEGADO el 10/08**: `password_resets` aislada en producción, con respaldo y ensayo previos. El invariante de hardening vuelve a dar 0 tablas sin RLS. |
| Z2 · Tenant 🔴 | LIBRE | — | — | — | — | — |
| Z3 · Inventario 🟡 | LIBRE | — | — | — | — | **Sin desplegar (10/08):** `rowToSitio` lleva un tercer parámetro `conMedia`; los listados van sin galería y `SiteFicha` la pide a `/api/sitios/:id/media`. Si añades un consumidor de `sitio.fotos`, recuerda que en los listados llega `[]` — mira `tieneFotos` |
| Z4 · Arrendadores 🔴 | LIBRE | — | — | — | — | **INC-07 desplegado el 10/08** (`7d27d25`). `arrendadores_tenant_rfc_uq` hace único el RFC por organización; el nombre repetido avisa con 409 y se puede confirmar. Antes de tocar el alta: `docs/adr/0013-altas-que-no-se-pueden-duplicar.md`. **11/08:** el alta guarda `direccion` (no lo hacía) y la lista permite editar arrendadores ya dados de alta — el `PATCH` existía y no lo llamaba ninguna pantalla. El contrato exige ese domicilio DOS veces |
| Z5 · Comercial 🟡 | LIBRE | — | — | — | — | **F1.3 hecha (13/08):** `cupoGlobalClientes()` lee `config_negocio` filtrando por `tenant_id` con el GUC, no solo apoyada en la RLS. La firma NO cambió. **INC-03 desplegado y CONFIRMADO el 10/08** junto con INC-09 (`484e768`). El barrido corrio a las 11:57 y movio las 2 campanas del ensayo en seco (`KFC`, `Propuesta para cliente 1`), ni una mas. `recomputarEstadoCampanas()` en `campanas-repo.ts` sincroniza `estado_comercial` con el calendario desde `/api/estado`. Si tocas la definición de «publicada», está en la constante `SQL_PUBLICADA` y la comparten las dos reglas — y `pipelineStage()` usa el mismo criterio para `instalada`: cámbialos juntos |
| Z6 · Operaciones 🟡 | LIBRE | — | — | — | — | — |
| Z7 · Finanzas 🔴 | LIBRE | — | — | — | — | — |
| Z8 · Integraciones 🟡 | LIBRE | — | — | — | — | **INC-02 DESPLEGADO el 10/08** (`c610592`), con backfill de 16 reservas. ⚠️ Quedan 2 pantallas de **eyro** sin asignar («Campaña lista — publicar a DOOHmain» y «pruebas_produccion», 2 aprobados cada una): el día que alguien las apruebe, el guard las rebotará. Se cierra desde un usuario de eyro. `DOOHMAIN_PUBLISH_ENABLED=1` en producción: la publicación es REAL. `publicarCampanaEnDoohmain()` ya no manda el producto cruzado — cada pantalla recibe su pieza asignada, con `veces` como `cantDia`. Sin `spots_por_dia` NO se manda cuota (las 16 reservas de prod lo tienen en NULL). Antes de tocar: [[2026-08-10]] |
| Z9 · Datos 🔴 | LIBRE | — | — | — | — | **F1.2 hecha (13/08), SIN APLICAR EN PRODUCCIÓN:** `20260812_sin_default_tenant.sql` retira el `DEFAULT` de `tenant_id` de las **23** tablas (no 21) recorriendo el catálogo, no una lista. Un insert descuidado ahora truena con 23502 en vez de nacer etiquetado como `rgb`. El guard del paso 1 **no abortó**: 0 tablas con default y sin NOT NULL. `db/schema.sql` NO se tocó — sigue creando el default y la migración lo retira, que es como nace cualquier instalación nueva. Aplicarla en prod es **F1.5 y la corre una persona**. **Al día.** Últimas migraciones aplicadas en producción el 10/08: `20260807_password_resets_rls.sql`, `20260810_notificaciones_archivada_en.sql` y `20260810_arrendadores_rfc_unico.sql`. Producción en `7d27d25`; **pendiente de aplicar queda la de F1.2** (antes no había ninguna). Invariante: 0 tablas con `tenant_id` sin RLS+FORCE |
| Z10 · UI base 🟡 | LIBRE | — | — | — | — | `Button` se bloquea solo mientras su `onClick` esté en vuelo (10/08, A5). No cambia su API y ningún formulario se tocó. La guarda vive en `lib/clic-unico.ts` y tiene sus propias pruebas. **11/08: el menú va por fases del proceso** (`nav.ts`, campo `grupo` + `GRUPOS`); si añades un módulo, ponle grupo o `nav.test.ts` se pone roja |
| Z11 · Utilidades 🟢 | LIBRE | — | — | — | — | **F0.3 hecha (14/08):** `entorno.test.ts` crece de 2 a **4 casos** y los dos nuevos leen `.env.example` **desde el disco**: exigen `AUTOREGISTRO=0` y que no haya `COOKIE_DOMAIN=` con valor. La mitad que faltaba de F0.3 era justo esa — el valor `=0` ya estaba (`0dbccb8`) pero **ninguna prueba lo miraba**, así que devolverlo a `=1` dejaba la suite verde y el CI mudo. Comprobado que la prueba muerde: con la plantilla en `=1` los dos casos se ponen rojos. La ruta se resuelve por `__dirname` (`lib` → `apps/web` → `apps` → raíz), no por el directorio de trabajo. Y **`COOKIE_DOMAIN=localhost` salió de la plantilla**: no lo leía ni una línea de `apps/` y contradecía el invariante 4 (cookies host-only, `auth.ts:191-201` y `:216-226`, citas verificadas hoy). **F2.6 hecha (14/08):** nace `lib/entorno.ts` con `autoregistroActivo()`, las banderas del despliegue que se deciden AL ARRANCAR. Que su prueba pueda existir es el punto: con el prefijo `NEXT_PUBLIC_` era IMPOSIBLE escribirla, porque Next inlinea el valor en el build y cambiar `process.env` entre dos llamadas no cambiaba nada. **F1.4 hecha (13/08):** nace `lib/host.ts` con `etiquetaDeHost()`, la **única** función que mira el `Host`. Una IP desnuda (`209.97.146.136`) ya no se confunde con el subdominio `209`. No resuelve marcas ni organizaciones: solo decide si el rewrite a `/portal` se dispara. Zona de entrada para agentes nuevos |
| Z12 · Docs 🟢 | LIBRE | — | — | — | — | **F2.2 hecha (14/08):** nacen `Dockerfile` y `.dockerignore` en la raiz. Imagen de **240 MB** sobre `node:20-alpine`, tres etapas (`deps` con `npm ci` → `build` con turbo → `runtime`), y **el esquema y las 67 migraciones viajan dentro**, en `/app/db` (invariante 1: en el servidor de una instancia no hay repo clonado). ⚠️ **`**/.env*` en el `.dockerignore` es lo unico que impide hornear credenciales**: el standalone se lleva el `.env` dentro (F2.1 lo midio: mismo md5, con `GOOGLE_CLIENT_SECRET`). Comprobado DENTRO de la imagen, no solo por el ignore: `find / -name '.env*'` devuelve vacio. Los patrones `*.xlsx`/`*.pdf` van **sin `**`** a proposito — con `**` se perderia `apps/web/public/plantilla-sitios-set.xlsx`. El `docker build` real y el smoke formal son de F2.5. **F2.1 (13/08):** el build sale además en `output: 'standalone'`. **Las dos formas de arrancar conviven y las dos se probaron**: `npm start` (`next start -p 3000`, lo que usa `ecosystem.config.js` en el droplet) da 200 en `/spaces-dooh/login/`, y `node .next/standalone/apps/web/server.js` también. ⚠️ El standalone **no lleva `.next/static` ni `public/`** — el CSS del login da 404 si se arranca tal cual. No es un defecto: copiarlos es paso del `Dockerfile` (F2.2) y se verifica en F2.5. `next.config.mjs` creció 10 líneas: **las citas `next.config.mjs:N` de cinco notas se recalcularon** (basePath 8-9→19-20, HSTS 40→51, alias webpack 47-56→58-67, images 11-22→22-33). **T-01 (13/08):** los inserts de ejemplo de `db/README.md` ya ponen `tenant_id` resuelto por slug — `usuarios` y `clientes` están las dos en el bucle de RLS de `db/schema.sql:600-624`. Bóveda creada el 07/08, **validada contra el código el 10/08** y actualizada con la tarde del 10/08 ([[2026-08-10]]) |

> [!warning] V2-01 ya está en `main` — FUSIONADO el 10/08, pero SIN DESPLEGAR
> `/api/estado` deja de llevar el PDF de los contratos y las fotos de las
> pantallas. Verde en local (typecheck · 772 unitarias · 129 e2e · build), y
> `feat/estado-ligero` fusionada en `main`.
>
> **Lo que falta es desplegar y MEDIR.** Su métrica —`<500 kB`, `<1 s` en frío—
> **no está tomada**: la base local tiene 3 contratos sin adjuntos, así que solo
> se reproduce en producción.
>
> Al desplegar, comprobar **la firma `/firmar/[token]` y el export de
> contratos**: son los dos flujos que leían el documento.
>
> Del merge: el runbook de INC-02 conserva la versión de `main` (la EJECUTADA);
> la de la rama era la instantánea previa al despliegue.

> [!important] `eyro` es el tenant de PRUEBAS (confirmado el 10/08)
> Reclasifica el «pendiente» de Z8: las 2 pantallas sin creativo asignado son de
> `eyro`, o sea **datos de ensayo**, no un cliente esperando. Sigue siendo cierto
> que rebotarán con 409 si alguien las aprueba — pero eso es la guarda haciendo
> su trabajo, no una incidencia. Ver [[multi-tenancy-y-rls]].
>
> Lo que **no** cambia: `DOOHMAIN_PUBLISH_ENABLED=1`, así que lo que salga por
> `eyro` llega a pantallas de verdad.
>
> **Reinicio pedido y escrito, SIN EJECUTAR:**
> `docs/datos/20260810_reset_tenant_eyro.sql`. Borra todo `eyro` y lo recrea
> vacío. Antes de correrlo hay que **editar el correo del Dueño** (`\set
> duenio_email`) — el script aborta si no. Y **retirar de DOOHmain** lo que siga
> publicado: el borrado no lo baja de las pantallas y además pierde el rastro de
> qué era.

## Archivos de alto contacto

Claim aparte, aunque estés en otra zona. Lista completa en [[AGENTES]].

| Archivo | Estado | Agente | Desde |
|---|---|---|---|
| `apps/web/middleware.ts` | LIBRE | — | — |
| `apps/web/next.config.mjs` | LIBRE | — | — |
| `apps/web/lib/server/db.ts` | LIBRE | — | — |
| `apps/web/lib/server/auth.ts` | LIBRE | — | — |
| `apps/web/lib/server/errores.ts` | LIBRE | — | — |
| `apps/web/lib/server/uploads.ts` | LIBRE | — | — |
| `apps/web/lib/modulos.ts` | LIBRE | — | — |
| `apps/web/components/demo/shell/nav.ts` | LIBRE | — | — |
| `apps/web/components/demo/ui/*` | LIBRE | — | — |
| `apps/web/app/providers.tsx` | LIBRE | — | — |
| `packages/types/src/*` | LIBRE | — | — |
| `db/schema.sql` | LIBRE | — | — |
| `package.json` / `package-lock.json` | LIBRE | — | — |
| `docs/Registro_Cambios.md` | LIBRE | — | — |

## Cómo se rellena una fila

```
| Z5 · Comercial 🟡 | TOMADA | agente-3 | lib/server/propuestas-repo.ts | feat/comercial-descuento | 07/08 14:20 | descuento por volumen |
```

Al terminar, vuelve a `LIBRE` **en el mismo commit** que cierra el trabajo.
Si te interrumpen, `PAUSADA` + dónde exactamente te quedaste (y al diario).

## Relacionadas
[[AGENTES]] · [[zonas-de-riesgo]] · [[_plantilla-diaria]] · [[MOC-Proyecto]]
