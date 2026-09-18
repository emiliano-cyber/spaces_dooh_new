---
tipo: datos
estado: verificado
actualizado: 2026-09-18
tags: [datos, semilla, demo, rentabilidad, reportes, ooh-summit]
archivos:
  - scripts/semilla-demo.mjs
  - scripts/semilla-demo.test.ts
  - db/semilla-desarrollo.sql
  - apps/web/lib/data/reportes.ts
  - apps/web/lib/costos-ot.ts
---

# La semilla de demostración

`scripts/semilla-demo.mjs` siembra el **guion** con el que se enseña el módulo de
rentabilidad: una historia coherente de varios trimestres, con una conclusión
puesta a propósito y comprobada.

> [!important] No es «datos de prueba»: es un guion, y se prueba como tal
> El software se presenta el **14 de octubre** en el OOH SUMMIT. El módulo de
> reportes estará construido, y **un reporte trimestral sobre una base con tres
> semanas de datos dibuja una sola barra.** Ese riesgo no lo arregla ningún día
> de desarrollo, y es invisible hasta que se abre la pantalla — en el peor caso,
> en el escenario.
>
> Y el dueño tiene una frase concreta que el reporte tiene que poder enseñar:
>
> > «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las mismas
> > campañas, pero a una van a cada rato a arreglarla.»
>
> Eso es una **afirmación**, y una afirmación se prueba. La comprueba
> `scripts/semilla-demo.test.ts` preguntándole al mismo motor que corre detrás
> de `GET /api/reportes/rentabilidad`.


> [!warning] 2026-09-18 · la columna de horas salía VACÍA, y solo se vio corriendo la app
> Las 74 órdenes nacían con `fecha_completada` y **sin `fecha_inicio`**, así que
> el reporte por operación devolvía `horasEnSitio: null` y
> `visitasConDuracion: 0`. El reporte no estaba mal —informaba null en vez de
> inventar un cero—: la semilla no daba el dato. Ni el typecheck, ni las 1430
> unitarias, ni las 390 e2e lo vieron; apareció al levantar la app y pedirle el
> reporte por su propio endpoint.
>
> Arreglado con `HORAS_POR_TIPO`, rangos **aprobados por Jochelo** el mismo día:
> inspección 0.5-1.5 h · desmontaje 1.5-3 · montaje de lona 2-4 · montaje
> digital 3-6 · preventivo 1.5-3 · **eléctrico 2-5 · correctivo 3-8 · herrería
> 4-10** · otro 1-3. Son datos de DEMOSTRACIÓN, no medición de campo.
>
> **Lo que no hay que deshacer al retocarlos:** las visitas extra de Tlalpan son
> correctivo, eléctrico y herrería — las **tres más largas**. Medido tras
> resembrar: **109.5 h contra 50 h**, o sea **2.19×**, cuando la razón de visitas
> es solo 1.5×. Las horas **amplifican** la conclusión del guion. Aplanar los
> rangos dejaría el reporte correcto y sin demostrar nada.
>
> La duración es **determinista** (sale del índice estable de la orden, no de
> `Math.random()`), que es lo que mantiene la idempotencia: la 2.ª corrida dice
> `filas nuevas: 0`. Y la jornada arranca a las **08:00** con cierre máximo a las
> 18:00, así que `fecha_completada::date` no cambia y los buckets del reporte
> caen donde caían — de paso, las 08:00 son más seguras que la medianoche
> implícita que había antes, que es la hora que un desplazamiento de zona manda
> al día anterior.

## Lo que siembra

| | |
|---|---|
| **Organización** | la crea con el slug que se le pase (`--org=`, por omisión `demo-rentabilidad`). **Nunca asume `rgb`** |
| **Historia** | 4 trimestres naturales **ya cerrados** por omisión; el mínimo admitido es 3, y por debajo se niega |
| **Arrendadores · predios · pantallas** | 3 · 3 · 4 |
| **Contratos** | 1 por predio, `VIGENTE`, con vigencia que **cubre todo el histórico** |
| **Comercial** | 2 clientes · 2 campañas por trimestre · 24 reservas (con 4 trimestres) |
| **Operación** | 74 órdenes de trabajo (con 4 trimestres), con mezcla de `tipo_ot` |
| **`config_negocio.costos_ot`** | los **nueve** tipos capturados, con importes distintos entre sí |

