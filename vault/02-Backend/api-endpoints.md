---
tipo: referencia
estado: verificado
actualizado: 2026-10-06
tags: [backend, api, endpoints]
archivos:
  - apps/web/app/api/
  - apps/web/middleware.ts
  - apps/web/lib/server/auth.ts
  - apps/web/lib/server/cambios.ts
  - apps/web/lib/server/actualizaciones-repo.ts
  - apps/web/app/api/novedades/route.ts
  - apps/web/app/api/tickets/route.ts
  - apps/web/lib/server/tickets-controller.ts
  - apps/web/lib/server/tickets-repo.ts
  - apps/web/lib/server/flota.ts
  - apps/web/app/api/auth/codigo/route.ts
  - apps/web/app/api/perfil/codigos-recuperacion/route.ts
  - apps/web/app/api/bienvenida/route.ts
  - apps/web/app/api/captacion/
  - apps/web/app/api/codigos-promocionales/
  - apps/web/app/api/energia/
  - apps/web/app/api/paquetes/
  - apps/web/app/api/propuestas/[id]/paquete/route.ts
  - apps/web/app/api/rejilla/
  - apps/web/app/api/reportes/rentabilidad/route.ts
  - apps/web/app/api/sitios/[id]/modalidades/route.ts
  - apps/web/app/api/sitios/[id]/rejilla/route.ts
  - apps/web/app/api/volumen/escalas/
---

# API — los 124 endpoints

Todos son Route Handlers de Next (`app/api/**/route.ts`), servidos bajo el
`basePath` `/spaces-dooh` (`apps/web/next.config.mjs:145`).

> [!tip] 100 medidos el 2026-09-23 con `node scripts/recuentos.mjs`, no copiados
> Decía 99 (21/09). La única ruta nueva es `/api/tickets` (ADR 0038, tickets de
> soporte) — un solo `route.ts` que cuenta como uno aunque exponga tres verbos.
> El script mide sobre el árbol donde se corre; hazlo tú si lo necesitas exacto,
> no confíes en este número pasado un commit.
>
> **2026-10-05: son 124**, y esta nota llevaba **24 rutas sin documentar**: la
> cadena de precio del ADR 0039 (rejilla, volumen, códigos, paquetes),
> captación, energía, el cuestionario de bienvenida, el reporte de
> rentabilidad y los códigos de recuperación del ADR 0028. El título seguía
> diciendo 100. Lista sacada de `find apps/web/app/api -name route.ts`, con los
> verbos exportados y el guard **leído en cada archivo**; las 24 van en sus
> secciones, marcadas «(05/10)».

> [!warning] El host **no** es parte de la API — no lo cablees
> Esta nota decía `https://demo.space-os.io/spaces-dooh/api/...` como si hubiera
> un dominio canónico. Desde el ADR 0022 **cada owner corre su instancia en su
> propio dominio**, y el PADRE sirve `space-os.io` y `demo.space-os.io` desde el
> mismo nginx (`infra/nginx/space-os.io.conf:133` y `:213`; el mismo archivo
> sirve además `prueba.space-os.io` y `spaceos.space-os.io`, `:288` y `:374`,
> verificado el 05/10). Lo único estable de
> una instalación a otra es el `basePath`.

## Cómo leer la columna Guard

| Guard | Qué exige | Definido en |
|---|---|---|
| `PÚBLICO` | Nada. Se auto-protege por token o es bootstrap de sesión. | — |
| `exigir` | Sesión válida + (opcional) permiso `modulo/accion` | `lib/server/auth.ts:183-243` |
| `usuarioActual` | Sesión, **sin** el corte de `debe_cambiar_password` ni el de los códigos de recuperación | `lib/server/auth.ts:124-140` |
| `DESBLOQ` | Además, desbloqueo vigente si el tenant lo exige | `exigirDesbloqueo()`, `lib/server/cambios.ts:275-286` |
| `REAUTH` | Además, desbloqueo **siempre**, ignore el interruptor del tenant | `exigirReautenticacionSiempre()`, `lib/server/cambios.ts:301-306` |
| `SENSIBLE` | `exigir(modulo,accion)` + `exigirDesbloqueo()` juntos | `exigirCambioSensible()`, `lib/server/cambios.ts:316-326` |

