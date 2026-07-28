# ADR 0001: Contrato de arrendamiento "incompleto" al generar la campaña

- **Fecha:** 2026-07-27
- **Estado:** Aceptada

> Decisiones tomadas al aceptar (2026-07-27): (1) se permite el contrato sin
> arrendador, con `CHECK` por estatus; (2) se hace **carga inicial retroactiva**
> para todo sitio que hoy no tenga contrato, no solo los ya vendidos; (3) el
> disparador es la generación de la campaña, no la aprobación de la propuesta.

## Contexto

Hoy, cuando se aprueba una propuesta y se genera la campaña
(`lib/server/campanas-repo.ts:446`, `generarCampanaDesdePropuesta`), el sistema crea
la campaña, sus reservas y actualiza el estatus comercial de los sitios. **No toca
`contratos_arrendamiento`.** El contrato con el propietario del espacio se captura
por separado, a mano, en el módulo de Arrendadores.

Consecuencia: se puede vender y facturar una pantalla sobre la que no existe
constancia de qué se le paga a su propietario. El P&L la reporta con costo de renta
cero, así que el margen de esa campaña sale inflado.

**Magnitud real en la base de datos actual:**

- 10 de 16 sitios no tienen ningún contrato de arrendamiento.
- 8 de esos 10 ya están comprometidos en reservas de campañas.
- **Los 10 tampoco tienen arrendador asignado** (`sitios.arrendador_id` es NULL),
  ni predio.

Restricciones del esquema vigente (`contratos_arrendamiento`):

- Son `NOT NULL`: `sitio_id`, `arrendador_id`, `fecha_inicio`, `fecha_fin`,
  `monto_renta`, `periodicidad`, `moneda`, `auto_renovable`, `estatus`, `tenant_id`.
- `estatus` es el enum `est_contrato`: `VIGENTE`, `POR_VENCER`, `VENCIDO`,
  `RENOVADO`, `CANCELADO`.
- El costo de renta del P&L solo cuenta contratos "activos" —
  `derive.ts:700`, `contratoActivo()` = `VIGENTE | POR_VENCER | RENOVADO`.

El bloqueador central es que **la columna `arrendador_id` es obligatoria y ninguno de
los sitios afectados tiene arrendador**. Sin resolver eso, no existe forma de
materializar un contrato incompleto para los casos que motivan el cambio.

Existe precedente en el sistema para generar registros derivados automáticamente:
cancelar un contrato genera una OT de retiro, y dar de alta una pantalla genera una
OT de montaje. Ese patrón es **no bloqueante**: si la generación derivada falla, la
acción principal se completa igual.

## Decisión

Añadiremos el estatus `INCOMPLETO` al enum `est_contrato` y, al generar la campaña
desde una propuesta aprobada, crearemos un contrato en ese estado para cada sitio de
la campaña que no tenga ya un contrato activo.

Para que el contrato incompleto pueda existir sin los datos que aún se desconocen,
relajaremos a `NULL` las columnas `arrendador_id`, `fecha_fin`, `monto_renta` y
`periodicidad`, y añadiremos un `CHECK` que exige que estén completas en cualquier
estatus distinto de `INCOMPLETO`:

```sql
alter type est_contrato add value 'INCOMPLETO';

alter table contratos_arrendamiento
  alter column arrendador_id drop not null,
  alter column fecha_fin     drop not null,
  alter column monto_renta   drop not null,
  alter column periodicidad  drop not null;

alter table contratos_arrendamiento add constraint contrato_completo_ck check (
  estatus = 'INCOMPLETO' or (
    arrendador_id is not null and fecha_fin is not null and
    monto_renta   is not null and periodicidad is not null
  )
);
```

La integridad no se pierde: se traslada del `NOT NULL` de columna a una regla por
estatus. Un contrato solo puede salir de `INCOMPLETO` cuando está completo.

`contratoActivo()` **no** incluirá `INCOMPLETO`, de modo que estos contratos no
aportan costo al P&L ni disparan las alertas de vencimiento. Su función es ser un
pendiente visible en Arrendadores, no un dato financiero.

El contrato nace **cubriendo el periodo vendido** (de la fecha de inicio a la de
fin del ítem de la propuesta), y si una venta posterior va más allá, el marcador
se estira. Un contrato REAL nunca se extiende solo: eso sería inventar los
términos pactados. Cuando lo vendido excede lo contratado —el caso grave, porque
comprometemos con el cliente un espacio sobre el que perderemos derechos— se
emite la alerta **«El contrato no cubre la campaña»**.

La creación será **no bloqueante**, siguiendo el precedente de las OT derivadas: si
falla, la campaña se genera igual y queda registrado el fallo.

## Alternativas consideradas

**A. Bloquear la generación de la campaña hasta que el sitio tenga arrendador y
contrato.** Es la opción más estricta y la que mejor garantiza el dato: nada se
vende sin saber qué cuesta. Se descarta porque hoy dejaría inoperante la operación
—10 de 16 sitios quedarían invendibles de inmediato— y porque castiga al equipo
comercial por un hueco que es del área de administración. Convierte un problema de
captura en un bloqueo de ventas.

