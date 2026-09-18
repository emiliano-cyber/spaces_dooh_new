import { etiquetaBucket } from '@/lib/data/derive'
import { diaComparable, esFechaValida, ordenInvertido } from '@/lib/server/fechas'

// ============================================================================
//  components/demo/reportes/consulta.ts — Qué se le pide al endpoint.
// ----------------------------------------------------------------------------
//  LA REGLA QUE DA SENTIDO A TODO ESTE ARCHIVO:
//  la pantalla de reportes pide sus números a `/api/reportes/rentabilidad`, y
//  NUNCA al store.
//
//  Hoy el resto de la analítica se calcula en el navegador: `/api/estado`
//  devuelve 24 rebanadas de tablas completas (`app/api/estado/route.ts:98-130`)
//  y el front deriva los márgenes con `useStoreMemo` (`lib/data/client.ts:329`).
//  Ese camino ya reventó una vez —6.12 MB y pantalla en blanco de 6 a 12
//  segundos, sin dar ningún error; lo cuenta su propio código en
//  `app/api/estado/route.ts:142-146`—, y los reportes verán historia de AÑOS.
//  Colgar esta pantalla del store obligaría a rehacerla entera cuando el
//  cálculo se porte a agregación SQL. Por eso el límite se respeta desde el
//  primer render.
//
//  Y está aquí, fuera del `.tsx`, porque `vitest.config.ts` no monta jsdom a
//  propósito: una decisión escrita dentro del componente no la prueba nadie.
//  El contrato del endpoint está en `vault/02-Backend/reportes-rentabilidad.md`.
// ============================================================================

export type DimensionUI = 'sitio' | 'trimestre' | 'operacion' | 'm2' | 'luz'
export type GranularidadUI = 'mes' | 'trimestre'

export interface FiltrosReporte {
  dimension: DimensionUI
  granularidad: GranularidadUI
  /** `AAAA-MM-DD`, inclusive. */
  desde: string
  /** `AAAA-MM-DD`, inclusive. */
  hasta: string
}

// CON el basePath y CON la barra final. `next.config.mjs:126-127` declara
// `basePath: '/spaces-dooh'` y `trailingSlash: true`: una ruta escrita
// '/api/reportes/rentabilidad' sale del navegador hacia el ORIGEN, no hacia la
// app, y el síntoma no es un error de red — es el 404 de Next con cuerpo HTML,
// que esta pantalla pintaría como «no se pudo calcular el reporte». Misma forma
// que ya usan `lib/data/estado-api.ts` y `components/demo/admin/OrganizacionesPanel.tsx`.
export const RUTA_RENTABILIDAD = '/spaces-dooh/api/reportes/rentabilidad/'

// Las cuatro dimensiones DECLARADAS por el contrato del endpoint, y las cuatro
// CALCULAN.
//
// Hubo un campo `conMotor` aquí, y con él la etiqueta «(en preparación)» en el
// desplegable: la pantalla nació el 17/09 con `trimestre`, `operacion` y `m2`
// devolviendo 501. La ola 2 cerró las tres el 18/09 y NADIE QUITÓ LA ETIQUETA,
// así que el selector ofrecía «Por trimestre (en preparación)» y al elegirla
// calculaba perfectamente. No lo vio nada automático —una etiqueta de más no
// rompe ninguna prueba— y solo apareció al abrir la app en un navegador.
//
// La bandera se retira en vez de ponerla en `true` para las cuatro: un
// interruptor que siempre vale lo mismo es el que se queda desfasado.
export const DIMENSIONES_UI: { valor: DimensionUI; label: string; ayuda: string }[] = [
  {
    valor: 'sitio',
    label: 'Por pantalla',
    ayuda:
      'Ingreso y las tres fuentes de costo de cada pantalla —espacio, operación y luz—. Peor margen primero.',
  },
  {
    valor: 'trimestre',
    label: 'Por trimestre',
    ayuda: 'Cómo evoluciona el negocio: una fila por trimestre natural, en orden cronológico.',
  },
  {
    valor: 'operacion',
    label: 'Por operación',
    ayuda: 'Dónde se va el dinero en visitas: órdenes de trabajo, su costo y las horas en sitio.',
  },
  {
    valor: 'm2',
    label: 'Por metro cuadrado',
    ayuda: 'Qué superficie estática rinde. Las digitales no entran: su denominador son spots.',
  },
  {
    valor: 'luz',
    label: 'Por consumo de luz',
    ayuda: 'Qué pantallas se comen la energía. El recibo del predio se reparte entre sus pantallas.',
  },
]

