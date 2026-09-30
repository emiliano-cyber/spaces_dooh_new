import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, Cliente } from './servidor-e2e'

// ============================================================================
//  OT-CHECK-01 · el checklist de una OT se guarda punto a punto, contra
//  Postgres real.
// ----------------------------------------------------------------------------
//  Pedido del dueño, 2026-09-30: «que todo lo de OT se guarde cada vez que se
//  tacha algo del checklist». Hasta hoy el checklist vivía en la memoria de la
//  pantalla y se perdía al recargar: la única escritura era el cierre, que lo
//  pone TODO en hecho.
//
//  Lo que estas pruebas miden y las unitarias no pueden:
//   1. Que marcar y **volver a leer** (lo que hace una recarga) devuelve el avance.
//   2. Que dos clics casi simultáneos sobre puntos DISTINTOS sobreviven los dos
//      —es lo que rompería un «leer, cambiar, escribir» en dos viajes—.
//   3. Que marcar NO cambia el estado de la OT ni su costo.
//   4. Permisos y aislamiento: quien solo puede VER operaciones no marca, y
//      nadie marca la OT de otra organización.
// ============================================================================

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let a: Cliente
let b: Cliente
// FINANZAS tiene `operaciones.ver` (y `costear`) pero NO `crear`: ve la OT y no
// debe poder tachar su checklist, que es trabajo de campo.
let finanzas: Cliente
// VENDEDOR no tiene nada de `operaciones`.
let vendedor: Cliente
let otA: string
let otB: string
let otCerrada: string

const PUNTOS = [
  { label: 'Inspección de estructura y herrajes', hecho: false },
  { label: 'Montaje / ejecución', hecho: false },
  { label: 'Foto comprobatoria con geolocalización', hecho: false },
]

async function sembrarOT(
  org: Awaited<ReturnType<typeof sembrarTenant>>,
  sufijo: string,
  estatus = 'PENDIENTE',
): Promise<string> {
  const { rows } = await poolTest().query(
    `insert into ordenes_trabajo (folio, tipo, sitio_id, descripcion, fecha_programada, estatus, checklist, tenant_id)
     values ($1,'HERRERIA',$2,'Herreria de prueba', now(), $3, $4, $5)
     returning id`,
    [`OT-CHK-${sufijo}-${org.id.slice(0, 8)}`, org.sitioId, estatus, JSON.stringify(PUNTOS), org.id],
  )
  return rows[0].id as string
}

async function checklistEnBase(id: string): Promise<{ label: string; hecho: boolean }[]> {
  const { rows } = await poolTest().query('select checklist from ordenes_trabajo where id = $1', [id])
  return rows[0].checklist
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('otka')
  orgB = await sembrarTenant('otkb')
  otA = await sembrarOT(orgA, 'a')
  otB = await sembrarOT(orgB, 'b')
  otCerrada = await sembrarOT(orgA, 'c', 'COMPLETADA')

  for (const [rol, email] of [
    ['FINANZAS', 'finanzas@otka.test'],
    ['VENDEDOR', 'vendedor@otka.test'],
  ]) {
    await poolTest().query(
      `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
       values ($1,$2,$3,$4,true,$5)`,
      [`${rol} OT`, email, rol, await bcrypt.hash(PASSWORD_DEMO, 4), orgA.id],
    )
  }

  await arrancarServidor()
  a = new Cliente()
  b = new Cliente()
  finanzas = new Cliente()
  vendedor = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
  await finanzas.entrar('finanzas@otka.test', PASSWORD_DEMO)
  await vendedor.entrar('vendedor@otka.test', PASSWORD_DEMO)
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

const marcar = (cli: Cliente, id: string, cuerpo: unknown) =>
  cli.pedir(`/api/ot/${id}/checklist/`, { metodo: 'PATCH', cuerpo })

// ─── 1 · marcar, «recargar» y ver el avance ─────────────────────────────────
describe('1 · marcar un punto se guarda en ese momento y sobrevive a la recarga', () => {
  it('el PATCH devuelve 200 y la OT con ESE punto marcado', async () => {
    const r = await marcar(a, otA, { indice: 1, label: PUNTOS[1].label, hecho: true })
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.checklist.map((c: { hecho: boolean }) => c.hecho)).toEqual([false, true, false])
  })

  it('volver a leer la OT (lo que hace una recarga) trae el avance guardado', async () => {
    const r = await a.pedir(`/api/ot/${otA}/`)
    expect(r.status).toBe(200)
    expect(r.datos.ot.checklist.map((c: { hecho: boolean }) => c.hecho)).toEqual([false, true, false])
    // Las etiquetas no se tocan: solo cambia `hecho`.
    expect(r.datos.ot.checklist.map((c: { label: string }) => c.label)).toEqual(PUNTOS.map((p) => p.label))
  })

  it('la lectura dice que este usuario PUEDE marcar', async () => {
    const r = await a.pedir(`/api/ot/${otA}/`)
    expect(r.datos.puedeEditar).toBe(true)
  })

  it('desmarcar también se guarda', async () => {
    const r = await marcar(a, otA, { indice: 1, label: PUNTOS[1].label, hecho: false })
    expect(r.status).toBe(200)
    expect((await checklistEnBase(otA)).map((c) => c.hecho)).toEqual([false, false, false])
  })

  it('es idempotente: marcar dos veces lo mismo deja lo mismo', async () => {
    await marcar(a, otA, { indice: 0, label: PUNTOS[0].label, hecho: true })
    const r = await marcar(a, otA, { indice: 0, label: PUNTOS[0].label, hecho: true })
    expect(r.status).toBe(200)
    expect((await checklistEnBase(otA)).map((c) => c.hecho)).toEqual([true, false, false])
  })
})

