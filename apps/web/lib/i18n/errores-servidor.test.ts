import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  CATALOGO_ERRORES,
  CAMPO_EN,
  PATRONES_ERROR,
  SIN_TRADUCIR,
  traducirError,
} from './errores-servidor'
import { IDIOMAS } from './idiomas'

// ============================================================================
//  I18N-05 · LOS MENSAJES DE ERROR DEL SERVIDOR, EN EL IDIOMA DE QUIEN LOS LEE.
// ----------------------------------------------------------------------------
//  EL DISENO, Y POR QUE ESTE Y NO OTRO.
//
//  Hay 253 `new AppError(...)` en 42 archivos. La via evidente —poner una clave
//  en cada sitio— toca 253 lugares y obliga a reescribir los textos en espanol,
//  que es justo lo que NO se debe hacer: hay 11 archivos de prueba que afirman
//  ese texto exacto, y esa red es lo que impide que al traducir se cambie lo
//  que un error DICE.
//
//  Asi que la traduccion ocurre EN LA SALIDA, en `respuestaError()`, que es el
//  unico embudo por donde pasan los 253. El catalogo va del ESPANOL CANONICO al
//  ingles, y el espanol sigue siendo la fuente: no se toca ni una letra.
//
//  ─── «PERO SI TU MISMO DIJISTE QUE LA FRASE NO SE USA DE CLAVE» ────────────
//
//  Cierto, y en I18N-01 se razono largo. La objecion era que usar la frase como
//  clave deja la traduccion huerfana EN SILENCIO al primer retoque de
//  redaccion. Lo que hace peligroso ese patron no es la frase: es el SILENCIO.
//
//  Aqui el silencio se quita: `GUARDIA` (abajo) recorre el repositorio, saca
//  todos los mensajes literales de `new AppError(...)` y exige que cada uno
//  este en el catalogo o declarado en `SIN_TRADUCIR`. Un mensaje nuevo, o uno
//  reescrito, pone la prueba EN ROJO. La deriva deja de ser silenciosa, que era
//  el problema entero.
//
//  La otra mitad del motivo es que aqui NO se puede elegir: con una clave por
//  sitio habria que tocar los 253 y reescribir el espanol. El coste de la via
//  limpia se paga en el sitio equivocado.
// ============================================================================

describe('el espanol es la fuente y NO SE TOCA', () => {
  it('en espanol, el mensaje sale tal cual entro', () => {
    // Literalmente la identidad. Es la garantia de que este lote no puede
    // cambiar lo que un error dice hoy en espanol -- y de que las 11 pruebas
    // que afirman ese texto siguen valiendo.
    const casos = [
      'No encontrado',
      'Campaña no encontrada',
      'RFC inválido',
      'cualquier cosa que no este en el catalogo',
      '',
    ]
    for (const m of casos) expect(traducirError(m, 'es')).toBe(m)
  })

  it('ninguna clave del catalogo esta vacia y ninguna traduccion repite el espanol por descuido', () => {
    const sospechosas: string[] = []
    for (const [es, en] of Object.entries(CATALOGO_ERRORES)) {
      if (es.trim() === '') sospechosas.push('(clave vacia)')
      if (en.trim() === '') sospechosas.push(`${es} · traduccion vacia`)
      // Que el ingles sea IGUAL al espanol solo se admite si no hay nada que
      // traducir (siglas, nombres). Con acentos o palabras funcionales, es un
      // descuido.
      if (en === es && /[áéíóúñ¿¡]| de | la | el | no /i.test(es)) {
        sospechosas.push(`${es} · sin traducir de verdad`)
      }
    }
    expect(sospechosas).toEqual([])
  })
})

describe('traducirError · en ingles', () => {
  it('traduce un mensaje del catalogo', () => {
    expect(traducirError('No encontrado', 'en')).toBe('Not found')
    expect(traducirError('Campaña no encontrada', 'en')).toBe('Campaign not found')
  })

  it('lo que NO conoce lo deja en espanol en vez de inventar', () => {
    // El respaldo honesto. Un mensaje a medias traducir es mejor en espanol
    // entero que convertido en una clave cruda o en una cadena vacia.
    const raro = 'Un mensaje que nadie ha catalogado todavia'
    expect(traducirError(raro, 'en')).toBe(raro)
  })

  it('no revienta con entradas degeneradas', () => {
    for (const idioma of IDIOMAS) {
      expect(() => traducirError('', idioma)).not.toThrow()
      expect(() => traducirError(null as unknown as string, idioma)).not.toThrow()
      expect(() => traducirError(undefined as unknown as string, idioma)).not.toThrow()
    }
    expect(traducirError(null as unknown as string, 'en')).toBe('')
  })
})

