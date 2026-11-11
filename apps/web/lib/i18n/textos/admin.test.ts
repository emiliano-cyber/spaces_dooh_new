import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ES_ADMIN, EN_ADMIN } from './admin'
import { DICCIONARIOS } from '../diccionario'

// ============================================================================
//  EL DICCIONARIO DE ADMINISTRACION, CONGELADO — y atado a sus fuentes.
// ----------------------------------------------------------------------------
//  Mismo patron que `codigos.test.ts` y `finanzas.test.ts`: la instantanea de
//  los dos idiomas, las guardias de forma, los espejos (donde una tabla
//  espanola sigue siendo la verdad, el diccionario la reproduce letra por
//  letra) y QUE CLAVE usa cada aviso que no se rinde (toasts, `confirm`).
// ============================================================================

const raiz = path.join(__dirname, '../../..')
const leer = (f: string) => readFileSync(path.join(raiz, f), 'utf8')
const ES = DICCIONARIOS.es as Record<string, string>

describe('diccionario de administracion · instantanea', () => {
  it('el ESPANOL no cambia sin que se vea', () => {
    expect(ES_ADMIN).toMatchSnapshot()
  })
  it('el INGLES tampoco', () => {
    expect(EN_ADMIN).toMatchSnapshot()
  })
})

// Iguales en los dos idiomas a proposito: marcas, siglas y nombres propios.
const IGUALES = new Set([
  'admin.modulo.dashboard', // «Dashboard», como el menu
  'admin.modulo.network', // «Network», como el menu
  'admin.logo.campo', // «Logo»
  'admin.cuenta.error', // «Error»
  'admin.network.no', // «No»
  'admin.tickets.prioridad.normal', // «Normal» (validacion: «Normal priority» esquivaba esta guardia)
])

