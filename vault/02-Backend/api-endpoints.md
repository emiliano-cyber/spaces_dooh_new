---
tipo: referencia
estado: verificado
actualizado: 2026-08-14
tags: [backend, api, endpoints]
archivos:
  - apps/web/app/api/
  - apps/web/middleware.ts
  - apps/web/lib/server/auth.ts
  - apps/web/lib/server/cambios.ts
---

# API — los 88 endpoints

Todos son Route Handlers de Next (`app/api/**/route.ts`), servidos bajo
`https://demo.space-os.io/spaces-dooh/api/...`.

## Cómo leer la columna Guard

| Guard | Qué exige | Definido en |
|---|---|---|
| `PÚBLICO` | Nada. Se auto-protege por token o es bootstrap de sesión. | — |
| `exigir` | Sesión válida + (opcional) permiso `modulo/accion` | `lib/server/auth.ts:150-182` |
| `usuarioActual` | Sesión, **sin** el corte de `debe_cambiar_password` | `lib/server/auth.ts:112-126` |
| `DESBLOQ` | Además, desbloqueo vigente si el tenant lo exige | `lib/server/cambios.ts:199-210` |
| `REAUTH` | Además, desbloqueo **siempre**, ignore el interruptor del tenant | `lib/server/cambios.ts:221-226` |
| `SENSIBLE` | `exigir(modulo,accion)` + `exigirDesbloqueo()` juntos | `lib/server/cambios.ts:236-245` |

> [!info] El middleware NO valida la sesión
> `apps/web/middleware.ts:100` solo comprueba que **exista** la cookie
> `spaces_sesion` (corre en Edge, sin `pg`). Todas las `/api/` quedan fuera de
> ese gate: **se auto-protegen**. Un endpoint nuevo sin guard queda abierto.

## Autenticación y cuenta

| Método | Path | Guard | Notas |
|---|---|---|---|
| POST | `/api/auth/login` | PÚBLICO | 10/5min por IP. Emite `spaces_sesion` + `spaces_csrf` |
| POST | `/api/auth/logout` | PÚBLICO | Exento de CSRF |
| GET | `/api/auth/me` | usuarioActual | Rellena `spaces_csrf` si falta |
| GET | `/api/auth/metodos` | PÚBLICO | `{"google":bool,"autoregistro":bool}`, `force-dynamic`, `no-store` |
| POST | `/api/auth/forgot` | PÚBLICO | 5/15min IP + 3/h correo |
| GET·POST | `/api/auth/reset` | PÚBLICO | GET valida token, POST aplica |
| GET | `/api/auth/google/inicio` | PÚBLICO | 302 a Google; 503 si apagado |
| GET | `/api/auth/google/callback` | PÚBLICO | Canjea código, abre sesión |
| POST | `/api/signup` | PÚBLICO | 503 salvo `AUTOREGISTRO=1` (fail-closed desde el 14/08; se lee al arrancar, no en el build) |
| PATCH | `/api/perfil` | usuarioActual | Exige `passwordActual` |
| GET | `/api/permisos` | exigir | |
| GET | `/api/admin/permisos-matriz` | exigir | |

## Usuarios y organización

| Método | Path | Guard | Nota |
|---|---|---|---|
| GET·POST | `/api/usuarios` | exigir | acepta `entraConGoogle` (sin contraseña) |
| PATCH·DELETE | `/api/usuarios/[id]` | exigir | |
| POST | `/api/usuarios/[id]/restablecer` | **REAUTH + DESBLOQ** | |
| GET·POST | `/api/tenants` | exigir | el admin acepta `entraConGoogle` |
| POST | `/api/tenant-activo` | exigir | Cambio de CRM del super-admin |
| PATCH | `/api/organizacion` | exigir | |
| GET·PATCH | `/api/config` | exigir | |
| GET·PUT | `/api/cambios` | exigir | Interruptor de reautenticación |
| POST·DELETE | `/api/cambios/desbloquear` | exigir | |
| GET | `/api/estado` | exigir | Devuelve **todo** el tenant |

> [!note] Alta con Google (ADR 0012 enmendado, 07/08)
> `POST /api/usuarios` y `POST /api/tenants` aceptan `entraConGoogle: true` y
> entonces **no se manda contraseña**: el servidor genera una con
> `passwordAleatoria()` que nadie ve (`usuarios-controller.ts:45,74`,
> `cuentas-controller.ts:31,77`). Ambos rechazan el alta si Google no está
> habilitado en ese servidor (`googleDisponible`), porque crearían a alguien que
> no puede entrar de ninguna forma. Ver [[flujo-acceso-con-google]].

> [!important] Lo pesado se sirve aparte, nunca dentro de `/api/estado`
> Tres rutas siguen el mismo patrón: `/api/logo/[token]`,
> `/api/creativos/[id]/arte` y —desde el 10/08— `/api/contratos/[id]/documento`
> y `/api/sitios/[id]/media`. Todo lo que se guarda como `data:` URL se sirve
> por su propia ruta y **no** viaja en la hidratación. Ver [[flujo-login]] y el
> apartado de hidratación en [[estado-y-data-fetching]].

> [!danger] `/api/estado` devuelve TODO el tenant
> Campañas, clientes, propuestas y cifras financieras en una sola respuesta.
> Por eso el corte de `debe_cambiar_password` en `exigir()` es incondicional
> (`lib/server/auth.ts:156-171`) y **no** puede condicionarse a que la ruta
> declare módulo.

