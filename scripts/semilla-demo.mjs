#!/usr/bin/env node
// ============================================================================
//  semilla-demo.mjs — el GUION de la demostración, sembrado con datos.
// ----------------------------------------------------------------------------
//  Uso:
//    DATABASE_URL=postgresql://usuario:clave@host:puerto/base \
//      node scripts/semilla-demo.mjs --org=demo-rentabilidad
//
//    ... --guion          imprime el guion y sus cifras. NO toca ninguna base
//    ... --verificar      tras sembrar, mide en la base y imprime el resultado
//    ... --trimestres=6   cuánta historia (por omisión 4; el mínimo útil es 3)
//    ... --ancla=AAAA-MM-DD  desde qué fecha se cuenta hacia atrás (por
//                            omisión hoy). Fija el histórico: con la misma
//                            ancla el guion es idéntico
//    ... --org-nombre='...'  nombre visible de la organización
//
//  ─── Por qué existe ───────────────────────────────────────────────────────
//  El software se presenta el 14 de octubre. El módulo de reportes de
//  rentabilidad estará construido, y **un reporte trimestral sobre una base con
//  tres semanas de datos dibuja una sola barra**. Ese riesgo no lo arregla
//  ningún día de desarrollo y es invisible hasta que se abre la pantalla — en el
//  peor caso, en el escenario.
//
//  Y no basta con volumen: el dueño tiene una frase concreta que el reporte
//  tiene que poder enseñar.
//
//    «Tlalpan G500 es menos rentable que G500 Santa Mónica. Han tenido las
//     mismas campañas, pero a una van a cada rato a arreglarla.»
//
//  Eso es un GUION, no un volcado aleatorio: dos pantallas comparables, las
//  mismas ventas encima de las dos, y la diferencia puesta a propósito en la
//  operación. Quien comprueba que el guion dice lo que promete es
//  `scripts/semilla-demo.test.ts`, que se lo pregunta al MISMO motor que corre
//  detrás de `GET /api/reportes/rentabilidad` (`apps/web/lib/data/reportes.ts`).
//  Las cifras de aquí no se copian a ninguna prueba: se miden.
//
//  ─── Esta semilla NO viaja en la imagen de producción ─────────────────────
//  Y no hay que hacer nada para conseguirlo, solo no deshacerlo: la etapa de
//  ejecución del `Dockerfile` copia scripts por LISTA BLANCA de un solo
//  archivo —`COPY … scripts/migrar.mjs ./scripts/migrar.mjs` (`Dockerfile:106`)—
//  y de `db/` solo `schema.sql` y `migrations/` (`Dockerfile:94-95`). Así que
//  ni este archivo ni `db/seeds/` entran. Es el mismo criterio con el que
//  `db/semilla-desarrollo.sql` se quedó fuera: **una instancia de un cliente no
//  puede nacer con las pantallas de una demostración dentro**. Si alguien
//  añadiera un `COPY scripts/ ./scripts/` genérico, esa propiedad se perdería
//  sin que nada fallara.
//
//  ─── Idempotente, y por qué importa tanto aquí ────────────────────────────
//  Correrlo dos veces no duplica una sola fila. No es pulcritud: la segunda
//  corrida duplicaría reservas, y el reporte enseñaría **el doble de ingreso
//  sin dar el menor error** — el modo de fallo que este repo persigue. Cada
//  `insert` va guardado por una clave natural (`on conflict` donde hay índice
//  único, `not exists` sobre `tenant_id` + clave donde no), y la prueba
//  «NINGUNA sentencia inserta sin guard» lo exige mecánicamente para que la
//  próxima tabla que entre al guion no se escape.
//
//  Lo que la segunda corrida SÍ hace es añadir un trimestre nuevo si el
//  calendario avanzó: los folios llevan el trimestre dentro, así que un
//  trimestre que no existía se siembra y los ya sembrados se reconocen.
//
//  ─── La organización no se da por supuesta ────────────────────────────────
//  El esquema nace SIN ninguna organización a propósito (`db/schema.sql:598`).
//  Este script crea la suya —con el slug que se le pase— y etiqueta cada fila
//  con su `tenant_id`. Nunca asume el tenant `rgb`: esa deriva ya etiquetó
//  filas de unas empresas como de otra (15 modalidades de g500/eyro), y la
//  retira `20260812_sin_default_tenant.sql`.
//
//  ─── Nada real, y se ve ───────────────────────────────────────────────────
//  Ni un dominio, ni una IP, ni un RFC verdadero. Los correos van a `.invalid`,
//  que RFC 2606 reserva para que nunca resuelva; los RFC empiezan por `DMO` y
//  los teléfonos son ceros. Los importes son redondos a propósito: esto se
//  proyecta en una pantalla delante de gente y tiene que leerse como una
//  demostración, no como la contabilidad de alguien.
// ============================================================================
import pg from 'pg'

// ─── Fechas de CALENDARIO, sin zona horaria ────────────────────────────────
//
// Todo lo que se siembra aquí es una fecha de calendario (`date` en Postgres),
// nunca un instante. `new Date('2026-07-01')` la interpreta como medianoche UTC,
// que en México (UTC−6) cae a las 18:00 del día ANTERIOR en hora local. Este
// repo ya pagó ese error dos veces —`diasHasta` en `lib/data/derive.ts` y la
// cabecera de `lib/server/reportes-repo.ts`— y aquí desplazaría una reserva de
// un trimestre a otro sin dar síntoma. Misma técnica que `lib/data/reportes.ts`:
// aritmética sobre día absoluto construido con `Date.UTC`.

/** Día absoluto (entero) de una fecha `AAAA-MM-DD`. */
function nDia(iso) {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d) / 86_400_000
}