// ─── 2 · clics simultáneos sobre puntos distintos ───────────────────────────
describe('2 · dos clics a la vez sobre puntos DISTINTOS no se pisan', () => {
  it('las dos marcas sobreviven', async () => {
    const [r1, r2] = await Promise.all([
      marcar(a, otA, { indice: 1, label: PUNTOS[1].label, hecho: true }),
      marcar(a, otA, { indice: 2, label: PUNTOS[2].label, hecho: true }),
    ])
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(200)
    expect((await checklistEnBase(otA)).map((c) => c.hecho)).toEqual([true, true, true])
  })
})

// ─── 3 · marcar NO cierra la OT ni toca su dinero ───────────────────────────
describe('3 · NEGATIVO · con TODO marcado la OT sigue igual', () => {
  it('sigue PENDIENTE, sin fechas de inicio/cierre, sin responsable estampado y sin costo', async () => {
    const { rows } = await poolTest().query(
      'select estatus, fecha_inicio, fecha_completada, asignado_a, costo_real from ordenes_trabajo where id = $1',
      [otA],
    )
    expect(rows[0].estatus).toBe('PENDIENTE')
    expect(rows[0].fecha_inicio).toBeNull()
    expect(rows[0].fecha_completada).toBeNull()
    expect(rows[0].asignado_a).toBeNull()
    expect(rows[0].costo_real).toBeNull()
  })

  it('y no se creó ninguna evidencia', async () => {
    const { rows } = await poolTest().query('select count(*)::int as n from evidencias_ot where ot_id = $1', [otA])
    expect(rows[0].n).toBe(0)
  })
})

// ─── 4 · permisos ───────────────────────────────────────────────────────────
describe('4 · NEGATIVO · quien no puede editar la OT no puede marcar', () => {
  it('FINANZAS VE la OT, pero la lectura le dice que NO puede marcar', async () => {
    const r = await finanzas.pedir(`/api/ot/${otA}/`)
    expect(r.status).toBe(200)
    expect(r.datos.puedeEditar).toBe(false)
  })

  it('y si lo intenta igual, 403 y la base no cambia', async () => {
    const antes = await checklistEnBase(otA)
    const r = await marcar(finanzas, otA, { indice: 0, label: PUNTOS[0].label, hecho: false })
    expect(r.status).toBe(403)
    expect(await checklistEnBase(otA)).toEqual(antes)
  })

  it('un rol sin `operaciones` recibe 403', async () => {
    const r = await marcar(vendedor, otA, { indice: 0, label: PUNTOS[0].label, hecho: false })
    expect(r.status).toBe(403)
  })

  it('sin sesión, 401', async () => {
    const r = await marcar(new Cliente(), otA, { indice: 0, label: PUNTOS[0].label, hecho: false })
    expect(r.status).toBe(401)
  })
})

// ─── 5 · aislamiento ────────────────────────────────────────────────────────
describe('5 · NEGATIVO · no se marca el checklist de la OT de otra organización', () => {
  it('A contra la OT de B: 404 (desde A esa OT no existe)', async () => {
    const r = await marcar(a, otB, { indice: 0, label: PUNTOS[0].label, hecho: true })
    expect(r.status).toBe(404)
  })

  it('y la OT de B sigue intacta', async () => {
    expect((await checklistEnBase(otB)).map((c) => c.hecho)).toEqual([false, false, false])
  })
})

// ─── 6 · lo que se rechaza ──────────────────────────────────────────────────
describe('6 · NEGATIVO · OT cerrada, índice fuera de rango y etiqueta que no cuadra', () => {
  it('una OT COMPLETADA no se marca: 409', async () => {
    const r = await marcar(a, otCerrada, { indice: 0, label: PUNTOS[0].label, hecho: true })
    expect(r.status).toBe(409)
    expect((await checklistEnBase(otCerrada)).map((c) => c.hecho)).toEqual([false, false, false])
  })

  it('un índice que no existe: 409 y nada cambia', async () => {
    const antes = await checklistEnBase(otA)
    const r = await marcar(a, otA, { indice: 7, label: 'Inventado', hecho: false })
    expect(r.status).toBe(409)
    expect(await checklistEnBase(otA)).toEqual(antes)
  })

  it('una etiqueta que no es la de ese punto: 409 y nada cambia', async () => {
    // Protege del índice VIEJO: si el checklist cambió desde que se abrió la
    // pantalla, marcar «el 2» podría tachar otra tarea.
    const antes = await checklistEnBase(otA)
    const r = await marcar(a, otA, { indice: 0, label: PUNTOS[1].label, hecho: false })
    expect(r.status).toBe(409)
    expect(await checklistEnBase(otA)).toEqual(antes)
  })

  it('un cuerpo mal formado: 400', async () => {
    const r = await marcar(a, otA, { indice: 0, label: PUNTOS[0].label, hecho: 'false' })
    expect(r.status).toBe(400)
  })
})