// ─── Los mensajes de VALIDACION, que no son una frase sino dos piezas ───────
//
// `validar()` compone `${Etiqueta}: ${motivo}` -- «Correo: Correo inválido».
// Un catalogo de frases enteras no los cubre porque la combinatoria es el
// producto de campos por motivos. Se traducen por PARTES.
describe('traducirError · los mensajes de validacion, por partes', () => {
  it('traduce la etiqueta del campo Y el motivo', () => {
    expect(traducirError('Correo: Este dato es obligatorio', 'en')).toBe(
      'Email: This field is required',
    )
    expect(traducirError('Razón social: Correo inválido', 'en')).toBe(
      'Legal name: Invalid email',
    )
  })

  it('si solo conoce una de las dos partes, traduce esa y conserva la otra', () => {
    // Degradar a medias es correcto AQUI y no en la interfaz: el usuario
    // prefiere «Email: <algo en espanol>» a no saber de que campo le hablan.
    const r = traducirError('Correo: motivo rarisimo sin catalogar', 'en')
    expect(r).toBe('Email: motivo rarisimo sin catalogar')
  })

  it('no parte por un `:` que no separa campo de motivo', () => {
    // Un mensaje normal que lleve dos puntos dentro no debe trocearse.
    const m = 'El montaje digital ya no es una tarea de OT: el arte se sube con "Subir a producción" en la campaña'
    expect(traducirError(m, 'en')).toBe(
      'Digital setup is no longer a work-order task: artwork is uploaded with "Send to production" in the campaign',
    )
  })

  it('un mensaje DESCONOCIDO con dos puntos dentro no se trocea ni se traduce a medias', () => {
    // ESTE es el caso que de verdad ejerce la guardia del corte. Costo DOS
    // intentos y conviene dejar escrito por que, porque es sutil:
    //
    //  · la prueba de arriba no vale: aquel mensaje esta en el catalogo, asi
    //    que la busqueda exacta devuelve antes de llegar al corte;
    //  · y «Aviso: algo sin catalogar» TAMPOCO vale —fue el primer intento—
    //    porque sin guardia el campo desconocido se conserva tal cual y el
    //    motivo desconocido tampoco cambia: sale identico y el mutante vive.
    //
    // Lo que distingue es que la DERECHA si se pueda traducir y la izquierda NO
    // sea un campo. Sin guardia esto saldria «Aviso: Not found»: media frase en
    // ingles, partida por unos dos puntos que no separaban nada.
    expect(traducirError('Aviso: No encontrado', 'en')).toBe('Aviso: No encontrado')
    expect(traducirError('Resultado: Correo inválido', 'en')).toBe('Resultado: Correo inválido')
  })

  it('con un campo conocido SI parte, para que quede claro que la guardia no lo apaga todo', () => {
    expect(traducirError('Monto: Este dato es obligatorio', 'en')).toBe(
      'Amount: This field is required',
    )
  })

  it('traduce los motivos de zod que llevan un NUMERO dentro', () => {
    // `mapaZodEs` produce «Debe tener al menos 8 caracteres». El numero sale
    // del esquema, asi que no cabe en un catalogo de frases: va por patron, y
    // el numero se conserva.
    expect(traducirError('Debe tener al menos 8 caracteres', 'en')).toBe(
      'Must be at least 8 characters',
    )
    expect(traducirError('Contraseña: Debe tener al menos 12 caracteres', 'en')).toBe(
      'Password: Must be at least 12 characters',
    )
    expect(traducirError('No puede ser mayor que 100', 'en')).toBe('Must not be greater than 100')
  })

  it('un patron NO se traga un numero que no es el suyo', () => {
    const r = traducirError('Debe tener al menos 8 caracteres', 'en')
    expect(r).toContain('8')
    expect(r).not.toContain('12')
  })
})

