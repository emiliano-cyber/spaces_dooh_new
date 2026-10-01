import { describe, it, expect } from 'vitest'
import { DICCIONARIOS, CLAVES, traducir, interpolar } from './diccionario'
import { IDIOMAS } from './idiomas'
import { EMAIL_INVALIDO } from '../validacion'
import { REGLA_PASSWORD, validarPassword, motivoPassword } from '../password'

// ============================================================================
//  I18N-03 · Los diccionarios, y la convencion de claves.
// ----------------------------------------------------------------------------
//  LA CONVENCION, Y EL PORQUE (que es lo que se pidio justificar):
//
//  1. Las claves van EN ESPANOL, en minusculas, separadas por puntos, con la
//     forma `ambito.elemento[.matiz]` -- `login.titulo`, `nav.grupo.patrimonio`,
//     `comun.cancelar`.
//
//     Porque este repositorio escribe el codigo en espanol a proposito
//     (`vault/06-Operacion/convenciones.md`), y una clave ES codigo: se teclea,
//     se busca con grep y se lee en un diff. Un archivo lleno de
//     `login.title` / `nav.group.inventory` seria el unico rincon del
//     repositorio que piensa en ingles, y ademas invitaria al renombrado que
//     esta tarea tiene prohibido.
//
//  2. La clave NO es el texto en espanol. Es `login.titulo`, no
//     `'Iniciar sesion'`.
//
//     Es la decision que mas cuesta y la que mas paga. Usar la frase como clave
//     es comodo el primer dia y despues cada retoque de redaccion --una coma,
//     una tilde, un «Vender» que pasa a «Comercial»-- deja huerfana la
//     traduccion EN SILENCIO: el ingles sigue ahi, apuntando a una frase que ya
//     no existe, y la pantalla se cae al espanol sin avisar. Este repositorio
//     tiene el caso documentado: `components/demo/shell/nav.ts` cuenta que un
//     mismo grupo del menu se llamo «Vender», luego «Ventas» y hoy «Comercial»
//     -- tres renombrados de UN rotulo, y las claves (`vender`) se dejaron
//     quietas justamente por esto.
//
//  3. El espanol manda: el tipo `ClaveTexto` se DERIVA del diccionario `es`, y
//     el `en` se declara como un registro completo de esas mismas claves. O sea
//     que una clave inglesa que falte NO es un hueco en tiempo de ejecucion:
//     es un error de compilacion de `tsc`. Las pruebas de abajo son el cinturon
//     sobre ese tirante.
// ============================================================================

describe('paridad · los dos diccionarios cubren exactamente lo mismo', () => {
  it('tienen el mismo juego de claves', () => {
    const es = Object.keys(DICCIONARIOS.es).sort()
    const en = Object.keys(DICCIONARIOS.en).sort()
    expect(en).toEqual(es)
  })

  it('CLAVES enumera todas las del espanol', () => {
    expect([...CLAVES].sort()).toEqual(Object.keys(DICCIONARIOS.es).sort())
  })

  it('hay un diccionario por idioma del catalogo, y ninguno de mas', () => {
    expect(Object.keys(DICCIONARIOS).sort()).toEqual([...IDIOMAS].sort())
  })

  it('ningun texto esta vacio ni tiene espacios sobrantes en los bordes', () => {
    const malos: string[] = []
    for (const idioma of IDIOMAS) {
      for (const [clave, valor] of Object.entries(DICCIONARIOS[idioma])) {
        if (valor.trim() === '') malos.push(`${idioma}:${clave} · vacio`)
        // El espacio del borde es intencional en algunas claves («¿Ya tienes
        // cuenta? ») porque van pegadas a otro nodo. Se permiten, pero NO el
        // salto de linea ni el tabulador, que siempre son un descuido.
        if (/[\n\t]/.test(valor)) malos.push(`${idioma}:${clave} · salto o tabulador`)
      }
    }
    expect(malos).toEqual([])
  })
})

describe('forma de las claves', () => {
  it('todas siguen `ambito.elemento` en minusculas, sin acentos y sin camelCase', () => {
    // Sin acentos por la misma razon que los mensajes de commit de este repo:
    // se teclean a menudo y se buscan con grep.
    //
    // El guion bajo se admite porque el ultimo segmento a veces REPRODUCE un
    // codigo que manda otro sistema y que no podemos elegir: los seis
    // `login.google.error.*` copian literalmente los valores que el callback de
    // Google devuelve en `?google=` (`no_disponible`, `no_registrado`,
    // `ya_vinculada`). Normalizarlos a guion medio obligaria a mantener una
    // tabla de equivalencias entre el codigo y la clave, y esa tabla es
    // exactamente la clase de cosa que se desincroniza sin avisar.
    const malas = [...CLAVES].filter((c) => !/^[a-z0-9]+(\.[a-z0-9_-]+)+$/.test(c))
    expect(malas).toEqual([])
  })

  it('todas tienen ambito: ninguna clave suelta sin punto', () => {
    const sueltas = [...CLAVES].filter((c) => !c.includes('.'))
    expect(sueltas).toEqual([])
  })
})

describe('los huecos {…} son los mismos en los dos idiomas', () => {
  it('cada clave usa exactamente los mismos nombres de hueco', () => {
    // Un hueco que exista en espanol y no en ingles deja un dato fuera de la
    // pantalla inglesa; al reves deja un `{n}` crudo a la vista.
    const huecos = (t: string) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const malas: string[] = []
    for (const clave of CLAVES) {
      const a = huecos(DICCIONARIOS.es[clave])
      const b = huecos(DICCIONARIOS.en[clave])
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        malas.push(`${clave} · es=[${a}] en=[${b}]`)
      }
    }
    expect(malas).toEqual([])
  })
})

