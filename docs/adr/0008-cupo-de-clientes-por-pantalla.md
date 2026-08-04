# ADR 0008: Cupo de clientes por pantalla, además de los slots

- **Fecha:** 2026-08-04
- **Estado:** Aceptada

> Aprobada e implementada el 2026-08-04. Se ejecutaron los siete puntos de la
> decisión. **Orden de despliegue obligatorio:** primero la migración
> `db/migrations/20260804_cupo_clientes_pantalla.sql` en el droplet (como
> `postgres`), después el código. Al revés, `reservar()` y el listado de
> inventario fallan: las dos consultas leen columnas que aún no existirían.

## Contexto

Hoy una pantalla se valida por **un solo eje**, y ese eje depende del tipo de medio:

| Medio | Regla | Dónde |
|---|---|---|
| Digital (`tipo_medio = 'PANTALLA_DIGITAL'`) | Ocupación = `count(distinct campana_id)` de reservas no canceladas, contra `sitios.total_spots` | `lib/server/campanas-repo.ts:366-382` |
| Estática (espectacular, etc.) | Exclusividad por **solape de fechas**: dos reservas activas no pueden traslaparse | `lib/server/campanas-repo.ts:346-364` |
| Lectura / disponibilidad | `spotsDisponibles = total_spots − nº de campañas con reserva no cancelada` | `lib/server/sitios-repo.ts:176-177`, `186-192` |
| Alta de inventario | Toda digital nueva nace con **12 slots forzados**, ignorando lo que traiga la importación | `lib/server/sitios-repo.ts:126-129` |

La regla vigente se resume en *"1 slot = 1 campaña"*, y está escrita así en cinco
lugares del UI (`SlotsBadge.tsx:6`, `StatusBadge.tsx:104-116`,
`comercial/page.tsx:309-319`, `disponibilidad/page.tsx:197-198`,
`SiteFicha.tsx:371-373`).

Lo que **no** existe es un límite de *cuántos anunciantes distintos* comparten una
pantalla. Una pantalla de 12 slots puede terminar con 12 clientes distintos, que es
una decisión comercial que hoy nadie puede expresar en el sistema. Ese es el hueco
que cierra este ADR.

### Cuatro hechos del código que condicionan el diseño

**1. El conteo digital no mira fechas.** Ni el guard de reserva
(`campanas-repo.ts:369-377`) ni la lectura de disponibilidad
(`sitios-repo.ts:176-177`) filtran por periodo: cuentan **toda** reserva no
cancelada desde el principio de los tiempos. Una campaña terminada en 2024 sigue
ocupando su slot para siempre. La validación de estáticas sí usa fechas
(`campanas-repo.ts:354-357`), así que el sistema ya se contradice a sí mismo. Una
regla nueva que copie el patrón digital hereda el defecto y envejece igual.

**2. `spots_reservados` se guarda pero no valida nada.** El diálogo de reserva
permite elegir cuántos spots tomar por pantalla (`ReservaDialog.tsx:79-81`), se
persisten en `reservas.spots_reservados` (`campanas-repo.ts:398-401`) y se devuelven
al barrer tentativas vencidas (`campanas-repo.ts:206-219`), pero la validación real
sigue siendo el conteo de campañas: una campaña que pide 6 spots ocupa exactamente
lo mismo que una que pide 1. El campo es informativo.

**3. Reservar desde Comercial crea un cliente nuevo cada vez.** `campanas-repo.ts:291-295`
hace `insert into clientes (nombre, tenant_id)` sin buscar antes si ese cliente ya
existe. Reservar tres veces para «Telcel» deja tres filas en `clientes`. **Cualquier
regla que cuente clientes distintos cuenta duplicados**: el cupo se llenaría con un
solo anunciante que compró tres veces.

**4. Propuestas no valida disponibilidad.** `lib/server/propuestas-repo.ts` no
menciona slots ni ocupación: una propuesta se aprueba sobre una pantalla llena y el
choque aparece hasta que se genera la campaña (`reservar()`). Una regla nueva
aplicada solo en la reserva mueve el problema, no lo elimina.

### Restricciones del entorno

- Postgres con RLS por `tenant_id` en `sitios`, `campanas`, `clientes` y `reservas`
  (`db/schema.sql:580-600`). La policy es **permisiva cuando `app.tenant_id` no está
  fijado**, así que todo conteo nuevo debe correr dentro de una transacción con
  `fijarTenant()` (`lib/server/db.ts:39-41`), como ya hace `reservar()`.
- `reservar()` es la **única** puerta de escritura de reservas y ya serializa por
  pantalla con `select … for update` (`campanas-repo.ts:328-333`). Hay un solo punto
  donde poner el guard, y ya es atómico.
- El despliegue a producción es manual por SSH al droplet y las migraciones se corren
  como `postgres`: cualquier columna nueva es un paso operativo, no automático.

## Decisión

