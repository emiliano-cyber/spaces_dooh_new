// ============================================================================
//  lib/novedades-reglas.mjs — Que es un archivo de notas de version valido.
// ----------------------------------------------------------------------------
//  Las notas de version (pedido del dueno, 2026-10-01): cada version nueva
//  trae escrito que cambio, para que cada cliente sepa que se hizo. Viven en
//  `apps/web/novedades.json` y las escriben los desarrolladores en el MISMO PR
//  que el cambio.
//
//  POR QUE ESTE ARCHIVO ES `.mjs` Y NO `.ts`, que es lo que pediria el resto de
//  `lib/`: estas reglas las usan DOS sitios que no comparten cadena de
//  herramientas.
//    · La aplicacion (`lib/novedades.ts`, que lo reexporta con tipos).
//    · `scripts/verificar-novedades.mjs`, que corre en `release.yml` ANTES del
//      `npm ci`, con el node a pelo del runner: ahi no hay TypeScript que
//      compile nada.
//  Con dos copias de la regla -una en TS y otra en JS- la primera que cambie
//  dejaria a la release aceptando un archivo que la aplicacion rechaza, o al
//  reves, y nadie se enteraria hasta que un cliente viera el dialogo vacio.
//  Una sola copia, en el unico idioma que entienden los dos.
//
//  Sin dependencias y sin efectos: solo funciones sobre datos. Vive DENTRO de
//  `apps/web` a proposito, y no en `scripts/`: la aplicacion no importa nada
//  de fuera de su arbol (ver la cabecera de `app/api/actualizaciones/route.ts`
//  sobre `output: 'standalone'`); es el script el que mira hacia aqui, y el
//  script corre en el repositorio, no en la imagen.
// ============================================================================

/** Los tres tipos, y solo estos (decision del dueno, 2026-10-01). */
export const TIPOS_NOVEDAD = Object.freeze(['NUEVO', 'AJUSTADO', 'CORREGIDO'])

export const ETIQUETA_TIPO = Object.freeze({ NUEVO: 'Nuevo', AJUSTADO: 'Ajustado', CORREGIDO: 'Corregido' })

// La version de una ENTRADA es `vX.Y.Z` a secas: las notas son de una version,
// no de cada precandidata que se ensaye antes de publicarla.
const RE_VERSION = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
// La version de una IMAGEN puede traer sufijo (`v0.0.1-rc2`): es el mismo
// patron que acepta `release.yml` en «Validar la version».
const RE_VERSION_IMAGEN = /^(v(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-[0-9A-Za-z.-]+)?$/
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

const CLAVES_ENTRADA = ['version', 'fecha', 'items']
const CLAVES_ITEM = ['tipo', 'texto']

function esObjeto(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

// AAAA-MM-DD y ademas una fecha que EXISTE: `2026-02-30` casa con el patron y
// no es ningun dia. Se reconstruye en UTC y se compara: si JS la "corrigio"
// al 2 de marzo, no era una fecha.
function esFechaReal(f) {
  if (typeof f !== 'string') return false
  const m = RE_FECHA.exec(f)
  if (!m) return false
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  return d.toISOString().slice(0, 10) === f
}

/** `vX.Y.Z` de una version de imagen (con o sin sufijo), o `null`. */
export function versionBase(v) {
  if (typeof v !== 'string') return null
  const m = RE_VERSION_IMAGEN.exec(v)
  return m ? m[1] : null
}

// Compara por NUMERO, no por texto: como cadenas, `v0.10.0` < `v0.9.2`.
function partes(v) {
  return v.slice(1).split('.').map(Number)
}
export function compararVersiones(a, b) {
  const pa = partes(a)
  const pb = partes(b)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

/**
 * Los errores de UNA entrada. `donde` es solo para el mensaje.
 * @returns {string[]}
 */
export function erroresDeEntrada(e, donde = 'la entrada') {
  if (!esObjeto(e)) return [`${donde} no es un objeto { version, fecha, items }`]
  const out = []
  // Un campo de mas es casi siempre un typo (`fehca`), y uno que se ignora en
  // silencio deja la entrada SIN fecha sin que nadie lo vea.
  for (const k of Object.keys(e)) {
    if (!CLAVES_ENTRADA.includes(k)) out.push(`${donde} trae un campo desconocido: «${k}»`)
  }
  if (typeof e.version !== 'string' || !RE_VERSION.test(e.version)) {
    out.push(`${donde}: la version ${JSON.stringify(e.version)} no es de la forma vX.Y.Z (por ejemplo v0.9.2)`)
  }
  if (!esFechaReal(e.fecha)) {
    out.push(`${donde}: la fecha ${JSON.stringify(e.fecha)} no es una fecha real AAAA-MM-DD`)
  }
  if (!Array.isArray(e.items) || e.items.length === 0) {
    // Sin items la entrada pasaria la puerta de la release sin decir nada al
    // cliente: es la forma mas barata de cumplir el tramite sin cumplirlo.
    out.push(`${donde}: «items» tiene que ser una lista con al menos un item`)
    return out
  }
  e.items.forEach((it, j) => {
    const d = `${donde}, item ${j + 1}`
    if (!esObjeto(it)) {
      out.push(`${d} no es un objeto { tipo, texto }`)
      return
    }
    for (const k of Object.keys(it)) {
      if (!CLAVES_ITEM.includes(k)) out.push(`${d} trae un campo desconocido: «${k}»`)
    }
    if (!TIPOS_NOVEDAD.includes(it.tipo)) {
      out.push(`${d}: el tipo ${JSON.stringify(it.tipo)} no es uno de ${TIPOS_NOVEDAD.join(', ')}`)
    }
    if (typeof it.texto !== 'string' || it.texto.trim() === '') {
      out.push(`${d}: el texto esta vacio`)
    }
  })
  return out
}

/**
 * Valida el archivo entero. Junta TODOS los errores: quien lo arregla en un PR
 * prefiere verlos de una vez que corregir uno, empujar y descubrir el siguiente.
 * @returns {{ ok: true, novedades: any[] } | { ok: false, errores: string[] }}
 */
export function validarNovedades(datos) {
  if (!Array.isArray(datos)) {
    return { ok: false, errores: ['novedades.json tiene que ser una lista de versiones, de la mas nueva a la mas vieja'] }
  }
  const errores = []
  const vistas = new Set()
  datos.forEach((e, i) => {
    const donde = `la entrada ${i + 1}${esObjeto(e) && typeof e.version === 'string' ? ` (${e.version})` : ''}`
    errores.push(...erroresDeEntrada(e, donde))
    if (!esObjeto(e) || typeof e.version !== 'string' || !RE_VERSION.test(e.version)) return
    if (vistas.has(e.version)) errores.push(`${donde}: version repetida`)
    vistas.add(e.version)
    const previa = datos[i - 1]
    if (
      i > 0 &&
      esObjeto(previa) &&
      typeof previa.version === 'string' &&
      RE_VERSION.test(previa.version) &&
      compararVersiones(previa.version, e.version) < 0
    ) {
      errores.push(`${donde}: fuera de orden, ${e.version} va ANTES que ${previa.version} (la mas nueva primero)`)
    }
  })
  return errores.length ? { ok: false, errores } : { ok: true, novedades: datos }
}

/**
 * La entrada de una version de imagen, o `null`. Una precandidata
 * (`v0.9.2-rc1`) trae las notas de su version (`v0.9.2`).
 */
export function notasDe(version, novedades) {
  const base = versionBase(version)
  if (!base || !Array.isArray(novedades)) return null
  return novedades.find((e) => esObjeto(e) && e.version === base) ?? null
}
