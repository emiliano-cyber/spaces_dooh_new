import { LIMITE_RAZON_SOCIAL, claveRazonSocial } from '@/lib/cuestionario-entidades'
import { esRfcValido } from '@/lib/rfc'

// ============================================================================
//  La lógica de la pantalla de razones sociales, FUERA del `.tsx`.
// ----------------------------------------------------------------------------
//  `vitest.config.ts` no monta jsdom, y lo dice en su propia cabecera: un
//  `.tsx` no se puede probar en este repositorio. Una decisión escrita dentro
//  de una pantalla no la prueba nadie, y aquí las decisiones son de identidad
//  fiscal: cuál es un duplicado, cuándo una razón social se puede guardar y qué
//  papeles del negocio se han quedado sin dueño. Equivocarse en eso no da
//  error: da rentas pagadas y comprobantes emitidos a nombre de quien no era.
//
//  Es el mismo molde que ya usan `components/demo/reportes/*.ts` y
//  `lib/cuestionario-entidades.ts`.
// ============================================================================

export interface EntidadUI {
  id: string
  razonSocial: string
  rfc: string | null
  regimen: string | null
  cpFiscal: string | null
  serieFolios: string | null
  roles: string[]
  activo: boolean
  creadoEn?: string | null
}

export interface BorradorEntidad {
  razonSocial: string
  rfc: string
  regimen: string
  cpFiscal: string
  serieFolios: string
  roles: string[]
}

export const BORRADOR_VACIO: BorradorEntidad = {
  razonSocial: '',
  rfc: '',
  regimen: '',
  cpFiscal: '',
  serieFolios: '',
  roles: [],
}

export { LIMITE_RAZON_SOCIAL }

export interface ContextoBorrador {
  /** Las que ya existen, INCLUIDAS las dadas de baja. */
  existentes: EntidadUI[]
  /** El id que se está editando, para que no choque consigo mismo. */
  editando?: string | null
  /** Los roles que la base admite, leídos del catálogo. */
  catalogo: string[]
}

/**
 * Lo que impide guardar, o `null` si se puede. Es el aviso que ve quien captura
 * Y la misma regla que rechaza el servidor: no es una validación duplicada, es
 * la de antes de gastar el viaje. Si divergieran, el formulario daría por bueno
 * algo que el servidor rechaza con un 400 sobre un campo pintado en verde — eso
 * ya pasó en este repositorio con el RFC, cuando la pantalla llevaba una COPIA
 * de la expresión y el servidor la endureció (ver `GestionRazonesSociales.tsx`).
 */
export function loQueFaltaEnElBorrador(
  borrador: BorradorEntidad,
  ctx: ContextoBorrador,
): string | null {
  const nombre = String(borrador?.razonSocial ?? '').trim()
  if (!nombre) return 'Captura la razon social: es el nombre con el que la empresa firma y factura.'
  if (nombre.length > LIMITE_RAZON_SOCIAL) {
    return `La razon social no puede pasar de ${LIMITE_RAZON_SOCIAL} caracteres.`
  }

  // El duplicado se busca por CLAVE, no por texto: «ACME, S.A. de C.V.» y
  // «Acme SA de CV» son la misma empresa teclada dos veces. Se usa
  // `claveRazonSocial`, la MISMA función del cuestionario de bienvenida — una
  // copia aquí divergiría de la que agrupa en el alta, y entonces lo que allí
  // es una sola sociedad aquí serían dos.
  const clave = claveRazonSocial(nombre)
  const editando = ctx?.editando ?? null
  const choque = (ctx?.existentes ?? []).find(
    (e) => e && e.id !== editando && claveRazonSocial(e.razonSocial) === clave,
  )
  if (choque) {
    // Se nombra la que ya existe TAL COMO está escrita: quien captura no ve por
    // qué dos textos distintos son el mismo, y sin verla no sabe qué corregir.
    //
    // Las DADAS DE BAJA cuentan, y se dice que lo están. La baja es lógica: la
    // fila sigue ahí sosteniendo contratos y comprobantes. Dejar pasar el
    // duplicado dejaría al owner con dos filas para una sola sociedad y sin
    // forma de saber cuál de las dos pagan sus contratos.
    return choque.activo === false
      ? `Ya tienes «${choque.razonSocial}», que es la misma razon social y esta dada de baja. Reactivala en vez de crear otra.`
      : `Ya tienes «${choque.razonSocial}», que es la misma razon social escrita de otra forma.`
  }

  const rfc = String(borrador?.rfc ?? '').trim()
  // El RFC puede FALTAR: el expediente nace incompleto (ADR 0001) y exigirlo
  // aquí obligaría a ir a buscar al contador antes de poder guardar nada. Lo
  // que no puede es estar mal escrito.
  if (rfc && !esRfcValido(rfc)) {
    return `El RFC «${rfc}» no tiene una forma valida. Dejalo vacio si todavia no lo tienes.`
  }

  // El catálogo llega por parámetro y no como constante: `rol` es texto con una
  // tabla detrás (`catalogo_roles_entidad`) para que añadir un papel sea un
  // `insert` y no una migración con su despliegue a toda la flota. Una lista
  // escrita aquí anularía ese motivo y, peor, sería una SEGUNDA lista — y lo
  // que impide que dos listas divergan no es que hoy coincidan, es que solo
  // exista una. Este repositorio ya pagó esa lección con los permisos.
  const validos = new Set((ctx?.catalogo ?? []).map((r) => String(r).trim().toUpperCase()))
  const intruso = (borrador?.roles ?? [])
    .map((r) => String(r).trim().toUpperCase())
    .find((r) => r && !validos.has(r))
  if (intruso) {
    return `El papel «${intruso}» no existe. Los que hay son: ${[...validos].join(', ')}.`
  }

  // Sin ningún rol SÍ se guarda: cuál papel juega una sociedad se puede decidir
  // después, y exigirlo aquí obligaría a inventárselo para poder capturarla.
  return null
}

