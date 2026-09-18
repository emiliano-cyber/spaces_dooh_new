// ============================================================================
//  lib/cuestionario-entidades.ts — El cuestionario de bienvenida, en funciones
//  puras: de las tres respuestas del dueño al conjunto de razones sociales y
//  roles que hay que crear.
// ----------------------------------------------------------------------------
//  Las tres preguntas son literalmente las que pidió el dueño el 2026-09-17:
//
//    1. ¿Tu empresa tiene varias razones sociales? (sí/no)
//    2. ¿La operación está en la misma razón social que comercializa o factura
//       las ventas? (sí/no)
//    3. El mapa rol → razón social, con los roles del catálogo.
//
//  Las dos primeras existen para SIMPLIFICAR la tercera, no para repetirla:
//  quien contesta «no, una sola» da UN dato y no cinco, y quien contesta que
//  operación y ventas coinciden contesta CUATRO campos y no cinco. Si esa
//  simplificación se rompe, las preguntas 1 y 2 dejan de servir para nada.
//
//  ─── POR QUÉ ESTO NO VIVE DENTRO DE LA PANTALLA ───────────────────────────
//  `vitest.config.ts` no monta jsdom, y lo dice en su propia cabecera: un
//  `.tsx` no se puede probar en este repositorio. Una decisión de negocio
//  escrita ahí dentro no la prueba nadie, y esto es una decisión de negocio de
//  las caras: de aquí salen filas en `entidades_fiscales` y `entidad_roles`, y
//  una traducción mal hecha NO da error — da una identidad fiscal equivocada, y
//  con ella rentas pagadas y comprobantes emitidos a nombre de quien no era.
//
//  ─── EL CATÁLOGO DE ROLES ENTRA POR PARÁMETRO, SIEMPRE ────────────────────
//  La lista de roles vive en la tabla `catalogo_roles_entidad` porque es una
//  decisión de negocio todavía abierta: cambiarla tiene que ser un `insert` y
//  no una migración con su despliegue detrás (ver
//  `vault/02-Backend/entidades-fiscales.md`). Escribirla aquí dentro anularía
//  ese motivo, así que no está: llega como argumento.
//
//  La única excepción, y es inherente a la pregunta y no al catálogo, son los
//  dos roles que la pregunta 2 RELACIONA. El dueño preguntó por «operación» y
//  por «facturación/ventas» por su nombre; sin nombrarlos no hay pregunta 2.
//  Si el catálogo recibido no los trae, la pregunta simplemente no aplica y se
//  ignora en vez de dar un error que nadie puede arreglar.
// ============================================================================

/** Los dos roles que la pregunta 2 relaciona. Ver la cabecera. */
export const ROL_OPERACION = 'OPERACION'
export const ROL_VENTAS = 'VENTAS'

/** `entidades_fiscales.razon_social` se valida contra el mismo límite que el
 *  alta de entidades (`entidades-controller.ts`), para que el cuestionario y la
 *  pantalla de Administración no acepten cosas distintas. */
export const LIMITE_RAZON_SOCIAL = 200

export interface RolCatalogo {
  rol: string
  etiqueta: string
}

export interface RespuestasCuestionario {
  /** Pregunta 1. `null`/ausente = sin contestar, que no es lo mismo que «no». */
  variasRazonesSociales?: boolean | null
  /** Pregunta 2. Ídem. */
  operacionYVentasJuntas?: boolean | null
  /** Pregunta 3 cuando la 1 fue «no»: un solo nombre para todos los roles. */
  razonSocialUnica?: string | null
  /** Pregunta 3 cuando la 1 fue «sí»: rol → razón social. */
  razonSocialPorRol?: Record<string, string | null | undefined> | null
}

export interface EntidadPlaneada {
  razonSocial: string
  roles: string[]
}

export type PlanCuestionario =
  | { ok: true; entidades: EntidadPlaneada[] }
  | { ok: false; error: string }

export interface CampoPaso3 {
  /** Identificador estable del campo en el formulario. */
  clave: string
  /** Los roles que ese único campo contesta. Más de uno = campo fusionado. */
  roles: string[]
  etiqueta: string
}

export interface EntidadConRoles {
  id: string
  razonSocial: string
  roles: string[]
  activo?: boolean
  creadoEn?: string | null
}

// ─── Normalización ──────────────────────────────────────────────────────────

/** Texto tal como se va a guardar: sin espacios de sobra ni saltos de línea.
 *  Un espacio de más no es otra empresa. */
function textoLimpio(v: unknown): string {
  return typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : ''
}