> [!important] Los dos borrados de catálogo son **REAUTH**, no SENSIBLE
> `DELETE /api/clientes/[id]` y `DELETE /api/arrendadores/[id]` piden la
> contraseña **siempre**, ignorando el interruptor `tenants.exigir_reautenticacion`.
> No es celo: `SENSIBLE` llama a `exigirDesbloqueo()`, que **deja pasar sin pedir
> nada** cuando el interruptor está apagado — como está por defecto y como está
> en los cinco tenants de producción (`cambios.ts:278`). El de arrendadores era
> `SENSIBLE` hasta `ba6fb09` (26/08): decía que pedía la contraseña y no la pedía.
> Mismo criterio que `/api/usuarios/[id]/restablecer`.

> [!info] El middleware NO valida la sesión
> `apps/web/middleware.ts:176` solo comprueba que **exista** la cookie
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
| GET·POST | `/api/auth/reset` | PÚBLICO | GET valida token, POST aplica. Desde el 06/10 **no** lo apaga `NEXT_PUBLIC_RECUPERAR_PASSWORD` (ADR 0044) |
| GET | `/api/auth/google/inicio` | PÚBLICO | 302 a Google; 503 si apagado |
| GET | `/api/auth/google/callback` | PÚBLICO | Canjea código, abre sesión |
| POST | `/api/signup` | PÚBLICO | 503 salvo `AUTOREGISTRO=1` (fail-closed desde el 14/08; se lee al arrancar, no en el build) |
| POST | `/api/bootstrap` | PÚBLICO | **De un solo uso.** 404 —nunca 401— si falta `BOOTSTRAP_TOKEN`, si no coincide, si `tenants` ya tiene algo o si se pasa de 10/h por IP. 201 solo con los tres cerrojos abiertos |
| POST | `/api/auth/codigo` | PÚBLICO | (05/10) Entrar con un **código de recuperación** (ADR 0028). Sin correo: el código identifica al usuario. **5/15min por IP**, más estricto que el login; la sesión se abre como `password`, no `google`. No está en la lista de exentos de CSRF, pero quien llega aquí no trae cookie de sesión y el middleware solo exige CSRF si la hay (`middleware.ts:134-135`) |
| PATCH | `/api/perfil` | usuarioActual | Exige `passwordActual` |
| POST | `/api/perfil/codigos-recuperacion` | usuarioActual; el **segundo** lote, además **REAUTH** | (05/10) Genera el lote y lo devuelve en claro **una vez** (`no-store`); `?ya=1` confirma que se guardaron. Resuelve con `usuarioActual()` y no con `exigir()` porque es la **salida** del corte de `exigir()` (`auth.ts:230-237`). Regenerar invalida los anteriores y va por `exigirReautenticacionSiempre()` |
| GET | `/api/permisos` | exigir | |
| GET | `/api/admin/permisos-matriz` | exigir | |

## Usuarios y organización

| Método | Path | Guard | Nota |
|---|---|---|---|
| GET·POST | `/api/usuarios` | exigir | acepta `entraConGoogle` (sin contraseña) o `invitar` (06/10, ADR 0044: enlace de 72 h; vuelve en `invitacion.enlace` solo si el correo no salió) |
| PATCH·DELETE | `/api/usuarios/[id]` | exigir | |
| POST | `/api/usuarios/[id]/restablecer` | **REAUTH + DESBLOQ** | |
| GET·POST | `/api/tenants` | exigir | el admin acepta `entraConGoogle` |
| POST | `/api/tenant-activo` | exigir | Cambio de CRM del super-admin |
| PATCH | `/api/organizacion` | exigir | |
| GET·PATCH | `/api/config` | exigir | |
| GET·PUT | `/api/cambios` | exigir | Interruptor de reautenticación |
| POST·DELETE | `/api/cambios/desbloquear` | exigir | |
| GET | `/api/estado` | exigir | Devuelve **todo** el tenant |
| GET·POST | `/api/entidades` | `administracion:ver` · `:crear` | Razones sociales **PROPIAS** del owner (17/09). `?inactivas=1` |
| GET·PATCH·DELETE | `/api/entidades/[id]` | `administracion:ver` · `:crear` | `DELETE` es baja **lógica** (`activo = false`) |
| GET·POST | `/api/bienvenida` | `administracion:ver` · `:crear` | (05/10) El cuestionario de las razones sociales del owner: el `POST` crea filas en `entidades_fiscales` y `entidad_roles` (201). Va **después** del alta, nunca dentro del bootstrap de un solo uso — [[cuestionario-bienvenida]] |
| GET·PATCH | `/api/actualizaciones` | `administracion:ver` · `:aprobar` | ADR 0037 — el dueño ve la versión instalada/disponible y aprueba por **DIGEST**, nunca por nombre de versión; `PATCH` con un digest que ya no es el disponible da **409** (comprobado y escrito en el mismo `UPDATE`, ver [[infraestructura-servidor]]). El `GET` trae además `notasDisponibles`, las notas de la versión disponible **revalidadas** al leer (inválidas o de otra versión → `null`) — [[notas-de-version]] |
| GET | `/api/novedades` | sesión (`exigir()` sin módulo) | Las notas de la versión **instalada** (`SPACE_OS_VERSION`; `null` en desarrollo o sin versión) y la lista entera de `novedades.json`, para el diálogo de una vez por versión y la página **Novedades**. **Con sesión siempre**: la versión va tras token en `/api/version` (P6) — [[notas-de-version]] |

