import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  Los datos que el CONTRATO exige llegan hasta el documento.
// ----------------------------------------------------------------------------
//  Se reportó que el contrato salía con «Faltan 4 datos por capturar». Tres eran
//  de la organización (RFC, domicilio fiscal, representante legal) y SÍ se
//  capturan en Administración: solo estaban vacíos.
//
//  El cuarto no. `arrendadores.direccion` existía en la tabla, el PATCH la
//  aceptaba y `rowToArrendador` la devolvía — pero el ALTA ni la aceptaba ni la
//  guardaba, el tipo del navegador no la declaraba y ningún formulario la pedía.
//  O sea: un dato obligatorio del contrato sin ninguna forma de teclearlo.
//
//  Va por HTTP contra Postgres real porque el fallo estaba en el INSERT: un
//  mock del repo habría devuelto el objeto entero y la prueba pasaría en verde
//  sobre el mismo agujero.
// ============================================================================

let org: Awaited<ReturnType<typeof sembrarTenant>>
let c: Cliente

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  org = await sembrarTenant('contrato')
  await arrancarServidor()
  c = new Cliente()
  await c.entrar(org.usuarioEmail, PASSWORD_DEMO)
}, 120_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

beforeEach(async () => {
  await poolTest().query(`delete from arrendadores where nombre not like 'Arrendador %'`)
})

const DOMICILIO = 'Av. Reforma 222, Juárez, 06600, CDMX'

const alta = (cuerpo: Record<string, unknown>) => c.pedir('/api/arrendadores/', { cuerpo })

const enBase = async (id: string) =>
  (await poolTest().query('select rfc, direccion from arrendadores where id=$1', [id])).rows[0]

describe('1 · el alta guarda el domicilio', () => {
  it('lo persiste, y no se pierde por el camino', async () => {
    // El fallo exacto: el INSERT enumeraba (nombre, rfc, telefono, email,
    // notas) y el domicilio se caía en silencio. La petición respondía 201 y el
    // dato no estaba, que es la peor forma de perderlo.
    const r = await alta({ nombre: 'Con domicilio', rfc: 'AGI990422EL7', direccion: DOMICILIO })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
    expect((await enBase(r.datos.id)).direccion).toBe(DOMICILIO)
  })

  it('lo devuelve en la respuesta, para que la pantalla lo pinte', async () => {
    const r = await alta({ nombre: 'Devuelto', direccion: DOMICILIO })
    expect(r.datos.direccion).toBe(DOMICILIO)
  })

  it('sigue siendo opcional: sin él, el alta entra igual', async () => {
    // El ADR 0001 admite que el expediente nazca incompleto. Exigirlo aquí
    // frenaría altas legítimas; lo que hace el sistema es AVISAR en el contrato.
    const r = await alta({ nombre: 'Sin domicilio' })
    expect(r.status).toBe(201)
    expect((await enBase(r.datos.id)).direccion).toBeNull()
  })

  it('lo recorta: un espacio de más no es un domicilio distinto', async () => {
    const r = await alta({ nombre: 'Con espacios', direccion: `   ${DOMICILIO}   ` })
    expect((await enBase(r.datos.id)).direccion).toBe(DOMICILIO)
  })
})

describe('2 · se puede completar un arrendador que ya existe', () => {
  it('el PATCH guarda domicilio y RFC', async () => {
    // Es lo único que permite arreglar los que ya están dados de alta: en
    // producción los ocho tienen el domicilio en null, y hasta ahora no había
    // ninguna pantalla que llamara a este endpoint.
    const r = await alta({ nombre: 'A completar' })
    const p = await c.pedir(`/api/arrendadores/${r.datos.id}/`, {
      metodo: 'PATCH',
      cuerpo: { direccion: DOMICILIO, rfc: 'SJI8003047D4' },
    })
    expect(p.status, JSON.stringify(p.datos)).toBe(200)
    const fila = await enBase(r.datos.id)
    expect(fila.direccion).toBe(DOMICILIO)
    expect(fila.rfc).toBe('SJI8003047D4')
  })

  it('se puede vaciar a propósito, sin que un null se confunda con «no lo toques»', async () => {
    const r = await alta({ nombre: 'A vaciar', direccion: DOMICILIO })
    await c.pedir(`/api/arrendadores/${r.datos.id}/`, { metodo: 'PATCH', cuerpo: { direccion: null } })
    expect((await enBase(r.datos.id)).direccion).toBeNull()
  })

  it('no se cuela un RFC mal formado', async () => {
    const r = await alta({ nombre: 'RFC malo' })
    const p = await c.pedir(`/api/arrendadores/${r.datos.id}/`, {
      metodo: 'PATCH', cuerpo: { rfc: 'ESTO-NO-ES-UN-RFC' },
    })
    expect(p.status).toBe(400)
  })
})