// `dia` y `semana` existen en `Granularidad` para la gráfica de ocupación y NO
// valen aquí: una rentabilidad por día sobre años de historia es la consulta
// sin límite que este endpoint viene a evitar. El zod del controller las
// rechaza, así que ofrecerlas sería ofrecer un 400.
export const GRANULARIDADES_UI: { valor: GranularidadUI; label: string }[] = [
  { valor: 'mes', label: 'Mensual' },
  { valor: 'trimestre', label: 'Trimestral' },
]

// QUÉ ES una fila en cada dimensión. No es cosmético: la cabecera decía
// «N pantallas con movimiento» en TODA dimensión, y en trimestral las filas son
// trimestres. Es el mismo defecto que el encabezado «PANTALLA» de la primera
// columna de la tabla, cometido en otro sitio de la misma pantalla, y por eso
// se declara UNA vez y lo leen los dos.
//
// `operacion`, `m2` y `luz` pivotan la misma rejilla que `sitio`, así que sus
// filas siguen siendo pantallas: lo que cambia es qué se mide de ellas.
const SUSTANTIVO_FILA: Record<DimensionUI, { singular: string; plural: string }> = {
  sitio: { singular: 'pantalla', plural: 'pantallas' },
  trimestre: { singular: 'trimestre', plural: 'trimestres' },
  operacion: { singular: 'pantalla', plural: 'pantallas' },
  m2: { singular: 'pantalla', plural: 'pantallas' },
  luz: { singular: 'pantalla', plural: 'pantallas' },
}

export function sustantivoFila(d: DimensionUI): { singular: string; plural: string } {
  return SUSTANTIVO_FILA[d]
}

/** `1 pantalla` · `3 trimestres`. El número con su sustantivo, ya concordado. */
export function cuenta(n: number, d: DimensionUI): string {
  const s = SUSTANTIVO_FILA[d]
  return `${n} ${n === 1 ? s.singular : s.plural}`
}

// Los CUATRO parámetros que el schema admite, y ninguno más. El schema del
// controller es `.strict()`, así que un parámetro de más da 400 en vez de
// ignorarse: un `tenantId` colado aquí tumbaría la pantalla entera, y el tenant
// sale SIEMPRE de la sesión.
export function construirConsulta(f: FiltrosReporte): string {
  // `URLSearchParams` y no concatenación: escapa por su cuenta. Los valores de
  // los dos selectores son enums cerrados, pero una función no puede suponer
  // quién la llama, y un `&` sin escapar es como se cuela un parámetro de más.
  const p = new URLSearchParams({
    dimension: f.dimension,
    granularidad: f.granularidad,
    desde: f.desde,
    hasta: f.hasta,
  })
  return `${RUTA_RENTABILIDAD}?${p.toString()}`
}