describe('diccionario de administracion · el ingles no esta en espanol', () => {
  it('ninguna entrada inglesa es igual a la espanola (salvo las declaradas)', () => {
    const iguales = Object.keys(ES_ADMIN).filter(
      (k) => ES_ADMIN[k as keyof typeof ES_ADMIN] === EN_ADMIN[k as keyof typeof EN_ADMIN] && !IGUALES.has(k),
    )
    expect(iguales).toEqual([])
  })

  it('las declaradas iguales siguen siendolo', () => {
    expect([...IGUALES].filter((k) => ES[k] !== EN_ADMIN[k as keyof typeof EN_ADMIN])).toEqual([])
  })

  it('ninguna entrada inglesa lleva acentos, ñ ni signos de apertura', () => {
    expect(Object.entries(EN_ADMIN).filter(([, v]) => /[áéíóúñÁÉÍÓÚÑ¿¡]/.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los huecos son los mismos en los dos idiomas', () => {
    const huecos = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join()
    expect(
      Object.keys(ES_ADMIN).filter(
        (k) => huecos(ES_ADMIN[k as keyof typeof ES_ADMIN]) !== huecos(EN_ADMIN[k as keyof typeof EN_ADMIN]),
      ),
    ).toEqual([])
  })

  it('ningun porcentaje ingles lleva espacio antes del «%», ni dice «Tap» o «press»', () => {
    expect(Object.entries(EN_ADMIN).filter(([, v]) => /\S %|\btap\b|\bpress\b/i.test(v)).map(([k]) => k)).toEqual([])
  })

  it('los plurales vienen en pareja (.uno / .otros)', () => {
    const claves = Object.keys(ES_ADMIN)
    const sueltas = claves.filter(
      (k) => (k.endsWith('.uno') && !claves.includes(k.replace(/\.uno$/, '.otros'))) ||
        (k.endsWith('.otros') && !claves.includes(k.replace(/\.otros$/, '.uno'))),
    )
    expect(sueltas).toEqual([])
  })
})

describe('diccionario de administracion · el espanol reproduce EXACTAMENTE su modulo', () => {
  it('roles (`ROLES_ASIGNABLES`) y `rolLabel` en los dos idiomas', async () => {
    const { ROLES_ASIGNABLES, rolLabel } = await import('../../roles')
    for (const r of ROLES_ASIGNABLES) {
      expect(ES[`admin.rol.${r.value.toLowerCase()}`]).toBe(r.label)
      expect(rolLabel(r.value)).toBe(r.label)
      expect(rolLabel(r.value, 'en')).toBe(EN_ADMIN[`admin.rol.${r.value.toLowerCase()}` as keyof typeof EN_ADMIN])
    }
    // Un rol retirado cae a su propio valor, en los dos idiomas.
    expect(rolLabel('COMERCIAL' as never, 'en')).toBe('COMERCIAL')
  })

  it('tipos de tarea (`TIPO_OT_LABEL`) y `etiquetaTipoOt`', async () => {
    const { TIPO_OT_LABEL, etiquetaTipoOt } = await import('../../tipos-ot')
    for (const [tipo, label] of Object.entries(TIPO_OT_LABEL)) {
      const k = `admin.tipo-ot.${tipo.toLowerCase().replace(/_/g, '-')}`
      expect(ES[k]).toBe(label)
      expect(etiquetaTipoOt(tipo as never)).toBe(label)
      expect(etiquetaTipoOt(tipo as never, 'en')).toBe(EN_ADMIN[k as keyof typeof EN_ADMIN])
    }
  })

  it('conectores de Integraciones: su espanol es el que manda el servidor', async () => {
    const { estadoIntegraciones } = await import('../../server/integraciones')
    const conectores = estadoIntegraciones()
    expect(conectores.length).toBeGreaterThan(0)
    for (const c of conectores) {
      expect(ES[`admin.integ.conector.${c.clave}.nombre`]).toBe(c.nombre)
      expect(ES[`admin.integ.conector.${c.clave}.descripcion`]).toBe(c.descripcion)
    }
  })

  it('capacidades (`CAP_LABEL`) con `CLAVE_CAP`', async () => {
    const { CAP_LABEL, CLAVE_CAP, CAPACIDADES } = await import('../../../components/demo/admin/permisos')
    for (const c of CAPACIDADES) expect(ES[CLAVE_CAP[c]]).toBe(CAP_LABEL[c])
  })

  it('notas de version: `ETIQUETA_TIPO` y `SIN_NOTAS`', async () => {
    const { ETIQUETA_TIPO } = await import('../../novedades')
    const { CLAVE_TIPO_NOVEDAD, SIN_NOTAS } = await import('../../../components/demo/novedades/NotasDeVersion')
    for (const [tipo, label] of Object.entries(ETIQUETA_TIPO)) expect(ES[CLAVE_TIPO_NOVEDAD[tipo as never]]).toBe(label)
    expect(ES['admin.novedades.sin-notas']).toBe(SIN_NOTAS)
  })

  it('las areas de la matriz: el rotulo del menu (`nav.<clave>`) dice lo mismo que `lib/modulos.ts`', async () => {
    const { areasDeModulo } = await import('../../modulos')
    const modulos = ['dashboard', 'comercial', 'captacion', 'inventario', 'precios', 'arrendadores', 'operaciones', 'imprenta', 'finanzas', 'network', 'administracion']
    const areas = modulos.flatMap((m) => areasDeModulo(m))
    expect(areas.length).toBeGreaterThan(10)
    for (const a of areas) {
      if (a.clave === 'space-eyes') expect(ES['admin.area.space-eyes']).toBe(a.label)
      else if (`nav.${a.clave}` in ES) expect(ES[`nav.${a.clave}`]).toBe(a.label)
    }
  })

  it('los motivos de `loQueFaltaEnElBorrador` (sin acentos, como siempre) y su ingles', async () => {
    const { loQueFaltaEnElBorrador, BORRADOR_VACIO } = await import('../../../components/demo/razones-sociales/gestion')
    const ctx = { existentes: [{ id: 'a', razonSocial: 'Uno SA', activo: false }], editando: null, catalogo: ['VENTAS'] }
    const b = (o: object) => ({ ...BORRADOR_VACIO, ...o })
    expect(loQueFaltaEnElBorrador(b({}), ctx as never)).toBe(
      'Captura la razon social: es el nombre con el que la empresa firma y factura.',
    )
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'uno sa' }), ctx as never)).toBe(
      'Ya tienes «Uno SA», que es la misma razon social y esta dada de baja. Reactivala en vez de crear otra.',
    )
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'Dos', roles: ['X'] }), ctx as never)).toBe(
      'El papel «X» no existe. Los que hay son: VENTAS.',
    )
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'uno sa' }), ctx as never, 'en')).toBe(
      'You already have “Uno SA”, which is the same legal entity and is deactivated. Reactivate it instead of creating another one.',
    )
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'Dos', rfc: 'MAL' }), ctx as never, 'en')).toBe(
      'The RFC “MAL” doesn’t have a valid format. Leave it empty if you don’t have it yet.',
    )
  })

  it('ola 7 · el papel que no existe: en ingles, los codigos validos con su nombre ingles; en espanol, los de siempre', async () => {
    const { loQueFaltaEnElBorrador, BORRADOR_VACIO } = await import('../../../components/demo/razones-sociales/gestion')
    const ctx = { existentes: [], editando: null, catalogo: ['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS', 'OTRO'] }
    const b = (o: object) => ({ ...BORRADOR_VACIO, ...o })
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'Dos', roles: ['x'] }), ctx as never)).toBe(
      'El papel «X» no existe. Los que hay son: ARRENDAMIENTOS, ACTIVOS, LICENCIAS, OPERACION, VENTAS, OTRO.',
    )
    // Un codigo que no es de los cinco (OTRO) es dato: se queda como esta.
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'Dos', roles: ['x'] }), ctx as never, 'en')).toBe(
      'The role “X” doesn’t exist. The available ones are: RENT, ASSETS, PERMITS, OPERATIONS, SALES, OTRO.',
    )
    // El intruso es lo que tecleo quien captura: dato, aunque coincida con un codigo ingles.
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'Dos', roles: ['sales'] }), ctx as never, 'en')).toBe(
      'The role “SALES” doesn’t exist. The available ones are: RENT, ASSETS, PERMITS, OPERATIONS, SALES, OTRO.',
    )
    // Y aunque lo tecleado sea un codigo de partida que esta instancia no tiene,
    // se repite como se tecleo: es lo que la persona tiene que corregir.
    expect(loQueFaltaEnElBorrador(b({ razonSocial: 'Dos', roles: ['ventas'] }), { ...ctx, catalogo: ['ACTIVOS'] } as never, 'en')).toBe(
      'The role “VENTAS” doesn’t exist. The available ones are: ASSETS.',
    )
  })
})

