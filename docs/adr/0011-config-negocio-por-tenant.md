# ADR 0011: `config_negocio` deja de ser una fila global y pasa a ser por tenant

- **Fecha:** 2026-08-05
- **Estado:** Propuesta

Responde al hallazgo **M5** de la auditoría QA del 04/08/2026 («Branding
inconsistente entre login, sidebar y configuración»), y al que el repo venía
arrastrando como **M-8** en las notas de `20260724_n6_config_negocio_moneda_mxn.sql`.

## Contexto

La auditoría reportó M5 como un problema de rótulos: el sidebar dice «G500»,
Configuración dice «RGB Catorce». Al ir a la causa, el problema es de modelo de
datos y es más ancho que un rótulo.

### `config_negocio` es UNA fila para TODAS las organizaciones

Verificado en `spaces_prod`:

```
select count(*) from config_negocio;   -- 1
```

La tabla (`db/schema.sql:102`) **no tiene `tenant_id`**, y
`obtenerConfigRow()` (`lib/server/config-repo.ts:38`) la lee con
`select * from config_negocio limit 1`. Los **cinco** tenants de producción
—`rgb`, `g500`, `eyro`, `telcel`, `demo-owner`— comparten:

| Campo | Valor único para todos |
|---|---|
| `moneda` | MXN |
| `iva_tasas` | {16} |
| `plazos_cobranza` | {60,90,120} |
| `loop_seg` / `spot_seg` | 60 / 10 |
| `logo_url` | (vacío) |
| `max_clientes_pantalla` | (sin límite) |

### Y se ESCRIBE sobre esa fila compartida

`PATCH /api/config` mapea los campos a `config_negocio` sin ningún filtro por
tenant (`app/api/config/route.ts:70-78`). Es decir: **el Dueño de cualquier
organización que cambie su IVA, su moneda, su logo o sus plazos de cobranza los
cambia para todas las demás**, desde una pantalla de administración normal, sin
ningún aviso y sin que quede rastro de que afectó a terceros.

Eso ya no es una inconsistencia de branding: es una escritura entre tenants por
la puerta principal. La auditoría no lo detectó porque solo se demostró un
tenant.

### Es la única tabla de negocio fuera del aislamiento

```
relname         | rls | force
campanas        |  t  |  t
sitios          |  t  |  t
config_negocio  |  f  |  f
```

Todo lo demás va con RLS fail-closed + FORCE (Hardening 1). `config_negocio`
quedó fuera porque nació como singleton global, así que ni siquiera la segunda
capa la protege.

### El nombre de la organización está duplicado

`config_negocio.nombre_tenant` y `tenants.nombre` guardan lo mismo, y el código
resuelve la duplicidad de dos maneras contradictorias:

- `obtenerConfig()` (`config-repo.ts:52`) **pisa** `nombreTenant` con
  `tenants.nombre` → el sidebar dice «G500».
- `obtenerConfigAdmin()` (`config-repo.ts:68`) **no lo pisa**, a propósito y con
  comentario, «porque ese campo se edita contra config_negocio» → Configuración
  dice «RGB Catorce».

Esa es, literalmente, la contradicción que reportó M5. Y el «se edita contra
config_negocio» es el mismo agujero de arriba: renombrar tu organización
renombraba la fila que leen todas.

### Duplicidad ya existente

`tenants.moneda` (`schema.sql:590`, «moneda estándar por organización») y
`config_negocio.moneda` conviven desde antes. Nadie las sincroniza.

## Decisión

**`config_negocio` pasa a tener una fila por tenant, y la identidad de la
organización deja de vivir en ella.**

1. **`config_negocio.tenant_id`** `not null` + `unique`, con FK a `tenants`. Una
   fila por organización, garantizado por el índice único y no por convención.

2. **RLS fail-closed + FORCE**, con la misma política que el resto de las tablas
   de negocio. Deja de ser la excepción del aislamiento.

3. **`nombre_tenant` se elimina.** El nombre de la organización es
   `tenants.nombre` y punto — una sola fuente. Administración pasa a editar ese
   campo, así que renombrar afecta solo a quien renombra, y el sidebar y
   Configuración no pueden volver a discrepar porque leen lo mismo.

4. **La migración CLONA la fila actual para cada tenant** antes de imponer las
   restricciones. Nadie estrena valores: cada organización se queda exactamente
   con la configuración que estaba viendo hasta ese momento. La fila original se
   asigna a `rgb`, que es de quien eran esos datos.

5. **`obtenerConfigRow()` deja de tener el literal `'RGB Catorce'`** como
   semilla: si a un tenant le falta su fila, se crea con los DEFAULT de la tabla.

6. **`config_negocio.moneda` se queda como la fuente** y `tenants.moneda` se
   deja estar: quitarla ahora tocaría el alta de tenants y el seed, y no es lo
   que M5 pide. Se anota como deuda en las consecuencias, no se esconde.

## Alternativas consideradas

### A. Dejarlo global y documentarlo

**Qué es:** aceptar el singleton; a lo sumo, poner la pantalla en solo lectura
salvo para un superadministrador.
**A favor:** cero migración, cero riesgo de despliegue.
**Por qué se descarta:** no arregla la escritura entre tenants, que es el punto
grave. Y poner la pantalla en solo lectura convierte un producto multi-tenant en
uno que solo el proveedor puede configurar — justo lo contrario de lo que se
está vendiendo.

### B. Mover todos los campos a la tabla `tenants`

