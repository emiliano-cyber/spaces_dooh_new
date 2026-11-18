---
tipo: modulo
estado: verificado
actualizado: 2026-11-18
tags: [frontend, publico, tokens, amarillo]
archivos:
  - apps/web/app/(app)/portal/[token]/
  - apps/web/app/(app)/firmar/[token]/
  - apps/web/app/(app)/p/[id]/
  - apps/web/app/(app)/m/ot/[id]/
  - apps/web/app/(app)/contrato/[id]/
  - apps/web/lib/server/portal-repo.ts
  - apps/web/middleware.ts
  - apps/web/components/demo/rejilla/AvisoFranjaCMS.tsx
  - apps/web/components/demo/propuestas/SeguimientoCampana.tsx
  - apps/web/lib/seguimiento-campana.ts
  - apps/web/components/demo/propuestas/FotosYUbicacionSitio.tsx
  - apps/web/lib/server/fotos-sitio-publico-controller.ts
---

# Páginas públicas (sin sesión)

> [!warning] ZONA AMARILLA
> Son las únicas páginas que ve alguien **de fuera de la organización**. Un fallo
> aquí filtra datos a un tercero, no a un compañero.

## Las cuatro puertas sin sesión

| Página | Credencial | API | Quién la abre |
|---|---|---|---|
| `/portal/[token]` | `campanas.portal_token` | `GET /api/portal/[token]` | El cliente anunciante |
| `/firmar/[token]` | token de firma | `GET·POST /api/firma/[token]` | El arrendador |
| `/p/[id]` | `propuestas.token_publico` | `GET·POST /api/propuestas/publica/[id]` | El cliente/agencia |
| `/m/ot/[id]` | — (**sesión**, sin chrome) | `/api/ot/[id]` | La cuadrilla en campo |

Más `/contrato/[id]` (vista interna del contrato) y `/propuesta`.

## Cómo se resuelve el tenant sin sesión

**Nunca desde el cliente.** Postgres lo deriva del token con
`portal_tenant_por_token()` y `propuesta_tenant_por_token()`
(`20260720_hard1_rls_todas_tablas.sql`). Ver [[multi-tenancy-y-rls]].

## Qué se expone, y qué no

`lib/server/portal-repo.ts:11-12`: el portal devuelve **solo** lo de esa
campaña — nada de otros clientes ni datos financieros.

> [!danger] Al añadir un campo al portal, comprueba que no arrastre precio
> El repo mapea con `rowToCampana`/`rowToReserva`/`rowToSitio`, que son las
> **mismas** funciones del lado interno. Añadir un campo interno a esos mapeos
> lo publica en el portal sin que nadie lo note.

## Exención de CSRF

Estas rutas están exentas del double-submit (`middleware.ts:119-133`) porque **no
dependen de la cookie de sesión**: la credencial es el token del enlace. Si
alguna empezara a leer la cookie, la exención se vuelve un agujero.

> [!warning] Desde F5.2 hay una exención más, y no es una página
> `/api/bootstrap` (`middleware.ts:133`) también está exenta: arranca una
> instancia recién aprovisionada, cuando la base está vacía y **todavía no
> existe ninguna sesión que proteger**. Su credencial es `BOOTSTRAP_TOKEN` y su
> cerrojo real es que la tabla `tenants` esté vacía. Cuenta como puerta sin
> sesión aunque no tenga página: si algún día `tenants` deja de estar vacía y el
> guard no lo comprueba, la exención se vuelve una puerta abierta.
> Ver [[modelo-instancias-soberanas]].

## La propuesta pública enseña la cadena de precio entera

> [!note] 2026-10-05 · lo que añadió el ADR 0039 a `/p/[id]`
> Desde finales de septiembre la cotización que ve el cliente
> (`app/(app)/p/[id]/page.tsx`) muestra, además de los ítems:
> - la **franja contratada** con su horario en cada línea (`:253-262`) y, si
>   alguna tiene franja, el aviso `AvisoFranjaCMS` (`:298-300`);
> - el **paquete cerrado** primero, como «precio del conjunto» y no como
>   descuento (`:338-357`);
> - el **descuento por volumen** con su porcentaje (`:363-366`);
> - el **código promocional con su nombre** (`:380-383`).
>
> Todo opcional en el tipo (`:16-72`): una propuesta sin nada de eso se pinta
> como antes. Ver [[rejilla-franja-y-temporada]], [[descuento-por-volumen]],
> [[codigo-promocional]] y [[paquete-cerrado]].