/** `AAAA-MM-DD` con ceros a la izquierda, desde un día absoluto. */
function isoDe(n) {
  const d = new Date(n * 86_400_000)
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${d.getUTCFullYear()}-${mm}-${dd}`
}

/** Suma días naturales a una fecha de calendario. */
function masDias(iso, k) {
  return isoDe(nDia(iso) + k)
}

/** Hoy, en fecha de calendario y en hora LOCAL (que es el día que ve quien corre). */
function hoyIso() {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Los `cuantos` trimestres naturales YA CERRADOS anteriores al del ancla, del
 * más antiguo al más reciente.
 *
 * Cerrados a propósito. Un trimestre a medias sale con menos ingreso y menos
 * renta que los demás, y en la gráfica se lee como una caída del negocio en vez
 * de como un periodo incompleto — en una demostración eso es peor que no tener
 * el periodo.
 */
export function trimestresCerrados(ancla, cuantos) {
  const [anioAncla, mesAncla] = ancla.slice(0, 10).split('-').map(Number)
  const idxAncla = anioAncla * 4 + Math.floor((mesAncla - 1) / 3)
  const out = []
  for (let atras = cuantos; atras >= 1; atras--) {
    const i = idxAncla - atras
    const anio = Math.floor(i / 4)
    const t = (i % 4) + 1
    const mesInicial = (t - 1) * 3
    out.push({
      clave: `${anio}-T${t}`,
      anio,
      trimestre: t,
      desde: isoDe(Date.UTC(anio, mesInicial, 1) / 86_400_000),
      hasta: isoDe(Date.UTC(anio, mesInicial + 3, 0) / 86_400_000),
    })
  }
  return out
}

// ─── Las dos pantallas del guion ───────────────────────────────────────────
// Se exportan porque la prueba interroga al reporte POR ESTAS CLAVES: si el
// guion cambiara de nombre, la prueba tiene que romperse, no adaptarse sola.
export const SITIO_TLALPAN = 'DEMO-TLP-01'
export const SITIO_SANTA_MONICA = 'DEMO-STM-01'

// ─── Cuánto cuesta cada tipo de orden de trabajo, para ESTA organización ───
//
// Va a `config_negocio.costos_ot`, que es una fila por tenant (ADR 0011), así
// que estos importes de demostración no tocan los de nadie más.
//
// Se capturan los NUEVE tipos a propósito. `costoDeOt()` cae al respaldo ante
// cualquier hueco (`apps/web/lib/costos-ot.ts`) y el respaldo son 1500 para
// todos: con él, el guion no podría enseñar lo que ahora sí enseña —que el
// costo depende del TIPO—, porque montar una lona y reparar una estructura
// costarían lo mismo. Y son diferencias del tamaño que tiene la vida real: una
// herrería cuesta un múltiplo de una inspección.
export const COSTOS_OT_DEMO = {
  MONTAJE_LONA: 3500,
  MONTAJE_DIGITAL: 4200,
  DESMONTAJE: 2200,
  MANTENIMIENTO_PREVENTIVO: 1800,
  MANTENIMIENTO_CORRECTIVO: 6400,
  HERRERIA: 8900,
  ELECTRICO: 5100,
  INSPECCION: 900,
  OTRO: 1500,
}

// ─── El reparto de la diferencia, declarado como dato ──────────────────────
//
// «A una van a cada rato a arreglarla», y va EMPEORANDO. Un trimestre por
// entrada, del más antiguo al más reciente; con más trimestres que entradas se
// repite la última.
//
// Que empeore en vez de ser una brecha plana es la decisión importante de este
// archivo: una diferencia constante se enseña igual con un solo periodo, y
// entonces el reporte TRIMESTRAL no estaría demostrando nada. Lo que justifica
// el eje de tiempo es ver el margen de Tlalpan caer mientras el de Santa Mónica
// se sostiene.
const AVERIAS_TLALPAN = [
  ['MANTENIMIENTO_CORRECTIVO'],
  ['MANTENIMIENTO_CORRECTIVO', 'ELECTRICO'],
  ['MANTENIMIENTO_CORRECTIVO', 'MANTENIMIENTO_CORRECTIVO', 'HERRERIA'],
  ['MANTENIMIENTO_CORRECTIVO', 'MANTENIMIENTO_CORRECTIVO', 'HERRERIA', 'ELECTRICO'],
]

// ─── Cuánto dura una visita, por tipo ──────────────────────────────────────
//
// Rangos en HORAS, aprobados por Jochelo el 2026-09-18. Son datos de
// DEMOSTRACIÓN, no una medición de campo: el día que haya horas reales
// capturadas, esta tabla deja de hacer falta. Ordenados por duración porque el
// orden ES la información — una inspección es mirar y subir fotos, y una
// herrería es soldadura en estructura.
//
// Y hay una coincidencia que conviene NO deshacer al retocarlos: las visitas
// extra de Tlalpan son `MANTENIMIENTO_CORRECTIVO`, `ELECTRICO` y `HERRERIA`
// (ver `AVERIAS_TLALPAN` arriba), o sea las TRES MÁS LARGAS. Por eso las horas
// amplifican la historia del guion en vez de diluirla. Si alguien aplanara
// estos rangos, el reporte por operación seguiría siendo correcto y dejaría de
// demostrar nada.
const HORAS_POR_TIPO = {
  INSPECCION: [0.5, 1.5],
  OTRO: [1, 3],
  DESMONTAJE: [1.5, 3],
  MANTENIMIENTO_PREVENTIVO: [1.5, 3],
  MONTAJE_LONA: [2, 4],
  ELECTRICO: [2, 5],
  MANTENIMIENTO_CORRECTIVO: [3, 8],
  MONTAJE_DIGITAL: [3, 6],
  HERRERIA: [4, 10],
}

// Hora de cierre de la jornada, en `HH:MM:SS`, arrancando a las 08:00.
//
// DETERMINISTA a propósito, y es la parte que importa: la semilla tiene que ser
// idempotente, así que dos corridas del mismo guion deben producir la MISMA
// hora. Con `Math.random()` la segunda corrida escribiría duraciones distintas
// —y aunque el `on conflict … do nothing` las ignorase, el guion dejaría de ser
// reproducible y ninguna prueba podría fijar un número—. La variedad sale del
// índice de la orden dentro de su sitio, que ya es estable por construcción.
function cierreDeJornada(tipo, indice) {
  const [min, max] = HORAS_POR_TIPO[tipo] ?? HORAS_POR_TIPO.OTRO
  const pasos = Math.round((max - min) / 0.5) + 1        // tramos de media hora
  const horas = min + (((indice * 3 + tipo.length) % pasos) * 0.5)
  const fin = 8 * 60 + Math.round(horas * 60)            // minutos desde las 00:00
  const hh = String(Math.floor(fin / 60)).padStart(2, '0')
  const mm = String(fin % 60).padStart(2, '0')
  return `${hh}:${mm}:00`
}

// Precio por campaña y por pantalla. IDÉNTICO en las dos comparables: si
// difiriera, la conclusión del reporte seguiría siendo cierta pero dejaría de
// demostrar nada —el dueño podría atribuirla a que una se vende peor—. Es
// además lo que pasa de verdad cuando una campaña compra las dos en paquete.
const PRECIO_COMPARABLE = 72000
const PRECIO_SIN_MEDIDAS = 18000

const ARRENDADORES = [
  {
    clave: 'ARR-SUR',
    nombre: 'Arrendador DEMO Sur',
    rfc: 'DMO010101AA1',
    telefono: '55 0000 0001',
    email: 'arrendador.sur@ejemplo.invalid',
    direccion: 'Calle DEMO Sur 000, Ciudad de Mexico',
    formaPago: 'TRANSFERENCIA',
  },
  {
    clave: 'ARR-PTE',
    nombre: 'Arrendador DEMO Poniente',
    rfc: 'DMO010101AA2',
    telefono: '55 0000 0002',
    email: 'arrendador.poniente@ejemplo.invalid',
    direccion: 'Calle DEMO Poniente 000, Ciudad de Mexico',
    formaPago: 'TRANSFERENCIA',
  },
  {
    clave: 'ARR-VIA',
    nombre: 'Arrendador DEMO Viaducto',
    rfc: 'DMO010101AA3',
    telefono: '55 0000 0003',
    email: 'arrendador.viaducto@ejemplo.invalid',
    direccion: 'Calle DEMO Viaducto 000, Ciudad de Mexico',
    formaPago: 'EFECTIVO',
  },
]

// Predios DISTINTOS para las dos comparables, y es deliberado: si compartieran
// predio compartirían contrato, y la renta se repartiría entre las dos caras
// (`rentaAtribuidaPorSitio`, derive.ts). Eso es otro escenario — válido, pero
// no el del guion, donde cada una tiene su arrendador y su renta.
const PREDIOS = [
  {
    clave: 'PRE-TLP',
    arrendadorClave: 'ARR-SUR',
    nombre: 'Predio DEMO Tlalpan',
    direccion: 'Calzada DEMO de Tlalpan 000, Tlalpan, Ciudad de Mexico',
    tipoUbicacion: 'Estacion de servicio',
    estado: 'OCUPADO',
  },
  {
    clave: 'PRE-STM',
    arrendadorClave: 'ARR-PTE',
    nombre: 'Predio DEMO Santa Monica',
    direccion: 'Avenida DEMO Santa Monica 000, Tlalnepantla, Estado de Mexico',
    tipoUbicacion: 'Estacion de servicio',
    estado: 'OCUPADO',
  },
  {
    clave: 'PRE-VIA',
    arrendadorClave: 'ARR-VIA',
    nombre: 'Predio DEMO Viaducto',
    direccion: 'Eje DEMO Viaducto 000, Iztacalco, Ciudad de Mexico',
    tipoUbicacion: 'Bardado industrial',
    estado: 'OCUPADO',
  },
]

// `papel` no se siembra: dice para qué está cada pantalla en el guion, y lo usa
// el reparto de campañas y de órdenes más abajo.
const SITIOS = [
  {
    clave: SITIO_TLALPAN,
    papel: 'comparable',
    sufijoFolio: 'TLP',
    codigoProveedor: 'DEMO-PROV-TLP-01',
    nombre: 'Tlalpan G500',
    predioClave: 'PRE-TLP',
    tipoMedio: 'ESPECTACULAR',
    direccion: 'Calzada DEMO de Tlalpan 000',
    alcaldia: 'Tlalpan',
    plazaCiudad: 'Ciudad de Mexico',
    ciudad: 'Ciudad de Mexico',
    estado: 'Ciudad de Mexico',
    pais: 'MX',
    ancho: 12.9,
    alto: 7.2,
    caras: 1,
    iluminado: true,
    exhibicion: 'fijo',
    unidad: 'mensual',
    tarifa: PRECIO_COMPARABLE,
    notas: 'DEMO · pantalla del guion de rentabilidad: la que se visita mucho.',
  },
  {
    clave: SITIO_SANTA_MONICA,
    papel: 'comparable',
    sufijoFolio: 'STM',
    codigoProveedor: 'DEMO-PROV-STM-01',
    nombre: 'G500 Santa Mónica',
    predioClave: 'PRE-STM',
    tipoMedio: 'ESPECTACULAR',
    direccion: 'Avenida DEMO Santa Monica 000',
    alcaldia: 'Tlalnepantla',
    plazaCiudad: 'Zona Metropolitana',
    ciudad: 'Tlalnepantla',
    estado: 'Estado de Mexico',
    pais: 'MX',
    // Mismas medidas que Tlalpan: son comparables o el guion no vale.
    ancho: 12.9,
    alto: 7.2,
    caras: 1,
    iluminado: true,
    exhibicion: 'fijo',
    unidad: 'mensual',
    tarifa: PRECIO_COMPARABLE,
    notas: 'DEMO · pantalla del guion de rentabilidad: la que casi no se visita.',
  },
  // ─── Las dos SIN MEDIDAS, a propósito ────────────────────────────────────
  // El reporte por metro cuadrado no las puede calcular, y lo que tiene que
  // hacer es EXCLUIRLAS Y CONTARLAS, no esconderlas. Sin una sola pantalla sin
  // medidas, ese aviso del reporte no se puede enseñar ni comprobar.
  //
  // Van las dos en el MISMO predio con un solo contrato: así el guion ejercita
  // además el reparto de la renta entre las caras de un predio, que es el otro
  // anclaje de `rentaAtribuidaPorSitio`.
  {
    clave: 'DEMO-SM-01',
    papel: 'sin-medidas',
    sufijoFolio: 'SM1',
    codigoProveedor: 'DEMO-PROV-SM-01',
    nombre: 'Mural DEMO Viaducto',
    predioClave: 'PRE-VIA',
    tipoMedio: 'MURAL',
    direccion: 'Eje DEMO Viaducto 000, lado norte',
    alcaldia: 'Iztacalco',
    plazaCiudad: 'Ciudad de Mexico',
    ciudad: 'Ciudad de Mexico',
    estado: 'Ciudad de Mexico',
    pais: 'MX',
    ancho: null,
    alto: null,
    caras: 1,
    iluminado: false,
    exhibicion: 'fijo',
    unidad: 'mensual',
    tarifa: PRECIO_SIN_MEDIDAS,
    notas: 'DEMO · sin medidas capturadas a proposito: el reporte de m2 la excluye y la cuenta.',
  },
  {
    clave: 'DEMO-SM-02',
    papel: 'sin-medidas',
    sufijoFolio: 'SM2',
    codigoProveedor: 'DEMO-PROV-SM-02',
    nombre: 'Valla DEMO Zaragoza',
    predioClave: 'PRE-VIA',
    tipoMedio: 'VALLA',
    direccion: 'Eje DEMO Viaducto 000, lado sur',
    alcaldia: 'Iztacalco',
    plazaCiudad: 'Ciudad de Mexico',
    ciudad: 'Ciudad de Mexico',
    estado: 'Ciudad de Mexico',
    pais: 'MX',
    ancho: null,
    alto: null,
    caras: 1,
    iluminado: false,
    exhibicion: 'fijo',
    unidad: 'mensual',
    tarifa: PRECIO_SIN_MEDIDAS,
    notas: 'DEMO · sin medidas capturadas a proposito: el reporte de m2 la excluye y la cuenta.',
  },
]

// Rentas PARECIDAS en las dos comparables (1.8 % de diferencia). Tienen que
// serlo: si una pagara el doble, el costo del espacio explicaría la brecha y el
// guion diría lo contrario de lo que quiere decir. Y no idénticas, porque dos
// arrendadores distintos no firman el mismo número.
const RENTAS = {
  'PRE-TLP': { sitioAncla: SITIO_TLALPAN, monto: 28000 },
  'PRE-STM': { sitioAncla: SITIO_SANTA_MONICA, monto: 27500 },
  'PRE-VIA': { sitioAncla: 'DEMO-SM-01', monto: 6000 },
}

const CLIENTES = [
  {
    clave: 'CLI-1',
    nombre: 'Cliente DEMO Bebidas del Valle',
    rfc: 'DMO010101BB1',
    razonSocial: 'Bebidas del Valle DEMO, S.A. de C.V.',
    regimenFiscal: '601 - General de Ley Personas Morales',
    tipo: 'DIRECTO',
    ivaPct: 16,
  },
  {
    clave: 'CLI-2',
    nombre: 'Cliente DEMO Banca Ejemplo',
    rfc: 'DMO010101BB2',
    razonSocial: 'Banca Ejemplo DEMO, S.A. de C.V.',
    regimenFiscal: '601 - General de Ley Personas Morales',
    tipo: 'AGENCIA',
    ivaPct: 16,
  },
]

// ─── El plan ───────────────────────────────────────────────────────────────

/**
 * El guion completo, como DATO puro. No abre conexiones, no lee la hora si se
 * le da ancla y no genera un solo identificador aleatorio.
 *
 * Es puro por dos razones, y las dos importan:
 *   · así la prueba puede pasárselo al motor de reportes de verdad y comprobar
 *     que el guion dice lo que promete, sin Postgres y sin Docker;
 *   · así la SEGUNDA corrida del script produce exactamente las mismas claves
 *     naturales que la primera, que es lo que hace posible reconocer lo ya
 *     sembrado en vez de duplicarlo.
 */
export function planSemilla(opciones = {}) {
  const ancla = (opciones.ancla ?? hoyIso()).slice(0, 10)
  const cuantos = Number(opciones.trimestres ?? 4)
  if (!Number.isInteger(cuantos) || cuantos < 3) {
    // Tres es el mínimo con sentido, y es el motivo de que esta tarea exista:
    // con dos periodos una tendencia es una recta entre dos puntos y no se
    // distingue de un dato suelto.
    throw new Error(`--trimestres tiene que ser un entero >= 3 (recibido: ${opciones.trimestres})`)
  }

  const slug = opciones.slug ?? 'demo-rentabilidad'
  const nombre = opciones.nombreOrg ?? 'Organizacion DEMO Rentabilidad'
  const moneda = opciones.moneda ?? 'MXN'
  const trimestres = trimestresCerrados(ancla, cuantos)

  // La vigencia de los contratos CUBRE todo el histórico, y eso no es un
  // detalle de forma: un contrato que solo valiera «hoy» dejaría los trimestres
  // pasados sin costo de espacio, y el reporte enseñaría márgenes inflados justo
  // en los periodos que se van a mirar. Empieza un mes antes del primer
  // trimestre y termina un año después del último.
  const vigenciaDesde = masDias(trimestres[0].desde, -31)
  const vigenciaHasta = isoDe(nDia(trimestres[trimestres.length - 1].hasta) + 365)

  const contratos = PREDIOS.map((p) => ({
    clave: `CON-${p.clave}`,
    predioClave: p.clave,
    sitioClave: RENTAS[p.clave].sitioAncla,
    arrendadorClave: p.arrendadorClave,
    fechaInicio: vigenciaDesde,
    fechaFin: vigenciaHasta,
    montoRenta: RENTAS[p.clave].monto,
    periodicidad: 'MENSUAL',
    moneda,
    deposito: RENTAS[p.clave].monto * 2,
    estatus: 'VIGENTE',
  }))

  const comparables = SITIOS.filter((s) => s.papel === 'comparable').map((s) => s.clave)
  const sinMedidas = SITIOS.filter((s) => s.papel === 'sin-medidas').map((s) => s.clave)

  const campanas = []
  const reservas = []
  const ordenesTrabajo = []

  trimestres.forEach((t, iT) => {
    // El trimestre se parte en dos mitades por DÍAS naturales, y cada mitad es
    // una campaña. Las dos quedan enteras dentro del trimestre a propósito: el
    // reporte prorratea el precio por días (`reportes.ts`), así que una reserva
    // a caballo entre dos trimestres repartiría su ingreso y las cifras del
    // guion dejarían de ser redondas en pantalla.
    const dias = nDia(t.hasta) - nDia(t.desde) + 1
    const corte = masDias(t.desde, Math.floor(dias / 2) - 1)

    const tramos = [
      { n: 1, desde: t.desde, hasta: corte, conSinMedidas: true },
      { n: 2, desde: masDias(corte, 1), hasta: t.hasta, conSinMedidas: false },
    ]

    for (const tramo of tramos) {
      const cliente = CLIENTES[(iT + tramo.n) % CLIENTES.length]
      const folio = `DEMO-CMP-${t.clave}-${tramo.n}`
      const sitiosDeLaCampana = tramo.conSinMedidas
        ? [...comparables, ...sinMedidas]
        : [...comparables]

      const bruto = sitiosDeLaCampana.reduce(
        (a, clave) => a + (comparables.includes(clave) ? PRECIO_COMPARABLE : PRECIO_SIN_MEDIDAS),
        0,
      )

      campanas.push({
        folio,
        trimestre: t.clave,
        clienteClave: cliente.clave,
        clienteRfc: cliente.rfc,
        nombre: `Campana DEMO ${cliente.nombre.replace('Cliente DEMO ', '')} ${t.clave}-${tramo.n}`,
        tipoCampana: 'OOH',
        fechaInicio: tramo.desde,
        fechaFin: tramo.hasta,
        presupuestoBruto: bruto,
        moneda,
        // COMPLETADA: son trimestres cerrados. Una campaña de un periodo pasado
        // que siguiera en DRAFT sería un dato incoherente en la pantalla de
        // comercial, y la demo se mira entera, no solo el reporte.
        estadoComercial: 'COMPLETADA',
        notas: 'DEMO · campana del guion de rentabilidad.',
      })

      for (const clave of sitiosDeLaCampana) {
        reservas.push({
          campanaFolio: folio,
          sitioClave: clave,
          trimestre: t.clave,
          fechaInicio: tramo.desde,
          fechaFin: tramo.hasta,
          precio: comparables.includes(clave) ? PRECIO_COMPARABLE : PRECIO_SIN_MEDIDAS,
          tipoVenta: 'FIXED_PKG',
          estatus: 'CONFIRMADA',
        })
      }
    }

    // ─── Las órdenes de trabajo ──────────────────────────────────────────
    // La BASE es la misma para todas: montar al empezar la campaña, desmontar
    // al acabarla, y una inspección por trimestre. Es lo que hace que la
    // diferencia de Tlalpan sea atribuible y no un ruido más.
    const porSitio = new Map(SITIOS.map((s) => [s.clave, []]))

    for (const c of campanas.filter((c) => c.trimestre === t.clave)) {
      for (const r of reservas.filter((r) => r.campanaFolio === c.folio)) {
        porSitio.get(r.sitioClave).push({
          tipo: 'MONTAJE_LONA',
          fecha: c.fechaInicio,
          campanaFolio: c.folio,
          descripcion: `Montaje de lona para ${c.nombre}`,
        })
        porSitio.get(r.sitioClave).push({
          tipo: 'DESMONTAJE',
          fecha: c.fechaFin,
          campanaFolio: c.folio,
          descripcion: `Desmontaje al cierre de ${c.nombre}`,
        })
      }
    }

    for (const s of SITIOS) {
      porSitio.get(s.clave).push({
        tipo: 'INSPECCION',
        fecha: masDias(t.desde, 45),
        campanaFolio: null,
        descripcion: `Inspeccion trimestral de rutina (${t.clave})`,
      })
    }

    // Y aquí, la diferencia deliberada: «a una van a cada rato a arreglarla».
    const averias = AVERIAS_TLALPAN[Math.min(iT, AVERIAS_TLALPAN.length - 1)]
    averias.forEach((tipo, i) => {
      porSitio.get(SITIO_TLALPAN).push({
        tipo,
        // Repartidas dentro del trimestre, nunca más allá de su día 80: tienen
        // que caer en el bucket del trimestre o el costo se iría a otro periodo.
        fecha: masDias(t.desde, Math.min(20 + i * 18, 80)),
        campanaFolio: null,
        descripcion: `Atencion correctiva en sitio (${tipo.toLowerCase()}) — ${t.clave}`,
      })
    })

    // Folios deterministas: `DEMO-OT-<trimestre>-<sitio>-<nn>`. Son la clave
    // natural con la que la segunda corrida reconoce la orden ya sembrada, así
    // que se numeran en un orden estable (el de `SITIOS`, y dentro el de
    // creación) y NO con un contador global que dependiera de la hora.
    for (const s of SITIOS) {
      porSitio.get(s.clave).forEach((o, i) => {
        ordenesTrabajo.push({
          folio: `DEMO-OT-${t.clave}-${s.sufijoFolio}-${String(i + 1).padStart(2, '0')}`,
          trimestre: t.clave,
          sitioClave: s.clave,
          campanaFolio: o.campanaFolio,
          tipo: o.tipo,
          descripcion: o.descripcion,
          prioridad: o.tipo === 'MANTENIMIENTO_CORRECTIVO' ? 'ALTA' : 'NORMAL',
          fechaProgramada: o.fecha,
          // Trimestres cerrados: el trabajo ya se hizo. `fechaDeOt()` del
          // reporte usa `completada → programada → creación`, así que con la
          // completada puesta el costo cae en el periodo en que se trabajó.
          //
          // Las DOS llevan hora, y no solo fecha, porque sin `fecha_inicio` el
          // reporte por operación devuelve `horasEnSitio: null` y
          // `visitasConDuracion: 0` — medido el 18/09 con la app levantada, y
          // la columna de horas salía vacía. El reporte no estaba mal: informaba
          // null en vez de inventar un cero, y era la semilla la que no daba el
          // dato.
          //
          // La jornada empieza a las 08:00 y la duración sale de la tabla de
          // arriba, así que el cierre nunca pasa de las 18:00 y **la fecha no
          // cambia**: los buckets del reporte se calculan con
          // `fecha_completada::date` y tienen que seguir cayendo donde caían.
          // De paso, 08:00 es más seguro que la medianoche implícita que había
          // antes, que es la hora que un desplazamiento de zona manda al día
          // anterior.
          fechaInicio: `${o.fecha}T08:00:00`,
          fechaCompletada: `${o.fecha}T${cierreDeJornada(o.tipo, i)}`,
          estatus: 'COMPLETADA',
        })
      })
    }
  })

  return {
    organizacion: { slug, nombre, moneda },
    ancla,
    trimestres,
    costosOt: COSTOS_OT_DEMO,
    arrendadores: ARRENDADORES,
    predios: PREDIOS,
    sitios: SITIOS,
    contratos,
    clientes: CLIENTES,
    campanas,
    reservas,
    ordenesTrabajo,
  }
}

/**
 * El plan traducido a lo que come `rentabilidadPorSitio()`
 * (`apps/web/lib/data/reportes.ts`), usando las claves naturales como ids.
 *
 * Existe para que la prueba le pregunte al MOTOR DE VERDAD si el guion se
 * cumple, en vez de rehacer la aritmética del prorrateo en la prueba. Ese
 * atajo comprobaría que la semilla cuadra con la copia de la prueba, no con lo
 * que el reporte va a dibujar — y este repo documenta esa clase de error como su
 * error de raíz (`lib/server/tenant.ts:87-89`).
 *
 * La forma es la MISMA que devuelve `lib/server/reportes-repo.ts` desde la
 * base. Si esa forma cambia, la prueba se rompe aquí, que es donde se ve.
 */
export function datosDeRentabilidad(plan) {
  return {
    sitios: plan.sitios.map((s) => ({
      id: s.clave,
      nombre: s.nombre,
      claveInterna: s.clave,
      codigoProveedor: s.codigoProveedor,
      caras: s.caras,
      predioId: s.predioClave,
    })),
    contratos: plan.contratos.map((c) => ({
      id: c.clave,
      sitioId: c.sitioClave,
      arrendadorId: c.arrendadorClave,
      predioId: c.predioClave,
      montoRenta: c.montoRenta,
      periodicidad: c.periodicidad,
      estatus: c.estatus,
      fechaInicio: c.fechaInicio,
      fechaFin: c.fechaFin,
    })),
    arrendadores: plan.arrendadores.map((a) => ({ id: a.clave, nombre: a.nombre })),
    reservas: plan.reservas.map((r) => ({
      sitioId: r.sitioClave,
      precio: r.precio,
      estatus: r.estatus,
      fechaInicio: r.fechaInicio,
      fechaFin: r.fechaFin,
    })),
    ordenesTrabajo: plan.ordenesTrabajo.map((o) => ({
      sitioId: o.sitioClave,
      tipo: o.tipo,
      estatus: o.estatus,
      fechaCompletada: o.fechaCompletada,
      fechaProgramada: o.fechaProgramada,
      creadoEn: null,
    })),
    costosOt: plan.costosOt,
  }
}

// ─── El SQL ────────────────────────────────────────────────────────────────
//
// Cada sentencia lleva su GUARD contra la segunda corrida, y el guard se elige
// por lo que la base garantiza:
//   · `on conflict (clave) do nothing` donde hay un índice único de verdad
//     (`tenants.slug`, `sitios.clave_interna`, `campanas.folio`,
//     `ordenes_trabajo.folio`). Es el más fuerte: no depende de lo que la
//     consulta pueda VER, y esas tres claves son únicas GLOBALES, no por
//     tenant, así que un `not exists` filtrado por tenant podría no ver el
//     choque y estrellarse contra la restricción.
//   · `where not exists (… tenant_id = $1 and <clave natural>)` en las tablas
//     cuya unicidad es por organización o no está declarada. Aquí el filtro por
//     tenant es correcto Y necesario: sin él, la existencia de una fila
//     homónima de OTRA empresa haría que esta se quedara sin sembrar.
//
// Las claves ajenas se resuelven DENTRO del SQL por clave natural
// (`from predios p where p.nombre = $n`) en vez de con un ida y vuelta por
// cada id. Así toda la semilla cabe en una transacción y no hay un estado
// intermedio en el que la mitad de las filas existan.
//
// Todos los parámetros van con CAST explícito. En `insert into … select $1, $2`
// Postgres resuelve los tipos de la lista del select antes de mirar las columnas
// destino, y un parámetro sin cast revienta con «could not determine data type
// of parameter» — que además solo se ve al correrlo contra una base.

/** La organización. Va aparte porque su id es lo que necesitan las demás. */
export function sentenciaOrganizacion(plan) {
  return {
    etiqueta: `organizacion ${plan.organizacion.slug}`,
    sql: `insert into tenants (nombre, slug, moneda)
          values ($1::text, $2::text, $3::text)
          on conflict (slug) do nothing`,
    valores: [plan.organizacion.nombre, plan.organizacion.slug, plan.organizacion.moneda],
  }
}

/**
 * Todo lo demás, en orden de dependencia, ya etiquetado con `tenant_id`.
 *
 * El orden no es estético: predios necesitan arrendadores, sitios necesitan
 * predios, contratos necesitan las dos, reservas necesitan campañas y sitios.
 */
export function sentenciasDelPlan(plan, tenantId) {
  const out = []
  const T = tenantId

  // ─── Configuración del negocio ─────────────────────────────────────────
  // Dos sentencias, y la segunda es a conciencia: la fila puede existir ya
  // —la crea la app al primer acceso (`lib/server/config-repo.ts:59-61`)— y el
  // guion NO funciona sin sus importes por tipo de OT. Así que la semilla se
  // declara DUEÑA de `costos_ot` para esta organización de demostración. Un
  // `update` es idempotente por naturaleza: no hay segunda corrida que duplique.
  out.push({
    etiqueta: 'config_negocio (si falta)',
    sql: `insert into config_negocio (tenant_id, moneda, costos_ot)
          select $1::uuid, $2::text, $3::jsonb
           where not exists (select 1 from config_negocio c where c.tenant_id = $1::uuid)`,
    valores: [T, plan.organizacion.moneda, JSON.stringify(plan.costosOt)],
  })
  out.push({
    etiqueta: 'config_negocio.costos_ot',
    // La ÚNICA sentencia del guion que no inserta. Se marca para que el recuento
    // de la corrida no la cuente como fila nueva: si lo hiciera, la segunda
    // corrida diría «filas nuevas: 1» y la demostración de idempotencia
    // quedaría en entredicho por un dato mal etiquetado.
    actualiza: true,
    sql: `update config_negocio
             set costos_ot = $2::jsonb, moneda = $3::text
           where tenant_id = $1::uuid`,
    valores: [T, JSON.stringify(plan.costosOt), plan.organizacion.moneda],
  })

  for (const a of plan.arrendadores) {
    out.push({
      etiqueta: `arrendador ${a.nombre}`,
      sql: `insert into arrendadores (tenant_id, nombre, rfc, telefono, email, direccion, forma_pago, activo)
            select $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, true
             where not exists (
               select 1 from arrendadores x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      valores: [T, a.nombre, a.rfc, a.telefono, a.email, a.direccion, a.formaPago],
    })
  }

  for (const p of plan.predios) {
    const arr = plan.arrendadores.find((a) => a.clave === p.arrendadorClave)
    out.push({
      etiqueta: `predio ${p.nombre}`,
      sql: `insert into predios (tenant_id, arrendador_id, nombre, direccion, tipo_ubicacion, estado)
            select $1::uuid, a.id, $2::text, $3::text, $4::text, $5::estado_predio
              from arrendadores a
             where a.tenant_id = $1::uuid and a.nombre = $6::text
               and not exists (
                 select 1 from predios x where x.tenant_id = $1::uuid and x.nombre = $2::text)`,
      valores: [T, p.nombre, p.direccion, p.tipoUbicacion, p.estado, arr.nombre],
    })
  }

  for (const s of plan.sitios) {
    const predio = plan.predios.find((p) => p.clave === s.predioClave)
    out.push({
      etiqueta: `sitio ${s.clave} (${s.nombre})`,
      sql: `insert into sitios (
              tenant_id, clave_interna, codigo_proveedor, nombre, tipo_medio,
              direccion, direccion_predio, direccion_comercial,
              alcaldia, plaza_ciudad, ciudad, estado, pais,
              ancho, alto, caras, iluminado, exhibicion, unidad,
              tarifa_mensual, tarifa_publicada, predio_id, arrendador_id,
              estatus_comercial, estatus_legal, estatus_operativo, notas)
            select $1::uuid, $2::text, $3::text, $4::text, $5::tipo_medio,
                   $6::text, $6::text, $6::text,
                   $7::text, $8::text, $9::text, $10::text, $11::text,
                   $12::numeric, $13::numeric, $14::integer, $15::boolean, $16::text, $17::text,
                   $18::numeric, $18::numeric, p.id, p.arrendador_id,
                   'OCUPADO'::est_comercial, 'EN_ORDEN'::est_legal, 'ACTIVO'::est_operativo,
                   $19::text
              from predios p
             where p.tenant_id = $1::uuid and p.nombre = $20::text
            on conflict (clave_interna) do nothing`,
      valores: [
        T, s.clave, s.codigoProveedor, s.nombre, s.tipoMedio,
        s.direccion, s.alcaldia, s.plazaCiudad, s.ciudad, s.estado, s.pais,
        s.ancho, s.alto, s.caras, s.iluminado, s.exhibicion, s.unidad,
        s.tarifa, s.notas, predio.nombre,
      ],
    })
  }

  for (const c of plan.contratos) {
    const predio = plan.predios.find((p) => p.clave === c.predioClave)
    out.push({
      etiqueta: `contrato de ${predio.nombre}`,
      // El guard mira «¿ya hay un contrato ACTIVO en este predio?», que es
      // exactamente lo que declara `contratos_predio_activo_uq`
      // (`20260716_arr_m8_contrato_activo_unico.sql:28`). Cualquier otro guard
      // —por fechas, por importe— dejaría pasar un segundo contrato activo y la
      // atribución de renta empezaría a elegir «el de mayor renta» entre dos que
      // nadie quiso duplicar.
      sql: `insert into contratos_arrendamiento (
              tenant_id, sitio_id, arrendador_id, predio_id,
              fecha_inicio, fecha_fin, monto_renta, periodicidad, moneda, deposito, estatus)
            select $1::uuid, s.id, p.arrendador_id, p.id,
                   $2::date, $3::date, $4::numeric, $5::periodicidad_pago,
                   $6::text, $7::numeric, $8::est_contrato
              from predios p
              join sitios s
                on s.tenant_id = $1::uuid and s.predio_id = p.id and s.clave_interna = $9::text
             where p.tenant_id = $1::uuid and p.nombre = $10::text
               and not exists (
                 select 1 from contratos_arrendamiento x
                  where x.tenant_id = $1::uuid and x.predio_id = p.id
                    and x.estatus in ('VIGENTE','POR_VENCER','RENOVADO'))`,
      valores: [
        T, c.fechaInicio, c.fechaFin, c.montoRenta, c.periodicidad,
        c.moneda, c.deposito, c.estatus, c.sitioClave, predio.nombre,
      ],
    })
  }

  for (const cl of plan.clientes) {
    out.push({
      etiqueta: `cliente ${cl.nombre}`,
      sql: `insert into clientes (tenant_id, nombre, rfc, razon_social, regimen_fiscal, tipo, iva_pct, activo)
            select $1::uuid, $2::text, $3::text, $4::text, $5::text, $6::text, $7::numeric, true
             where not exists (
               select 1 from clientes x where x.tenant_id = $1::uuid and x.rfc = $3::text)`,
      valores: [T, cl.nombre, cl.rfc, cl.razonSocial, cl.regimenFiscal, cl.tipo, cl.ivaPct],
    })
  }

  for (const c of plan.campanas) {
    out.push({
      etiqueta: `campana ${c.folio}`,
      sql: `insert into campanas (
              tenant_id, folio, nombre, cliente_id, tipo_campana,
              fecha_inicio, fecha_fin, presupuesto_bruto, presupuesto_neto,
              moneda, estado_comercial, notas)
            select $1::uuid, $2::text, $3::text, cl.id, $4::tipo_campana,
                   $5::date, $6::date, $7::numeric, $7::numeric,
                   $8::text, $9::est_comercial_campana, $10::text
              from clientes cl
             where cl.tenant_id = $1::uuid and cl.rfc = $11::text
            on conflict (folio) do nothing`,
      valores: [
        T, c.folio, c.nombre, c.tipoCampana, c.fechaInicio, c.fechaFin,
        c.presupuestoBruto, c.moneda, c.estadoComercial, c.notas, c.clienteRfc,
      ],
    })
  }

  for (const r of plan.reservas) {
    out.push({
      etiqueta: `reserva ${r.campanaFolio} · ${r.sitioClave}`,
      sql: `insert into reservas (
              tenant_id, campana_id, sitio_id, fecha_inicio, fecha_fin, precio, tipo_venta, estatus)
            select $1::uuid, c.id, s.id, $2::date, $3::date, $4::numeric,
                   $5::tipo_venta, $6::est_reserva
              from campanas c
              join sitios s on s.tenant_id = $1::uuid and s.clave_interna = $7::text
             where c.tenant_id = $1::uuid and c.folio = $8::text
               and not exists (
                 select 1 from reservas x
                  where x.tenant_id = $1::uuid and x.campana_id = c.id and x.sitio_id = s.id)`,
      valores: [
        T, r.fechaInicio, r.fechaFin, r.precio, r.tipoVenta, r.estatus,
        r.sitioClave, r.campanaFolio,
      ],
    })
  }

  for (const o of plan.ordenesTrabajo) {
    out.push({
      etiqueta: `OT ${o.folio}`,
      sql: `insert into ordenes_trabajo (
              tenant_id, folio, tipo, sitio_id, campana_id, descripcion,
              prioridad, fecha_programada, fecha_inicio, fecha_completada, estatus)
            select $1::uuid, $2::text, $3::tipo_ot, s.id, c.id, $4::text,
                   $5::prioridad, $6::timestamptz, $7::timestamptz, $8::timestamptz,
                   $9::est_ot
              from sitios s
              left join campanas c on c.tenant_id = $1::uuid and c.folio = $10::text
             where s.tenant_id = $1::uuid and s.clave_interna = $11::text
            on conflict (folio) do nothing`,
      valores: [
        T, o.folio, o.tipo, o.descripcion, o.prioridad,
        o.fechaProgramada, o.fechaInicio, o.fechaCompletada, o.estatus,
        o.campanaFolio, o.sitioClave,
      ],
    })
  }

  return out
}

