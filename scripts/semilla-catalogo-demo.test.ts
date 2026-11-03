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
  mesesDeDesplazamiento,
} from './semilla-catalogo-demo.mjs'
import { pngDeArte, imagenAHtml as imagenAHtmlSemilla } from './semilla-arte-demo.mjs'
import { pdfDeTexto } from './semilla-pdf-demo.mjs'
import { imagenAHtml, imagenDeHtml } from '@/lib/creativo-html'

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
    // Con el calendario QUIETO (meses: 0), que es lo que pasa cuando la base
    // ya se sembró con él y `main` lo reutiliza.
    expect(comprobarCoherencia(planCatalogo({ ancla: '2026-11-25', meses: 0 })).length).toBeGreaterThan(0)
  })

  it('el calendario se mueve con el ancla y la demo es coherente CUALQUIER día hasta 2028', () => {
    // Nació el 2026-11-03: «CAT-CMP-020 COTIZACION ya empezada» a media hora de
    // una demo en vivo.
    expect(mesesDeDesplazamiento('2026-10-06')).toBe(0)
    expect(mesesDeDesplazamiento('2026-11-03')).toBe(1)
    expect(mesesDeDesplazamiento('2028-01-20')).toBe(15)
    const malos: string[] = []
    for (let t = Date.UTC(2026, 9, 1); t <= Date.UTC(2028, 11, 31); t += 86_400_000) {
      const d = new Date(t).toISOString().slice(0, 10)
      if (comprobarCoherencia(plan(d)).length) malos.push(d)
    }
    expect(malos).toEqual([])
    const nov = plan('2026-11-03')
    expect(nov.campanas.find((c) => c.folio === 'CAT-CMP-020')!.desde).toBe('2026-12-01')
    expect(nov.contratos.find((k) => k.clave === 'REF-1')!.inicio).toBe('2024-02-01')
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
      // Las que no borran devuelven a vacío los datos de la organización
      // (identidad, logotipo, condiciones), y solo si siguen siendo los sembrados.
      expect(s.sql, s.etiqueta).toMatch(
        /^(delete from \w+\s+where tenant_id = \$1::uuid|update (config_negocio|tenants|campanas) set ([a-z_]+ = null,?\s*)+where (tenant_id|id) = \$1::uuid)/,
      )
      expect(s.valores[0]).toBe(TENANT)
      expect(s.sql, s.etiqueta).not.toMatch(/cascade/i)
      // Acotada por la marca CAT, por la lista exacta de claves del plan o por
      // el valor exacto que se sembró.
      expect(s.sql, s.etiqueta).toMatch(/CAT|\$2::(text|int)\[\]|= \$2::text/)
    }
  })

  it('deshacer cubre cada tabla en la que siembra', () => {
    const sembradas = new Set(
      // Solo los insert: el reparto de spots es un `update` de reservas, que
      // ya se borran enteras.
      sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12))
        .map((s) => /insert into (\w+)/.exec(s.sql)?.[1])
        .filter((t): t is string => !!t),
    )
    const borradas = new Set(
      sentenciasDeshacer(plan(), TENANT)
        .map((s) => /delete from (\w+)/.exec(s.sql)?.[1])
        .filter((t): t is string => !!t),
    )
    // `acciones` es la única excepción, y no por elección: la bitácora es
    // append-only por trigger y no admite DELETE.
    expect([...sembradas].filter((t) => !borradas.has(t))).toEqual(['acciones'])
  })

  it('la bitácora de ejemplo no queda atada a los usuarios demo (si no, no se podrían borrar)', () => {
    const s = sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12)).filter((x) => /insert into acciones/.test(x.sql))
    expect(s.length).toBeGreaterThan(0)
    for (const x of s) expect(x.sql).toMatch(/\$3::text, null,/)
    const u = sentenciasDeshacer(plan(), TENANT).find((x) => /delete from usuarios/.test(x.sql))!
    expect(u.sql).toContain('not exists (select 1 from acciones')
  })

  // ─── Creativos (lo pidió el dueño: creativos de fijas Y de digitales) ─────
  it('hay creativos digitales en los tres estados y arte de fijas en los cinco de imprenta', () => {
    const p = plan()
    expect(new Set(p.creativos.map((c) => c.estatus))).toEqual(new Set(['VALIDADA', 'PENDIENTE', 'RECHAZADA']))
    expect(new Set(p.impresiones.map((o) => o.estatus))).toEqual(
      new Set(['ARTE_RECIBIDO', 'VALIDADO', 'EN_PRODUCCION', 'IMPRESO', 'LISTO_MONTAJE']),
    )
    expect(p.creativos.some((c) => c.resolucion === '1080x1920')).toBe(true)
    expect(p.creativos.find((c) => c.estatus === 'RECHAZADA')!.motivo).toBeTruthy()
  })

  it('ningún creativo digital cae en una campaña toda fija (el servidor lo rechaza)', () => {
    const p = plan()
    for (const cr of p.creativos) expect(p.campanas.find((c) => c.folio === cr.campanaFolio)!.tipo).not.toBe('OOH')
    for (const oi of p.impresiones) expect(p.sitios.find((s) => s.clave === oi.sitio)!.digital).toBe(false)
  })

  it('las campañas al aire tienen TODOS sus spots digitales con creativo aprobado', () => {
    const p = plan()
    for (const c of p.campanas.filter((x) => x.estado === 'ACTIVA')) {
      for (const r of p.reservas.filter((x) => x.campanaFolio === c.folio && x.digital)) {
        const a = p.asignaciones.find((x) => x.campanaFolio === c.folio && x.sitio === r.sitio)
        expect(a, `${c.folio} ${r.sitio}`).toBeDefined()
        for (const k of a!.creativos)
          expect(p.creativos.find((cr) => cr.nombre === k.nombre)!.estatus).toBe('VALIDADA')
      }
    }
  })

  it('el arte es un PNG de verdad y se guarda envuelto como lo hace la pantalla de Creativos', () => {
    const png = pngDeArte({ ancho: 64, alto: 36, fondo: '#000000', acento: '#FFFFFF', texto: '#FFFFFF', lineas: ['DEMO'] })
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    const url = `data:image/png;base64,${png.toString('base64')}`
    // Copia literal de la función de la app: si una cambia, esto lo dice.
    expect(imagenAHtmlSemilla(url, 'x.png')).toBe(imagenAHtml(url, 'x.png'))
    expect(imagenDeHtml(imagenAHtmlSemilla(url, 'x.png'))).toBe(url)
  })

  it('el reparto en los spots no pisa lo que ya se cambió en la demo', () => {
    const spots = sentenciasDelCatalogo(plan(), TENANT, 'x'.repeat(12)).filter((s) => /^update reservas/.test(s.sql))
    expect(spots.length).toBeGreaterThan(0)
    for (const s of spots) expect(s.sql).toContain("and r.creativos = '[]'::jsonb")
  })

  // ─── Los módulos que el catálogo no cubría (auditoría del 2026-11-03) ─────
  it('cada módulo del menú tiene al menos un ejemplo, y en sus estados', () => {
    const m = plan().modulos
    expect(new Set(m.prospectos.filter((p) => ['PREDIO', 'PANTALLA'].includes(p.tipo)).map((p) => p.etapa))).toEqual(
      new Set(['PROSPECTO', 'CONTACTADO', 'VISITA', 'NEGOCIACION', 'EN_REVISION', 'RECHAZADO', 'APROBADO', 'PERDIDO']),
    )
    for (const k of ['codigos', 'canjes', 'paquetes', 'franjas', 'temporadas', 'tarifas', 'escalas', 'activos', 'movimientos',
      'incidencias', 'evidencias', 'costosOt', 'abonos', 'extensiones', 'ordenesCompra', 'notificaciones', 'acciones', 'tickets'] as const)
      expect((m as Record<string, unknown[]>)[k].length, k).toBeGreaterThan(0)
    expect(new Set(m.activos.map((a) => a.estado))).toEqual(new Set(['EN_ALMACEN', 'INSTALADO', 'EN_TRASLADO', 'BAJA']))
  })

  it('las fechas de los módulos se mueven con el ancla', () => {
    const a = plan('2026-10-06').modulos
    const b = plan('2027-03-06').modulos
    expect(a.codigos[0].desde).not.toBe(b.codigos[0].desde)
    expect(b.notificaciones.length).toBe(a.notificaciones.length)
  })

  it('la extensión deja la campaña terminando en su fin NUEVO', () => {
    const p = plan()
    for (const x of p.modulos.extensiones) {
      const c = p.campanas.find((k) => k.folio === x.campana)!
      expect(x.nueva).toBe(c.hasta)
      expect(x.anterior < x.nueva).toBe(true)
    }
  })

  it('los abonos no pasan del total del comprobante', () => {
    const p = plan()
    for (const a of p.modulos.abonos)
      expect(a.monto).toBeLessThanOrEqual(p.comprobantes.find((f) => f.folio === a.factura)!.monto)
  })

  it('el PDF de los documentos es un PDF que abre (cabecera, xref y fin)', () => {
    const t = pdfDeTexto('Prueba', ['linea con acento: campaña']).toString('latin1')
    expect(t.startsWith('%PDF-1.4')).toBe(true)
    expect(t.trimEnd().endsWith('%%EOF')).toBe(true)
    const xref = Number(/startxref\n(\d+)/.exec(t)![1])
    expect(t.slice(xref, xref + 4)).toBe('xref')
    expect(t).toContain('campana')
  })
})