> [!warning] `/api/entidades` y `/api/razones-sociales` NO son lo mismo
> `/api/entidades` son las razones sociales **del owner** —quien **PAGA** la
> renta, compra los activos, tramita licencias o vende— y van por
> `administracion`, porque son la identidad fiscal del negocio.
> `/api/razones-sociales` (abajo, en Arrendadores) es la razón social **del
> arrendador**: quien me **COBRA**, y va por `arrendadores`. Detalle en
> [[entidades-fiscales]].
>
> Una de otra organización responde **404**, no 403: un 403 confirmaría que ese
> id existe en alguna parte.

> [!note] Alta con Google (ADR 0012 enmendado, 07/08)
> `POST /api/usuarios` y `POST /api/tenants` aceptan `entraConGoogle: true` y
> entonces **no se manda contraseña**: el servidor genera una con
> `passwordAleatoria()` que nadie ve, a través de `passwordDeAlta()`
> (`lib/server/auth.ts:72-89`, llamada en `usuarios-controller.ts:128` y
> `cuentas-controller.ts:121,141`; las citas anteriores —`:45,74` y `:31,77`—
> ya no apuntaban a nada, verificado el 05/10). Ambos rechazan el alta si Google no está
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
> (`lib/server/auth.ts:204-210`; el de los códigos de recuperación del ADR 0028,
en `:230-237`) y **no** puede condicionarse a que la ruta
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
| GET·POST | `/api/almacen` (GET acepta `?tipo=`, catálogo de `lib/almacen-tipos.ts`; desde 30/09) · POST `/api/almacen/[id]/movimiento` | exigir |
| POST | `/api/licencias` · PATCH·DELETE `/api/licencias/[id]` | exigir |
| PATCH | `/api/sitios/[id]/modalidades` | (05/10) **SENSIBLE** `inventario:crear` — tarifas por unidad de venta; ruta aparte porque `sitio_modalidades.tarifa_publicada` es el mismo dinero que `sitios.tarifa_publicada` |
| GET · PATCH | `/api/sitios/[id]/rejilla` | (05/10) `inventario:ver` · **SENSIBLE** `inventario:crear` — la rejilla franja×temporada de la pantalla, [[rejilla-franja-y-temporada]] |
| GET·POST | `/api/energia/consumos` | (05/10) `operaciones:ver` · `operaciones:crear` — [[energia-consumos]] |
| DELETE | `/api/energia/consumos/[id]` | (05/10) `operaciones:aprobar` |
| POST | `/api/energia/recibos` | (05/10) `operaciones:crear` — sube los PDF de CFE y **propone**, no guarda nada: el alta sigue siendo `POST /api/energia/consumos`. Pide `crear` aunque no escriba, porque lo que devuelve es el borrador de un alta — [[recibos-cfe-pdf]] |

## Arrendadores y contratos