// ─── Lo que se mide EN LA BASE después de sembrar ──────────────────────────
//
// ⚠️ Es una cuenta INDEPENDIENTE, y a propósito: no pasa por
// `lib/data/reportes.ts`. Sirve para confirmar que lo que quedó guardado es lo
// que el plan decía, con una aritmética que nadie compartió con el motor.
//
// Vale SOLO para esta semilla, y hay que decir por qué: cada reserva cabe
// entera dentro de su trimestre y los contratos cubren todo el rango, así que
// aquí no hace falta prorratear nada. **La aritmética que manda es la del
// motor**, y quien la comprueba contra el guion es `semilla-demo.test.ts`. Si
// las dos discreparan, la que está mal es esta.
const SQL_MEDICION = `
with sitios_demo as (
  select s.id, s.clave_interna, s.nombre, s.caras, s.predio_id, s.ancho, s.alto
    from sitios s
   where s.tenant_id = $1::uuid and s.clave_interna like 'DEMO-%'
),
caras_predio as (
  select predio_id, sum(caras) caras from sitios_demo where predio_id is not null group by 1
),
renta as (
  select sd.id, c.monto_renta * (sd.caras::numeric / cp.caras) mensual
    from sitios_demo sd
    join caras_predio cp on cp.predio_id = sd.predio_id
    join contratos_arrendamiento c
      on c.tenant_id = $1::uuid and c.predio_id = sd.predio_id
     and c.estatus in ('VIGENTE','POR_VENCER','RENOVADO')
),
ingreso as (
  select r.sitio_id, sum(r.precio) monto, count(*) n
    from reservas r
   where r.tenant_id = $1::uuid and r.estatus <> 'CANCELADA'
     and r.fecha_inicio >= $2::date and r.fecha_fin <= $3::date
   group by 1
),
operacion as (
  select o.sitio_id,
         sum(coalesce((cn.costos_ot ->> o.tipo::text)::numeric, 1500)) monto,
         count(*) n
    from ordenes_trabajo o
    join config_negocio cn on cn.tenant_id = $1::uuid
   where o.tenant_id = $1::uuid and o.estatus <> 'CANCELADA'
     and coalesce(o.fecha_completada, o.fecha_programada, o.creado_en)::date
         between $2::date and $3::date
   group by 1
)
select sd.clave_interna                                          as clave,
       sd.nombre,
       (sd.ancho is null and sd.alto is null)                     as sin_medidas,
       coalesce(i.n, 0)                                           as reservas,
       coalesce(i.monto, 0)                                       as ingreso,
       round(coalesce(re.mensual, 0) * $4::numeric, 2)            as costo_espacio,
       coalesce(op.n, 0)                                          as ot,
       coalesce(op.monto, 0)                                      as costo_operacion,
       coalesce(i.monto, 0)
         - round(coalesce(re.mensual, 0) * $4::numeric, 2)
         - coalesce(op.monto, 0)                                  as margen
  from sitios_demo sd
  left join renta re     on re.id = sd.id
  left join ingreso i    on i.sitio_id = sd.id
  left join operacion op on op.sitio_id = sd.id
 order by margen asc`

