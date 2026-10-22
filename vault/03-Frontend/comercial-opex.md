---
tipo: modulo
estado: verificado
actualizado: 2026-10-22
tags: [frontend, comercial, prospeccion, arrendadores, negociacion, ubicacion]
archivos:
  - apps/web/app/(app)/(shell)/comercial-opex/page.tsx
  - apps/web/components/demo/comercial-opex/ComercialOpex.tsx
  - apps/web/components/demo/comercial-opex/SelectorUbicacion.tsx
  - apps/web/lib/comercial-opex.ts
  - apps/web/lib/comercial-opex.test.ts
  - apps/web/lib/negociacion.ts
  - apps/web/lib/negociacion.test.ts
  - apps/web/lib/server/negociacion-repo.ts
  - apps/web/lib/server/negociacion-controller.ts
  - apps/web/lib/server/geo-buscar.ts
  - apps/web/lib/server/geo-buscar.test.ts
  - apps/web/lib/data/captacion-api.ts
  - apps/web/app/api/captacion/[id]/ficha/route.ts
  - apps/web/app/api/captacion/[id]/contactos/route.ts
  - apps/web/app/api/captacion/[id]/ofertas/route.ts
  - apps/web/app/api/captacion/[id]/competencia/route.ts
  - apps/web/app/api/captacion/[id]/notas/route.ts
  - apps/web/app/api/geo/buscar/route.ts
  - apps/web/lib/test/negociacion.e2e.test.ts
  - db/migrations/20261022_comercial_negociacion.sql
  - docs/adr/0047-comercial-negociacion-encima-de-prospectos.md
  - apps/web/components/demo/shell/nav.ts
  - apps/web/lib/modulos.ts
---

# Comercial negociación · prospección de arrendadores (NEG-01)

> [!success] 2026-10-22 · deja de ser maqueta — NEG-01
> Pedido del dueño el 21/10: *«en comercial negociación ya debemos empezarlo a hacer
> funcional creando sus tablas»*, con coordenadas correctas de cada lugar, notas
> adicionales, visibilidad **cercana, media o lejana** y las medidas del área. Las
> cuatro decisiones de diseño las tomó él ese día —están en el
> **[ADR 0047](../../docs/adr/0047-comercial-negociacion-encima-de-prospectos.md)**— y
> el 22/10 pidió **dejar el GPS pendiente**.
>
> - **Encima de [[02-Backend/captacion]]**, no aparte: un espacio es un prospecto
>   `PREDIO` o `PANTALLA`. Una sola bitácora.
> - Migración `20261022_comercial_negociacion.sql` (ver [[04-Datos/migraciones]]), solo
>   agrega: columnas en `prospectos`, canal y contacto en `prospecto_avances`, y
>   cuatro tablas (ver [[04-Datos/esquema]]).
> - **42 e2e** en `lib/test/negociacion.e2e.test.ts`, en verde en el CI contra
>   Postgres real (run `39698089041`), y **33 unitarias** nuevas.
> - **No se abrió en un navegador con datos**: en esta máquina no hay Postgres. El
>   build de producción compila la pantalla; la revisión visual queda para DEMO.

## Qué contesta

**Quién manda en un espacio que todavía no es nuestro, y cómo va su renta.**

El producto empieza cuando el espacio **ya es tuyo**: [[inventario-y-sitios]] →
[[arrendadores-y-contratos]]. Esto es lo de antes: un muro, una azotea o un terreno
que estás persiguiendo, al que le estás **buscando el dueño**. Por eso no vive en
`sitios`: un prospecto no es un sitio todavía, y meterlo ahí lo sacaría en el
inventario, en el mapa de pantallas y en los reportes como si lo tuvieras. Cuando se
cierra, se **aprueba** en Captación y entonces nace el predio, con la ubicación que
fijó el vendedor.

## La pantalla

La forma de la maqueta, ahora con datos: las cuatro cifras arriba (en seguimiento,
en negociación, activos, sin contacto +30 días), a la izquierda la lista de espacios
(`GET /api/captacion?tipos=PREDIO,PANTALLA`) con **Nuevo espacio**, y a la derecha
el detalle del elegido:

| Bloque | Qué guarda | Ruta |
|---|---|---|
| Búsqueda del responsable | La etapa 1..5, con un clic en la barra de pasos | `PATCH …/ficha` |
| Ficha técnica | Tipo de espacio, **visibilidad**, ancho, alto (el área se calcula), superficie, renta autorizada mín/máx y quién autoriza | `PATCH …/ficha` |
| Ubicación | Buscar la dirección → elegir un candidato → afinar el pin → guardar | `GET /api/geo/buscar` + `PATCH …/ficha` |
| Responsables y contactos | Varios; «Firma» marca a quien firma | `…/contactos` |
| Ofertas de renta al arrendador | v1, v2…: renta, plazo, estado y notas | `…/ofertas` |
| Competencia | Quién más ofrece y desde cuándo | `…/competencia` |
| Historial | La bitácora de Captación, con canal y con quién se habló | `…/avances` |
| Notas adicionales | Lista con autor y fecha; no se editan ni se borran | `…/notas` |

Estado del espacio = etapa de venta: `APROBADO` → **activo**, `PERDIDO` →
**inactivo**, el resto → **en negociación** (`estadoEspacio()`).

**Qué se puede tocar según la etapa** (`motivoEdicion()`, la usa la pantalla para
no ofrecerlo y el servidor con la fila bloqueada): perdido solo admite notas; en
revisión no se mueve la ficha (ni la ubicación, que es la que se usa al crear el
predio); un activo sigue admitiendo contactos y ofertas.

## Las cinco etapas de la búsqueda del responsable

Son otro eje que la etapa de venta: no son de vender, son de **averiguar a quién hay
que convencer**.

