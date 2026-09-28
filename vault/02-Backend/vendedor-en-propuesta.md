---
tipo: contrato
estado: verificado
actualizado: 2026-09-28
tags: [backend, reportes, rentabilidad, propuestas, usuarios, vendedores, dinero, rojo, r2]
archivos:
  - db/migrations/20260928_vendedor_en_propuesta.sql
  - apps/web/lib/server/propuestas-repo.ts
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/server/reportes-repo.ts
  - apps/web/lib/server/reportes-controller.ts
  - apps/web/components/demo/reportes/tabla.ts
  - apps/web/components/demo/reportes/consulta.ts
  - apps/web/lib/data/reportes.vendedor.test.ts
  - apps/web/lib/server/propuestas-vendedor.test.ts
  - apps/web/lib/test/vendedor-en-propuesta.e2e.test.ts
---

# El vendedor de una propuesta, y la octava dimensión

`GET /api/reportes/rentabilidad?dimension=vendedor` — una fila por persona:
**cuánto vendió y cuánto descuento concedió.**

La pregunta es de un dueño: «¿puedo medir los descuentos que hace cada
vendedor?». **La auditoría midió la respuesta, y no era que faltara un reporte:
faltaba EL DATO.**

| Tabla | Columnas | ¿Apunta a `usuarios`? |
|---|---|---|
| `propuestas` (`db/schema.sql:346-361`) | 16 | **ninguna** |
| `campanas` (`:378-405`) | 23 | **ninguna** |

En todo el esquema, `usuario_id` existía en **dos** sitios: `sesiones` (`:85`) y
la bitácora `acciones` (`:578`). Usuarios y roles sí existían y funcionaban. Lo
que faltaba era **atar la propuesta a quien la hizo**.

---

## 1 · El dato: `propuestas.usuario_id`

Lo añade **`db/migrations/20260928_vendedor_en_propuesta.sql`** (VEND-01),
aditiva e idempotente, sin tocar `db/schema.sql` ni ninguna migración anterior.

### Quién es el vendedor, y por qué no se puede falsear

**El vendedor es quien CREA la propuesta** — decisión del dueño, 2026-09-28.
Automático, sin campo que rellenar, y no falseable porque **se toma de la sesión
en el servidor**:

```ts
// propuestas-repo.ts, dentro de crearPropuesta()
const vendedorId = (await usuarioActual())?.id ?? null
```

Es **el mismo camino que `tenantActual()`** —`usuarioActual()` lee la cookie
httpOnly y resuelve la fila por `auth_usuario_por_sesion`— y por la misma razón:
lo que decide **quién eres** no puede entrar por el cuerpo de la petición.

> [!danger] El modo de fallo que esto evita es de DINERO, y no daría error
> Si `usuario_id` viajara en el JSON, cualquiera con `comercial.crear` podría
> atribuirse una venta ajena —o **cargarle a otro un descuento del 80 %**— con
> un `curl`. La propuesta se crearía igual, con su folio y su economía correcta;
> lo único que cambiaría es **el nombre en la tabla del reporte**. No hay
> síntoma.

Hay **tres candados**, y los tres están probados:

1. **`PropuestaInput` no declara ningún campo de usuario.** No es un olvido: es
   el candado que hace que el typecheck sea la mitad del guard.
2. **El zod del controller no lo declara** y no lleva `.passthrough()`, así que
   una clave desconocida en el cuerpo se **recorta** antes de llegar al repo.
3. **El repo no lee `input` para esto**: lo toma de `usuarioActual()`.

`propuestas-vendedor.test.ts` vigila los tres sobre el fuente y sobre el
contrato controller→repo; `vendedor-en-propuesta.e2e.test.ts` manda un
`usuarioId` ajeno **por la red** y lee la fila que quedó escrita.

### `on delete set null`, y no `restrict`

Se sigue **el criterio que ya usa el esquema**. Las cinco claves ajenas hacia
`usuarios` que no son la sesión son todas `set null`:

| Columna | Dónde |
|---|---|
| `acciones.usuario_id` | `schema.sql:578` |
| `incidencias.reportado_por_usuario` | `:320` |
| `ordenes_trabajo.asignado_a` · `.supervisor` | `:483`, `:484` |
| `evidencias_ot.uploaded_by` | `:510` |