| Método | Path | Guard |
|---|---|---|
| POST | `/api/arrendadores` | exigir |
| PATCH | `/api/arrendadores/[id]` | **SENSIBLE** |
| DELETE | `/api/arrendadores/[id]` | **REAUTH** + `arrendadores:aprobar` |
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
| DELETE | `/api/clientes/[id]` | **REAUTH** + `comercial:aprobar` |
| POST | `/api/propuestas` · PATCH `/api/propuestas/[id]` | exigir (`comercial:crear`). Desde `17fbd252` (01/10) el `POST` **recalcula la tarifa** de cada línea en el servidor; un precio distinto al centavo exige además `comercial:aprobar` del rol de la sesión, o 403 y no se guarda nada |
| POST · DELETE | `/api/propuestas/[id]/paquete` | (05/10) `comercial:crear` — aplicar o quitar un paquete cerrado; el cuerpo lleva **solo** `paqueteId`, el precio lo copia el servidor bajo RLS — [[paquete-cerrado]] |
| PATCH | `/api/propuestas/items/[id]` | exigir |
| POST | `/api/propuestas/[id]/generar-campana` | exigir |
| GET · POST · DELETE | `/api/propuestas/[id]/codigo` | `comercial:ver` (leer: estado del cupón y `puedeAprobarCodigo`, COD-03) · `comercial:crear` (aplicar —nace **PENDIENTE**; en una RECHAZADA la reactiva a BORRADOR— y quitar); ver [[codigo-promocional]] |
| POST | `/api/propuestas/[id]/codigo/decision` | `comercial:aprobar` — aprobar o rechazar (con motivo) el cupón PENDIENTE; `.strict()`; 409 si no está pendiente, 404 si es de otra organización (COD-03, 30/09) |
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
| GET · PUT | `/api/campanas/franja-programada` | `comercial:ver` · `comercial:aprobar` — la franja en que **se transmite** (PROG-01, 30/09), en bloque y atómico; ver [[rejilla-franja-y-temporada]] |
| POST | `/api/ordenes-compra` | exigir |
| GET·POST | `/api/captacion` | (05/10) `captacion:ver` · `captacion:crear` — [[captacion]] |
| GET·PATCH | `/api/captacion/[id]` | (05/10) `captacion:ver` · `captacion:crear` |
| POST | `/api/captacion/[id]/avances` | (05/10) `captacion:crear` |
| POST | `/api/captacion/[id]/decision` | (05/10) `captacion:aprobar` — el segundo clic contesta 409: solo una petición reclama el prospecto |

## Precios — la cadena del ADR 0039 (05/10)

Todo lo que escribe va por **SENSIBLE** (`exigirCambioSensible('precios',
'crear')`) y lo que lee por `exigir('precios', 'ver')`. El módulo `precios`
agrupa las cuatro pantallas en `lib/modulos.ts:77-83`.

| Método | Path | Guard | Nota |
|---|---|---|---|
| GET·POST | `/api/rejilla/franjas` | `precios:ver` · SENSIBLE | El `GET` trae el catálogo entero, franjas **y** temporadas — [[rejilla-franja-y-temporada]] |
| PATCH·DELETE | `/api/rejilla/franjas/[id]` | SENSIBLE | |
| POST | `/api/rejilla/temporadas` | SENSIBLE | **No hay `GET` propio**: sale por el de franjas. El solape de temporadas está prohibido |
| PATCH·DELETE | `/api/rejilla/temporadas/[id]` | SENSIBLE | |
| GET·POST | `/api/volumen/escalas` | `precios:ver` · SENSIBLE | [[descuento-por-volumen]] |
| PATCH·DELETE | `/api/volumen/escalas/[id]` | SENSIBLE | |
| GET·POST | `/api/codigos-promocionales` | `precios:ver` · SENSIBLE | [[codigo-promocional]] |
| PATCH·DELETE | `/api/codigos-promocionales/[id]` | SENSIBLE | |
| GET·POST | `/api/paquetes` | `precios:ver` · SENSIBLE | [[paquete-cerrado]] |
| PATCH·DELETE | `/api/paquetes/[id]` | SENSIBLE | |

> [!warning] El comentario de `propuestas/[id]/paquete/route.ts` dice otro módulo
> La cabecera de esa ruta afirma que crear un paquete vive en `/api/paquetes`
> «con `exigirCambioSensible('inventario', …)`». **El código dice `precios`**
> (`app/api/paquetes/route.ts`, verificado el 05/10). Manda el código; el
> comentario quedó del diseño anterior al módulo `precios`. No se corrige desde
> aquí: esta tarea no toca código.

## Operaciones e imprenta

| Método | Path | Guard |
|---|---|---|
| GET·POST | `/api/ot` | exigir |
| GET | `/api/ot/[id]` | exigir |
| POST | `/api/ot/[id]/cerrar` | exigir |
| PATCH | `/api/ot/[id]/costo` | exigirCambioSensible (`operaciones.costear`) |
| PATCH | `/api/ot/[id]/checklist` | exigir (`operaciones.crear`) — un punto por petición, 2026-09-30 |
| GET·POST | `/api/impresion` · PATCH `/api/impresion/[id]` | exigir |
| PATCH | `/api/impresion/[id]/prueba-color` | exigir |