const SQL_MEDICION_OT = `
select s.clave_interna as clave, o.tipo::text as tipo, count(*)::int as n
  from ordenes_trabajo o
  join sitios s on s.id = o.sitio_id and s.tenant_id = $1::uuid
 where o.tenant_id = $1::uuid and s.clave_interna like 'DEMO-%'
   and coalesce(o.fecha_completada, o.fecha_programada, o.creado_en)::date
       between $2::date and $3::date
 group by 1, 2
 order by 1, 2`

// ─── Línea de órdenes ──────────────────────────────────────────────────────

const USO = `uso:
  DATABASE_URL=postgresql://usuario:clave@host:puerto/base \\
    node scripts/semilla-demo.mjs [opciones]

  --org=<slug>            organizacion a crear/reusar (por omision demo-rentabilidad)
  --org-nombre=<texto>    su nombre visible
  --trimestres=<n>        cuanta historia; entero >= 3 (por omision 4)
  --ancla=AAAA-MM-DD      desde que fecha se cuenta hacia atras (por omision hoy)
  --guion                 imprime el guion y NO toca ninguna base
  --verificar             tras sembrar, mide en la base e imprime el resultado`

// La base de INTEGRACION es del arnés, y `recrearEsquema()` la deja como la
// encuentre: sembrarla haría fallar suites ajenas con filas que sus pruebas no
// esperan, y el rojo no diría nada de por qué. Se niega siempre y por nombre.
const BASES_PROHIBIDAS = ['spaces_e2e']