## El guion, y por qué cada pieza está donde está

**Dos pantallas comparables.** `Tlalpan G500` (`DEMO-TLP-01`) y `G500 Santa Mónica`
(`DEMO-STM-01`): mismo `tipo_medio`, mismas medidas (12.90 × 7.20), rentas al 1.8 %
una de otra (28 000 y 27 500 mensuales) y **predios distintos**, cada uno con su
arrendador y su contrato. Si compartieran predio compartirían contrato, y la renta
se repartiría entre las dos caras ([[04-Datos/esquema]] → `rentaAtribuidaPorSitio`).

**Las mismas campañas encima de las dos, al mismo precio.** Ingreso idéntico a
propósito: si difiriera, la conclusión del reporte seguiría siendo cierta pero
dejaría de demostrar nada — el dueño podría atribuirla a que una se vende peor.

**La diferencia, deliberada, en la operación.** Y **va empeorando**, que es la
decisión importante: una brecha plana se enseña igual con un solo periodo, y
entonces el reporte *trimestral* no estaría demostrando nada. Lo que justifica el
eje de tiempo es ver el margen de Tlalpan caer mientras el de Santa Mónica se
sostiene.

**Estáticas sin medidas a propósito.** `DEMO-SM-01` y `DEMO-SM-02` nacen con
`ancho` y `alto` en NULL, y con actividad (reservas, renta y OT) para que salgan
en el reporte. Sin ellas no se puede enseñar —ni comprobar— que el reporte de m²
las **excluye y las cuenta** en vez de esconderlas. Van las dos en el mismo predio
con un solo contrato, así que además ejercitan el reparto de la renta entre caras.

## Las cifras que produce — medidas el 2026-09-18

Sobre una base desechable, con `--ancla=2026-09-18` (4 trimestres,
`2025-07-01 → 2026-06-30`):

| Pantalla | m²? | Ingreso | Espacio | OT | Operación | **Margen** |
|---|---|---:|---:|---:|---:|---:|
| `DEMO-SM-01` Mural DEMO Viaducto | **no** | 72 000 | 36 000 | 12 | 26 400 | 9 600 |
| `DEMO-SM-02` Valla DEMO Zaragoza | **no** | 72 000 | 36 000 | 12 | 26 400 | 9 600 |
| `DEMO-TLP-01` **Tlalpan G500** | sí | 576 000 | 336 000 | **30** | **115 600** | **124 400** |
| `DEMO-STM-01` **G500 Santa Mónica** | sí | 576 000 | 330 000 | 20 | 49 200 | **196 800** |

El ingreso de las dos comparables es **el mismo**, y la brecha de 72 400 la
explica la operación (66 400 de diferencia) y no el espacio (6 000).

Y trimestre a trimestre, que es lo que el reporte existe para enseñar:

| Trimestre | Tlalpan | Santa Mónica |
|---|---:|---:|
| 2025-T3 | 41 300 | 49 200 |
| 2025-T4 | 36 200 | 49 200 |
| 2026-T1 | 26 000 | 49 200 |
| 2026-T2 | **20 900** | 49 200 |

> [!warning] No copies estas cifras: se miden
> Cambian con `--trimestres`, con el ancla y con cualquier ajuste de
> `COSTOS_OT_DEMO`. Para el número de hoy:
> `node scripts/semilla-demo.mjs --ancla=<fecha> --verificar`.

## Cómo se corre

```powershell
# Ver el guion sin tocar ninguna base
node scripts/semilla-demo.mjs --guion

# Sembrar y medir
$env:DATABASE_URL="postgresql://usuario:clave@host:puerto/base"
node scripts/semilla-demo.mjs --org=demo-rentabilidad --trimestres=4 --verificar
```

La base tiene que traer ya `db/schema.sql` y sus migraciones aplicadas
(`node scripts/migrar.mjs --instalacion-nueva` sobre una base recién nacida).

## Las cuatro propiedades que hay que no romper