describe('administracion · las frases de `actualizaciones-ui` y `tickets-ui` en los dos idiomas', () => {
  const base = {
    comprobadoEn: 'x', digestDisponible: 'd2', hayNovedad: true, modo: 'aprobacion', versionInstalada: 'v1',
    versionDisponible: 'v2', aprobadoDigest: null, migracionesPendientes: 1, notasDisponibles: null,
  }
  it('en espanol, las de siempre', async () => {
    const a = await import('../../../components/demo/admin/actualizaciones-ui')
    expect(a.textoConfirmarInstalar(base as never)).toBe(
      'Vas a instalar v2. Trae 1 migración pendiente. No llegaron sus notas: no sabes qué trae. El servicio se corta mientras dura la instalación.',
    )
    expect(a.textoDeEstado({ ...base, modo: 'automatica' } as never).texto).toBe(
      'Hay v2 disponible. Se instalará sola en la próxima ventana automática, de madrugada (04:17).',
    )
    const tk = await import('../../../components/demo/admin/tickets-ui')
    expect(tk.textoDeEstado([{ respuesta: null }, { respuesta: null }] as never).texto).toBe('Tienes 2 tickets esperando respuesta.')
  })
  it('en ingles, sin una palabra espanola y con su plural', async () => {
    const a = await import('../../../components/demo/admin/actualizaciones-ui')
    expect(a.textoConfirmarInstalar({ ...base, migracionesPendientes: 3, notasDisponibles: {} } as never, 'en')).toBe(
      'You’re about to install v2. It includes 3 pending migrations. The service goes down while the installation runs.',
    )
    expect(a.textoDeEstado({ ...base, aprobadoDigest: 'd1' } as never, 'en').texto).toBe(
      'What you approved is no longer what’s available: a newer version came out, v2. Approve again to install it.',
    )
    expect(a.textoDeEstado({ ...base, hayNovedad: false } as never, 'en').texto).toBe(
      'Up to date: running v1, the same one that is available.',
    )
    expect(a.avisoSinNotas(base as never, 'en')).toMatch(/^The notes for v2 didn’t arrive/)
    expect(a.tituloNotasDisponibles({ ...base, versionDisponible: null } as never, 'en')).toBe('What’s in the available version')
    const tk = await import('../../../components/demo/admin/tickets-ui')
    expect(tk.textoDeEstado([{ respuesta: null }] as never, 'en').texto).toBe('You have 1 ticket waiting for a reply.')
    expect(tk.textoDeEstado([] as never, 'en').texto).toBe('You haven’t opened any support tickets yet.')
  })
})