**Se añade un segundo eje de validación —el cupo de clientes por pantalla— que
convive con los slots; ninguno sustituye al otro. Y ambos conteos pasan a contar solo
reservas cuyo periodo se solapa con el que se está vendiendo.**

Concretamente:

**1. Modelo.** Columna `sitios.max_clientes integer null` (límite por pantalla) y
ajuste `config_negocio.max_clientes_pantalla integer null` (default para pantallas
nuevas y para las que no tengan valor propio). `null` en ambos = **sin límite**.

**2. La regla nace desactivada.** La migración deja las dos columnas en `null`, así
que desplegarla no bloquea ninguna venta en curso. El cupo empieza a aplicar cuando
alguien lo captura, y se puede apagar poniéndolo en `null` otra vez.

**3. Guard en la reserva.** Dentro de la transacción de `reservar()`, después del
guard de contrato (ADR 0003) y junto al de slots: si el cliente de la campaña que se
está reservando **no** está ya presente en esa pantalla en fechas solapadas, y el
número de clientes distintos ya presentes alcanza el cupo, se rechaza con 409 y un
mensaje que nombra la pantalla y el cupo (`"P-014" ya tiene sus 4 clientes en esas
fechas (Telcel, Bimbo, Coca-Cola, Cinépolis)`). Un cliente que **ya** está en la
pantalla puede seguir metiendo campañas mientras le queden slots.

**4. Ventana temporal.** Los dos conteos —slots y clientes— pasan a filtrar por
solape (`r.fecha_inicio <= $fin and r.fecha_fin >= $inicio`), el mismo criterio que
ya usan las estáticas. En la lectura de inventario, donde no hay un periodo que
vender, el criterio es "vigentes hoy o a futuro" (`fecha_fin >= current_date`).

**5. Prerrequisito: deduplicar clientes.** `reservar()` deja de insertar un cliente
por nombre a ciegas: busca primero por nombre normalizado (trim + mayúsculas) dentro
del tenant y reutiliza el existente. Sin esto el cupo cuenta fantasmas (hecho 3).
Los duplicados ya creados quedan como están: fusionarlos es otro trabajo, con su
propio riesgo, y no bloquea esto.

**6. Superficie de UI.** El cupo se captura en la ficha de la pantalla
(`SiteFicha.tsx`, junto a "Cantidad de slots") y su default en Administración →
Configuración, junto a loop/spot. En la tarjeta de Comercial y en la ficha se muestra
un segundo indicador `clientes: 3/4` al lado de `SlotsBadge`; una pantalla con cupo
lleno deja de ser seleccionable para un cliente nuevo, con el motivo escrito.

**7. Propuestas: aviso, no bloqueo.** Al aprobar un ítem de propuesta se advierte si
la pantalla ya está en su cupo para esas fechas, pero no se impide: la propuesta es
una intención comercial y el inventario puede liberarse antes de cerrar. El bloqueo
duro sigue siendo el de la reserva.

## Alternativas consideradas

**A. Contar la ocupación por cliente en vez de por campaña (1 slot = 1 cliente).**
Sería más limpio conceptualmente: hoy un cliente que renueva tres veces consume tres
de doce slots, lo que castiga al anunciante fiel. Se descarta porque **cambia el
inventario ya vendido**: pantallas que hoy figuran llenas aparecerían con hueco al
desplegar, sin que nada haya cambiado en la calle, y el equipo comercial no tendría
forma de distinguir el hueco real del hueco contable. Además no expresa el límite que
se pidió: sigue sin haber manera de decir "esta pantalla no lleva más de cuatro
anunciantes".

**B. Tope de slots por cliente (anti-acaparamiento).** Ningún cliente toma más de N
slots de una misma pantalla. Resuelve un problema real —que un anunciante grande se
lleve la pantalla entera— pero es una pregunta distinta ("cuánto toma cada uno"), no
la que se planteó ("cuántos caben"). Se puede añadir después sobre el mismo punto de
validación, que queda preparado para ello.

**C. Exclusividad competitiva por giro.** Impedir que convivan dos clientes del mismo
rubro. Es la regla que de verdad usan los grandes operadores y probablemente sea el
destino final. Se descarta **ahora** por costo de datos: no existe catálogo de giros
ni clasificación de la cartera (`clientes` solo tiene `tipo` DIRECTO/AGENCIA,
`db/schema.sql:113`), así que habría que crear el catálogo y clasificar a mano todos
los clientes antes de que la regla sirviera de algo. El guard de este ADR es el mismo
sitio donde se enchufaría.

**D. No tocar el modelo: bajar `total_spots` a 4.** "Si no quieres más de cuatro
clientes, pon cuatro slots." Se descarta porque confunde la **capacidad técnica** del
loop con la **política comercial**: `total_spots` alimenta el cálculo de spots por
loop (`administracion/page.tsx:552-557`) y el inventario que se publica a DOOHmain.
Bajarlo mentiría sobre la pantalla y además impediría que un mismo cliente tomara
varios spots, que es justo lo que sí se quiere permitir.