## Cuando la propuesta ya es campaña: el seguimiento

> [!note] 2026-11-17 · el rastreo «tipo Mercado Libre» en `/p/[id]`
> La página pide en paralelo la propuesta y `GET /api/propuestas/publica/[id]/seguimiento`
> y se pinta cuando llegan las dos. Con `hayCampana: true` va ARRIBA
> `SeguimientoCampana` (banner con el mensaje y la fecha clave, línea vertical de
> seis pasos con un solo `aria-current="step"`, lonas con «1 de 2 lonas impresas»
> y detalle plegable, anuncios con su estatus) y la propuesta se pliega debajo,
> montada solo al abrirla (el mapa oculto se dibuja roto). Con `hayCampana: false`
> o si el fetch falla, la página es la de siempre.
>
> - Los textos van por `cuenta.seguimiento.*` (es/en/it/pt); la regla de los pasos
>   es pura en `lib/seguimiento-campana.ts`.
> - **El nombre de la imprenta llega `null` por omisión** (solo lo enciende el
>   vendedor): sin nombre no se pinta ni «Imprime» ni hueco.
>   El interruptor está en la ficha interna de la propuesta, solo si ya tiene
>   campaña: `components/demo/propuestas/ImprentaVisibleCliente.tsx`
>   (`GET·PATCH /api/propuestas/[id]/imprenta-visible`; deshabilitado con su
>   nota si `puedeCambiar` es falso).
> - El banner de «al aire», «lista» y «terminó» se deriva de los PASOS, no de
>   `mensaje`: el servidor pone `mensaje = pasoActual`, que con la campaña
>   corriendo vale «finalizada».
> - Pruebas: `lib/i18n/pantallas-cuenta-shell.test.ts` (tres estados en cuatro
>   idiomas y lo que NO debe verse).

## Fotos y ubicación de cada pantalla

> [!note] 2026-11-18 · «Ver fotos y ubicación» en `/p/[id]` (FOTOS-UBIC)
> Cada renglón de sitios lleva el botón «Ver fotos y ubicación», que abre un
> cuadro con la galería de la pantalla (foto grande + miniaturas), la dirección,
> la zona, las coordenadas con enlace a Google Maps y un mapa chico. Las fotos
> se piden **al abrir** a `GET /api/propuestas/publica/[id]/sitios/[sitioId]`,
> con el mismo token de la liga: `/api/sitios/:id/media` exige sesión y **no se
> abrió**. La ruta solo responde sitios que son renglón de ESA propuesta, y solo
> ubicación y fotos (lista blanca en el controller). Un servidor anterior sin
> `items[].sitioId` no enseña el botón. Detalle en
> [[comercial-propuestas-campanas]].

## Marca en las páginas de cara al cliente

El portal y la hoja de firma pintan el **logo y el nombre de la organización que
presta el servicio**, no un nombre fijo (`docs/Registro_Cambios.md`, 06/08). Si
la organización no cargó logo, se quedan como estaban.

Se dejan fuera a propósito la **pantalla de acceso** y la de **consultar
propuesta por código**: ahí todavía no se sabe de qué organización es quien
mira, así que no hay logo correcto que poner.

El logo se sirve por `GET /api/logo/[token]` (público, token en
`config_negocio.logo_token`).

> [!note] La barra final del logo ya costó un redespliegue
> Commit `104c019`: *"la URL del logo termina en barra, o en el correo
> redirige"*. Ver [[entorno-y-despliegue]].

## Módulo móvil de OT

`/m/ot/[id]` va sin chrome para la cuadrilla. **Sí exige sesión** — no es
público, solo es una vista distinta.

> [!success] Retirado el 2026-08-27
> La pista archivada salió entera de `apps/web` — nueve rutas, ~2 700 líneas.
> Lo destapó la CSP en modo reporte: el `AuthProvider` **se ejecutaba en cada
> carga de página en producción**, pidiéndole una identidad a la máquina del
> visitante. `apps/web/lib/pista-archivada.test.ts` se pone roja si vuelve.
> Ver [[zonas-de-riesgo]] §A6.
>
> `OTMovil.tsx` era uno de ellos, y **no lo importaba nadie**: la página real
> `/m/ot/[id]` renderiza `OTVista`.

## Relacionadas
[[comercial-propuestas-campanas]] · [[arrendadores-y-contratos]] ·
[[multi-tenancy-y-rls]] · [[03-Frontend/_indice|Índice de Frontend]] ·
[[MOC-Proyecto]]