Solo `sesiones.usuario_id` cascadea, y ahí la fila no significa nada sin su
usuario.

> [!important] Y hay una razón dura además de la coherencia
> **`borrarUsuario()` existe y se usa** (`usuarios-repo.ts:143`). Con
> `restrict`, el primer vendedor que hiciera una propuesta quedaría
> **imborrable** y la pantalla de usuarios devolvería un 500 sin explicar por
> qué. Con `set null` la atribución se degrada a «Sin vendedor» —el mismo hueco
> que el histórico, pintado por el mismo mecanismo— en vez de bloquear una
> operación legítima de administración.

**Lo que eso cuesta, con todas las letras:** un vendedor que se va **y se borra**
se lleva su atribución. **No se denormaliza su nombre** —como sí hace
`acciones.usuario_nombre`— porque una propuesta es un registro **vivo** y no una
línea de bitácora congelada: el nombre debe seguir al usuario cuando se corrige,
y una copia sería una segunda verdad que envejece. En la práctica la baja es
**lógica** (`usuarios.activo`) y una baja lógica **no toca esta columna** — el
reporte lee también a los dados de baja, a propósito. Queda como pregunta
abierta para el dueño: ver [[00-Indice/preguntas-abiertas]].

### `campanas` NO lleva columna: se deduce por el join

Una campaña nace de una propuesta (`campanas.propuesta_id`, `:392`, indexado en
`:407`) **pero también puede nacer suelta desde Comercial**. El vendedor se
deduce por ese join y **no se copia**:

- Copiarlo daría **dos verdades sobre el mismo hecho**, y divergirían el día que
  alguien reasigne una propuesta o regenere una campaña. Es el error de raíz que
  este repo documenta en `lib/server/tenant.ts:87-89`.
- Y para la campaña nacida en Comercial **no habría a quién copiar**: estampar
  ahí a quien la **tecleó** le acreditaría una venta a un operador o a finanzas.
  Eso es **exactamente el dato falseable que esta tarea existe para evitar**,
  solo que falseado por descuido en vez de a propósito.

Esas campañas salen en «Sin vendedor», **contadas aparte** de las históricas.

### La FK es PLANA, y eso es una desviación consciente

`20260918_entidad_tenant_compuesto.sql` repuntó tres FK a la pareja
`(id, tenant_id)` porque **una FK plana se comprueba con los privilegios del
dueño de la tabla y elude la RLS**. Aquí **no se sigue**, con el motivo escrito:

1. Esa sintaxis —`on delete set null (columna)`— es **PostgreSQL 15**, y esa
   migración lleva `-- @pg-min: 15`. **La flota no está toda en 15: g500 corre
   14.24**, y el guard del runner (código de salida **4**) para la cola entera de
   esa base. Añadir un segundo bloqueo a dieciséis días del lanzamiento no compra
   seguridad: compra un despliegue imposible.
2. **El agujero no es alcanzable**: `usuario_id` no entra por la petición, sale
   de `usuarioActual()`, que es **la misma sesión** de la que sale
   `tenantActual()`. Escribir un vendedor de otra organización exigiría que las
   dos funciones discreparan sobre quién está conectado.
3. **La lectura está cerrada por su lado**: el reporte lee `usuarios` con
   `and tenant_id = $1`, y un `usuario_id` que apunte fuera **no llega** a la
   lista de vendedores — cae en «Sin vendedor» y **ni su id se pinta**.

> [!warning] Deuda anotada
> Cuando toda la flota esté en PostgreSQL 15, esta FK **debe** repuntarse a
> `(id, tenant_id)`. Está en [[00-Indice/preguntas-abiertas]].

---

## 2 · El histórico, que es lo que hay que hacer bien

> [!danger] TODO lo capturado antes del 2026-09-28 queda sin vendedor PARA SIEMPRE
> Y **no hay de dónde deducirlo**: la bitácora `acciones` guarda el **nombre** de
> la propuesta como texto libre (`entidad`), no su id, así que ni un backfill a
> mano podría casarlos sin inventar.
>
> **Eso se enseña, no se esconde.** La columna nace **nullable y sin DEFAULT**.
> Rellenarla con «alguien» —el primer `DUENO`, el que corre la migración—
> convertiría una laguna en una **afirmación falsa**, y encima sobre dinero: le
> acreditaría a una persona las ventas y los descuentos de todos los demás. Mismo
> criterio que el DEFAULT de tenant que retiró `20260812_sin_default_tenant.sql`.

