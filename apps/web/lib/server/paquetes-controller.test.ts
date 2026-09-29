import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  LA FORMA DE ENTRADA DE UN PAQUETE CERRADO. ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  ⚠️ ESTE ARCHIVO NACIÓ DE UN MUTANTE QUE SOBREVIVIÓ (M35). El mutante
//  cambiaba `admiteCodigo: d.admiteCodigo === true` por `!== false`, o sea
//  invertía la polaridad de la regla 2 del ADR 0039 — **la bandera pasaba a
//  nacer ENCENDIDA** — y la suite entera seguía en verde, porque el controller
//  no tenía ninguna prueba.
//
//  Lo que costaría: cada paquete creado sin marcar la casilla admitiría un
//  cupón encima de un precio que se vendió como final. Con un cupón del 20 %,
//  un paquete de 180 000 se cobraría a 144 000 y nadie vería un error: la
//  cotización quedaría coherente consigo misma.
//
//  «La regla nace cerrada y se abre a propósito» es una frase del ADR; esto es
//  lo que la convierte en algo que se puede romper y se nota.
// ============================================================================

// `vi.hoisted` porque `vi.mock` se iza al principio del archivo: sin él, la
// fábrica del mock vería estas variables todavía sin inicializar.
const { guardado, aplicado } = vi.hoisted(() => ({
  guardado: vi.fn(),
  aplicado: vi.fn(),
}))

vi.mock('./paquetes-repo', () => ({
  listarPaquetes: vi.fn(async () => []),
  guardarPaquete: guardado,
  borrarPaquete: vi.fn(async () => true),
  aplicarPaquete: aplicado,
  quitarPaquete: vi.fn(async () => true),
  PaqueteImposible: class extends Error {},
}))

const { guardarPaqueteCtrl, aplicarPaqueteCtrl } = await import('./paquetes-controller')

const CUERPO = { nombre: 'Periferico', precioCerrado: 180_000, sitios: ['a', 'b'] }

beforeEach(() => {
  guardado.mockReset()
  aplicado.mockReset()
  guardado.mockImplementation(async (p: any) => ({
    id: 'PK1',
    nombre: p.nombre,
    precioCerrado: p.precioCerrado,
    admiteCodigo: p.admiteCodigo,
    activo: p.activo,
    notas: p.notas ?? null,
    sitios: p.sitios,
    aplicadoEn: 0,
  }))
  aplicado.mockResolvedValue({
    nombre: 'Periferico', precio: 180_000, admiteCodigo: false, composicion: ['a', 'b'],
  })
})

describe('1 · la regla 2 del ADR: la bandera NACE APAGADA', () => {
  it('un cuerpo que NO menciona `admiteCodigo` crea un paquete de PRECIO FINAL', async () => {
    const r = await guardarPaqueteCtrl({ ...CUERPO })
    expect(r.admiteCodigo).toBe(false)
    expect(guardado.mock.calls[0][0].admiteCodigo).toBe(false)
  })

  it('solo un `true` EXPLÍCITO la enciende', async () => {
    await guardarPaqueteCtrl({ ...CUERPO, admiteCodigo: true })
    expect(guardado.mock.calls[0][0].admiteCodigo).toBe(true)
  })

  it('un `false` explícito la deja apagada', async () => {
    await guardarPaqueteCtrl({ ...CUERPO, admiteCodigo: false })
    expect(guardado.mock.calls[0][0].admiteCodigo).toBe(false)
  })

  it('NEGATIVA · la CADENA "true" NO la enciende: se rechaza el cuerpo', async () => {
    // `z.coerce.boolean()` convertiría tanto `'true'` como `'false'` en `true`,
    // porque `Boolean('false')` es `true`. Sobre una regla que decide si un
    // cupón descuenta encima de un precio final, eso es abrirla sin que nadie
    // lo haya decidido. Se rechaza el cuerpo en vez de adivinar.
    await expect(guardarPaqueteCtrl({ ...CUERPO, admiteCodigo: 'true' })).rejects.toBeTruthy()
    await expect(guardarPaqueteCtrl({ ...CUERPO, admiteCodigo: 'false' })).rejects.toBeTruthy()
    await expect(guardarPaqueteCtrl({ ...CUERPO, admiteCodigo: 1 })).rejects.toBeTruthy()
  })

  it('`activo` va al revés y también es explícito: sin decir nada, nace activo', async () => {
    await guardarPaqueteCtrl({ ...CUERPO })
    expect(guardado.mock.calls[0][0].activo).toBe(true)
  })
})

describe('2 · las reglas de formato vienen del módulo puro', () => {
  it('un precio con centavos se rechaza con la frase que dice qué hacer', async () => {
    await expect(guardarPaqueteCtrl({ ...CUERPO, precioCerrado: 180_000.5 })).rejects.toThrow(
      /entero/i,
    )
    expect(guardado).not.toHaveBeenCalled()
  })

  it('una sola pantalla se rechaza', async () => {
    await expect(guardarPaqueteCtrl({ ...CUERPO, sitios: ['a'] })).rejects.toThrow(/pantalla/i)
    expect(guardado).not.toHaveBeenCalled()
  })

  it('un precio de cero se rechaza', async () => {
    await expect(guardarPaqueteCtrl({ ...CUERPO, precioCerrado: 0 })).rejects.toThrow(/precio/i)
  })
})

describe('3 · AL APLICAR, el precio NUNCA entra por el cuerpo', () => {
  it('lo único que se acepta es el `paqueteId`', async () => {
    await aplicarPaqueteCtrl('P1', { paqueteId: 'PK1', precio: 1, admiteCodigo: true })
    // El repo recibe DOS argumentos y ninguno es un precio: si el precio del
    // conjunto viajara en el JSON, cerrar cinco pantallas en un peso sería un
    // `curl` — y sin ningún error, porque la propuesta quedaría coherente.
    expect(aplicado).toHaveBeenCalledWith('P1', 'PK1')
  })

  it('sin `paqueteId` se rechaza', async () => {
    await expect(aplicarPaqueteCtrl('P1', {})).rejects.toBeTruthy()
  })
})

describe('4 · EL CANDADO DEL PRECIO, leído del fuente', () => {
  it('el esquema de aplicar NO declara ningún campo de precio', async () => {
    // Misma red que el candado del vendedor (VEND-01) y el del volumen: impide
    // que alguien añada el campo «porque hace falta en la pantalla» sin darse
    // cuenta de lo que abre. Se leen SOLO las líneas de código, no los
    // comentarios: una aserción que casa con la prosa que explica el código no
    // prueba nada, y eso ya pasó cinco veces en este repositorio.
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const fuente = readFileSync(join(__dirname, 'paquetes-controller.ts'), 'utf8')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
      .join('\n')
    const esquema = fuente.slice(
      fuente.indexOf('const aplicarSchema'),
      fuente.indexOf('export async function aplicarPaqueteCtrl'),
    )
    expect(esquema).toContain('paqueteId')
    expect(esquema).not.toMatch(/precio/i)
    expect(esquema).not.toMatch(/admiteCodigo/)
    expect(esquema).not.toMatch(/nombre/)
  })
})