describe('traducir', () => {
  it('devuelve el texto del idioma pedido', () => {
    expect(traducir('es', 'login.boton.entrar')).toBe('Entrar')
    expect(traducir('en', 'login.boton.entrar')).toBe('Sign in')
  })

  it('interpola los huecos', () => {
    expect(interpolar('Hola {nombre}, van {n}', { nombre: 'Ana', n: 3 })).toBe('Hola Ana, van 3')
  })

  it('un hueco sin valor se deja tal cual y NO se pinta «undefined»', () => {
    expect(interpolar('Van {n}', {})).toBe('Van {n}')
  })

  it('cae al espanol si por lo que sea faltara el texto ingles', () => {
    // No deberia poder ocurrir --lo impide `tsc`-- pero el cinturon existe
    // porque la alternativa en produccion es pintar la clave cruda.
    const roto = { ...DICCIONARIOS, en: {} } as unknown as typeof DICCIONARIOS
    expect(traducir('en', 'login.boton.entrar', undefined, roto)).toBe('Entrar')
  })
})

// ─── Que el diccionario no se despegue de lo que ya valida el servidor ──────
//
// `EMAIL_INVALIDO`, `REGLA_PASSWORD` y los motivos de `validarPassword` los
// escribe codigo COMPARTIDO con el servidor (`lib/validacion.ts`,
// `lib/password.ts`). El diccionario copia esos textos al espanol para poder
// dar su version inglesa, y una copia sin arnes se despega al primer retoque.
describe('el espanol del diccionario no puede despegarse de la validacion compartida', () => {
  it('validacion.email dice LO MISMO que EMAIL_INVALIDO', () => {
    expect(DICCIONARIOS.es['validacion.email']).toBe(EMAIL_INVALIDO)
  })

  it('password.regla dice LO MISMO que REGLA_PASSWORD', () => {
    expect(DICCIONARIOS.es['password.regla']).toBe(REGLA_PASSWORD)
  })

  it('cada motivo de contrasena tiene su clave, y el espanol coincide con validarPassword', () => {
    // Se ejerce la funcion de verdad en vez de copiar la lista a mano: si
    // manana se anade una regla, este caso lo dice.
    const casos: Array<[string, ReturnType<typeof motivoPassword>]> = [
      ['abc', 'corta'],
      ['12345678', 'sin-letra'],
      ['abcdefgh', 'sin-numero'],
      ['abcd 123', 'con-espacios'],
    ]
    for (const [entrada, motivoEsperado] of casos) {
      const motivo = motivoPassword(entrada)
      expect(motivo).toBe(motivoEsperado)
      expect(DICCIONARIOS.es[`password.${motivo}` as never]).toBe(validarPassword(entrada))
    }
  })

  it('una contrasena valida no tiene motivo', () => {
    expect(motivoPassword('abcd1234')).toBeNull()
    expect(validarPassword('abcd1234')).toBeNull()
  })
})

// ─── El menu se traduce por la clave que YA tiene ───────────────────────────
describe('cobertura del menu lateral', () => {
  it('cada entrada y cada grupo del NAV tiene su texto en los dos idiomas', async () => {
    // Se importa aqui dentro para que este archivo no arrastre los iconos de
    // lucide al resto de las pruebas.
    const { NAV, GRUPOS } = await import('../../components/demo/shell/nav')
    const faltan: string[] = []
    for (const item of NAV) {
      for (const idioma of IDIOMAS) {
        if (!(`nav.${item.key}` in DICCIONARIOS[idioma])) faltan.push(`${idioma}:nav.${item.key}`)
      }
    }
    for (const g of GRUPOS) {
      if (g.titulo === null) continue
      for (const idioma of IDIOMAS) {
        if (!(`nav.grupo.${g.key}` in DICCIONARIOS[idioma])) faltan.push(`${idioma}:nav.grupo.${g.key}`)
      }
    }
    expect(faltan).toEqual([])
  })

  it('el espanol del diccionario reproduce EXACTAMENTE el label de nav.ts', () => {
    // `nav.ts` es archivo de alto contacto y esta tarea NO lo toca: el menu se
    // traduce mirando `item.key`, y el `label` sigue siendo la verdad en
    // espanol. Si alguien cambia un rotulo alli --ya paso tres veces-- esta
    // prueba obliga a traerlo aqui en el mismo commit en vez de dejar dos
    // menus distintos segun el idioma.
    return import('../../components/demo/shell/nav').then(({ NAV, GRUPOS }) => {
      const desviados: string[] = []
      for (const item of NAV) {
        const esperado = DICCIONARIOS.es[`nav.${item.key}` as never] as unknown as string
        if (esperado !== item.label) desviados.push(`nav.${item.key}: «${esperado}» != «${item.label}»`)
      }
      for (const g of GRUPOS) {
        if (g.titulo === null) continue
        const esperado = DICCIONARIOS.es[`nav.grupo.${g.key}` as never] as unknown as string
        if (esperado !== g.titulo) desviados.push(`nav.grupo.${g.key}: «${esperado}» != «${g.titulo}»`)
      }
      expect(desviados).toEqual([])
    })
  })
})
