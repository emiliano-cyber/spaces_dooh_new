# ADR 0047: Comercial negociación se construye encima de `prospectos`, y la ubicación la confirma la persona

- **Fecha:** 2026-10-22
- **Estado:** Aceptada. Las cuatro decisiones las tomó el dueño el 2026-10-21; la forma de la
  migración la aprobó ese mismo día, y el 22/10 pidió dejar el GPS pendiente.
- **Relacionado:** [ADR 0041](0041-google-maps-solo-donde-aporta-y-con-clave-en-tiempo-de-ejecucion.md)
  (Google Maps solo donde aporta; sigue en Propuesta y este ADR no lo acepta: toma su plan B y
  deja la puerta abierta a su plan A). [ADR 0030](0030-el-basemap-de-la-flota-no-lleva-clave.md)
  (el basemap sin clave).

## Contexto

«Comercial negociación» (`/comercial-opex`) era una maqueta desde el 30/09: sin base, sin API,
datos escritos en `lib/comercial-opex.ts`. El 21/10 el dueño pidió hacerla funcional, con
coordenadas correctas de cada lugar, notas adicionales, un campo de visibilidad (cercana, media o
lejana) y las medidas del área.

Ya existía **Captación** (CAP-01, `20260930_captacion.sql`): `prospectos` y su bitácora
`prospecto_avances`, con etapas, vendedor, aprobación y el filtro «el vendedor solo ve lo suyo».
Oculta del menú desde el 30/09, pero viva. La maqueta añadía lo que Captación no tenía: varios
contactos, ofertas de renta al dueño, competencia y la búsqueda de quién firma.

Sobre las coordenadas, dos hechos: los términos de Google Maps Platform **no dejan guardar más de
30 días** la latitud y longitud de su geocodificador (el `place_id` sí), y **ninguna instancia
tiene hoy clave de Google**.

## Decisión

1. **Encima de `prospectos`, no aparte.** Un espacio en negociación es un prospecto `PREDIO` o
   `PANTALLA`. Se le añaden columnas opcionales (tipo de espacio, búsqueda del responsable 1..5,
   visibilidad, ancho/alto/superficie, presupuesto, origen de la ubicación) y cuatro tablas
   hijas: `prospecto_contactos`, `prospecto_ofertas`, `prospecto_competencia` y
   `prospecto_notas`. La bitácora es UNA, la de Captación, que gana canal y contacto.
2. **El permiso es el de `captacion`.** Las rutas son `/api/captacion/[id]/…` y la regla de quién
   ve qué es la misma (`soloDe`): `comercial-opex` pasa al módulo `captacion` en `lib/modulos.ts`.
3. **Las notas son una lista con autor y fecha que solo crece**, y **las ofertas no se borran**:
   las dos con el `revoke` en la base, no solo sin ruta.
4. **La ubicación que se guarda es la que confirma la persona** en el mapa —con un clic o
   arrastrando el pin—, con su origen (`PIN` o `BUSCADOR`), quién la fijó y cuándo. El buscador
   solo propone un punto de partida.
5. **El buscador es Nominatim (OpenStreetMap), por el servidor**, mientras no haya clave de
   Google. Cada owner pondrá la suya cuando quiera; entonces se enchufa Google en el mismo
   contrato (fase 2, no construida).
6. **El GPS del teléfono queda pendiente** (dueño, 22/10). `GPS` está en el CHECK de la base para
   no necesitar otra migración, pero la API no lo acepta.

## Alternativas consideradas

**A · Tablas propias, aparte de Captación.** Más limpio por dentro: las etapas de «encontrar al
responsable» no se mezclan con las de venta. Se descartó a petición del dueño: duplicaba la
bitácora, que es justo lo que no conviene tener dos veces, y dejaba dos pantallas para lo mismo.

**B · Guardar tal cual lo que devuelve el buscador.** Lo más rápido. Con Google choca con sus
términos (30 días), y obligaría a cambiar el contrato el día que llegue la clave. Con la persona
confirmando el punto, el contrato es el mismo para los dos proveedores.

**C · Google desde el principio, con una clave central.** Descartado por lo mismo que el ADR 0030
y el 0041: una clave en el build la comparte toda la flota y no se restringe por dominio.

## Consecuencias

**Positivas**
- La pantalla guarda de verdad, sin una segunda bitácora ni un segundo sistema de permisos.
- Al aprobar un espacio en Captación, el predio nace con la ubicación que fijó el vendedor.
- Sin dependencias npm nuevas y sin tocar la CSP: el buscador va por el servidor y el mapa usa el
  basemap que ya estaba permitido.

**Negativas**
- **Dos ejes de etapa** en la misma fila: `etapa` (la venta) y `etapa_responsable` (quién firma).
  Se explican en la pantalla y en los comentarios de la migración.
- **El contacto del alta vive dos veces**: en el `jsonb` de `prospectos` (lo leen la regla de
  revisión y el alta del registro al aprobar) y como primer `prospecto_contactos`. Si se edita
  uno, el otro no cambia. Se asume para no tocar el flujo de aprobación de CAP-01.
- **Nominatim** encuentra peor las direcciones en México que Google y limita a una consulta por
  segundo en total. Se compensa con el pin manual; el ritmo se impone en el servidor.

**Implicaciones de seguridad**
- **Aislamiento:** las cuatro tablas con RLS forzada y FK compuesta `(prospecto_id, tenant_id)`:
  los chequeos de FK saltan la RLS, y una FK simple dejaría colgar un contacto de un prospecto de
  otra organización con el id equivocado. Probado en `lib/test/negociacion.e2e.test.ts`.
- **Autorización por recurso:** todas las rutas hijas bloquean el prospecto con `soloDe`; uno
  ajeno es 404, no 403. Un id que no es uuid, también 404.
- **Entrada:** esquemas `.strict()`; el autor de una nota, quien fija la ubicación y la versión de
  una oferta salen de la sesión o del servidor, nunca del cuerpo.
- **Salida a terceros:** al buscador solo sale el texto de la dirección buscada, recortado a 200
  letras, identificado como SPACE-OS. Con ritmo de 1/s global, 30 búsquedas por persona cada 10
  minutos y memoria de 24 h, para que nadie bloquee la IP del servidor.

## Cómo revertir

La migración solo agrega: la versión anterior funciona con ella puesta (no lee lo nuevo). Volver
a la maqueta es revertir los commits de NEG-01; los datos capturados se quedan en las tablas.