// ─── LA GUARDIA · aqui es donde se quita el silencio ────────────────────────
describe('GUARDIA · ningun mensaje de error puede quedarse fuera EN SILENCIO', () => {
  const RAIZ = path.resolve(__dirname, '..', '..')
  const PODAR = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', '.git'])

  function fuentes(dir: string = RAIZ, acc: string[] = []): string[] {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (PODAR.has(e.name)) continue
      const abs = path.join(dir, e.name)
      if (e.isDirectory()) fuentes(abs, acc)
      // Las PRUEBAS quedan fuera: sus mensajes son andamio, no interfaz.
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(abs)
    }
    return acc
  }

  // Lee `'a' + 'b' + 'c'` y devuelve el texto COMPLETO, o null si hay una
  // variable en medio. Es la trampa que se encontro al medir: un mensaje
  // partido en dos literales deja en el catalogo solo el primer trozo, y
  // entonces la entrada NUNCA casa y nadie se entera.
  function leerConcatenacion(resto: string): string | null {
    let i = 0
    let texto = ''
    let primero = true
    for (;;) {
      while (i < resto.length && /\s/.test(resto[i])) i++
      if (!primero) {
        if (resto[i] !== '+') break
        i++
        while (i < resto.length && /\s/.test(resto[i])) i++
      }
      const c = resto[i]
      if (c !== "'" && c !== '"') return primero ? null : null
      let j = i + 1
      let val = ''
      while (j < resto.length && resto[j] !== c) {
        if (resto[j] === '\\') {
          val += resto[j + 1] === 'n' ? '\n' : resto[j + 1]
          j += 2
          continue
        }
        val += resto[j]
        j++
      }
      texto += val
      i = j + 1
      primero = false
    }
    return texto
  }

  // Los COMENTARIOS se tachan antes de buscar, y no es un detalle: este
  // repositorio comenta muchisimo, y la primera version de esta guardia se puso
  // roja por un comentario de `errores-servidor.ts` que decia
  // «115 mensajes de `new AppError('...')`». Es el mismo fallo que ya costo
  // caro aqui —un `toContain` que casa con un comentario—, solo que del lado
  // del arnes.
  //
  // Se sustituye cada caracter por un espacio en vez de borrarlo, para que los
  // numeros de linea que se reportan sigan siendo los de verdad.
  function sinComentarios(src: string): string {
    const blanquear = (m: string) => m.replace(/[^\n]/g, ' ')
    return src.replace(/\/\*[\s\S]*?\*\//g, blanquear).replace(/\/\/[^\n]*/g, blanquear)
  }

  function mensajesLiterales(): Map<string, string[]> {
    const out = new Map<string, string[]>()
    for (const abs of fuentes()) {
      const rel = path.relative(RAIZ, abs).replace(/\\/g, '/')
      const src = sinComentarios(readFileSync(abs, 'utf8'))
      const re = /new AppError\(/g
      let m: RegExpExecArray | null
      while ((m = re.exec(src)) !== null) {
        const resto = src.slice(m.index + m[0].length)
        if (/^\s*`/.test(resto)) continue // plantilla: declarada en SIN_TRADUCIR
        const texto = leerConcatenacion(resto)
        if (texto === null) continue // identificador o compuesto con variable
        const linea = src.slice(0, m.index).split('\n').length
        if (!out.has(texto)) out.set(texto, [])
        out.get(texto)!.push(`${rel}:${linea}`)
      }
    }
    return out
  }

  it('el arnes encuentra mensajes (no esta mirando al vacio)', () => {
    // Sin esto, un fallo del recorrido dejaria la prueba de abajo en verde por
    // no mirar nada. Es el arnes del arnes.
    const m = mensajesLiterales()
    expect(m.size).toBeGreaterThan(100)
    expect([...m.keys()]).toContain('No encontrado')
  })

  it('TODO mensaje literal esta en el catalogo o DECLARADO como pendiente', () => {
    // Esta es la prueba que convierte «la frase es la clave» en un patron
    // seguro. Si alguien anade un `new AppError('...')` nuevo, o reescribe uno
    // existente, esto se pone rojo y le obliga a decidir: traducirlo o
    // declararlo. Lo que ya no puede es pasar desapercibido.
    const sinCubrir: string[] = []
    for (const [msg, sitios] of mensajesLiterales()) {
      if (msg in CATALOGO_ERRORES) continue
      if ((SIN_TRADUCIR as readonly string[]).includes(msg)) continue
      sinCubrir.push(`${sitios[0]} · ${JSON.stringify(msg)}`)
    }
    expect(sinCubrir).toEqual([])
  })

  it('el catalogo no acumula entradas MUERTAS que ya nadie lanza', () => {
    // El reves del anterior, y hace falta: una entrada que ya no corresponde a
    // ningun mensaje real es peso muerto que aparenta cobertura.
    //
    // Se admiten las de `errores.ts` y las piezas de validacion, que no se
    // lanzan con `new AppError('...')` literal sino desde el mapa de Postgres,
    // el embudo o `validar()`.
    const vivos = new Set(mensajesLiterales().keys())
    const EXENTAS = new Set([
      ...Object.values(ERRORES_PG_ES),
      'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.',
      'Error interno',
      'Datos inválidos',
      // motivos de zod (los compone `validar()`, no un `new AppError` literal)
      'Este dato es obligatorio',
      'El valor tiene un formato inválido',
      'Correo inválido',
      'Selecciona una opción válida',
      'El texto tiene un formato inválido',
      'El valor no es válido',
      'Debe ser mayor que 0',
      // los de `lib/password.ts` y `lib/validacion.ts`, que viajan por variable
      'La contraseña debe tener al menos 8 caracteres',
      'La contraseña debe incluir al menos una letra',
      'La contraseña debe incluir al menos un número',
      'La contraseña no puede contener espacios',
      'Correo inválido. Usa el formato ejemplo@correo.com',
      'Teléfono inválido. Escribe 10 dígitos (p. ej. 55 1234 5678)',
      'Código postal inválido (5 dígitos)',
      'Ese prospecto no existe',
      'Tu organizacion ya tiene razones sociales registradas, asi que el cuestionario ya se contesto. Para cambiarlas, usa la pantalla de Administracion.',
      'Las tarifas por unidad se guardan en su propia ruta (PATCH /api/sitios/:id/modalidades), que siempre pide la contraseña.',
    ])
    const muertas = Object.keys(CATALOGO_ERRORES).filter(
      (k) => !vivos.has(k) && !EXENTAS.has(k),
    )
    expect(muertas).toEqual([])
  })
})

// Los mensajes del mapa de Postgres, copiados aqui para la prueba de entradas
// muertas. Viven en `lib/server/errores.ts` y NO se importan para no arrastrar
// `server-only` ni `next/server` a este archivo.
const ERRORES_PG_ES = {
  '22P02': 'Dato con formato inválido',
  '22007': 'Fecha inválida',
  '22008': 'Fecha fuera de rango',
  '22001': 'Un valor excede la longitud permitida',
  '23502': 'Falta un dato obligatorio',
  '23514': 'Un valor no cumple las reglas de la tabla',
  '23505': 'El registro ya existe',
  '23503': 'El registro está referenciado por otro',
  '42501': 'Sin acceso a ese registro',
}

// ─── El mismo fallo NO puede decirse de dos maneras ─────────────────────────
describe('coherencia con el diccionario de la INTERFAZ', () => {
  it('las cinco validaciones compartidas dicen lo MISMO en ingles vengan de donde vengan', async () => {
    // `lib/password.ts` y `lib/validacion.ts` los usa el navegador (que ataja
    // antes de enviar) Y el servidor (que vuelve a comprobar). Si el navegador
    // dijera «The password must be at least 8 characters long» y el servidor
    // «Password too short», el usuario veria dos mensajes distintos para el
    // mismo fallo segun lo rapido que escriba.
    const { DICCIONARIOS } = await import('./diccionario')
    const pares: Array<[string, keyof (typeof DICCIONARIOS)['es']]> = [
      ['Correo inválido. Usa el formato ejemplo@correo.com', 'validacion.email'],
      ['La contraseña debe tener al menos 8 caracteres', 'password.corta'],
      ['La contraseña debe incluir al menos una letra', 'password.sin-letra'],
      ['La contraseña debe incluir al menos un número', 'password.sin-numero'],
      ['La contraseña no puede contener espacios', 'password.con-espacios'],
    ]
    for (const [es, clave] of pares) {
      // El espanol de los dos lados ya tiene su propia prueba en
      // `diccionario.test.ts`; aqui se ata el INGLES.
      expect(CATALOGO_ERRORES[es]).toBe(DICCIONARIOS.en[clave])
      expect(traducirError(es, 'en')).toBe(DICCIONARIOS.en[clave])
    }
  })
})

describe('cobertura declarada · lo que falta esta CONTADO, no escondido', () => {
  it('SIN_TRADUCIR solo contiene mensajes que de verdad existen', () => {
    // Una lista de pendientes con entradas fantasma miente sobre el avance.
    expect(Array.isArray(SIN_TRADUCIR)).toBe(true)
    for (const m of SIN_TRADUCIR) expect(typeof m).toBe('string')
  })

  it('las etiquetas de campo cubren las mismas claves que el servidor humaniza', () => {
    // `CAMPO_EN` es el espejo de `CAMPO_ES` (`lib/server/errores.ts`). Si el
    // servidor anade un campo y aqui no, la mitad izquierda del mensaje se
    // queda en espanol.
    expect(Object.keys(CAMPO_EN).length).toBeGreaterThan(20)
    expect(CAMPO_EN['Correo']).toBe('Email')
    expect(CAMPO_EN['Contraseña']).toBe('Password')
  })

  it('cada patron tiene su hueco y su traduccion', () => {
    for (const p of PATRONES_ERROR) {
      expect(p.re).toBeInstanceOf(RegExp)
      expect(typeof p.en).toBe('string')
      expect(p.en).toMatch(/\$1/)
    }
  })
})