// ─── Los avisos que no se rinden ────────────────────────────────────────────
// Un toast, un `window.confirm` o un error de `catch` no salen en ningun estado
// de `pantallas-admin.test.ts`: se lee el FUENTE y se fija que cada uno usa SU
// clave. Si alguien cruza dos (el aviso de activar con el de desactivar), cae.
describe('administracion · los avisos que no se rinden usan su clave', () => {
  it('Usuarios y contraseñas', () => {
    const s = leer('app/(app)/(shell)/administracion/page.tsx')
    expect(s).toContain("t(activo ? 'admin.usuarios.toast.desactivado' : 'admin.usuarios.toast.activado', { nombre })")
    expect(s).toContain("onToast(t('admin.usuarios.toast.rol', { nombre, rol: rolLabel(rol, idioma) }))")
    expect(s).toContain("enviada ? t('admin.usuarios.toast.invitacion', { nombre: n }) : t('admin.usuarios.toast.creado', { nombre: n })")
    expect(s).toContain("passwordDe.id === yo ? t('admin.usuarios.toast.tu-contrasena') : t('admin.usuarios.toast.contrasena-de'")
    expect(s).toContain("setError(t('admin.password.error.corta'))")
    expect(s).toContain("setError(t('admin.password.error.no-coinciden'))")
    expect(s).toContain("setError(t('admin.password.error.actual'))")
  })
  it('Configuracion', () => {
    const s = leer('app/(app)/(shell)/administracion/page.tsx')
    expect(s).toContain("onToast(v >= 100 ? t('admin.tope.sin-tope') : t('admin.tope.toast', { v }))")
    expect(s).toContain("mensajeSiFalla: t('admin.tope.error')")
    expect(s).toContain("if (!tipoOk) { onToast(t('admin.logo.tipo')); return }")
    expect(s).toContain("onToast(t('admin.logo.peso', { mb: LOGO_MAX_MB }))")
    expect(s).toContain("guardar({ logoUrl: dataUrl }, t('admin.logo.actualizado'))")
    expect(s).toContain("v == null ? t('admin.cupo.desactivado') : t('admin.cupo.toast', { v })")
    expect(s).toContain("guardar({ loopSeg: v }, t('admin.loop.toast'))")
    expect(s).toContain("guardar({ spotSeg: v }, t('admin.loop.slot-toast'))")
    expect(s).toContain("valor ? t('admin.correo.actualizado') : t('admin.correo.quitado')")
    expect(s).toContain("t('admin.iva.agregado', { n: nx })")
    expect(s).toContain("t('admin.plazos.agregado', { n: nx })")
  })
  it('Control de cambios, actualizaciones y soporte', () => {
    const c = leer('components/demo/admin/ControlCambiosPanel.tsx')
    expect(c).toContain("!window.confirm(t('admin.cambios.confirmar-activar'))")
    expect(c).toContain("!window.confirm(t('admin.cambios.confirmar-desactivar'))")
    expect(c).toContain("onToast(siguiente ? t('admin.cambios.toast.activado') : t('admin.cambios.toast.desactivado'))")
    expect(c).toContain("onToast(tieneContrasena ? t('admin.cambios.toast.actualizada') : t('admin.cambios.toast.asignada'))")
    const a = leer('components/demo/admin/ActualizacionesPanel.tsx')
    expect(a).toContain("onToast(modo === 'automatica' ? t('admin.act.modo.automatica') : t('admin.act.modo.aprobacion'))")
    expect(a).toContain("onToast(t('admin.act.aprobada'))")
    const k = leer('components/demo/admin/TicketsPanel.tsx')
    expect(k).toContain("onToast(t('admin.tickets.toast.abierto', { folio: nuevo.folio }))")
  })
  it('Configuracion (Mi cuenta), Network y Razones sociales', () => {
    const c = leer('app/(app)/(shell)/configuracion/page.tsx')
    expect(c).toContain("toast.success(t('admin.cuenta.empresa.toast'))")
    expect(c).toContain("toast.success(t('admin.cuenta.toast'))")
    expect(c).toContain("toast.error(t('admin.cuenta.corta'))")
    const n = leer('app/(app)/(shell)/network/page.tsx')
    expect(n).toContain("notify(s.enNetwork ? t('admin.network.toast.quitada', { nombre: s.nombre }) : t('admin.network.toast.compartida', { nombre: s.nombre }))")
    const r = leer('components/demo/razones-sociales/GestionEntidadesFiscales.tsx')
    expect(r).toContain("toast.success(t('admin.razones.toast.agregada'))")
    expect(r).toContain("toast.success(t('admin.razones.toast.actualizada'))")
    expect(r).toContain("toast.success(t('admin.razones.toast.baja'))")
    expect(r).toContain("toast.success(t('admin.razones.toast.reactivada'))")
  })
})
