# ADR 0034: Multi-entidad es atribución, no aislamiento

- **Fecha:** 2026-09-18
- **Estado:** Aceptada — construida y fusionada en `main` con el PR #91 (`ac4f71c`)

## Contexto

La mayoría de los owners de publicidad exterior reparten su operación entre
varias razones sociales. Palabras del jefe de Jochelo el 2026-09-17:

> «Una empresa tipo [...] tiene: 1 razón social para pago de rentas, 1 para la
> compra de activos, 1 para trámites legales / licencias con gobierno, 1 o más
> para vender publicidad. Prácticamente la mayoría son multi entidad.»

El producto no guardaba **ninguna** razón social propia. Medido antes de decidir:

| Pieza | Estado al 17/09 |
|---|---|
| `tenants` | Solo `id, nombre, slug, moneda`. Cero datos fiscales |
| `arrendador_razon_social` | Existe, pero es la del **arrendador**: quién me cobra, no quién paga |
| `clientes.razon_social` / `facturas.razon_social` | Datos del **cliente** (receptor) |
| Emisor de un comprobante | **No existía campo en ninguna parte del esquema** |
| Alta de una organización | Pedía nombre + admin. Nada fiscal |

Plazo: **27 días** al lanzamiento del 14 de octubre.

## Decisión

Una tabla **`entidades_fiscales`** por tenant, una tabla de **roles** —porque una
entidad puede tener varios— y **`entidad_id` nullable** en los puntos donde el
dinero cambia de dueño: `contratos_arrendamiento.entidad_id` (quién paga la
renta) y `facturas.entidad_emisora_id` (quién emite el comprobante).

**`entidad_id` NO es una frontera de seguridad. La única sigue siendo
`tenant_id`, con RLS.**

Esa frase es la decisión, no un adorno. Lo que el owner pide no es separar sus
razones sociales: es **verlas juntas**. Quiere el reporte consolidado *y* el
desglose por entidad. Eso es atribución dentro de un tenant, no aislamiento
entre tenants.

## Alternativas consideradas

**A · Un tenant por razón social.** Reusaba el aislamiento que ya existe y
funciona, con costo de código casi cero. **Se descarta porque rompe el
requisito:** un sitio que la entidad de arrendamientos renta y la de ventas
comercializa tendría que existir dos veces, y el reporte consolidado sería
imposible por diseño — cruzar tenants es justo lo que la RLS prohíbe. Además un
usuario pertenece a un solo tenant: solo el Dueño de la plataforma cambia de CRM.

**B · Lanzar mono-entidad y migrar después.** Menos trabajo ahora. **Se descarta
porque el costo se dispara con datos reales:** rellenar `entidad_id` en facturas
históricas de un cliente es una corrección de datos en producción con rollback
capturado, y ya hay una instancia con datos reales de cliente. Hoy cuesta cinco
columnas nullable; en enero cuesta un expediente.

**C · Un `jsonb` de razones sociales en `config_negocio`.** Rapidísimo de
escribir. **Se descarta:** sin llave foránea no hay integridad ni forma de
agrupar, y agrupar por entidad es el objetivo entero del módulo de reportes.

## Consecuencias

**Positivas.** El reporte por entidad sale casi gratis y **sigue consolidando**.
El cuestionario convierte la implementación de un owner en un flujo guiado en vez
de una llamada. Y `facturas` gana un emisor, que va a hacer falta el día que se
timbre de verdad.

**Negativas.** Dos formularios ganan un selector. El cuestionario alarga el alta.
Las filas anteriores quedan con `entidad_id` nulo y hay que pintarlas como «sin
asignar» — esconderlas es cómo un reporte miente sin dar error. Y **no hay
reasignación de la emisora de una factura ya emitida**: crear esa ruta es abrir
escritura sobre un comprobante emitido, o sea R4. Queda constatado, no resuelto.

**Deuda declarada.** El timbrado fiscal **no existe**: lo que emite el sistema son
comprobantes de pago, no CFDI. Multi-entidad se *ve* como facturación real y no lo
es. El timbrado llega después por integración con un PAC.

## Implicaciones de seguridad

**Lo que esta decisión costó, y es la parte que importa.** Las tres claves
foráneas hacia `entidades_fiscales` nacieron planas, contra `(id)`. Y **las
comprobaciones de clave ajena no pasan por RLS**. Medido ejecutándolo con el rol
de la aplicación, dentro de una transacción que se deshizo:

```
con app.tenant_id = B:
  select razon_social from entidades_fiscales;   → solo las de B   (la RLS lee bien)
  insert into entidad_roles (entidad_id, rol, tenant_id)
    values (<entidad de A>, 'VENTAS', <B>);      → INSERT 0 1      ← PASABA
```

Se podía colgar una fila de la razón social de **otra organización**, sin ningún
error. No se alcanzaba desde la aplicación porque el repo valida el tenant antes
de escribir — **y se volvía alcanzable justo al cablear el selector**, que es lo
que este ADR autoriza.

Cerrado con `unique (id, tenant_id)` y las tres FK repuntadas a la pareja
(`20260918_entidad_tenant_compuesto.sql`). Dos sutilezas que no se ven leyendo:

- `on delete set null` **exige lista de columnas**, o intentaría anular también
  el `tenant_id`, que es `not null` — y borrar una entidad **fallaría** en vez de
  dejar el documento «sin asignar».
- `MATCH SIMPLE` (el de omisión) es lo que permite que «sin asignar» siga
  entrando. Con `MATCH FULL`, toda fila estaría obligada a tener entidad.

**La validación en el repo se conserva. La FK es la red; la validación es la
puerta.**

Resto del perfil: el catálogo lo edita el Dueño, no cada rol. RFC y régimen en
reposo, del mismo tipo que `clientes.rfc` ya guardaba — no cambia el perfil de
riesgo, lo duplica. Toda consulta por `q` y nunca `qRaw`, con `and tenant_id = $n`
explícito como segunda capa. El alta queda en `acciones`. Dependencias nuevas:
ninguna.

## Cómo revertir

Barato **hoy**: `drop` del catálogo y de las columnas nullable; ningún dato
obligatorio depende de ellas. **Caro en cuanto existan comprobantes con emisor
asignado**: ahí es una corrección de datos irreversible sobre dinero.