## Finanzas

| Método | Path | Guard |
|---|---|---|
| POST | `/api/cobranzas/[id]/pagar` | **SENSIBLE** |
| POST | `/api/cobranzas/[id]/recordar` | exigir |
| GET | `/api/reportes/rentabilidad` | (05/10) `finanzas:ver` — el reporte ya agregado en el servidor (`?dimension=&granularidad=&desde=&hasta=`), para no derivarlo en el navegador desde `/api/estado` — [[reportes-rentabilidad]] |

## Notificaciones e integraciones

| Método | Path | Guard |
|---|---|---|
| GET | `/api/notificaciones/nuevas` | exigir |
| POST | `/api/notificaciones/[id]/leer` | exigir |
| POST | `/api/notificaciones/archivar-todas` | exigir |
| GET | `/api/integraciones` | exigir |

> [!warning] `leer-todas` no existe: se llama `archivar-todas`
> Esta tabla listó `POST /api/notificaciones/leer-todas` desde el 07/08 hasta el
> **27/08**, y esa ruta da **404** desde el 10/08 — verificado en producción ese
> mismo día ([[2026-08-10]]). La sustituyó `archivar-todas`, que además de marcar
> leída **archiva** (`app/api/notificaciones/archivar-todas/route.ts:8-11`); el
> cliente la llama en `apps/web/lib/data/estado-api.ts:102`. [[manual-tecnico-2026-09-15]]
> llevaba **trece días** señalando el error de esta nota sin que nadie lo
> arreglara: una discrepancia anotada en otra nota no se corrige sola.

## Flota

| Método | Path | Guard | Notas |
|---|---|---|---|
| GET | `/api/version` | PÚBLICO / token | Sin `x-flota-token` devuelve solo `{ok}`; con él, `version`, `ultimaMigracion`, `base`, `canal` y `uptime`. **503 si la base no contesta** — es el `SALUD_URL` de `infra/scripts/update.sh`, y la anterior (`/api/auth/metodos`) daba 200 con Postgres muerto |

> [!important] `/api/version` no dice **nada** del negocio del owner, a propósito
> Ni organizaciones, ni usuarios, ni una cifra. El panel de flota es de AS OOH y
> la instancia es del owner (ADR 0022): una ruta de telemetría es justo por donde
> esa promesa se erosiona sin que nadie lo note. La prueba afirma **las claves
> exactas** del cuerpo, así que una clave nueva la rompe en vez de colarse
> (`apps/web/app/api/version/route.ts:31-39`).

> [!note] `esElPanel()` y `tokenCoincide()` se mudaron a `lib/server/flota.ts`
> Nacieron dentro de `app/api/version/route.ts` (F6.1), cuando solo había una
> ruta que el panel consumía. Con `/api/tickets` (ADR 0038, abajo) llegó una
> segunda, y la alternativa era copiar una comparación en tiempo constante —la
> copia que diverge es justo la que nadie mira—. `version/route.ts` **no
> cambió de comportamiento**, solo de dónde importa la función; su prueba de
> claves exactas sigue intacta.

## Tickets de soporte (ADR 0038)

El dueño de una instancia escribe una incidencia desde Administración, y AS OOH
la ve y la contesta desde `/flota/tickets` en el PADRE. Toda la ruta vive en un
solo `route.ts` sin segmento `[id]`: el panel manda el `id` en el cuerpo del
`PATCH`.

| Método | Path | Guard | Notas |
|---|---|---|---|
| GET | `/api/tickets` | **Dos caminos** — ver el aviso de abajo | Con `x-flota-token` válido: PÚBLICO, y devuelve los tickets de **toda la instancia**. Sin él, o con uno inválido: `administracion:ver`, y devuelve solo los del tenant en sesión |
| POST | `/api/tickets` | `administracion:crear` | Abre un ticket para el tenant en sesión. Folio `TK-AAAA-NNNN` (ámbito `ticket` de `folios.ts`). `estado` no es un campo aceptado por el `.strict()` del controlador — nace `ABIERTO` siempre, nunca lo manda el cliente |
| PATCH | `/api/tickets` | PÚBLICO por `x-flota-token`, **sin camino de sesión** | Solo el panel. Responde (`respuesta`), mueve el `estado`, o las dos cosas — nunca una porque llegó la otra (ADR 0038: responder no es resolver). Sin token válido: 401 y nada se toca. **Un ticket `CERRADO` no se toca: 409** — ver el aviso de abajo |

