import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { manejar, escapar, RUTAS } from './servidor.mjs'

// ============================================================================
//  El servidor del panel de flota (ADR 0026).
//
//  `manejar()` devuelve `{status, cabeceras, cuerpo}` en vez de escribir en un
//  socket: asi se prueba entera la decision de cada peticion sin levantar nada.
//
//  Lo que esta pantalla enseña es LA LISTA DE CLIENTES CON SUS DOMINIOS, que es
//  justo lo que el modelo de instancias soberanas protege. Por eso la mayoria de
//  estas pruebas comprueban que NO sale.
// ============================================================================

const FILAS = [
  { nombre: 'pixeled', dominio: 'space-os.pixeled.mx', canal: 'estable', version: 'v0.3.0', estado: 'al-dia', fecha: '2026-09-04T10:00:00Z', origen: 'consulta' },
  { nombre: 'sankofa', dominio: 'inventario.sankofa.mx', canal: 'estable', version: '—', estado: 'sin-respuesta', fecha: '—', origen: 'consulta' },
]

/** Dependencias de mentira; apuntan si se las llamo. */
function deps(opciones: any = {}) {
  const registro: any[] = []
  let consultas = 0
  return {
    registro,
    get consultas() {
      return consultas
    },
    d: {
      verificar: async () => opciones.acceso ?? { permitido: true, usuario: { email: 'jefa@asnetwork.io' } },
      obtenerFilas: async () => {
        consultas++
        return opciones.filas ?? FILAS
      },
      registrar: (e: any) => registro.push(e),
    },
  }
}

describe('sin permiso no sale ni un dominio', () => {
  it('sin cookie responde 401', async () => {
    const { d } = deps({ acceso: { permitido: false, motivo: 'sin cookie de sesion' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: undefined }, d)
    expect(r.status).toBe(401)
  })

  it('y el cuerpo del 401 NO filtra la flota', async () => {
    // Un 401 que enseñe la tabla seria peor que no tener panel.
    const { d } = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(401)
    for (const fila of FILAS) {
      expect(r.cuerpo).not.toContain(fila.dominio)
      expect(r.cuerpo).not.toContain(fila.nombre)
    }
  })

  it('ni siquiera se consulta a las instancias cuando se deniega', async () => {
    // Denegar tiene que ser barato y silencioso: no hay por que ir a tocar los
    // servidores de los clientes para acabar contestando 401.
    const dd = deps({ acceso: { permitido: false, motivo: 'sin sesion' } })
    await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(dd.consultas).toBe(0)
  })

  it('el motivo del rechazo NO se le cuenta al visitante', async () => {
    // Distinguir «sin sesion» de «sin permiso» le dice a quien prueba si acerto
    // con la cookie. Al registro si va; a la respuesta no.
    const { d } = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).not.toMatch(/administracion|permiso|sesion/i)
  })
})

describe('con permiso, la tabla', () => {
  it('responde 200 y trae las siete columnas', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(200)
    for (const col of ['nombre', 'dominio', 'canal', 'version', 'estado', 'fecha', 'origen']) {
      expect(r.cuerpo.toLowerCase()).toContain(col)
    }
  })

  it('y las instancias, con su estado', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).toContain('space-os.pixeled.mx')
    expect(r.cuerpo).toContain('sin-respuesta')
  })

  it('no se cachea en ningun sitio', async () => {
    // La flota cambia sola. Una tabla cacheada dice que todo va bien cuando ya
    // no va bien, que es la peor forma de fallar de un panel de estado.
    const { d } = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cabeceras['cache-control']).toMatch(/no-store/)
  })

  it('sirve tanto /flota/ como / (nginx puede recortar el prefijo)', async () => {
    const { d } = deps()
    for (const ruta of RUTAS) {
      const r = await manejar({ metodo: 'GET', ruta, cookie: 'spaces_sesion=x' }, d)
      expect(r.status, ruta).toBe(200)
    }
  })
})

describe('lo que llega de una instancia es TEXTO AJENO', () => {
  it('un nombre con etiquetas no sale crudo', async () => {
    // `/api/version` lo contesta el servidor de un owner. Si un dia devuelve
    // algo con `<script>`, esta pantalla NO es el sitio donde se ejecuta.
    const { d } = deps({
      filas: [{ ...FILAS[0], nombre: '<script>alert(1)</script>', dominio: 'a"b\'c<d>' }],
    })
    const r = await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.cuerpo).not.toContain('<script>alert(1)</script>')
    expect(r.cuerpo).toContain('&lt;script&gt;')
  })

  it('escapar() cubre los cinco de siempre', () => {
    expect(escapar('<>&"\'')).toBe('&lt;&gt;&amp;&quot;&#39;')
    expect(escapar(null)).toBe('')
    expect(escapar(3)).toBe('3')
  })
})

describe('queda constancia de quien mira', () => {
  it('cada acceso concedido se registra con el correo', async () => {
    // Deuda anotada en el ADR 0026: por SSH quedaba rastro, y publicarlo por web
    // lo quitaba. Aqui se repone.
    const dd = deps()
    await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(dd.registro).toHaveLength(1)
    expect(dd.registro[0].usuario).toBe('jefa@asnetwork.io')
    expect(dd.registro[0].permitido).toBe(true)
  })

  it('y los rechazados tambien, con su motivo', async () => {
    const dd = deps({ acceso: { permitido: false, motivo: 'sin permiso administracion:ver' } })
    await manejar({ metodo: 'GET', ruta: '/flota/', cookie: 'spaces_sesion=x' }, dd.d)
    expect(dd.registro).toHaveLength(1)
    expect(dd.registro[0].permitido).toBe(false)
    expect(dd.registro[0].motivo).toMatch(/permiso/)
  })
})

describe('todo lo demas', () => {
  it('una ruta que no existe es 404, y no consulta nada', async () => {
    const dd = deps()
    const r = await manejar({ metodo: 'GET', ruta: '/flota/secreto', cookie: 'spaces_sesion=x' }, dd.d)
    expect(r.status).toBe(404)
    expect(dd.consultas).toBe(0)
  })

  it('solo se sirve GET', async () => {
    const { d } = deps()
    const r = await manejar({ metodo: 'POST', ruta: '/flota/', cookie: 'spaces_sesion=x' }, d)
    expect(r.status).toBe(405)
  })
})