> [!danger] Idempotente, y no es pulcritud
> La segunda corrida duplicaría reservas, y el reporte enseñaría **el doble de
> ingreso sin dar el menor error** — el modo de fallo que este repo persigue.
> Cada `insert` va guardado por una clave natural: `on conflict` donde hay índice
> único de verdad (`tenants.slug`, `sitios.clave_interna`, `campanas.folio`,
> `ordenes_trabajo.folio`) y `not exists` sobre `tenant_id` + clave donde no. La
> prueba **«NINGUNA sentencia inserta sin guard»** lo exige mecánicamente, para
> que la próxima tabla que entre al guion no se escape.
>
> Medido: 1.ª corrida `filas nuevas: 122`; 2.ª `filas nuevas: 0 · ya sembradas:
> 122`, con los recuentos de la base idénticos antes y después.

> [!danger] NO viaja en la imagen de producción
> Y no hay que hacer nada para conseguirlo, solo **no deshacerlo**: la etapa de
> ejecución del `Dockerfile` copia scripts por **lista blanca de un archivo**
> (`COPY … scripts/migrar.mjs`, `Dockerfile:106`) y de `db/` solo `schema.sql` y
> `migrations/` (`Dockerfile:94-95`). Mismo criterio con el que
> `db/semilla-desarrollo.sql` se quedó fuera: **una instancia de un cliente no
> puede nacer con las pantallas de una demostración dentro**. Un
> `COPY scripts/ ./scripts/` genérico rompería esa propiedad sin que nada fallara.

> [!danger] Todo dato lleva su `tenant_id` (R2)
> El esquema nace **sin ninguna organización** a propósito (`db/schema.sql`, el
> bloque que explica por qué se retiró la semilla de `rgb`). El script crea la
> suya y etiqueta cada fila. Una prueba comprueba que **ningún `insert` a una
> tabla con `tenant_id` lo deja fuera**: es la deriva que ya etiquetó como RGB
> filas de otras empresas. Ver [[06-Operacion/zonas-de-riesgo]].

> [!note] Nada real, y se ve
> Ni dominios, ni IPs, ni RFC verdaderos, ni tokens. Los correos van a
> `.invalid` (RFC 2606 lo reserva para que nunca resuelva), los RFC empiezan por
> `DMO` y los teléfonos son ceros. Los importes son redondos a propósito: esto se
> proyecta delante de gente y tiene que leerse como una demostración. Una prueba
> lo comprueba sobre el plan serializado.

## Lo que esta semilla NO hace, dicho para que no sorprenda

- **No siembra usuarios ni sesiones.** De eso se encarga
  `apps/web/scripts/bootstrap-auth.mjs`, que pide la identidad por variables de
  entorno. Para entrar a la aplicación y ver el reporte hay que correrlo aparte.
- **No siembra facturas ni cobranza.** El guion es de rentabilidad por pantalla:
  ingreso de reservas contra renta y operación. Finanzas queda fuera.
- **No siembra `sitio_modalidades`.** Las pantallas llevan `tarifa_publicada` y
  `tarifa_mensual`, que es lo que el reporte usa.
- **No mira el trimestre en curso.** Siembra solo trimestres **cerrados**: uno a
  medias sale con menos ingreso y menos renta que los demás y en la gráfica se
  lee como una caída del negocio, no como un periodo incompleto.
- **La cuenta de `--verificar` es independiente del motor**, a propósito, y vale
  solo para esta semilla (cada reserva cabe entera en su trimestre y los
  contratos cubren todo el rango, así que no hay que prorratear). **La aritmética
  que manda es `apps/web/lib/data/reportes.ts`**, y quien la comprueba contra el
  guion es `scripts/semilla-demo.test.ts`. Si las dos discrepan, la que está mal
  es la del script.

## Relacionado

- [[04-Datos/esquema]] — las tablas que esta semilla escribe
- [[04-Datos/migraciones]] — `20260917_costos_ot_por_tipo.sql` es la que hace que
  el tipo de OT decida el costo, y por tanto lo que hace posible este guion
- [[06-Operacion/zonas-de-riesgo]] — R2, el `tenant_id` de cada fila
- [[02-Backend/operaciones-y-ot]] — de dónde salen los `tipo_ot`
- [[02-Backend/arrendadores-y-contratos]] — el anclaje predio/pantalla del contrato
