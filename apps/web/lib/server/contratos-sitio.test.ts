import { describe, it, expect, vi } from 'vitest'
import type { PoolClient } from 'pg'
import { AppError } from './errores'

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return { ...actual, cache: <T,>(fn: T) => fn }
})

const {
  exigirArrendador,
  asignarArrendadorYAbrirContrato,
  exigirContratoCompleto,
  resolverPredio,
  abrirContratoDePredio,
} = await import('./contratos-sitio')

const TENANT = 'tenant-1'
const ARR = '11111111-1111-1111-1111-111111111111'

// Cliente falso: devuelve `rows` de la cola y registra cada consulta.
function fakeClient(colas: Record<string, unknown>[][] = []) {
  const queries: { sql: string; params: unknown[] }[] = []
  let i = 0
  const client = {
    query: async (sql: string, params: unknown[] = []) => {
      queries.push({ sql, params })
      return { rows: colas[i++] ?? [] }
    },
  } as unknown as PoolClient
  return { client, queries }
}

describe('exigirArrendador', () => {
  it('rechaza cuando no se eligió arrendador', async () => {
    const { client, queries } = fakeClient()
    await expect(exigirArrendador(client, TENANT, undefined)).rejects.toBeInstanceOf(AppError)
    // No debe ni consultar la BD: falta el dato de entrada.
    expect(queries).toHaveLength(0)
  })

  it('rechaza la cadena vacía y los espacios en blanco', async () => {
    const { client } = fakeClient()
    await expect(exigirArrendador(client, TENANT, '')).rejects.toBeInstanceOf(AppError)
    await expect(exigirArrendador(client, TENANT, '   ')).rejects.toBeInstanceOf(AppError)
  })

  it('rechaza un arrendador que no existe en el tenant', async () => {
    const { client, queries } = fakeClient([[]]) // la consulta no devuelve filas
    await expect(exigirArrendador(client, TENANT, ARR)).rejects.toBeInstanceOf(AppError)
    // La pertenencia se comprueba SIEMPRE contra el tenant, no solo por forma.
    expect(queries[0].params).toEqual([ARR, TENANT])
  })

  it('devuelve el id cuando el arrendador existe', async () => {
    const { client } = fakeClient([[{ id: ARR }]])
    await expect(exigirArrendador(client, TENANT, ARR)).resolves.toBe(ARR)
  })
})

describe('exigirContratoCompleto', () => {
  it('deja pasar la pantalla cubierta por un contrato completo', async () => {
    const { client } = fakeClient([[{ nombre: 'Pantalla A', cubierta: true }]])
    await expect(
      exigirContratoCompleto(client, { tenantId: TENANT, sitioId: 'S1' }),
    ).resolves.toBeUndefined()
  })

  it('bloquea la pantalla sin contrato completo, nombrándola', async () => {
    const { client } = fakeClient([[{ nombre: 'Pantalla A', cubierta: false }]])
    const err = await exigirContratoCompleto(client, { tenantId: TENANT, sitioId: 'S1' }).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(409)
    // El mensaje debe decir QUÉ pantalla y DÓNDE arreglarlo, no solo que falló.
    expect(err.message).toContain('Pantalla A')
    expect(err.message).toContain('Arrendadores')
  })

  it('404 si la pantalla no existe en el tenant', async () => {
    const { client } = fakeClient([[]])
    const err = await exigirContratoCompleto(client, { tenantId: TENANT, sitioId: 'S1' }).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(404)
  })

  it('solo INCOMPLETO y CANCELADO dejan de acreditar; VENCIDO sí es completo', async () => {
    const { client, queries } = fakeClient([[{ nombre: 'A', cubierta: true }]])
    await exigirContratoCompleto(client, { tenantId: TENANT, sitioId: 'S1' })
    expect(queries[0].params[2]).toEqual(['INCOMPLETO', 'CANCELADO'])
    // La cobertura se mira en los dos anclajes: pantalla suelta y predio.
    expect(queries[0].sql).toContain('c.predio_id is null and c.sitio_id = s.id')
    expect(queries[0].sql).toContain('c.predio_id = s.predio_id')
  })
})