**B. No crear contrato; generar una alerta o una tarea "falta contrato".** Es la
opción de menor impacto en el esquema, reutiliza el mecanismo de alertas que ya
existe y no toca la tabla de contratos. Se descarta porque el pendiente vive fuera
de Arrendadores: al entrar al módulo de contratos no se ve nada, hay que acordarse
de mirar las alertas. El pedido explícito es que **el contrato exista** en su
módulo, aunque le falte información.

**C. Crear el contrato incompleto contra un arrendador genérico "Por asignar".**
Evita tocar el `NOT NULL` y por tanto no requiere migración de esquema. Se descarta
porque ensucia el catálogo de arrendadores con una entidad falsa que luego aparece
en reportes, en el consolidado por razón social y en los pagos de renta; y porque
"sin arrendador" y "arrendador "Por asignar"" son indistinguibles para cualquier
consulta posterior. Un NULL explícito es más honesto que un centinela.

## Consecuencias

**Positivas**

- El hueco deja de ser invisible: entra por la puerta principal de Arrendadores en
  vez de depender de que alguien audite el P&L.
- El margen inflado queda señalizado en el momento en que se origina —al vender—, no
  meses después en la cobranza.
- La regla de integridad queda más expresiva que antes: hoy un contrato puede tener
  `monto_renta = 0` y pasar por completo; con el `CHECK` por estatus, "completo"
  pasa a ser un concepto explícito del esquema.

**Negativas**

- Se asume deuda de datos: aparecerán contratos incompletos que nadie complete, y
  sin un mecanismo de seguimiento se vuelven ruido. Hace falta decidir quién los
  cierra y en qué plazo.
- Los 10 sitios existentes sin contrato **no** se arreglan solos: este cambio actúa
  al generar campañas nuevas. Hay que decidir aparte si se hace una carga inicial
  retroactiva.
- Cuatro columnas dejan de ser `NOT NULL`. Todo el código que lee contratos debe
  tolerar nulos en `monto_renta`, `periodicidad`, `fecha_fin` y `arrendador_id`. Es
  el punto de mayor riesgo de regresión del cambio.
- `ALTER TYPE ... ADD VALUE` no se puede ejecutar dentro del mismo bloque
  transaccional que lo usa en PostgreSQL; la migración necesita dos pasos.

**Implicaciones de seguridad**

- *Superficie de ataque:* no se agrega ningún endpoint nuevo. La creación ocurre
  dentro de la transacción de `generarCampanaDesdePropuesta`, que ya está autenticada
  y sujeta a los permisos de propuestas. No hay entrada de datos del usuario en el
  contrato generado: todos sus campos salen del sitio y de la propuesta.
- *Autorización:* aparece un camino indirecto por el que un rol comercial (que puede
  aprobar propuestas) provoca la creación de filas en Arrendadores, un módulo que
  normalmente no le corresponde. El contrato nace vacío y sin importe, así que no
  otorga capacidad financiera. **Completar** un contrato incompleto sí fija
  `monto_renta`, y por eso exige el candado en modo ESTRICTO (`sinExenciones`),
  igual que cambiar los datos bancarios del arrendador: sin la exención del Dueño,
  para que una sesión suya desatendida no pueda comprometer una renta sin
  reconfirmar la contraseña. Implementado en `app/api/contratos/[id]/route.ts`,
  que consulta el estatus previo para decidir el nivel de candado antes de editar.
- *Datos sensibles:* no se almacena información nueva. Los contratos incompletos
  contienen menos datos financieros que uno normal, no más.
- *Aislamiento por tenant:* las filas se insertan dentro de la transacción que ya
  fija `app.tenant_id` (`fijarTenant`), heredando la RLS fail-closed. El `tenant_id`
  debe tomarse de la misma fuente que la campaña, nunca de la petición.
- *Dependencias:* ninguna nueva.
- *Auditoría:* debe quedar registrado en la bitácora quién y qué generó cada contrato
  incompleto, para distinguir los automáticos de los capturados a mano. Sin eso, el
  origen del registro se pierde.

## Cómo revertir

Los contratos incompletos son datos nuevos y aislados: se pueden borrar con
`delete from contratos_arrendamiento where estatus = 'INCOMPLETO'` sin afectar
campañas, reservas ni facturas, porque no participan en ningún cálculo.

Lo que **no** es trivial de revertir es la relajación de los `NOT NULL`. Volver a
imponerlos exige que ninguna fila tenga nulos en esas columnas, así que primero hay
que completar o borrar todo contrato incompleto. Y `ALTER TYPE ... DROP VALUE` no
existe en PostgreSQL: quitar `INCOMPLETO` del enum obliga a recrear el tipo y
reescribir la columna. En la práctica, el valor del enum es permanente.

Revertir el comportamiento (dejar de crear contratos al generar campañas) sí es
inmediato: es una condición en `generarCampanaDesdePropuesta`.