## Consecuencias

**Positivas**

- El operador puede expresar una política comercial que hoy no cabe en el sistema, y
  se aplica en el único punto que escribe reservas: no hay forma de saltárselo desde
  el UI ni con un `curl`.
- El arreglo de fechas libera inventario que hoy está bloqueado por campañas
  terminadas, y elimina la contradicción entre el criterio digital y el estático.
- La regla nace en `null` (inactiva): el despliegue es seguro y el apagado es un
  `update`, no un rollback de código.
- Un cliente que ya está en la pantalla no se ve penalizado al renovar, que era el
  efecto perverso de contar por campaña.

**Negativas**

- **Dos ejes de rechazo.** Una pantalla puede rechazarse por slots o por cupo, y los
  mensajes tienen que decir cuál de los dos, o el comercial va a buscar en el lugar
  equivocado. Es exactamente el riesgo que ya documentó ADR 0003 con el contrato.
- **El arreglo de fechas cambia números a la vista.** Pantallas hoy marcadas "sin
  slots libres" volverán a estar disponibles. Es lo correcto, pero hay que avisarlo
  antes de desplegar o va a leerse como un bug.
- **La deduplicación de clientes cambia un comportamiento existente.** El alta rápida
  desde Comercial dejará de crear una ficha por reserva. Dos empresas distintas con
  el mismo nombre exacto quedarían fusionadas; se acota usando coincidencia exacta
  normalizada (nunca aproximada) dentro del tenant.
- **Migración manual en producción.** Dos columnas nuevas que hay que correr por SSH
  como `postgres` antes de publicar el código, con la ventana de despliegue que eso
  implica.
- Los duplicados de clientes ya existentes siguen ahí, y hasta que se limpien pueden
  inflar el conteo de una pantalla concreta. Es una deuda conocida, no un bloqueo.

**Implicaciones de seguridad**

- **Superficie de ataque:** no se agrega ninguna. No hay endpoint nuevo: el cupo se
  escribe por `PATCH /api/sitios/[id]` y `PATCH /api/config`, que ya exigen permiso
  (`inventario`/`administracion`) y ya validan con zod. Hay que añadir los dos campos
  a los esquemas y al mapa de columnas permitidas (`sitios-repo.ts:CAMPO_COL`), nunca
  aceptando columnas dinámicas.
- **Autorización:** el cupo es una regla de negocio, no un permiso. Quien puede editar
  una pantalla puede cambiar su cupo y con ello desbloquear una venta; por eso el
  cambio debe quedar en la bitácora (`registrarAccion`) igual que los demás cambios de
  inventario. Vale la pena evaluar si entra al guard de **cambio sensible**
  (`lib/server/cambios.ts`), como ya pasa con la renta: subir el cupo de 4 a 12 para
  colar una venta es el mismo tipo de gesto que subir un importe.
- **Aislamiento multi-tenant:** el conteo de clientes distintos cruza `reservas` ×
  `campanas` × `clientes`. La policy RLS es permisiva cuando `app.tenant_id` no está
  fijado (`db/schema.sql:596-598`), así que la consulta **debe** correr dentro de la
  transacción con `fijarTenant()` ya aplicado —como el resto de `reservar()`— o un
  contexto sin tenant contaría clientes de otro CRM. Es la única trampa real de esta
  decisión.
- **Fuga de información:** el mensaje de rechazo nombra a los clientes que ocupan la
  pantalla. Eso es información comercial sensible (quién anuncia dónde), pero se
  entrega a un usuario autenticado del mismo tenant que ya puede ver esas campañas en
  Comercial. No se expone en el portal público de campaña (`/portal/:token`), que no
  pasa por este código.
- **Secretos / datos personales:** ninguno nuevo. Las dos columnas son enteros.
- **Dependencias:** ninguna nueva. Solo SQL y zod, ya en el proyecto.
- **Auditoría:** queda registrado el cambio de cupo. El **rechazo** de una reserva por
  cupo no se registra hoy en ninguna parte (tampoco el de slots); si se quiere saber
  cuánta demanda se está rechazando, eso es trabajo aparte.

## Cómo revertir

En caliente: `update sitios set max_clientes = null` y vaciar el default global. La
regla queda inactiva sin tocar código ni desplegar, porque `null` ya significa "sin
límite".

En frío, a seis meses: quitar el guard de `reservar()` y las dos columnas. La
migración inversa es un `drop column` de dos enteros — sin pérdida de información de
negocio, porque el cupo es una política, no un hecho registrado.

Lo que **no** es reversible por esta vía es el filtro por fechas: una vez que el
sistema deja de contar campañas terminadas, volver atrás significaría volver a
bloquear inventario libre, y nadie va a querer hacerlo. Se considera corrección de un
defecto, no una opción de configuración.