El hueco sale en la fila **«Sin vendedor»**, siempre la última, con su importe, y
el aviso de cobertura (`CoberturaVendedor`) lo dice encima de la tabla **con sus
dos causas separadas**:

| Causa | Se cuenta en | ¿Se arregla? |
|---|---|---|
| Campaña creada en **Comercial**, sin propuesta | `reservasSinPropuesta` | Sí: vendiendo por propuesta |
| Propuesta **histórica** (o vendedor borrado) | `reservasDePropuestaSinVendedor` | **No. Nunca** |

No se funden en un número a propósito: decir solo «sin vendedor» mandaría a
alguien a buscar en los papeles un dato que **en la mitad de los casos no existe
en ninguna parte**. La nota lo dice literalmente — «ese dato **no se puede
recuperar**».

> [!important] Y el aviso se pinta TAMBIÉN cuando no falta nada, en gris
> Porque su primera frase hace falta **siempre**: la brecha lleva dentro la
> **comisión de agencia**, y sin decirlo la columna se lee como si el vendedor
> hubiera regalado toda esa diferencia. Mismo criterio que `saldoAtribuido` en
> [[reportes-por-razon-social]] y que la nota de [[tarifa-publicada-vs-neta]].

---

## 3 · La dimensión `vendedor`

Reutiliza **el camino que abrió `tarifa`**, no inventa otro: el descuento no se
recalcula, sale de `propuestas.snapshot_economico` (`{lista, neto}` por pantalla)
por donde ya se leía. Ver [[tarifa-publicada-vs-neta]].

### Las columnas, y por qué esas

| Columna | Qué contesta |
|---|---|
| **Vendedor** | quién. El `detalle` es su cargo |
| **Ingreso** | cuánto vendió, prorrateado por días |
| **% de la facturación** | qué parte del negocio del periodo es eso |
| **Tarifa publicada** | qué se publicó de lo suyo |
| **Neto comparable** | cuánto de lo que entró se puede comparar con eso |
| **Descuento y comisión** | la brecha |
| **% sobre publicada** | en qué proporción |

> [!warning] NO hereda las columnas de costo ni el margen — es la TERCERA que no parte de `COMUNES`
> Junto a `entidad` y `tarifa`, y por un motivo **propio de esta**: aquí las
> filas son **personas**. La renta que se le paga al arrendador y las visitas a
> la pantalla **no las decide el vendedor**, así que `costoEspacio`,
> `costoOperacion` y `margen` medirían a alguien por un contrato de arrendamiento
> que no negoció — y que además cambiaría sin que él hiciera nada.
>
> **«El margen de Ana» no existe**, y pintarlo invitaría a usarlo. Hay guard:
> `tabla.luz.test.ts` comprueba que la exención sea **exacta** (ni costo alguno,
> ni margen, ni `margenPct`), así que el día que aparezca una columna de costo
> aquí se pone rojo y obliga a decidirlo a propósito.

Las cuatro columnas de la comparación son **las mismas** que las de `tarifa`, con
el mismo nombre y el mismo significado. Dos columnas que se llamaran igual y
midieran distinto harían que las dos pantallas no se pudieran conciliar.

### Raya y no cero

Los cuatro campos de la comparación son `number | null`, y el `null` **es la
mitad del trabajo**: se pinta con una **raya**.

> [!danger] Un cero en «Descuento y comisión» afirma que esa persona no concedió ninguno
> Una raya dice que **no se sabe**. En un reporte que mide a **personas** la
> diferencia entre las dos cosas es el bono de alguien.

La fila **sigue saliendo** aunque no se pueda comparar: vendió, y eso es verdad.
Lo que no se sabe es cuánto descontó.

### Hereda la trampa de las dos convenciones de precio

`reservas.precio` guarda **la lista** si la venta nació en Comercial
(`campanas-repo.ts:443`) y **el neto** si nació de una propuesta (`:701`). Una
reserva entra en la comparación **solo si su precio ES el neto que el snapshot
congeló** para esa pantalla. Comparar una cifra contra sí misma daría un
descuento del **0 %** que nadie concedió — y aquí ese 0 % **se lo comería un
vendedor con nombre y apellido**.