// Comparación de nombres para ordenar: por `localeCompare` en español, que es
// lo que hace que «Álfa» vaya antes de «beta» en vez de después de «ómicron».
// Comparar los códigos de carácter pondría todas las mayúsculas primero y
// cualquier acento al final, y el listado parecería desordenado.
const porNombre = (a: EntidadUI, b: EntidadUI) =>
  String(a.razonSocial ?? '').localeCompare(String(b.razonSocial ?? ''), 'es', {
    sensitivity: 'base',
  })

/**
 * Activas primero y alfabético dentro de cada grupo. Las dadas de baja NO se
 * esconden —siguen sosteniendo documentos y hay que poder reactivarlas— pero
 * tampoco se mezclan con las que se usan todos los días.
 *
 * Devuelve un arreglo NUEVO: `sort` muta, y mutar lo que viene del store de
 * zustand es cambiar el estado sin pasar por `setState`.
 */
export function entidadesOrdenadas(entidades: EntidadUI[]): EntidadUI[] {
  const lista = (entidades ?? []).filter(Boolean)
  const activas = lista.filter((e) => e.activo !== false).sort(porNombre)
  const bajas = lista.filter((e) => e.activo === false).sort(porNombre)
  return [...activas, ...bajas]
}

// Los papeles que tiene cada entidad ACTIVA, normalizados y contados.
function cuentaPorRol(entidades: EntidadUI[]): Map<string, number> {
  const cuenta = new Map<string, number>()
  for (const e of entidades ?? []) {
    if (!e || e.activo === false) continue
    for (const r of e.roles ?? []) {
      const rol = String(r).trim().toUpperCase()
      if (rol) cuenta.set(rol, (cuenta.get(rol) ?? 0) + 1)
    }
  }
  return cuenta
}

/**
 * Los papeles del catálogo que NADIE activo tiene. Se pinta como aviso y no
 * como error: es legítimo no haber decidido todavía.
 *
 * Importa porque se nota tarde y en otro sitio: sin dueño de `VENTAS` ningún
 * comprobante se va a preasignar, y eso no da error — el selector simplemente
 * aparece vacío en una pantalla distinta, semanas después. El caso que muerde
 * es dar de baja la única que vendía: por eso una dada de baja NO cuenta como
 * dueña de su papel.
 */
export function rolesSinDueno(entidades: EntidadUI[], catalogo: string[]): string[] {
  const cuenta = cuentaPorRol(entidades)
  return (catalogo ?? [])
    .map((r) => String(r).trim().toUpperCase())
    .filter((r) => r && !cuenta.has(r))
}

/**
 * Los papeles que tienen DOS o más entidades activas. Para ésos la derivación
 * del default no propone nada (`emisorPorOmision` devuelve `null` con dos
 * candidatas, a propósito), así que quien capture un documento va a tener que
 * elegir a mano cada vez. Decirlo aquí explica por qué.
 */
export function rolesCompartidos(entidades: EntidadUI[], catalogo: string[]): string[] {
  const cuenta = cuentaPorRol(entidades)
  return (catalogo ?? [])
    .map((r) => String(r).trim().toUpperCase())
    .filter((r) => (cuenta.get(r) ?? 0) > 1)
}
