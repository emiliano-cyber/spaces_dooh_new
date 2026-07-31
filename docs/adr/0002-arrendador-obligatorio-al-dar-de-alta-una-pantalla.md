# ADR 0002: Arrendador obligatorio al dar de alta una pantalla

- **Fecha:** 2026-07-29
- **Estado:** Aceptada

> Decisiones tomadas al aceptar (2026-07-29): (1) el alta **exige** elegir un
> arrendador existente, pero **no** exige capturar los términos del contrato;
> (2) la pantalla se crea igual y su contrato nace `INCOMPLETO`, marcando lo que
> falta; (3) aplica a las dos puertas que hoy esquivan el modelo —import masivo y
> alta manual—; (4) los datos fiscales se heredan del arrendador.

## Contexto

El modelo canónico del módulo es **Arrendador → Predio → Contrato → Pantallas**
(`docs/Reglas_Arrendadores.md:16`), con un alta unificada atómica que crea las
cuatro entidades juntas (`arrendadores-repo.ts:615`).

Hay tres puertas que crean pantallas y solo una respeta esa estructura:

| Entrada | Exigía arrendador | Creaba contrato |
|---|---|---|
| Alta unificada (`arrendadores-repo.ts:615`) | Sí | Sí |
| Alta manual (`sitios-repo.ts`, `crearSitio`) | **No** | **No** |
| Import masivo (`sitios-repo.ts`, `importarSitios`) | **No** | **No** |

Consecuencia observada en local: se cargaron 8 pantallas por Excel y las 8
quedaron con `arrendador_id` NULL y sin ninguna fila en
`contratos_arrendamiento`. No hay rastro de a quién se le paga la renta de un
espacio que ya está en el inventario y listo para venderse.

El ADR 0001 ya atacó este hueco, pero desde el otro extremo del ciclo: abre un
contrato `INCOMPLETO` cuando se **vende** una pantalla que no tiene ninguno. Eso
llega tarde. Entre el alta y la primera venta puede pasar cualquier cantidad de
tiempo, y durante todo ese periodo el inventario miente por omisión.

Restricción del esquema que condiciona toda la solución:
`contratos_arrendamiento.sitio_id` es `NOT NULL` con FK a `sitios`. **Un contrato
no puede existir antes que su pantalla.** Por tanto "no dejar dar de alta una
pantalla sin contrato" solo puede significar una de dos cosas: crear ambos en la
misma transacción, o bloquear la pantalla después de crearla.

Restricción del formato: ni `plantilla-sitios-set.xlsx` ni el CSV de ejemplo
tienen columna de propietario. Las 23 columnas de la plantilla son todas
características físicas y comerciales de la pantalla.

## Decisión

El alta de una pantalla **exige elegir un arrendador existente**. Sin él, la
operación se rechaza. Con él, la pantalla se crea y se le abre en la misma
transacción un contrato en estatus `INCOMPLETO`.

El contrato nace INCOMPLETO a propósito: ya sabe **de quién** es el espacio, pero
todavía no la vigencia ni el importe. El `CHECK contrato_completo_ck` exige
`arrendador_id`, `fecha_fin`, `monto_renta` y `periodicidad` para cualquier
estatus que afirme un acuerdo real, así que INCOMPLETO es el único estatus que
este alta puede producir sin inventar datos.

El arrendador es de **lote** en el import, no por fila: la plantilla no tiene
columna de propietario y un Excel de inventario se carga por origen. Mezclar
propietarios en un mismo archivo no es el caso de uso, y añadir la columna
obligaría a rehacer todas las plantillas ya distribuidas.

Los datos fiscales se heredan: si el arrendador tiene **una sola** razón social,
se ancla al contrato (`razon_social_id`). Con varias no se adivina —cuál factura
es decisión de quien captura— y con ninguna no hay nada que heredar; en ambos
casos queda NULL y pasa a formar parte de lo que falta por completar.

El arrendador se fija con un `UPDATE` explícito y **no** añadiendo `arrendador_id`
a la lista `COLS` de `sitios-repo.ts`. Esa lista la reutiliza
`actualizarSitioCompleto()` para la re-importación, que pisa todas sus columnas
con lo que traiga el Excel; como la plantilla no lleva propietario, meterlo ahí
borraría el arrendador en cada recarga del archivo. Es exactamente el fallo que
tenían las columnas de pausa legal y que se corrigió el mismo día.

A diferencia del ADR 0001, la creación **sí es bloqueante**: va dentro de la
transacción del alta y, si falla, la pantalla tampoco entra. El precedente no
bloqueante del ADR 0001 aplica a un registro derivado de una acción ya consumada
(la venta ya ocurrió); aquí el dato es un requisito de entrada, no una
consecuencia.

## Alternativas consideradas

