# ADR 0041: Google Maps solo donde aporta, y con su clave en tiempo de ejecución

- **Fecha:** 2026-10-01
- **Estado:** Propuesta (pendiente del dueño)
- **Relacionado:** [ADR 0030](0030-el-basemap-de-la-flota-no-lleva-clave.md) — el basemap
  de la flota no lleva clave; este ADR **no lo reemplaza**, lo complementa.
  [ADR 0022](0022-instancia-dedicada-por-owner.md) — una imagen para toda la flota.

## Contexto

El dueño preguntó el 2026-10-01 si se puede usar la API de Google Maps «para Comercial OPEX y
para los mapas». Hechos medidos en el repositorio ese día:

- **Los mapas de hoy** son MapLibre GL 5 (`apps/web/package.json:24`) sobre **OpenFreeMap
  `positron`, sin clave** (`components/demo/MapView.tsx:61`), por decisión del ADR 0030.
  Salen en cinco pantallas: Comercial, Inicio, Propuestas, el detalle de propuesta y
  **`/p/[id]`, la propuesta pública que ve el cliente sin sesión**.
- **Comercial OPEX no tiene mapa todavía**: es una maqueta de prospección de arrendadores
  (`components/demo/comercial-opex/ComercialOpex.tsx:39`, «no hay formularios ni mapa»).
- **No hay geocodificación ni búsqueda de lugares en ninguna parte.** Las coordenadas llegan
  escritas a mano o por el CSV de carga masiva.
- **Una clave `NEXT_PUBLIC_*` no puede ser por instancia**: Next la mete en el artefacto al
  compilar, y toda la flota compartiría la misma (`MapView.tsx:68-75`, ADR 0030). Es la
  misma trampa que se corrigió con `AUTOREGISTRO`.
- **La CSP** solo deja hablar con los hosts de mapas actuales (`next.config.mjs:110`). Un
  host que falte no da error: el mapa sale en blanco (lo vigila `lib/entorno.test.ts`).

Lo que Google aporta y OpenFreeMap no: **buscar lugares y direcciones** (Places,
Geocoding), **Street View** para ver el predio sin ir, y un mapa base más conocido por el
usuario. Lo que cuesta: dinero por uso, una clave que custodiar y condiciones de uso más
estrictas.

## Decisión

Usaremos Google Maps Platform **solo en las pantallas donde aporta algo que el mapa actual
no puede dar**, y no como mapa base de toda la aplicación:

1. **Comercial OPEX** (prospección): buscador de lugares y direcciones, ficha del lugar y
   Street View del predio.
2. **El alta de pantallas y predios**: buscar la dirección para fijar el pin, en lugar de
   teclear la latitud y la longitud a mano.

**El basemap de las otras cinco pantallas se queda en OpenFreeMap** (ADR 0030 sigue en pie),
incluida la propuesta pública.

**La clave llega en tiempo de ejecución, por instancia**, nunca en el build:

- Una variable **de servidor** en el `.env` de cada instancia (`GOOGLE_MAPS_BROWSER_KEY`, sin
  `NEXT_PUBLIC_`) que la app entrega al navegador desde una ruta autenticada solo a quien
  abre esas pantallas.
- Cada clave restringida en Google Cloud **por referente HTTP** al dominio de su instancia y
  **por API** (solo Maps JavaScript, Places y Street View).
- **Sin clave, la función se apaga sola**: las pantallas funcionan como hoy y el buscador no
  aparece. Ninguna instancia queda rota por no tenerla.

## Alternativas consideradas

**A · Google Maps en toda la aplicación, sustituyendo a MapLibre.** Un solo proveedor y la
experiencia más conocida. Se descarta porque **pagaría cada carga de mapa de cada pantalla**,
incluida la liga pública que se manda a clientes y que no controla cuántas veces se abre.
Obliga además a reescribir `MapView.tsx` y sus pines, y a que **toda** pantalla con mapa
dependa de una clave: es justo lo que el ADR 0030 decidió evitar tras el fallo del 08/09.

