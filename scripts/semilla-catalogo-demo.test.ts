import { describe, it, expect } from 'vitest'
import { ROLES_ASIGNABLES } from '@/lib/roles'
import {
  planCatalogo,
  comprobarCoherencia,
  sentenciasDelCatalogo,
  sentenciasDeshacer,
  columnasDeLaSiembra,
  vencimiento,
  USUARIOS,
} from './semilla-catalogo-demo.mjs'

// ============================================================================
//  El CATÁLOGO de la demo, probado sin Postgres.
// ----------------------------------------------------------------------------
//  Lo que se mira en una demostración es la coherencia: una pantalla OCUPADA
//  sin campaña al aire, una campaña ACTIVA fuera de fecha o un estado que no
//  aparece. `comprobarCoherencia` es lo que el script consulta antes de tocar
//  la base; aquí se fija que con las fechas de la presentación salga limpia, y
//  que de verdad muerda cuando el catálogo se contradice.
// ============================================================================

const ANCLA = '2026-10-06'
const plan = (ancla = ANCLA) => planCatalogo({ ancla })
const TENANT = '00000000-0000-4000-8000-000000000001'

describe('semilla-catalogo-demo', () => {
  it('es coherente hoy y el día de la presentación', () => {
    expect(comprobarCoherencia(plan())).toEqual([])
    expect(comprobarCoherencia(plan('2026-10-14'))).toEqual([])
  })

  it('la coherencia MUERDE: una pantalla ocupada sin campaña al aire se detecta', () => {
    const p = plan()
    const f05 = p.sitios.find((s) => s.clave === 'CAT-F05')!
    f05.comercial = 'OCUPADO'
    expect(comprobarCoherencia(p)).toContain('CAT-F05 OCUPADO sin campana al aire hoy')
  })

  it('la coherencia MUERDE: dos campañas vivas sobre la misma fija se detectan', () => {
    const p = plan()
    const r = p.reservas.find((x) => x.campanaFolio === 'CAT-CMP-014' && x.sitio === 'CAT-F02')!
    r.sitio = 'CAT-F01'
    expect(comprobarCoherencia(p).some((m) => m.startsWith('CAT-F01:'))).toBe(true)
  })

  it('y se niega a sembrar con un «hoy» que deja la demo contradiciéndose', () => {
    expect(comprobarCoherencia(plan('2026-11-25')).length).toBeGreaterThan(0)
  })

  it('hay historia desde 2024 y contratos y campañas hasta 2028', () => {
    const p = plan()
    expect(p.campanas.map((c) => c.desde).sort()[0].startsWith('2024')).toBe(true)
    expect(p.campanas.map((c) => c.hasta).sort().at(-1)!.startsWith('2028')).toBe(true)
    expect(p.contratos.some((k) => k.fin?.startsWith('2028'))).toBe(true)
    expect(p.consumos.map((c) => c.periodo).sort()[0]).toBe('2024-01-01')
  })

  it('las propuestas aprobadas tienen campaña, y la campaña lleva sus pantallas', () => {
    const p = plan()
    for (const pr of p.propuestas.filter((x) => x.estatus === 'APROBADA')) {
      const c = p.campanas.find((x) => x.propuestaFolio === pr.folio)
      expect(c, pr.folio).toBeDefined()
      expect(pr.items.map((i) => i.sitio).sort()).toEqual(c!.pantallas.map((k) => `CAT-${k}`).sort())
    }
  })

  it('solo las campañas terminadas o al aire llevan comprobante; las listas para facturar no', () => {
    const p = plan()
    const conComprobante = new Set(p.comprobantes.map((f) => f.campanaFolio))
    for (const c of p.campanas) {
      if (c.estado === 'LISTA_FACTURAR') expect(conComprobante.has(c.folio), c.folio).toBe(false)
      if (['COMPLETADA', 'ACTIVA'].includes(c.estado)) expect(conComprobante.has(c.folio), c.folio).toBe(true)
    }
  })

  it('un usuario por cada rol asignable, y ninguno más', () => {
    expect(USUARIOS.map((u) => u.rol).sort()).toEqual(ROLES_ASIGNABLES.map((r) => r.value).sort())
  })

  it('la contraseña no viaja en el plan: entra solo como parámetro', () => {
    expect(JSON.stringify(plan())).not.toMatch(/Catalogo-Demo|password/i)
    const s = sentenciasDelCatalogo(plan(), TENANT, 'clave-de-prueba-123')
    const u = s.filter((x) => /insert into usuarios/.test(x.sql))
    expect(u).toHaveLength(USUARIOS.length)
    for (const x of u) {
      expect(x.sql).not.toContain('clave-de-prueba-123')
      expect(x.sql).toMatch(/crypt\(\$6::text, gen_salt\('bf', 10\)\)/)
    }
  })

  it('NINGUNA sentencia inserta sin guard contra la segunda corrida', () => {
    for (const s of sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12))) {
      if (!/insert\s+into/i.test(s.sql)) continue
      const guardada = /on\s+conflict/i.test(s.sql) || /not\s+exists/i.test(s.sql)
      expect(guardada, `sin guard: ${s.etiqueta}`).toBe(true)
    }
  })

  it('NINGÚN insert deja fuera el tenant_id', () => {
    for (const s of sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12))) {
      if (!/insert\s+into/i.test(s.sql)) continue
      expect(/tenant_id/i.test(s.sql), `sin tenant_id: ${s.etiqueta}`).toBe(true)
    }
  })

  it('ningún valor real viaja quemado', () => {
    const texto = JSON.stringify(plan())
    expect(texto).not.toMatch(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/)
    expect(texto).not.toMatch(/space-os\.io/)
    for (const u of USUARIOS) expect(u.email).toMatch(/\.invalid$/)
    for (const c of plan().clientes) expect(c.rfc).toMatch(/^DMO/)
  })

  it('sin espacios_comprados la partida se siembra igual, y esa columna no aparece', () => {
    // DEMO iba tres migraciones por detrás el 06/10 y el catálogo murió a mitad
    // con «column espacios_comprados does not exist».
    const con = sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12))
    const sin = sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12), { sinEspacios: true })
    expect(sin).toHaveLength(con.length)
    const partidas = sin.filter((s) => /insert into propuesta_items/.test(s.sql))
    expect(partidas.length).toBe(29)
    for (const s of partidas) {
      expect(s.sql).not.toContain('espacios_comprados')
      // Mismo número de parámetros: el `$8` sigue en el SQL para que Postgres le
      // pueda dar tipo, y va en null.
      expect(s.sql).toContain('$8::integer is null')
      expect(s.valores[7]).toBeNull()
    }
    expect(columnasDeLaSiembra(con)).toContain('propuesta_items.espacios_comprados')
    expect(columnasDeLaSiembra(sin)).not.toContain('propuesta_items.espacios_comprados')
  })

  it('columnasDeLaSiembra lee las columnas de cada insert', () => {
    const cols = columnasDeLaSiembra(sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12)))
    expect(cols).toContain('sitios.clave_interna')
    expect(cols).toContain('usuarios.password_hash')
    expect(cols).toContain('pagos_renta.periodo')
    expect(cols.every((c) => /^\w+\.\w+$/.test(c))).toBe(true)
  })

  it('el vencimiento se ancla al día de inicio y se recorta a fin de mes, como la app', () => {
    expect(vencimiento('2024-01-31', 1, 'MENSUAL')).toBe('2024-02-29')
    expect(vencimiento('2024-01-31', 2, 'MENSUAL')).toBe('2024-03-31')
    expect(vencimiento('2024-07-01', 1, 'TRIMESTRAL')).toBe('2024-10-01')
    expect(vencimiento('2025-04-01', 2, 'ANUAL')).toBe('2027-04-01')
  })

  it('deshacer borra solo lo de ESTA organización y solo lo CAT-, sin cascade', () => {
    for (const s of sentenciasDeshacer(plan(), TENANT)) {
      expect(s.sql, s.etiqueta).toMatch(/^delete from \w+ where tenant_id = \$1::uuid/)
      expect(s.valores[0]).toBe(TENANT)
      expect(s.sql, s.etiqueta).not.toMatch(/cascade/i)
      expect(s.sql, s.etiqueta).toMatch(/CAT-|any\(\$2::text\[\]\)/)
    }
  })

  it('deshacer cubre cada tabla en la que siembra', () => {
    const sembradas = new Set(
      sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12)).map((s) => /insert into (\w+)/.exec(s.sql)![1]),
    )
    const borradas = new Set(sentenciasDeshacer(plan(), TENANT).map((s) => /delete from (\w+)/.exec(s.sql)![1]))
    expect([...sembradas].filter((t) => !borradas.has(t))).toEqual([])
  })
})