También hereda el **centinela de ambigüedad**: una propuesta con dos ítems de la
misma pantalla no se compara.

### Las otras dos decisiones

- **«Sin vendedor» va SIEMPRE al final.** El día del despliegue puede ser la fila
  **más grande de la tabla**, y ordenada por ingreso saldría la primera,
  leyéndose como el mejor vendedor.
- **Solo salen los que vendieron en el periodo.** La pregunta es «cuánto vendió
  cada quien», no «quién trabaja aquí»: la mitad de los usuarios de una
  organización son operaciones y finanzas. Es **lo contrario de `entidad`**,
  donde las razones sociales son un puñado y la que no mueve dinero tiene que
  verse. Está en [[00-Indice/preguntas-abiertas]] por si el dueño quiere ver
  también al que no vendió nada.

Los **totales** son los del negocio completo, idénticos a los de `sitio`: cambiar
de agrupador no puede cambiar las cifras grandes de arriba.

---

## 4 · Lo que cambió en las capas

| Archivo | Cambio |
|---|---|
| `db/migrations/20260928_vendedor_en_propuesta.sql` | la columna, su FK y su índice `(usuario_id, tenant_id)` |
| `lib/server/propuestas-repo.ts` | el INSERT estampa `usuario_id` desde `usuarioActual()` |
| `lib/data/reportes.ts` | `PorVendedor` en `matriz()`, `rentabilidadPorVendedor()`, `CoberturaVendedor`, `VendedorReporte` |
| `lib/server/reportes-repo.ts` | dos consultas más: los usuarios del tenant y el puente campaña→vendedor |
| `lib/server/reportes-controller.ts` | `MOTORES` exhaustivo — **añadir una dimensión sin motor no compila** |
| `components/demo/reportes/{consulta,tabla}.ts` | la opción, sus columnas, su orden y su aviso |

`route.ts` **no se tocó**: la dimensión ya era un parámetro de su contrato.

> [!note] El prorrateo se acumula en el MISMO bucle de `matriz()`
> Por lo mismo que `porEntidad` y que `ingresoLista`: el reparto por días es una
> aritmética delicada y dos copias divergen el día que una cambie. Aquí divergir
> significaría que **el reporte por pantalla y el reporte por vendedor dieran dos
> ventas distintas del mismo mes**.

El aislamiento **no cambió de forma**: las ocho consultas siguen con `q()` y su
`and tenant_id` explícito, nunca `qRaw`, y el guard de
`reportes-repo.aislamiento.test.ts` las recorre todas sin tocarse. Ver
[[multi-tenancy-y-rls]] y [[02-Backend/reportes-rentabilidad]].

---

## 5 · Pruebas

| Archivo | Qué ancla | Casos |
|---|---|---|
| `lib/data/reportes.vendedor.test.ts` | la dimensión: atribución, raya, cobertura, las dos convenciones, el prorrateo, R2 en el motor | 18 |
| `lib/server/propuestas-vendedor.test.ts` | que el vendedor **no** se pueda mandar desde el cliente, en el contrato y en el fuente | 7 |
| `lib/test/vendedor-en-propuesta.e2e.test.ts` | la migración aplicada, la inyección por la red, dos organizaciones vivas, el histórico, el 403 y el 401 | 14 |

> [!danger] La e2e siembra las dos organizaciones con la MISMA venta y el MISMO descuento
> 72 000 de neto sobre 100 000 de lista, cada una, en el mismo periodo. Porque un
> fallo de aislamiento en un reporte **no da error**: da **un total al doble**, y
> un reporte con el vendedor de otra empresa dentro se lee perfectamente bien.
>
> Y comprueba **contra Postgres** lo que el DDL solo promete: que borrar al
> vendedor deja su propuesta «sin vendedor» en vez de fallar (`confdeltype = 'n'`
> y el `delete` dentro de una transacción que se deshace).

---

## Relacionadas
[[tarifa-publicada-vs-neta]] · [[reportes-por-razon-social]] ·
[[02-Backend/reportes-dimensiones]] · [[02-Backend/reportes-rentabilidad]] ·
[[02-Backend/comercial-propuestas-campanas]] · [[02-Backend/autenticacion-y-sesion]] ·
[[multi-tenancy-y-rls]] · [[02-Backend/_indice]] · [[zonas-de-riesgo]] ·
[[convenciones]] · [[MOC-Proyecto]]