// Por qué se valida aquí además de en el servidor: el servidor es la autoridad
// y sigue detrás, pero pedir un rango que se sabe malo cuesta una consulta y
// devuelve un 400 que la pantalla tiene que traducir. Se avisa antes, con la
// MISMA regla —`ordenInvertido` de `lib/server/fechas.ts`, que el controller
// también usa— y no con una copia: dos reglas divergen, y aquí divergir
// significa rechazar periodos correctos.
export function motivoInvalido(f: FiltrosReporte): string | null {
  const desde = f.desde.trim()
  const hasta = f.hasta.trim()
  // Las fechas son obligatorias y no tienen valor por omisión: un rango por
  // omisión sobre historia de años es una consulta sin límite disfrazada de
  // comodidad, que es el problema del que este endpoint nace.
  if (!desde) return 'Falta la fecha de inicio del reporte'
  if (!hasta) return 'Falta la fecha de fin del reporte'
  if (!esFechaValida(desde) || !esFechaValida(hasta)) return 'Usa fechas con formato AAAA-MM-DD'
  // `esFechaValida` acepta formas que no se pueden ordenar («March 3, 2026»).
  // Si no se pueden comparar no se puede garantizar que el rango no esté
  // invertido, y el endpoint las rechaza igual.
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(desde) || !/^\d{4}-\d{1,2}-\d{1,2}$/.test(hasta)) {
    return 'Usa fechas con formato AAAA-MM-DD'
  }
  if (ordenInvertido(desde, hasta)) return 'La fecha de fin no puede ser anterior a la de inicio'
  return null
}

const dosCifras = (n: number) => String(n).padStart(2, '0')

// El trimestre EN CURSO, y **el rango con el que abre la pantalla** — ver
// `RANGO_DE_APERTURA` al final del archivo.
//
// Se construye desde las PARTES LOCALES de la fecha (`getMonth`, no
// `toISOString`): en México (UTC−6) el 1.º de enero a las 00:00 locales sale
// como 31 de diciembre en UTC, y el rango propuesto caería en el trimestre
// anterior. Es la misma trampa que ya se pagó en `diasHasta`.
export function rangoDelTrimestreDe(hoy: Date): { desde: string; hasta: string } {
  const anio = hoy.getFullYear()
  const primerMes = Math.floor(hoy.getMonth() / 3) * 3
  const ultimoMes = primerMes + 2
  // Día 0 del mes siguiente = último día del mes, sin tabla de 28/30/31.
  const ultimoDia = new Date(anio, ultimoMes + 1, 0).getDate()
  return {
    desde: `${anio}-${dosCifras(primerMes + 1)}-01`,
    hasta: `${anio}-${dosCifras(ultimoMes + 1)}-${dosCifras(ultimoDia)}`,
  }
}

// El último trimestre CERRADO: el trimestre natural completo anterior al que
// está en curso.
//
// Se calcula retrocediendo al día ANTERIOR al primero del trimestre en curso y
// preguntando por el trimestre de ese día — `new Date(anio, primerMes, 0)` es
// el último día del mes previo, y cruza el año él solo. Escrito como `mes - 3`
// sin cruzar el año, enero daría octubre a diciembre del año EN CURSO: un
// trimestre que todavía no ha pasado, presentado como cerrado, y sin dar ningún
// error.
export function rangoDelTrimestreCerradoDe(hoy: Date): { desde: string; hasta: string } {
  const primerMes = Math.floor(hoy.getMonth() / 3) * 3
  return rangoDelTrimestreDe(new Date(hoy.getFullYear(), primerMes, 0))
}

// ─── DECISIÓN DEL DUEÑO, 2026-09-18. NO ES UN DESCUIDO ──────────────────────
// Con qué rango abre la pantalla. Es lo que escribe en sus dos campos —no un
// valor por omisión del endpoint, donde las fechas son obligatorias a propósito
// porque un rango por omisión sobre años de historia es una consulta sin límite
// disfrazada de comodidad— y viaja en la querystring como cualquier otro rango
// que elija una persona.
//
// **Abre en el trimestre EN CURSO, y eso está decidido, no pendiente.**
//
// Quien lea esto va a notar enseguida que un trimestre a medias se lee PEOR de
// lo que es: la renta del espacio corre desde el día 1 y lo vendido se cobra al
// cerrar, así que al abrir se ve mucho costo y poco ingreso. Medido en la base
// de demostración el 2026-09-18: el trimestre en curso (jul-sep 2026) no tenía
// ingresos y sí tenía renta, y la pantalla arrancaba enseñando
// `Ingreso $0.00 · Costo $184,500.00 · Margen ($184,500.00)`.
//
// Eso se vio, se llevó al dueño con las tres salidas y sus consecuencias, y
// **eligió ver el trimestre VIVO al abrir**, porque es lo que quiere mirar. La
// letra pequeña de su elección es que el engaño se arregla POR EL OTRO LADO:
// diciéndolo en pantalla. Lo dice `avisosDelReporte` con la clave
// `periodo-en-curso` (`tabla.ts`), y `solapaTrimestreEnCurso` de aquí abajo
// decide cuándo.
//
// **Así que no "arregles" esta línea.** Si vuelve a cambiar de opinión, se
// cambia a `rangoDelTrimestreCerradoDe` —que se conserva entero, con sus
// pruebas— y nada más se toca.
export const RANGO_DE_APERTURA: (hoy: Date) => { desde: string; hasta: string } = rangoDelTrimestreDe