function nombreDeBase(url) {
  try {
    return new URL(url).pathname.replace(/^\//, '')
  } catch {
    return ''
  }
}

function opcionesDeArgv(args) {
  const o = { guion: false, verificar: false }
  for (const a of args) {
    if (a === '--guion') { o.guion = true; continue }
    if (a === '--verificar') { o.verificar = true; continue }
    const m = /^--([a-z-]+)=(.*)$/.exec(a)
    if (!m) throw new Error(`argumento desconocido: ${a}\n\n${USO}`)
    const [, clave, valor] = m
    if (clave === 'org') o.slug = valor
    else if (clave === 'org-nombre') o.nombreOrg = valor
    else if (clave === 'trimestres') o.trimestres = Number(valor)
    else if (clave === 'ancla') o.ancla = valor
    else throw new Error(`opcion desconocida: --${clave}\n\n${USO}`)
  }
  return o
}

function imprimirGuion(plan) {
  console.log(`\nGUION DE LA DEMO — organizacion '${plan.organizacion.slug}'`)
  console.log(`  ancla        ${plan.ancla}`)
  console.log(
    `  trimestres   ${plan.trimestres.length}  (${plan.trimestres[0].desde} → ` +
      `${plan.trimestres[plan.trimestres.length - 1].hasta})`,
  )
  console.log(`               ${plan.trimestres.map((t) => t.clave).join(' · ')}`)
  console.log(
    `  a sembrar    ${plan.arrendadores.length} arrendadores · ${plan.predios.length} predios · ` +
      `${plan.sitios.length} pantallas · ${plan.contratos.length} contratos`,
  )
  console.log(
    `               ${plan.clientes.length} clientes · ${plan.campanas.length} campanas · ` +
      `${plan.reservas.length} reservas · ${plan.ordenesTrabajo.length} ordenes de trabajo`,
  )
  console.log('\n  ordenes de trabajo por pantalla:')
  for (const s of plan.sitios) {
    const suyas = plan.ordenesTrabajo.filter((o) => o.sitioClave === s.clave)
    const porTipo = {}
    for (const o of suyas) porTipo[o.tipo] = (porTipo[o.tipo] ?? 0) + 1
    const detalle = Object.entries(porTipo)
      .map(([t, n]) => `${t}×${n}`)
      .join(', ')
    console.log(`    ${s.clave.padEnd(11)} ${String(suyas.length).padStart(3)}  ${detalle}`)
  }
  console.log('')
}

function imprimirTabla(filas) {
  const n = (v) => Number(v).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  console.log('')
  console.log(
    'clave        pantalla                 m2?   res   ingreso        espacio        OT  operacion      margen',
  )
  console.log('-'.repeat(118))
  for (const f of filas) {
    console.log(
      `${f.clave.padEnd(12)} ${String(f.nombre).slice(0, 24).padEnd(24)} ` +
        `${(f.sin_medidas ? 'NO' : 'si').padEnd(5)} ` +
        `${String(f.reservas).padStart(3)} ` +
        `${n(f.ingreso).padStart(13)} ` +
        `${n(f.costo_espacio).padStart(14)} ` +
        `${String(f.ot).padStart(4)} ` +
        `${n(f.costo_operacion).padStart(13)} ` +
        `${n(f.margen).padStart(13)}`,
    )
  }
  console.log('')
}

export async function main(argv = process.argv) {
  let o
  let plan
  try {
    o = opcionesDeArgv(argv.slice(2))
    plan = planSemilla(o)
  } catch (e) {
    // Un argumento mal escrito es un error del operador, no un fallo del
    // programa: sale el mensaje y nada más. Una traza de Node de doce líneas
    // esconde justo la frase que dice qué hay que corregir.
    console.error(`ERROR semilla-demo: ${e.message}`)
    return 1
  }

  if (o.guion) {
    imprimirGuion(plan)
    console.log('--guion: no se toco ninguna base.')
    return 0
  }

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error(`ERROR semilla-demo: falta DATABASE_URL.\n\n${USO}`)
    return 1
  }
  const base = nombreDeBase(url)
  if (BASES_PROHIBIDAS.includes(base)) {
    console.error(
      `ERROR semilla-demo: me niego a sembrar '${base}'.\n` +
        'Es la base del arnes de integracion: `recrearEsquema()` la rehace en cada\n' +
        'corrida y estas filas harian fallar suites que no las esperan, con un rojo\n' +
        'que no dice por que. Usa una base propia de la demo.',
    )
    return 1
  }

  imprimirGuion(plan)

  const cli = new pg.Client({ connectionString: url })
  await cli.connect()
  let salida = 0
  try {
    await cli.query('begin')

    const org = sentenciaOrganizacion(plan)
    const creada = await cli.query(org.sql, org.valores)
    const { rows } = await cli.query('select id from tenants where slug = $1::text', [
      plan.organizacion.slug,
    ])
    if (!rows.length) throw new Error(`no se pudo resolver la organizacion '${plan.organizacion.slug}'`)
    const tenantId = rows[0].id
    console.log(
      `organizacion '${plan.organizacion.slug}' → ${tenantId} ` +
        `(${creada.rowCount ? 'creada ahora' : 'ya existia'})`,
    )

    // R2: el contexto de tenant se fija TRANSACTION-LOCAL, igual que hace `q()`
    // (`lib/server/db.ts`). Aquí se siembra con un rol que puede saltarse la RLS,
    // así que esto no es lo que protege el aislamiento —lo protege el `tenant_id`
    // explícito de cada sentencia—, pero `config_negocio` tiene FORCE ROW LEVEL
    // SECURITY y sin contexto una lectura normal devuelve CERO filas: el guard
    // de «si falta, insértala» no vería la que ya está y chocaría contra su
    // índice único.
    await cli.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId])

    let nuevas = 0
    let yaEstaban = 0
    let alDia = 0
    for (const s of sentenciasDelPlan(plan, tenantId)) {
      const r = await cli.query(s.sql, s.valores)
      // Las sentencias marcadas `actualiza` NO crean filas, así que se cuentan
      // aparte. Mezclarlas hacía que la segunda corrida dijera «filas nuevas: 1»
      // y dejara la idempotencia en entredicho por un dato mal etiquetado.
      if (s.actualiza) {
        alDia += r.rowCount
        continue
      }
      if (r.rowCount > 0) {
        nuevas += r.rowCount
        console.log(`  + ${s.etiqueta}`)
      } else {
        yaEstaban += 1
      }
    }

    await cli.query('commit')
    console.log(
      `\nfilas nuevas: ${nuevas} · ya sembradas: ${yaEstaban} · puestas al dia: ${alDia}`,
    )
    if (nuevas === 0) console.log('nada que hacer: la semilla ya estaba completa (idempotente).')

    if (o.verificar) {
      const desde = plan.trimestres[0].desde
      const hasta = plan.trimestres[plan.trimestres.length - 1].hasta
      const meses = plan.trimestres.length * 3
      await cli.query('begin')
      await cli.query('select set_config($1, $2, true)', ['app.tenant_id', tenantId])
      const med = await cli.query(SQL_MEDICION, [tenantId, desde, hasta, meses])
      const ots = await cli.query(SQL_MEDICION_OT, [tenantId, desde, hasta])
      await cli.query('commit')

      console.log(`\nMEDIDO EN LA BASE — ${desde} → ${hasta} (${meses} meses, cuenta independiente)`)
      imprimirTabla(med.rows)
      console.log('ordenes de trabajo por pantalla y tipo:')
      for (const r of ots.rows) console.log(`  ${r.clave.padEnd(12)} ${r.tipo.padEnd(26)} ${r.n}`)

      const t = med.rows.find((r) => r.clave === SITIO_TLALPAN)
      const s = med.rows.find((r) => r.clave === SITIO_SANTA_MONICA)
      if (t && s) {
        const ok = Number(t.margen) < Number(s.margen)
        console.log(
          `\nel guion: ${SITIO_TLALPAN} margen ${t.margen} vs ${SITIO_SANTA_MONICA} margen ${s.margen}` +
            ` → ${ok ? 'Tlalpan sale menos rentable, como se pretende' : 'NO SE CUMPLE'}`,
        )
        console.log(
          `  ingreso identico: ${Number(t.ingreso) === Number(s.ingreso) ? 'si' : 'NO'}` +
            ` · OT ${t.ot} vs ${s.ot} · operacion ${t.costo_operacion} vs ${s.costo_operacion}`,
        )
        if (!ok) salida = 2
      }
    }
  } catch (e) {
    await cli.query('rollback').catch(() => {})
    console.error(`\nERROR semilla-demo: ${e.message}`)
    salida = 2
  } finally {
    await cli.end()
  }
  return salida
}

// Solo corre cuando se invoca como programa, nunca al importarlo desde la
// prueba. `process.argv[1]` puede venir con separadores de Windows, así que se
// compara por el nombre del archivo y no por la ruta entera.
if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/semilla-demo.mjs')) {
  main().then((c) => process.exit(c))
}