## Inventario

| Método | Path | Guard |
|---|---|---|
| GET·POST | `/api/sitios` | exigir |
| PATCH·DELETE | `/api/sitios/[id]` | **DESBLOQ** + exigir |
| POST·DELETE | `/api/sitios/[id]/pausa-legal` | exigir |
| POST | `/api/sitios/[id]/reubicar` | exigir |
| GET | `/api/sitios/[id]/space-eye` | exigir |
| GET | `/api/sitios/[id]/media` | exigir (`network.ver`) |
| POST | `/api/sitios/import` | exigir |
| POST | `/api/predios` · PATCH `/api/predios/[id]` · POST `/api/predios/[id]/pantallas` | exigir |
| POST | `/api/incidencias` | exigir |
| GET·POST | `/api/almacen` · POST `/api/almacen/[id]/movimiento` | exigir |
| POST | `/api/licencias` · PATCH·DELETE `/api/licencias/[id]` | exigir |

## Arrendadores y contratos

| Método | Path | Guard |
|---|---|---|
| POST | `/api/arrendadores` | exigir |
| PATCH·DELETE | `/api/arrendadores/[id]` | **SENSIBLE** |
| POST | `/api/contratos` | **SENSIBLE** |
| PATCH | `/api/contratos/[id]` | **SENSIBLE** |
| POST | `/api/contratos/[id]/cancelar` | **SENSIBLE** |
| POST | `/api/contratos/[id]/renovar` | **SENSIBLE** |
| GET | `/api/contratos/[id]/documento` | `arrendadores` **o** `finanzas` |
| GET·POST | `/api/contratos/[id]/firma` | exigir |
| PATCH | `/api/pagos-renta/[id]` | exigir |
| POST | `/api/pagos-renta/[id]/pagar` | **SENSIBLE** |
| GET | `/api/pagos-renta/[id]/adjunto/[tipo]` | exigir |
| POST | `/api/razones-sociales` · PATCH·DELETE `/api/razones-sociales/[id]` | exigir |

## Comercial

| Método | Path | Guard |
|---|---|---|
| POST | `/api/clientes` · PATCH `/api/clientes/[id]` | exigir |
| POST | `/api/propuestas` · PATCH `/api/propuestas/[id]` | exigir |
| PATCH | `/api/propuestas/items/[id]` | exigir |
| POST | `/api/propuestas/[id]/generar-campana` | exigir |
| POST | `/api/reservar` | exigir |
| PATCH | `/api/reservas/[id]/creativo` | exigir |
| POST | `/api/creatividades` · PATCH·DELETE·PUT `/api/creatividades/[id]` | exigir |
| GET | `/api/creativos/[id]/arte` | exigir |
| POST | `/api/campanas/[id]/confirmar` | exigir |
| POST | `/api/campanas/[id]/contrato` | exigir |
| POST | `/api/campanas/[id]/extender` | exigir |
| POST | `/api/campanas/[id]/oc` | exigir |
| POST | `/api/campanas/[id]/validar` | exigir |
| POST | `/api/campanas/[id]/creativos/repartir` | exigir |
| POST | `/api/campanas/[id]/enviar-dominio` | exigir |
| GET·POST | `/api/campanas/[id]/playlogs` | exigir |
| POST | `/api/campanas/[id]/facturar` | **SENSIBLE** |
| POST | `/api/ordenes-compra` | exigir |

## Operaciones e imprenta

| Método | Path | Guard |
|---|---|---|
| GET·POST | `/api/ot` | exigir |
| GET | `/api/ot/[id]` | exigir |
| POST | `/api/ot/[id]/cerrar` | exigir |
| GET·POST | `/api/impresion` · PATCH `/api/impresion/[id]` | exigir |
| PATCH | `/api/impresion/[id]/prueba-color` | exigir |

## Finanzas

| Método | Path | Guard |
|---|---|---|
| POST | `/api/cobranzas/[id]/pagar` | **SENSIBLE** |
| POST | `/api/cobranzas/[id]/recordar` | exigir |

## Notificaciones e integraciones

| Método | Path | Guard |
|---|---|---|
| GET | `/api/notificaciones/nuevas` | exigir |
| POST | `/api/notificaciones/[id]/leer` · `/api/notificaciones/leer-todas` | exigir |
| GET | `/api/integraciones` | exigir |

## Públicos por token (sin sesión)

Estos **no** dependen de la cookie: la credencial es el token del enlace. Por eso
están exentos de CSRF (`middleware.ts:47-57`).

| Método | Path | Credencial |
|---|---|---|
| GET | `/api/portal/[token]` | `campanas.portal_token` |
| GET·POST | `/api/firma/[token]` | token de firma del contrato |
| GET·POST | `/api/propuestas/publica/[id]` | `propuestas.token_publico` |
| GET | `/api/logo/[token]` | `config_negocio.logo_token` |

## Cron

| Método | Path | Credencial |
|---|---|---|
| POST | `/api/recordatorios` | header `x-recordatorios-token` == `RECORDATORIOS_TOKEN`; **503 si la variable no está** |

Recorre **todos** los tenants fijando `app.tenant_id` uno por uno. Idempotente
por día. Ver [[integraciones-externas]].

## Relacionadas
[[02-Backend/_indice|Índice de Backend]] · [[autenticacion-y-sesion]] ·
[[multi-tenancy-y-rls]] · [[zonas-de-riesgo]] · [[MOC-Proyecto]]