**Qué es:** `tenants` gana `iva_tasas`, `plazos_cobranza`, `loop_seg`,
`spot_seg`, `logo_url`, `max_clientes_pantalla`; `config_negocio` desaparece.
**A favor:** una tabla menos, y elimina de raíz la duplicidad `tenants.moneda` ↔
`config_negocio.moneda`. Conceptualmente es defendible: son atributos de la
organización.
**Por qué se descarta:** `tenants` es **pre-sesión** — está exenta de RLS porque
la resuelve el login antes de saber quién eres, y las funciones SECURITY DEFINER
la leen sin contexto de tenant. Meterle ahí la configuración de negocio mezcla
datos que deben estar aislados con datos que se consultan sin aislamiento
posible, y obliga a razonar caso por caso sobre qué columna puede leerse antes de
autenticar. Separar identidad-de-conexión de configuración-de-negocio vale más
que ahorrarse una tabla. Además migrar 6 columnas y sus ~16 consumidores es más
cambio, no menos.

### C. Una columna JSONB de ajustes en `tenants`

**Qué es:** `tenants.ajustes jsonb`.
**A favor:** flexible, no hay migración cada vez que se añade un ajuste.
**Por qué se descarta:** hereda el mismo problema de RLS que B, y encima pierde
lo que hoy sí protege el esquema: `max_clientes_pantalla` tiene un `check >= 1`,
`plazos_cobranza` es `integer[]`, `moneda` es `not null`. En JSON todo eso pasa
a ser confianza en que el validador de la aplicación no se olvide. Para seis
campos estables no compensa.

### D. Fila por tenant pero SIN RLS, solo filtrando en la aplicación

**Qué es:** el punto 1 sin el punto 2.
**A favor:** menos que tocar; el filtro por `tenant_id` en las consultas ya
aislaría en la práctica.
**Por qué se descarta:** el resto del sistema tiene RLS **y** filtro explícito, a
propósito (documentado en `usuarios-repo.ts`: «si algún día la app conectara con
un rol BYPASSRLS, esto sigue aislando»). Dejar una sola tabla con una sola capa
es dejar el eslabón por el que se va a colar el siguiente fallo, y encima el
menos evidente porque parece igual que las demás.

## Consecuencias

**Positivas**

- Desaparece la escritura entre tenants: cambiar tus ajustes ya no toca los de
  nadie más.
- `config_negocio` entra en el modelo de aislamiento del resto del sistema.
- Una sola fuente para el nombre de la organización, así que sidebar y
  Configuración no pueden volver a contradecirse.
- Cada organización puede tener su IVA, su moneda, su loop y su logo — que es
  lo que un producto multi-tenant tiene que permitir para venderse como tal.

**Negativas**

- **`tenants.moneda` sigue duplicando `config_negocio.moneda`.** No se resuelve
  aquí y queda como deuda declarada; hoy nadie las sincroniza y pueden divergir.
- Migración con `not null` + `unique` sobre una tabla existente: hay que clonar
  antes de restringir, y el orden importa. Es el paso frágil del despliegue.
- Un tenant nuevo necesita su fila de configuración. Si el alta se olvida de
  crearla, `obtenerConfigRow()` la crea al vuelo con los DEFAULT — pero eso
  significa que estrena valores por defecto en vez de heredar nada, y conviene
  que el alta lo haga explícito.
- Seis campos más que un administrador puede tocar por organización: más
  superficie de configuración incorrecta (un IVA mal puesto factura mal). Es el
  precio de que sea configurable.

**Implicaciones de seguridad**

- **Superficie que se quita:** una escritura entre tenants alcanzable desde una
  pantalla de administración normal, con permisos legítimos y sin rastro. Era el
  problema real de este ADR.
- **Superficie que se agrega:** ninguna nueva. No hay endpoints nuevos; los que
  hay pasan a estar acotados por `tenant_id` y por RLS.
- **Aislamiento:** `config_negocio` pasa de `rls=f, force=f` a fail-closed +
  FORCE, igual que las otras 17 tablas de negocio. Doble capa: RLS **y** filtro
  explícito por `tenant_id` en las consultas.
- **Dónde viven los secretos:** ninguno. `logo_url` puede ser una data URL, que
  es contenido público de la organización, no un secreto.
- **Autenticación/autorización:** sin cambio. La pantalla sigue exigiendo
  `administracion`; lo que cambia es sobre qué fila escribe.
- **Datos sensibles:** ninguno nuevo. Los datos fiscales siguen en `tenants` y
  salen solo por `obtenerConfigAdmin()`, que ya exige permiso.
- **Dependencias nuevas:** ninguna.
- **Superficie de auditoría:** mejora indirectamente. Hoy un cambio de config
  queda registrado a nombre de quien lo hizo, pero afectaba a organizaciones que
  no aparecen en ningún lado; a partir de ahora el efecto está acotado al tenant
  del actor, que es lo que la bitácora ya afirmaba.

## Cómo revertir

Reversible, con una pérdida acotada y conocida:

- Quitar RLS y las restricciones es un `alter table`.
- Volver al singleton exige **elegir qué fila sobrevive** — las demás se
  descartan. Si para entonces cada organización ha configurado lo suyo, revertir
  significa imponerle a todas la configuración de una. Esa pérdida es real y por
  eso está aquí y no en «positivas».
- `nombre_tenant` se puede devolver como columna, pero su contenido habría que
  recomponerlo desde `tenants.nombre`, que es de donde debió salir siempre.

A los seis meses el coste de deshacerlo crece con el número de organizaciones
que hayan personalizado algo. Hoy, con los cinco tenants compartiendo los mismos
valores, revertir sería inocuo; ése es justo el motivo para hacerlo ahora y no
más tarde.