1. Sin contacto · 2. Vecinos o intermediarios · 3. Dueño identificado ·
4. En contacto con el dueño · 5. **Responsable legal confirmado** ← quien firma

La 5 **exige un contacto marcado como quien firma** (`motivoEtapaResponsable()`), y
al único que firma no se le quita la firma ni se le borra mientras el espacio siga en
5 (`motivoQuitarLegal()`). Las dos reglas corren en el servidor con el prospecto
bloqueado, así que dos pestañas no pueden dejarla mintiendo entre las dos. Cada
cambio de etapa deja su línea en la bitácora.

## La ubicación: la confirma la persona

- **El buscador** (`lib/server/geo-buscar.ts`) pregunta a **Nominatim**
  (OpenStreetMap) **por el servidor**: su política pide una consulta por segundo en
  total y que la aplicación se identifique, y eso solo se puede garantizar en un
  punto. Además así no se abre la CSP a ningún host. Topes: 1/s global, 30 por
  persona cada 10 min, memoria de 24 h; un fallo es un 502 con frase y no se guarda.
  Configurable por instancia: `GEO_BUSCADOR_URL`, `GEO_BUSCADOR_PAISES` (por omisión
  `mx`), `GEO_BUSCADOR_CONTACTO`.
- **El mapa** (`SelectorUbicacion.tsx`) es MapLibre con el basemap sin clave del ADR
  0030. Un clic pone el pin y se arrastra para afinarlo.
- **Lo que se guarda** es el punto que deja la persona, con `ubicacion_origen`
  (`PIN` o `BUSCADOR`), quién lo fijó y cuándo. Es el contrato que exigen los términos
  de Google (no guardar más de 30 días sus coordenadas), pensado para el día que un
  owner ponga su clave: entonces Google entra en este mismo contrato (fase 2, [[01-Arquitectura/decisiones|ADR 0041]]).
- **El (0,0) se rechaza** (`puntoUtil`, `lib/coordenadas.ts`).

> [!warning] El GPS del teléfono está PENDIENTE (dueño, 22/10)
> `GPS` está en el CHECK de `prospectos.ubicacion_origen` —y la columna
> `ubicacion_precision_m` existe— para no necesitar otra migración, pero **la API no
> lo acepta** (`ORIGENES_UBICACION` en `lib/negociacion.ts`) y el mapa no lleva el
> botón de «mi ubicación»: un botón que te centra sin guardar nada se confundiría con
> él. La e2e lo fija: un origen `GPS` es 400.

## Lo que aquí se CALCULA, con pruebas

En `lib/comercial-opex.ts` (las cuentas de la pantalla) y `lib/negociacion.ts` (las
reglas que también aplica el servidor), **no en el `.tsx`**: el arnés no monta DOM, y
en la semana del 28/09 tres mutantes que borraban avisos del reporte sobrevivieron
por eso. Ver [[reportes-dimensiones]].

- **`diasSinContacto()`** — sale de `ultimoContactoEn` (el avance más reciente) y
  devuelve **`null`, no `0`**, cuando nunca se ha hablado. Es el mismo error del
  `?? 0` del mapa y de los kWh de los recibos de CFE.
- **`enfriados()`** — en negociación y con **más de** 30 días sin contacto. Un
  activo o un perdido no cuentan: un aviso que salta siempre deja de mirarse.
- **`areaM2()`** — ancho × alto con dos decimales; sin una de las dos, `null`.

## Y una trampa de nombres que conviene no repetir

Las **ofertas de renta** de esta pantalla NO son las [[comercial-propuestas-campanas|propuestas]]
del producto. Aquéllas son **a un cliente que compra publicidad**; éstas, **al dueño
del espacio**. Sentido contrario y dinero contrario: por eso `prospecto_ofertas` es
tabla propia. La versión la pone el servidor con el prospecto bloqueado (un índice
único es la red), el importe no se reescribe —se hace otra versión— y **no se
borran**: ni hay ruta, ni el rol de la base puede.

## Permisos

Módulo **`captacion`** desde NEG-01 (`lib/modulos.ts`, `apiPropia: true`). Antes era
`comercial` sin API; con eso la pantalla se habría abierto a quien no puede leer su
API. Los roles que la ven no cambian: Dueño, Administrador y los tres de venta. Lo
decisivo es `captacion.aprobar` —ver [[02-Backend/captacion]]—: sin él, el vendedor
trabaja solo **sus** espacios, y uno ajeno es **404** en todas las rutas hijas. Ver
[[02-Backend/roles-de-venta]].

## Lo que NO se hizo

- **El GPS** — pendiente, arriba.
- **Google como buscador** — espera a que cada owner ponga su clave (ADR 0041, P22 en
  [[preguntas-abiertas]]).
- **Fotos, video y documentos del espacio.** La maqueta los pintaba con datos de
  ejemplo; se quitaron hasta que haya dónde subirlos.
- **Convertir un espacio cerrado en predio desde aquí**: se aprueba en Captación, que
  ya lo hace.
- **Captación sigue fuera del menú** (`nav.ts`); es la misma base, vista como lista de
  aprobación.

## Historia: la maqueta (30/09 – 21/10)

Se pidió el 30/09 como *«solo html sin funciones»* y *«el mapa ese no lo añadas»*, y
ese día se acomodó en dos columnas con capturas reales. Dos lecciones de entonces que
siguen vigentes en el componente: **`preflight` de Tailwind está desactivado**
(`tailwind.config.ts:24`), así que toda lista lleva `LISTA` o sale con viñetas del
navegador; e **`iniciales()`** quita el tratamiento y se queda con letras («C(» para
«Sra. Carmen (vecina 1418)» fue el primer error).
