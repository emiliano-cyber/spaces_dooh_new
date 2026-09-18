import { esFechaValida, ordenInvertido } from '@/lib/server/fechas'

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

export type DimensionUI = 'sitio' | 'trimestre' | 'operacion' | 'm2'
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

// Las cuatro dimensiones DECLARADAS por el contrato del endpoint. Se ofrecen
// las cuatro aunque tres devuelvan 501: la dimensión es parte del contrato, y
// el día que aterrice su motor esta pantalla funciona sin tocarse. Ofrecer solo
// `sitio` obligaría a volver aquí, que es justo lo que el límite evita.
export const DIMENSIONES_UI: { valor: DimensionUI; label: string; ayuda: string; conMotor: boolean }[] = [
  {
    valor: 'sitio',
    label: 'Por pantalla',
    ayuda: 'Ingreso, costo del espacio y costo de operación de cada pantalla.',
    conMotor: true,
  },
  {
    valor: 'trimestre',
    label: 'Por trimestre',
    ayuda: 'El mismo reporte agrupado por trimestre en vez de por pantalla.',
    conMotor: false,
  },
  {
    valor: 'operacion',
    label: 'Por operación',
    ayuda: 'Rentabilidad vista desde las órdenes de trabajo que costaron.',
    conMotor: false,
  },
  {
    valor: 'm2',
    label: 'Por metro cuadrado',
    ayuda: 'Ingreso y costo por metro cuadrado de superficie exhibida.',
    conMotor: false,
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

// El nombre con el que se le habla al usuario de una dimensión que falta. Se
// dice CUÁL falta y no «no implementado»: quien lo lea tiene que saber si pedir
// otra cosa o esperar.
const NOMBRE_DIMENSION: Record<DimensionUI, string> = {
  sitio: 'pantalla',
  trimestre: 'trimestre',
  operacion: 'operación',
  m2: 'metro cuadrado',
}

export function etiquetaDimension(d: DimensionUI): string {
  return NOMBRE_DIMENSION[d]
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

// El rango con el que se abre la pantalla: el trimestre EN CURSO. No es un
// valor por omisión del endpoint —allí las fechas son obligatorias a propósito—
// sino lo que la pantalla escribe en sus dos campos, y viaja en la querystring
// como cualquier otro rango que elija una persona. Un trimestre está acotado,
// se puede cambiar de un clic, y evita que la pantalla arranque en blanco
// pidiéndole al usuario dos fechas antes de enseñarle nada.
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