**A. Exigir el contrato completo (arrendador, vigencia, importe, periodicidad) en
el alta.** Es la lectura literal de "no debería dejarme subir pantallas sin
contrato" y la garantía más fuerte: nada entra al inventario sin que se sepa lo
que cuesta. Se descarta porque obliga a rehacer la plantilla Excel con columnas
de renta y fechas, invalida todos los archivos ya distribuidos, y convierte una
carga masiva de inventario en una captura contractual fila por fila. Además choca
con el caso real de negociación en curso: se identifica el espacio y se carga
antes de cerrar los términos. La exigencia se queda en el dato que sí se conoce
con certeza en ese momento —de quién es el espacio— y el resto queda señalizado.

**B. Dejar que la pantalla se cree sin arrendador y solo marcarla con una
alerta.** Menor fricción y cero cambios en la UI de alta. Se descarta por lo
mismo que el ADR 0001 descartó su equivalente: el pendiente vive fuera de
Arrendadores y depende de que alguien mire las alertas. Además no resuelve el
problema de fondo, que es que `contratos_arrendamiento.sitio_id` necesita un
arrendador para que el contrato pueda existir.

**C. Crear la pantalla BLOQUEADA comercialmente hasta que tenga contrato activo.**
Impide vender sin contrato sin impedir cargar inventario. Se descarta como
mecanismo *principal* porque no aporta el dato que falta: una pantalla bloqueada
y sin arrendador sigue sin decir de quién es. Sigue siendo una buena capa
adicional y queda anotada como pendiente.

**D. Arrendador por fila en el Excel (columna `arrendador_rfc` o similar).** Más
expresivo y permite un archivo con varios propietarios. Se descarta por ahora
porque obliga a versionar la plantilla y a resolver el arrendador por RFC o
nombre con toda la ambigüedad que eso trae (homónimos, RFC ausente, alta
implícita de arrendadores desconocidos). El selector de lote cubre el caso real
con una fracción del riesgo. Si aparece la necesidad, la columna puede añadirse
después sin romper nada: bastaría con que tenga prioridad sobre el valor de lote.

## Consecuencias

**Positivas**

- El inventario deja de poder mentir por omisión: toda pantalla tiene propietario
  desde el minuto cero, no desde su primera venta.
- El pendiente aparece en Arrendadores, que es su módulo, y no en una alerta que
  hay que acordarse de mirar.
- El P&L deja de tener pantallas con costo de renta cero por ausencia de dato.

**Negativas**

- Fricción nueva en el alta: hace falta tener al menos un arrendador antes de
  poder cargar inventario. En una organización recién creada, el primer paso pasa
  a ser obligatoriamente dar de alta un arrendador.
- Se asume la misma deuda de datos que el ADR 0001: aparecerán contratos
  INCOMPLETO que nadie complete. El volumen ahora será mayor, porque el disparador
  es el alta y no la venta.
- **Las pantallas ya existentes sin contrato no se arreglan solas.** Este cambio
  actúa sobre altas nuevas. La carga retroactiva sigue pendiente de decidir, igual
  que quedó en el ADR 0001.
- Un import con el arrendador equivocado cuelga todo el archivo del propietario
  incorrecto. La corrección es por pantalla y a mano.

**Implicaciones de seguridad**

- *Superficie de ataque:* no se agrega ningún endpoint. Cambia la forma de entrada
  de `POST /api/sitios` y `POST /api/sitios/import`, ambos ya autenticados y
  sujetos a `comercial.crear`.
- *Autorización:* aparece un camino por el que un rol comercial provoca filas en
  Arrendadores, igual que ya ocurría en el ADR 0001. El contrato nace sin importe
  ni vigencia, así que no otorga capacidad financiera; completarlo sigue exigiendo
  el candado en modo ESTRICTO de `app/api/contratos/[id]/route.ts`.
- *Validación de entrada:* `arrendadorId` se valida en dos capas. Forma (uuid) en
  el schema de zod del controller; **pertenencia al tenant contra la BD** en
  `exigirArrendador()`, dentro de la transacción y con `app.tenant_id` ya fijado.
  Sin la segunda, un id de otra organización colgaría una pantalla de un
  arrendador ajeno. La RLS fail-closed hace que esa consulta no vea nada fuera del
  tenant, así que la comprobación de pertenencia es la propia consulta.
- *Aislamiento por tenant:* el `tenant_id` del contrato sale de `tenantActual()`,
  nunca de la petición.
- *Auditoría:* el import ya registra la acción en la bitácora; el contrato
  generado queda ligado al sitio creado en la misma transacción.

## Cómo revertir

El comportamiento se revierte quitando la llamada a `exigirArrendador()` en
`crearSitio()` e `importarSitios()`, y volviendo `arrendadorId` opcional en el
schema del controller. No hay migración de esquema que deshacer: este ADR no
cambia la base de datos, solo usa lo que el ADR 0001 ya añadió.

Los contratos generados son datos aislados y se pueden borrar con
`delete from contratos_arrendamiento where estatus = 'INCOMPLETO'` sin afectar
campañas, reservas ni facturas, porque `contratoActivo()` no los cuenta.
