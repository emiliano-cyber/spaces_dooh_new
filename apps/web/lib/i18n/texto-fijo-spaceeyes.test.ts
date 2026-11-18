import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

// ============================================================================
//  I18N · NINGUNA FRASE EN ESPAÑOL ESCRITA DIRECTO EN SPACE EYES (2026-11-09)
// ----------------------------------------------------------------------------
//  `pantallas-spaceeyes.test.ts` rinde cada pantalla en inglés y busca español,
//  pero SOLO ve los estados que alguien le preparó a mano. Un componente nuevo
//  no está en esa lista hasta que alguien lo añade, y mientras tanto su texto
//  fijo pasa sin que nada lo diga.
//
//  Pasó así: `AvisosCorreo.tsx` (la rama de Jose del 09/11) llegó con 41 frases
//  en español escritas directo, y las dos suites seguían en verde. Las del
//  bloque de noche de `EquipoAdmin.tsx` llegaron igual el 06/11.
//
//  Esta prueba no rinde nada: LEE EL FUENTE de cada `.tsx` de Space Eyes y
//  busca frases en español fuera de `t('…')`. Es más tosca que la otra, pero
//  ve los archivos que nadie ha registrado todavía, que es justo su hueco.
//
//  QUÉ CUENTA COMO FRASE EN ESPAÑOL. Un texto de JSX o un literal de cadena con
//  al menos dos palabras y (a) una tilde, ñ, ¿ o ¡, o (b) una palabra de enlace
//  del español (de, que, los, para…). Las clases de Tailwind, las claves
//  (`spaceeyes.x.y`), las rutas y los correos de ejemplo no tienen ninguna de
//  las dos cosas, así que no se confunden.
//
//  SI TE FALLA: pasa el texto a `lib/i18n/textos/spaceeyes.ts`, en los CUATRO
//  diccionarios, y úsalo con `t('…')`. Solo si el texto NO lo lee el usuario
//  (lo lee soporte, o es un dato del servidor) va a `PERMITIDOS`, con su porqué.
// ============================================================================

const RAIZ = path.join(__dirname, '..', '..')
const CARPETAS = ['components/demo/space-eyes', 'app/(app)/(shell)/space-eyes']

// Texto que se queda en español a propósito. Cada entrada dice por qué.
const PERMITIDOS: Record<string, string> = {
  // El ticket de «Solicitar activación» le llega a NUESTRO soporte, que lee
  // español; el cliente no lo ve nunca.
  'Solicitud de activación de Space Eyes': 'ticket a soporte',
  'Nos interesa activar Space Eyes (cámaras que vigilan nuestras pantallas: fotos de exhibición, fallas y creativos). ':
    'ticket a soporte',
  'Solicitud enviada desde la demostración del módulo en SPACE OS.': 'ticket a soporte',
  // `Galeria.tsx`, al armar el álbum: el `catch` de al lado se traga el error
  // y solo cuenta la foto como fallida. El mensaje no se pinta nunca.
  'sin ruta': 'error interno que no se muestra',
}

const ENLACE = new Set(
  'de del la las el los que en por para con sin una un se no al su sus es lo hay ya más pero como cuando desde hasta este esta'.split(
    ' ',
  ),
)

export function pareceEspanol(texto: string): boolean {
  const t = texto.trim()
  const palabras = t.split(/\s+/).filter((p) => /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(p))
  if (palabras.length < 2) return false
  if (/[áéíóúÁÉÍÓÚñÑ¿¡]/.test(t)) return true
  return palabras.some((p) => ENLACE.has(p.toLowerCase().replace(/[^a-záéíóúñ]/g, '')))
}

// Quita comentarios sin tocar el contenido de las cadenas («https://…» lleva //).
export function sinComentarios(fuente: string): string {
  let out = ''
  let i = 0
  let cadena: string | null = null
  while (i < fuente.length) {
    const c = fuente[i]
    const sig = fuente[i + 1]
    if (cadena) {
      out += c
      if (c === '\\') {
        out += sig ?? ''
        i += 2
        continue
      }
      if (c === cadena) cadena = null
      i++
      continue
    }
    if (c === '/' && sig === '*') {
      const fin = fuente.indexOf('*/', i + 2)
      i = fin < 0 ? fuente.length : fin + 2
      continue
    }
    if (c === '/' && sig === '/') {
      const fin = fuente.indexOf('\n', i)
      i = fin < 0 ? fuente.length : fin
      continue
    }
    if (c === "'" || c === '"' || c === '`') cadena = c
    out += c
    i++
  }
  return out
}

/** Las frases en español que un archivo pinta sin pasar por `t('…')`. */
export function frasesFijas(fuente: string): string[] {
  const src = sinComentarios(fuente.replace(/\r\n/g, '\n'))
  const halladas: string[] = []
  // Literales de cadena: '…', "…" y `…` sin huecos.
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`$\n]*)`/g)) {
    const texto = m[1] ?? m[2] ?? m[3] ?? ''
    if (pareceEspanol(texto)) halladas.push(texto)
  }
  // Texto suelto de JSX: lo que va entre `>` y el siguiente `<` o `{`.
  for (const m of src.matchAll(/>([^<>{}]+)[<{]/g)) {
    const texto = m[1].replace(/\s+/g, ' ').trim()
    if (texto && !/[=;()]/.test(texto) && pareceEspanol(texto)) halladas.push(texto)
  }
  return halladas.filter((t) => !(t in PERMITIDOS))
}

function archivos(dir: string): string[] {
  const abs = path.join(RAIZ, dir)
  return readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name)
    if (e.isDirectory()) return archivos(rel)
    return /\.tsx$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : []
  })
}

describe('Space Eyes no pinta español escrito directo', () => {
  it('el detector distingue una frase de una clase, una clave o un correo', () => {
    expect(pareceEspanol('Mandar correo cuando una pantalla falle')).toBe(true)
    expect(pareceEspanol('Último intento')).toBe(true)
    expect(pareceEspanol('Guardado.')).toBe(false) // una palabra: no se puede saber
    expect(pareceEspanol('mt-1 h-9 w-full rounded border')).toBe(false)
    expect(pareceEspanol('spaceeyes.avisos.titulo')).toBe(false)
    expect(pareceEspanol('operacion@empresa.com, guardia@empresa.com')).toBe(false)
    expect(pareceEspanol('Send an email when a screen fails')).toBe(false)
  })

  it('caza el texto suelto de JSX y los literales, y no los comentarios', () => {
    const fuente = [
      '// Un comentario de la tarjeta no cuenta',
      '<span className="h-4 w-4">Correos que reciben el aviso</span>',
      "setMensaje({ texto: 'No se pudo guardar.' })",
      "<p>{t('spaceeyes.avisos.que-avisa')}</p>",
      "const url = 'https://ejemplo.com/a' // y la ruta tampoco",
    ].join('\n')
    expect(frasesFijas(fuente)).toEqual(['No se pudo guardar.', 'Correos que reciben el aviso'])
  })

  const lista = CARPETAS.flatMap(archivos)

  it('hay archivos que revisar (si no, la ruta cambió y esto no protege nada)', () => {
    expect(lista.length).toBeGreaterThan(20)
    expect(lista).toContain('components/demo/space-eyes/AvisosCorreo.tsx')
  })

  it.each(lista)('%s', (rel) => {
    const fuente = readFileSync(path.join(RAIZ, rel), 'utf8')
    expect(frasesFijas(fuente)).toEqual([])
  })
})