/**
 * La clave con la que se decide si dos campos hablan de la MISMA razón social.
 *
 * «ACME, S.A. de C.V.» y «Acme SA de CV» son la misma empresa teclada dos
 * veces, y crear dos filas dejaría el catálogo con un duplicado que nadie puede
 * distinguir —y el emisor por omisión ambiguo para siempre, porque
 * `emisorPorOmision` exige que solo una entidad tenga el rol—.
 *
 * Por eso la comparación ignora mayúsculas, acentos, puntos y comas. Los puntos
 * se BORRAN y las comas se convierten en espacio, no al revés: si el punto se
 * cambiara por espacio, «S.A.» quedaría «S A» y no coincidiría con «SA», que es
 * justo el caso que esto viene a resolver.
 *
 * Lo que se guarda es la primera forma que un humano escribió, no esta clave:
 * «ACME SA DE CV» no es como se llama la empresa.
 */
export function claveRazonSocial(v: string): string {
  return textoLimpio(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
}

const fallo = (error: string): PlanCuestionario => ({ ok: false, error })

// ─── El plan ────────────────────────────────────────────────────────────────

/**
 * Traduce las respuestas al conjunto de entidades a crear, o explica por qué no
 * se puede. Devuelve un resultado en vez de lanzar: es una función pura y quien
 * la llama decide si eso es un 400, un mensaje en la pantalla o las dos cosas.
 */
export function planDelCuestionario(
  respuestas: RespuestasCuestionario,
  catalogo: string[],
): PlanCuestionario {
  const cat = (catalogo ?? []).map((r) => String(r).trim().toUpperCase()).filter(Boolean)
  if (!cat.length) {
    // Un catálogo vacío significa que la base no está sembrada. Devolver un plan
    // vacío «correcto» crearía razones sociales sin ningún papel: visibles en la
    // lista, inservibles para todo, y sin nada que lo delatara.
    return fallo('El catalogo de roles esta vacio: no se puede contestar el cuestionario.')
  }

  if (typeof respuestas?.variasRazonesSociales !== 'boolean') {
    return fallo('Contesta la primera pregunta: si tu empresa tiene varias razones sociales.')
  }
  const varias = respuestas.variasRazonesSociales
  const juntas = respuestas.operacionYVentasJuntas

  // El mapa rol → razón social, con los roles normalizados y los blancos fuera.
  const mapa = new Map<string, string>()
  for (const [clave, valor] of Object.entries(respuestas.razonSocialPorRol ?? {})) {
    const rol = String(clave).trim().toUpperCase()
    if (!cat.includes(rol)) {
      return fallo(
        `El rol ${rol} no existe en el catalogo. Los disponibles son: ${cat.join(', ')}.`,
      )
    }
    const nombre = textoLimpio(valor)
    // Un rol en blanco es una respuesta legítima: el owner puede no saber
    // todavía con qué sociedad tramita las licencias. `entidad_id` es nullable
    // justamente por esto. Se ignora ANTES de mirar duplicados para que dos
    // campos vacíos del mismo rol no se lean como una contradicción.
    if (!nombre) continue
    if (mapa.has(rol)) {
      // Que gane el último sería una decisión tomada por el orden de las claves
      // de un objeto JSON, que no significa nada.
      return fallo(`El rol ${rol} viene repetido en las respuestas.`)
    }
    if (nombre.length > LIMITE_RAZON_SOCIAL) {
      return fallo(
        `La razon social del rol ${rol} no puede tener mas de ${LIMITE_RAZON_SOCIAL} caracteres.`,
      )
    }
    mapa.set(rol, nombre)
  }

  // ─── Pregunta 1 = «no»: una sola razón social para todo ──────────────────
  if (!varias) {
    if (juntas === false) {
      return fallo(
        'Contestaste que tu empresa tiene una sola razon social, asi que la operacion y las ' +
          'ventas estan forzosamente en la misma. Revisa la segunda pregunta.',
      )
    }
    const claves = new Set([...mapa.values()].map(claveRazonSocial))
    if (claves.size > 1) {
      return fallo(
        `Contestaste que tu empresa tiene una sola razon social, pero indicaste ${claves.size} ` +
          'distintas. Corrige la primera pregunta o deja una sola.',
      )
    }
    const unica = textoLimpio(respuestas.razonSocialUnica)
    if (unica.length > LIMITE_RAZON_SOCIAL) {
      return fallo(`La razon social no puede tener mas de ${LIMITE_RAZON_SOCIAL} caracteres.`)
    }
    // La del mapa vale como respuesta si no se escribió el campo único: un
    // cliente de la API que solo mande el mapa obtiene el mismo resultado que
    // la pantalla, que es lo que evita dos comportamientos para una pregunta.
    const nombre = unica || [...mapa.values()][0] || ''
    if (!nombre) return fallo('Escribe el nombre de tu razon social.')
    if (unica && claves.size === 1 && !claves.has(claveRazonSocial(unica))) {
      // Una sola discrepancia no salta a la vista, y por eso es peor que cinco:
      // elegir en silencio cuál gana es inventarse la identidad fiscal.
      return fallo(
        `La razon social que escribiste ("${unica}") no coincide con la que asignaste a los ` +
          `roles ("${[...mapa.values()][0]}").`,
      )
    }
    // Con una sola sociedad, los roles del catálogo son todos suyos.
    return { ok: true, entidades: [{ razonSocial: nombre, roles: [...cat] }] }
  }

  // ─── Pregunta 1 = «sí»: varias razones sociales ──────────────────────────
  if (typeof juntas !== 'boolean') {
    return fallo(
      'Contesta la segunda pregunta: si la operacion esta en la misma razon social que ' +
        'comercializa o factura las ventas.',
    )
  }

  // La pregunta 2 solo tiene objeto si el catálogo trae los dos roles que
  // relaciona. Si alguien los retiró de la tabla, la pregunta no aplica y se
  // ignora: dar aquí un error dejaría el cuestionario imposible de contestar
  // por una fila que el owner no puede tocar.
  if (cat.includes(ROL_OPERACION) && cat.includes(ROL_VENTAS)) {
    const operacion = mapa.get(ROL_OPERACION)
    const ventas = mapa.get(ROL_VENTAS)
    if (juntas) {
      if (operacion && ventas && claveRazonSocial(operacion) !== claveRazonSocial(ventas)) {
        return fallo(
          'Contestaste que la operacion esta en la misma razon social que factura las ventas, ' +
            `pero indicaste dos distintas: "${operacion}" y "${ventas}".`,
        )
      }
      // La pantalla presenta UN campo para los dos roles, así que solo llega
      // uno. El reparto vive aquí y no en el `.tsx` para que un cliente de la
      // API que mande solo `OPERACION` obtenga exactamente lo mismo.
      if (operacion && !ventas) mapa.set(ROL_VENTAS, operacion)
      if (ventas && !operacion) mapa.set(ROL_OPERACION, ventas)
    } else if (operacion && ventas && claveRazonSocial(operacion) === claveRazonSocial(ventas)) {
      // La contradicción que se olvida, y que sin esta rama crearía una entidad
      // con los dos roles: o sea justo lo que acaba de decir que NO es su caso.
      return fallo(
        'Contestaste que la operacion y las ventas estan en razones sociales distintas, pero ' +
          `indicaste la misma para las dos: "${operacion}".`,
      )
    }
  }

  if (!mapa.size) {
    return fallo('Indica al menos una razon social para alguno de los roles.')
  }

  // Agrupa por razón social: una sociedad con varios papeles es UNA entidad con
  // varios roles, que es el caso normal y no la excepción (por eso
  // `entidad_roles` admite varios por entidad y solo prohíbe el mismo dos
  // veces). Se recorre el catálogo en su orden para que el resultado sea
  // determinista: de él dependen el texto de la bitácora y las pruebas.
  const porClave = new Map<string, EntidadPlaneada>()
  for (const rol of cat) {
    const nombre = mapa.get(rol)
    if (!nombre) continue
    const clave = claveRazonSocial(nombre)
    const ya = porClave.get(clave)
    if (ya) ya.roles.push(rol)
    else porClave.set(clave, { razonSocial: nombre, roles: [rol] })
  }

  // Que «varias» acabe en una sola entidad NO es un error: un owner con tres
  // sociedades puede saber hoy el nombre de una. Bloquearlo no gana nada y le
  // impide contestar.
  return { ok: true, entidades: [...porClave.values()] }
}

// ─── Lo que la pantalla tiene que preguntar ─────────────────────────────────

/**
 * Los campos del paso 3, ya simplificados por las respuestas 1 y 2. Vive aquí y
 * no en la pantalla porque es la mitad de la misma decisión que
 * `planDelCuestionario`: si una la simplifica y la otra no, el formulario pide
 * cosas que el plan rechaza.
 */
export function camposDelPaso3(
  respuestas: Pick<RespuestasCuestionario, 'variasRazonesSociales' | 'operacionYVentasJuntas'>,
  catalogo: RolCatalogo[],
): CampoPaso3[] {
  const filas = (catalogo ?? []).filter((c) => c && String(c.rol).trim())
  if (typeof respuestas?.variasRazonesSociales !== 'boolean' || !filas.length) return []

  const rolDe = (c: RolCatalogo) => String(c.rol).trim().toUpperCase()

  // Una sola razón social: UN campo. Es la razón de ser de la pregunta 1 — sin
  // esto habría que teclear el mismo nombre cinco veces.
  if (!respuestas.variasRazonesSociales) {
    return [{ clave: 'UNICA', roles: filas.map(rolDe), etiqueta: 'Tu razon social' }]
  }

  const juntas = respuestas.operacionYVentasJuntas === true
  const operacion = filas.find((c) => rolDe(c) === ROL_OPERACION)
  const ventas = filas.find((c) => rolDe(c) === ROL_VENTAS)
  const fusionar = juntas && !!operacion && !!ventas

  const campos: CampoPaso3[] = []
  const puestos = new Set<string>()
  for (const fila of filas) {
    const rol = rolDe(fila)
    if (puestos.has(rol)) continue
    if (fusionar && (rol === ROL_OPERACION || rol === ROL_VENTAS)) {
      puestos.add(ROL_OPERACION)
      puestos.add(ROL_VENTAS)
      campos.push({
        clave: `${ROL_OPERACION}+${ROL_VENTAS}`,
        roles: [ROL_OPERACION, ROL_VENTAS],
        // Las etiquetas salen del CATÁLOGO y se unen; no hay una cadena escrita
        // aquí para el campo fusionado. Quien renombre la etiqueta de un rol en
        // su instancia tiene que verlo en pantalla, y con un texto fijo no lo
        // vería.
        etiqueta: `${operacion!.etiqueta} · ${ventas!.etiqueta}`,
      })
      continue
    }
    puestos.add(rol)
    campos.push({ clave: rol, roles: [rol], etiqueta: fila.etiqueta })
  }
  return campos
}

// ─── Las dos derivaciones que evitan una migración ──────────────────────────

/**
 * ¿Falta contestar el cuestionario? Se DERIVA del recuento de razones sociales:
 * cero = falta. No hay columna en `tenants` ni en `config_negocio`, y por tanto
 * no hay migración que aplicar ni estado que pueda quedar desincronizado del
 * hecho que describe.
 *
 * Un recuento desconocido (`null`, o lo que devuelve una consulta que falló)
 * responde que NO falta, a propósito: ofrecer el cuestionario a quien ya lo
 * contestó acaba en un 409 que se ve como un error, y no ofrecerlo solo retrasa
 * la invitación hasta la siguiente carga.
 */
export function faltaContestarCuestionario(total: number | null | undefined): boolean {
  if (typeof total !== 'number' || !Number.isFinite(total)) return false
  return total <= 0
}

/**
 * La entidad que se propone por omisión para un rol —el emisor de un
 * comprobante, quien paga una renta— se DERIVA de los roles: si solo una
 * sociedad tiene ese papel, es ésa.
 *
 * Con dos no hay omisión, y devolver `null` es la respuesta correcta: adivinar
 * sería emitir a nombre de la sociedad equivocada sin que nadie lo hubiera
 * decidido. Se autocorrige solo cuando dan de alta la segunda, y por eso no hay
 * nada que guardar.
 *
 * Las dadas de baja no se ofrecen: siguen en la base para sostener los
 * documentos que las nombran, no para capturar documentos nuevos.
 */
export function emisorPorOmision<T extends EntidadConRoles>(
  entidades: T[] | null | undefined,
  rol: string,
): T | null {
  const objetivo = String(rol ?? '')
    .trim()
    .toUpperCase()
  if (!objetivo) return null
  const candidatas = (entidades ?? []).filter(
    (e) =>
      e &&
      e.activo !== false &&
      (e.roles ?? []).some((r) => String(r).trim().toUpperCase() === objetivo),
  )
  return candidatas.length === 1 ? candidatas[0] : null
}

// ─── La bitácora ────────────────────────────────────────────────────────────

/**
 * El texto que va a la bitácora de acciones. Nombra las razones sociales y sus
 * roles, no solo cuántas: el papel es la parte que decide qué documentos salen
 * a nombre de cada entidad, y quien revise después tiene que poder leerlo sin
 * abrir la base.
 */
export function resumenParaBitacora(entidades: EntidadPlaneada[]): string {
  const lista = entidades ?? []
  const cuantas = lista.length
  const cabeza = cuantas === 1 ? '1 razon social' : `${cuantas} razones sociales`
  const detalle = lista
    .map((e) => `"${e.razonSocial}" (${(e.roles ?? []).join(', ') || 'sin roles'})`)
    .join('; ')
  return detalle ? `${cabeza}: ${detalle}` : cabeza
}
