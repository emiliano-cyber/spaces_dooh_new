# Censo de validación de entrada — los 72 endpoints de mutación

**Fecha:** 2026-08-26 · **Método:** lectura del esquema de cada `POST`/`PATCH`/`PUT`
bajo `apps/web/app/api/`, más barrido mecánico de `z.string()` sin `.max()` y
`z.number()` sin `.min()`, y su controlador.

**Por qué existe.** La auditoría externa encontró que la API aceptaba lo que la
pantalla rechazaba. Arreglar los casos que ella vio no dice nada de los que no
vio. Esto es el barrido completo.

> **Lo que este censo NO es.** No es una lista de fallos explotables. La mayoría
> son topes de texto que rompen una tabla, no la seguridad. Está ordenado por
> **daño al dato**, no por alarma.

**Criterio de gravedad**, en orden:
**(a)** escribe un dato malo que después **nadie puede corregir** desde la
aplicación · **(b)** toca dinero o fechas de contrato · **(c)** rompe una
pantalla · **(d)** cosmético.

---

## Cerrados el 2026-08-26

| Endpoint | Qué aceptaba | Grav. |
|---|---|---|
| `POST /api/ordenes-compra` | monto negativo, `'abc'`, `1e15`; fecha no-fecha (500); textos sin tope | **a+b** |
| `POST /api/campanas/[id]/extender` | fecha anterior → **acortaba** la campaña y sus reservas | **a+b** |
| `PATCH /api/propuestas/[id]` | `descuentoPct` no numérico → **NaN guardado**, con 200 OK | **a** |
| `POST /api/firma/[token]` | nombre sin tope, sin sesión, en registro inmutable | **a** |
| `POST /api/propuestas/publica/[id]` | ídem en `aceptado_por` | **a** |
| `POST /api/campanas/[id]/facturar` | `primerVencimiento` no-fecha → 500 | b |
| `PATCH /api/config` | RFC **del emisor** con mes 13 | b |
| `PATCH /api/contratos/[id]` | inversión de fechas no detectada | b |
| `POST/PATCH /api/licencias[/id]` | vigencia invertida, misma causa | b |

---

## Abiertos, en orden de lo que conviene cerrar

| # | Endpoint | Qué acepta | Grav. | Coste |
|---|---|---|---|---|
| 1 | `PATCH /api/sitios/[id]` | `updateSchema = z.record(z.string(), z.unknown())` (`sitios-controller.ts:13`): solo las CLAVES tienen lista blanca, los VALORES van crudos. `tarifaPublicada: -5000`, `totalSpots: -50` | b/c | medio |
| 2 | `POST /api/sitios` | `crearSitio(body)` con el cuerpo entero; solo exige `nombre`. También por `predios/[id]/pantallas` (`.passthrough()`) | b/c | medio |
| 3 | `POST /api/reservar` | `spotsPorSitio: z.record(z.string(), z.coerce.number())` **sin `.int()` ni `.positive()`** (`reservas-controller.ts:21`) | b | bajo, **pero ver abajo** |
| 4 | `arrendadores-repo:528` y `:1017` | La misma comparación de fechas como texto, en traslape y renovación. Usa `<=`, necesita su propio predicado | b | bajo |
| 5 | `POST /api/ot` | `fechaProgramada` no valida fecha; columna `timestamptz` → `'mañana'` = 500 | c | bajo |
| 6 | `POST /api/impresion` | Sin zod: `alto`/`ancho` crudos; `material`/`proveedor` sin tope | c | bajo |
| 7 | `POST /api/almacen` y `/[id]/movimiento` | `etiqueta`, `descripcion`, `motivo` sin tope | c | bajo |
| 8 | `/sitios/[id]/pausa-legal`, `/campanas/[id]/validar`, `/creatividades` | `motivo`, `notas`, `formato`, `resolucion` sin tope | c | bajo |
| 9 | `POST /api/propuestas` | `nombre` y `notas` sin tope (el resto **está bien**) | c | bajo |
| 10 | `POST/PATCH /api/arrendadores`, `/predios`, `/razones-sociales` | `nombre`, `direccion`, `notas` sin tope (lo demás bien) | c | bajo |
| 11 | `POST /api/signup`, `/tenants`, `/usuarios` | `nombre`, `organizacion`, `cargo` sin tope | d | bajo |