**B · Seguir sin Google, con servicios libres** (Nominatim para direcciones, Mapillary para
fotos de calle). Gratis y sin clave. Se descarta como solución principal porque Nominatim
limita a una consulta por segundo, prohíbe el uso intensivo y en México encuentra peor las
direcciones, y Mapillary tiene huecos de cobertura justo fuera de las vialidades grandes, que
es donde están muchos predios. Sirve como **plan B** si no se quiere pagar Google.

**C · Una sola clave para toda la flota, en el build.** Lo más simple. Se descarta por lo
mismo que el ADR 0030: viajaría en el artefacto de todas las instancias, no se podría
restringir por dominio a cada una, y si se filtra hay que reconstruir y redistribuir la
imagen para cambiarla.

## Consecuencias

**Positivas**
- La prospección de OPEX puede encontrar lugares y ver el predio en Street View, que es lo
  que la hace útil en la calle.
- Dar de alta una pantalla deja de exigir teclear coordenadas.
- El gasto queda acotado a dos pantallas internas con sesión, no a cada visita de un cliente.

**Negativas**
- **Costo por uso** en la cuenta de facturación de Google Cloud de quien sea dueño de la
  clave. Hay una cuota gratuita mensual por servicio y el resto se cobra por cada mil
  llamadas. **Las cifras exactas no se verificaron**: hay que mirarlas en la página de precios
  de Google antes de aceptar, y poner un **tope de gasto** y alertas en la cuenta.
- **Dos proveedores de mapas** en la misma app, con dos estilos visuales.
- **Condiciones de uso de Google — verificar antes de construir:** según sus términos, lo que
  devuelven Places y Geocoding debe mostrarse sobre un mapa de Google, y **las coordenadas
  que dan no se pueden guardar para siempre** (solo el `place_id`; la latitud y longitud
  tienen límite de caché). Si se usara el buscador para rellenar `sitios.lat/lng` de forma
  permanente, habría que confirmar que lo permiten, o que el pin final lo fije la persona
  sobre el mapa. **Esto puede cambiar el diseño del punto 2 de la Decisión.**
- Hay que decidir **quién paga**: una cuenta de AS OOH para toda la flota o una por owner.

**Implicaciones de seguridad**
- **Superficie nueva:** el navegador habla con `maps.googleapis.com` y `maps.gstatic.com`;
  hay que añadirlos a la CSP (`connect-src`, `script-src`, `img-src`, `frame-src` si Street
  View va en iframe) **solo** lo necesario, en el mismo commit que la integración.
- **El script de Google corre en la página**: se carga solo en esas dos pantallas, no en el
  layout, para no meter código de un tercero en pantallas de dinero.
- **La clave del navegador es pública por diseño** (cualquiera la ve en el tráfico). Lo que
  la protege son las **restricciones por dominio y por API** en Google Cloud, y el tope de
  gasto. Vive en el `.env` de cada instancia, no en el repositorio ni en la imagen; la rota
  quien administra la cuenta de Google, sin reconstruir nada.
- **Datos que salen a Google:** las búsquedas que teclea el vendedor y la ubicación que se
  mira. No salen datos de clientes, precios ni contratos. Hay que decirlo en el aviso de
  privacidad si aplica.
- **Sin dependencia npm nueva obligatoria:** el cargador oficial de Google se puede usar sin
  paquete, o con `@googlemaps/js-api-loader` (mantenido por Google).
- **Auditoría:** Google registra el uso en su consola por clave; dentro de la app no hace
  falta registrar cada búsqueda.

## Cómo revertir

Quitar la clave del `.env` de una instancia la apaga ahí sin desplegar nada. Retirar la
integración es borrar el componente de búsqueda y Street View y las líneas de la CSP: no
toca la base ni el mapa base. **Es reversible en cualquier momento**, salvo una cosa: si se
llegaran a guardar coordenadas obtenidas de Google en `sitios`, quedarían en los datos aunque
se retire. Esa es una razón más para que el pin final lo fije la persona.