> [!warning] Un ticket `CERRADO` ya no admite respuesta ni cambio de estado (409)
> El guard está en el `where` del propio `update`
> (`apps/web/lib/server/tickets-repo.ts`, `actualizarTicketDesdePanel`):
> `where id = $1 and estado <> 'CERRADO'`. Va ahí, y no en un `select` previo,
> porque una sola sentencia no deja ventana entre comprobar y escribir — el
> mismo criterio que `estatus <> 'PAGADO'` en `arrendadores-repo.ts`.
>
> **Cero filas dice dos cosas a la vez**, y no son la misma: si el ticket no
> existe, sigue siendo `404`; si existe y está cerrado, es `409` con su motivo.
> Para distinguirlas hay una lectura de diagnóstico que ocurre **después** y
> **solo** cuando el `update` no tocó nada: el camino feliz sigue costando una
> sola ida a la base.
>
> **`RESUELTO` no se bloquea, y es una decisión tomada.** «Resuelto» es una
> hipótesis de AS OOH, y el cliente puede volver con un «pues sigue pasando»;
> bloquearlo dejaría el panel sin forma de corregir una resolución prematura.
> `CERRADO` es el único de los cuatro que significa «esta conversación se
> acabó».
>
> El panel (`apps/flota/servidor.mjs`, `paginaTickets()`) **no pinta
> formulario** para un ticket cerrado y dice por qué. Eso no es una segunda
> cerradura —una pantalla no puede serlo—: es no invitar a nadie a escribir una
> respuesta que se va a perder. **Reabrir un ticket cerrado no existe hoy**: si
> hiciera falta, necesita un camino explícito, no quitar este guard.

> [!danger] El `GET` atraviesa TODOS los tenants a propósito cuando lo pide el panel — zona roja R2
> No es un descuido: es el diseño. `listarTicketsDeLaInstancia()` usa `qRaw`
> (`apps/web/lib/server/tickets-repo.ts:120-127`) — sin `app.tenant_id`, así que
> la RLS de `tickets` no corta— porque el panel de AS OOH pregunta por su
> bandeja de soporte completa, de cualquier organización. El orden en el `GET`
> importa: primero se comprueba `esElPanel(req)` y solo si es falso se pide
> sesión, porque el panel no tiene cookie que mandar
> (`apps/web/app/api/tickets/route.ts:65-87`). `esElPanel()` es fail-closed —sin
> `FLOTA_TOKEN` configurado nadie es el panel—, así que la cabecera no puede
> saltarse el guard de sesión: solo identifica a quien ya conocía el secreto.
> Está probado EN PAREJA a propósito: que el lado del cliente aísla y que el
> lado del panel atraviesa. Una sola de las dos pruebas no demuestra nada — un
> guard roto pasaría la primera. Si alguien "arregla" esto filtrando por tenant,
> rompe el panel de flota, no un bug.

> [!warning] Solo quien puede abrir Administración puede escribir un ticket
> `POST /api/tickets` exige `administracion:crear`. Un operario que encuentra un
> fallo montando una lona **no puede reportarlo** desde ahí: tendría que
> pedírselo a alguien con acceso a Administración. Es una limitación real de
> esta versión, no un permiso que falte configurar — el ADR 0038 la deja fuera
> a propósito.

> [!note] Nadie ha mirado la pantalla del cliente con un navegador
> `TicketsPanel.tsx` (`apps/web/components/demo/admin/`) pasa las pruebas
> unitarias y las e2e de la ruta, pero **no se verificó visualmente**. No se
> sabe si se ve bien, solo que la API que consume responde lo que promete.

## Públicos por token (sin sesión)

Estos **no** dependen de la cookie: la credencial es el token del enlace. Por eso
están exentos de CSRF (`middleware.ts:119-133`; `/api/bootstrap` entró en esa lista
el 26/08 y su cerrojo real es que `tenants` esté vacía, no el token).

| Método | Path | Credencial |
|---|---|---|
| GET | `/api/portal/[token]` | `campanas.portal_token` |
| GET·POST | `/api/firma/[token]` | token de firma del contrato |
| GET·POST | `/api/propuestas/publica/[id]` | `propuestas.token_publico` — con el cupón **PENDIENTE** (COD-03) el GET no lo trae ni en el JSON y su total va sin él; el POST acepta **sin** cupón y devuelve el uso |
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