describe('asignarArrendadorYAbrirContrato', () => {
  it('cuelga la pantalla del arrendador y abre un contrato INCOMPLETO', async () => {
    const { client, queries } = fakeClient()
    await asignarArrendadorYAbrirContrato(client, { tenantId: TENANT, sitioId: 'S1', arrendadorId: ARR })

    expect(queries).toHaveLength(2)

    const [update, insert] = queries
    expect(update.sql).toContain('update sitios set arrendador_id')
    expect(update.params).toEqual([ARR, 'S1', TENANT])

    expect(insert.sql).toContain('insert into contratos_arrendamiento')
    expect(insert.sql).toContain("'INCOMPLETO'::est_contrato")
    // El contrato solo se abre si la pantalla no está ya cubierta, y la cobertura
    // se mira en los DOS anclajes: contrato propio y contrato del predio.
    expect(insert.sql).toContain('not exists')
    expect(insert.sql).toContain('c.predio_id is null and c.sitio_id')
    expect(insert.sql).toContain('c.predio_id = (select predio_id from sitios where id')
    // El 4.º parámetro es el importe de la renta: null cuando el Excel no trae
    // la columna `renta_arrendador`, que es el caso por defecto.
    expect(insert.params).toEqual(['S1', ARR, TENANT, null])
  })

  it('no inventa vigencia ni periodicidad, aunque sí acepte importe', async () => {
    // El importe SÍ puede venir del import (columna `renta_arrendador`) y es
    // legal en un INCOMPLETO: `contrato_completo_ck` exime a ese estatus. Lo que
    // sigue prohibido es fabricar la vigencia o la periodicidad, porque eso sería
    // inventar términos que nadie pactó.
    const { client, queries } = fakeClient()
    await asignarArrendadorYAbrirContrato(client, { tenantId: TENANT, sitioId: 'S1', arrendadorId: ARR })
    const insert = queries[1].sql
    for (const col of ['periodicidad', 'fecha_fin']) {
      expect(insert).not.toContain(col)
    }
  })

  it('lleva al contrato el importe que trajo el Excel', async () => {
    const { client, queries } = fakeClient()
    await asignarArrendadorYAbrirContrato(client, {
      tenantId: TENANT, sitioId: 'S1', arrendadorId: ARR, montoRenta: 45000,
    })
    expect(queries[1].params).toEqual(['S1', ARR, TENANT, 45000])
  })

  it('degrada a null un importe de 0 o negativo', async () => {
    // `contrato_monto_ck` los rechaza, pero el motivo de fondo es otro: un 0 se
    // lee como «el espacio es gratis», satisface la regla de contrato completo y
    // el contrato DESAPARECE de la alerta de incompleto con el P&L equivocado.
    for (const malo of [0, -100]) {
      const { client, queries } = fakeClient()
      await asignarArrendadorYAbrirContrato(client, {
        tenantId: TENANT, sitioId: 'S1', arrendadorId: ARR, montoRenta: malo,
      })
      expect(queries[1].params[3], `monto ${malo} no se degradó a null`).toBeNull()
    }
  })
})

const PREDIO = '22222222-2222-2222-2222-222222222222'

describe('resolverPredio', () => {
  it('sin predio devuelve null: la carga entra como pantallas sueltas', async () => {
    const { client, queries } = fakeClient()
    await expect(resolverPredio(client, TENANT, ARR, null)).resolves.toBeNull()
    await expect(resolverPredio(client, TENANT, ARR, undefined)).resolves.toBeNull()
    expect(queries).toHaveLength(0)
  })

  it('valida que el predio existente sea del arrendador elegido, no solo del tenant', async () => {
    const { client, queries } = fakeClient([[{ id: PREDIO }]])
    await expect(resolverPredio(client, TENANT, ARR, { id: PREDIO })).resolves.toBe(PREDIO)
    // Sin arrendador_id en el WHERE se podrían colgar pantallas del predio de
    // otro propietario y la renta se atribuiría al equivocado.
    expect(queries[0].sql).toContain('arrendador_id')
    expect(queries[0].params).toEqual([PREDIO, TENANT, ARR])
  })

  it('rechaza un predio de otro arrendador', async () => {
    const { client } = fakeClient([[]])
    const err = await resolverPredio(client, TENANT, ARR, { id: PREDIO }).catch((e) => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.status).toBe(404)
  })

  it('crea el predio nuevo colgado del arrendador elegido', async () => {
    const { client, queries } = fakeClient([[{ id: PREDIO }]])
    const out = await resolverPredio(client, TENANT, ARR, { nombre: '  Torre Reforma  ', direccion: ' Av. X ' })
    expect(out).toBe(PREDIO)
    expect(queries[0].sql).toContain('insert into predios')
    // Nombre y dirección se guardan recortados.
    expect(queries[0].params).toEqual([ARR, 'Torre Reforma', 'Av. X', TENANT])
  })

  it('la dirección vacía se guarda como NULL, no como cadena vacía', async () => {
    const { client, queries } = fakeClient([[{ id: PREDIO }]])
    await resolverPredio(client, TENANT, ARR, { nombre: 'Torre', direccion: '   ' })
    expect(queries[0].params[2]).toBeNull()
  })

  it('rechaza un predio nuevo sin nombre', async () => {
    const { client } = fakeClient()
    await expect(resolverPredio(client, TENANT, ARR, { nombre: '   ' })).rejects.toBeInstanceOf(AppError)
  })
})

describe('abrirContratoDePredio', () => {
  it('abre UN contrato anclado al predio y no otro si ya hay alguno', async () => {
    const { client, queries } = fakeClient()
    await abrirContratoDePredio(client, {
      tenantId: TENANT, predioId: PREDIO, arrendadorId: ARR, sitioId: 'S1',
    })
    const sql = queries[0].sql
    expect(sql).toContain('insert into contratos_arrendamiento')
    expect(sql).toContain("'INCOMPLETO'::est_contrato")
    // La unicidad del pendiente por predio depende de este guard: el índice
    // contratos_predio_activo_uq no cubre INCOMPLETO.
    expect(sql).toContain('c.predio_id = $2')
    expect(sql).toContain("c.estatus <> 'CANCELADO'")
    expect(queries[0].params).toEqual(['S1', PREDIO, ARR, TENANT, null])
  })

  it('acepta la renta del PREDIO entero, no la de una pantalla', async () => {
    // El contrato de predio es UNO para todas sus caras, así que su importe es
    // el del inmueble. Quien decide si se puede calcular sin adivinar es
    // importarSitios (solo si TODAS las pantallas del lote traen renta).
    const { client, queries } = fakeClient()
    await abrirContratoDePredio(client, {
      tenantId: TENANT, predioId: PREDIO, arrendadorId: ARR, sitioId: 'S1', montoRenta: 120000,
    })
    expect(queries[0].params).toEqual(['S1', PREDIO, ARR, TENANT, 120000])
  })
})