> **El punto 3 no es un tope de texto: es la puerta de la sobreventa.** Un
> `spotsPorSitio` negativo entra al cálculo de disponibilidad. Va junto con
> DATA-02, abajo, y **no se toca sin decidir antes** qué significa cada cifra.

---

## Lo que se revisó y está BIEN

- **Correos.** Los seis sitios que reciben uno —`clientes`, `arrendadores`,
  `usuarios`, `cuentas`, `config.emailRemitente` y `auth/forgot`— validan con
  `esEmailValido`. **No hay ningún endpoint que acepte un correo que no lo sea.**
- **`POST /api/propuestas`** salvo los dos textos: `nonnegative`, `positive`,
  `int` y `refine` de fechas, todo en su sitio.
- **Coordenadas y adjuntos** de arrendadores y predios: acotados y validados.

## Lo que solo se miró por encima, y se dice

`campanas/[id]/creativos/repartir`, `contratos/[id]/firma`, `notificaciones/*`,
`recordatorios`, `cobranzas/[id]/recordar`, `propuestas/[id]/generar-campana`,
`usuarios/[id]/restablecer`. Los cinco últimos no llevan cuerpo.

---

## DATA-02 — confirmado, y es peor que lo reportado

La auditoría dijo: *«Reserva vía propuesta guarda `spotsReservados: null`»*.
Cierto. La causa es que **`reservas.spots_reservados` guarda dos magnitudes
distintas según por dónde entres**:

- **Por Comercial** (`campanas-repo.ts:544-548`): spots tomados del pool de la
  pantalla, acotados a `spots_disponibles`, solo digitales. Un número.
- **Por propuesta** (`campanas-repo.ts:698-705`): `it.spots_por_dia ?? null` —
  spots **por día**, *otra unidad*, en la misma columna. Y `spots_por_dia` es
  opcional, así que **una propuesta mensual normal siempre da `null`**.

**Tres consumidores leen ese `null` y cada uno entiende otra cosa:**

1. `lib/reparto-creativos.ts:51-68` — `null` significa «pantalla FIJA, una
   lona». Una pantalla **digital** vendida por propuesta se reparte como si
   fuera una lona: **un creativo se lleva todo, sin rotación.**
2. `campanas-repo.ts:254-262` — solo las reservas con valor **devuelven slots**
   al vencer. Las de propuesta no los devuelven nunca.
3. `doohmain.ts:375-386` — lo lee como «sin cuota pactada».

**Y hay una segunda mitad**: tres criterios para la misma idea.
`estatus_comercial` y la disponibilidad cuentan campañas **distintas**
(`campanas-repo.ts:571-577`), y `sitios.spots_disponibles` es un contador que
**nunca se decrementa** —hay un solo `set`, y es el que **suma** al vencer— pero
se lee como tope y como candado, y encima se puede editar a mano por
`PATCH /api/sitios/[id]`.

> **Esto es sobreventa y necesita una decisión antes que un parche.** La
> pregunta que hay que contestar primero no es cómo arreglarlo, sino **qué
> significa `spots_reservados`**: ¿el total de la reserva o los de un día?
> Mientras dos caminos escriban unidades distintas en la misma columna,
> cualquier arreglo tapa un síntoma.

---

## Convención `and tenant_id` — falta en más sitios

`ordenes-compra-repo.ts:46,63` · `campanas-repo.ts:33-48` · `ot-repo.ts:147,178,191`
· `impresion-repo.ts:65` · `propuestas-repo.ts:527,545`.

La RLS con FORCE lo tapa, así que **no hay fuga**. Pero la convención pide la
segunda capa, y hay algo que conviene saber: **esa capa no es observable por
HTTP.** Se midió el 26/08 quitándola de un `DELETE` — las 16 pruebas siguieron
pasando. Ninguna prueba de caja negra la va a encontrar nunca; por eso lleva
años faltando en sitios sin que nadie lo note.

Es un barrido aparte, transversal, y toca `reservar()`.