// ¿El rango que se pidió toca el trimestre que todavía no ha cerrado?
//
// Es la condición del aviso de periodo incompleto, y la condición importa tanto
// como el aviso: **uno que saliera siempre no lo leería nadie**. Es la misma
// lección del ámbar que dejó de avisar por salir en todo. Si el usuario mueve el
// rango a un trimestre terminado, el aviso desaparece — y esa desaparición es
// información: dice que las cifras que está viendo ya son definitivas.
//
// Se compara con `diaComparable` y NO con `<=` de cadenas. `motivoInvalido`
// acepta `2026-9-1` sin cero a la izquierda, así que aquí puede llegar; como
// texto va DESPUÉS de `2026-09-30` —el '9' pesa más que el '0'—, y un `<=` de
// cadenas diría que septiembre no solapa con septiembre. El aviso no saldría
// justo en el mes en el que hace falta. Es el defecto que este repo ya pagó dos
// veces (`lib/server/fechas.ts:42-48`).
export function solapaTrimestreEnCurso(
  rango: { desde: string; hasta: string },
  hoy: Date,
): boolean {
  const vivo = rangoDelTrimestreDe(hoy)
  const desde = diaComparable(rango.desde)
  const hasta = diaComparable(rango.hasta)
  // Una fecha que no se puede reducir a un día queda FUERA en vez de compararse
  // mal: sin poder afirmar el solape, no se afirma. El rango además ya pasó por
  // `motivoInvalido`, que rechaza esas formas.
  if (desde == null || hasta == null) return false
  return desde <= diaComparable(vivo.hasta)! && diaComparable(vivo.desde)! <= hasta
}

// Días entre dos fechas contando solo el día del calendario. Se normalizan a
// UTC desde las PARTES LOCALES: una resta de dos `Date` en horas da 23 o 25 el
// día del cambio de horario, y el redondeo de un trimestre entero se iría un día.
const diasEntre = (a: Date, b: Date) =>
  Math.round(
    (Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) -
      Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) /
      86_400_000,
  )

// Cuánto lleva corrido el trimestre vivo, para poder decirlo en el aviso: «80 de
// 92 días» explica por sí solo por qué falta ingreso.
//
// **Los dos extremos son inclusive**, igual que el rango del reporte: el primer
// día del trimestre es UNO corrido y no cero — la renta de ese día ya corrió, y
// «0 de 92» se leería como que el periodo no ha empezado.
//
// La etiqueta sale de `etiquetaBucket`, la misma que pinta la gráfica de
// ocupación y la dimensión `trimestre`: dos etiquetados del mismo trimestre
// acabarían diciendo «T3 2026» en un sitio y «3er trimestre» en el otro.
export function avanceDelTrimestreEnCurso(hoy: Date): {
  corridos: number
  totales: number
  etiqueta: string
} {
  const anio = hoy.getFullYear()
  const primerMes = Math.floor(hoy.getMonth() / 3) * 3
  const inicio = new Date(anio, primerMes, 1)
  const fin = new Date(anio, primerMes + 3, 0)
  return {
    corridos: diasEntre(inicio, hoy) + 1,
    totales: diasEntre(inicio, fin) + 1,
    etiqueta: etiquetaBucket(inicio, 'trimestre'),
  }
}
