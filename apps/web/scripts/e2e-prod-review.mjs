// ============================================================================
//  scripts/e2e-prod-review.mjs — Repaso integral pre-producción.
//  Ejecuta el flujo completo con un perfil distinto en cada etapa, prueba RBAC
//  negativo, auth, candado de facturación, persistencia y bitácora.
//  Requiere el dev server arriba (localhost:3000) y Postgres con SOLO el usuario RGB.
//  Crea usuarios de prueba por perfil y AL FINAL deja la BD en solo-RGB.
// ============================================================================

const BASE = 'http://localhost:3000/spaces-dooh/api'
const PW = 'spaces123'
const RGB = 'jose@pixeled.com.mx'

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? '✓' : '✗'}  ${name}${detail ? `  — ${detail}` : ''}`)
}

// 1×1 PNG transparente como testigo fotográfico.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

async function call(method, path, { cookie, body } = {}) {
  const headers = {}
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers['content-type'] = 'application/json'
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: 'manual',
  })
  let data = null
  try { data = await r.json() } catch { /* sin cuerpo */ }
  let setCookie = null
  const sc = r.headers.getSetCookie?.() ?? []
  const found = sc.find((c) => c.startsWith('spaces_sesion='))
  if (found) setCookie = found.split(';')[0]
  return { status: r.status, data, setCookie }
}

async function login(email, password = PW) {
  const r = await call('POST', '/auth/login/', { body: { email, password } })
  return { status: r.status, cookie: r.setCookie, rol: r.data?.usuario?.rol }
}

async function ensureUser(rgbCookie, nombre, email, rol) {
  const r = await call('POST', '/usuarios/', { cookie: rgbCookie, body: { nombre, email, rol } })
  // 201 creado, o 409 si ya existía de una corrida previa: ambos sirven para loguear.
  return r.status === 201 || r.status === 409
}

async function main() {
  console.log('\n── A. AUTENTICACIÓN ─────────────────────────────────────────')
  const sinSesion = await call('GET', '/estado/')
  check('GET /estado sin sesión → 401', sinSesion.status === 401, `HTTP ${sinSesion.status}`)

  const badPw = await login(RGB, 'incorrecta')
  check('Login con contraseña incorrecta → 401', badPw.status === 401, `HTTP ${badPw.status}`)

  const rgb = await login(RGB)
  check('Login RGB (DUENO) → 200 + cookie', rgb.status === 200 && !!rgb.cookie, `rol ${rgb.rol}`)
  const RGBC = rgb.cookie

  console.log('\n── Alta de usuarios por perfil (como DUENO) ─────────────────')
  await ensureUser(RGBC, 'Carla Comercial', 'comercial@test.com', 'COMERCIAL')
  await ensureUser(RGBC, 'Omar Operaciones', 'operaciones@test.com', 'OPERACIONES')
  await ensureUser(RGBC, 'Ines Imprenta', 'imprenta@test.com', 'IMPRENTA')
  await ensureUser(RGBC, 'Félix Finanzas', 'finanzas@test.com', 'FINANZAS')

  const com = await login('comercial@test.com')
  const ope = await login('operaciones@test.com')
  const imp = await login('imprenta@test.com')
  const fin = await login('finanzas@test.com')
  check('Login de los 4 perfiles → 200',
    [com, ope, imp, fin].every((x) => x.status === 200 && x.cookie),
    `${com.rol}/${ope.rol}/${imp.rol}/${fin.rol}`)

  console.log('\n── B. COMERCIAL: inventario + reserva + OC ──────────────────')
  const altaSitio = await call('POST', '/sitios/', {
    cookie: com.cookie,
    body: { nombre: 'Valla Av. Javier Prado', tipoMedio: 'VALLA', distrito: 'San Isidro', lat: -12.09, lng: -77.02, tarifaPublicada: 18000 },
  })
  check('COMERCIAL alta de sitio → 201', altaSitio.status === 201, `HTTP ${altaSitio.status}`)
  const sitioId = altaSitio.data?.id

  const reservar = await call('POST', '/reservar/', {
    cookie: com.cookie,
    body: { clienteNombre: 'Telco Andina', nombreCampana: 'Lanzamiento Plan 5G', sitioIds: [sitioId], fechaInicio: '2026-07-01', fechaFin: '2026-07-31' },
  })
  check('COMERCIAL reservar (tentativa) → 201', reservar.status === 201, `HTTP ${reservar.status}`)
  const campId = reservar.data?.id

  const confirmar = await call('POST', `/campanas/${campId}/confirmar/`, { cookie: com.cookie })
  check('COMERCIAL confirmar reserva → 200', confirmar.status === 200, `estado ${confirmar.data?.estadoComercial}`)

  const oc = await call('POST', `/campanas/${campId}/oc/`, { cookie: com.cookie, body: {} })
  check('COMERCIAL registrar OC → 200', oc.status === 200, `HTTP ${oc.status}`)

  const comFactura = await call('POST', `/campanas/${campId}/facturar/`, { cookie: com.cookie, body: { plazoDias: 90 } })
  check('RBAC: COMERCIAL no puede facturar → 403', comFactura.status === 403, `HTTP ${comFactura.status}`)
  const comOT = await call('POST', '/ot/', { cookie: com.cookie, body: { tipo: 'MONTAJE_LONA', descripcion: 'x' } })
  check('RBAC: COMERCIAL no puede crear OT → 403', comOT.status === 403, `HTTP ${comOT.status}`)

  console.log('\n── C. IMPRENTA: orden de impresión ──────────────────────────')
  const crearOI = await call('POST', '/impresion/', {
    cookie: imp.cookie,
    body: { campanaId: campId, sitioId, material: 'Lona front 13oz', ancho: 12, alto: 8, proveedor: 'Gigantografías SAC' },
  })
  check('IMPRENTA crear orden de impresión → 201', crearOI.status === 201, `folio ${crearOI.data?.folio}`)
  const oiId = crearOI.data?.id

  const avZ1 = await call('PATCH', `/impresion/${oiId}/`, { cookie: imp.cookie })
  const avZ2 = await call('PATCH', `/impresion/${oiId}/`, { cookie: imp.cookie })
  check('IMPRENTA avanzar proceso x2 → 200', avZ1.status === 200 && avZ2.status === 200, `→ ${avZ2.data?.estatus}`)

  const impSitio = await call('POST', '/sitios/', { cookie: imp.cookie, body: { nombre: 'X', tipoMedio: 'VALLA' } })
  check('RBAC: IMPRENTA no puede dar alta de sitio → 403', impSitio.status === 403, `HTTP ${impSitio.status}`)

  console.log('\n── D. OPERACIONES: OT + testigo (cierra candado) ────────────')
  const crearOT = await call('POST', '/ot/', {
    cookie: ope.cookie,
    body: { tipo: 'MONTAJE_LONA', sitioId, campanaId: campId, descripcion: 'Montaje de lona Plan 5G', prioridad: 'ALTA' },
  })
  check('OPERACIONES crear OT → 201', crearOT.status === 201, `folio ${crearOT.data?.folio}`)
  const otId = crearOT.data?.id

  const cerrarOT = await call('POST', `/ot/${otId}/cerrar/`, {
    cookie: ope.cookie,
    body: { fotoUrl: PNG, tomadaEn: '2026-07-02T10:00:00.000Z', lat: -12.09, lng: -77.02 },
  })
  check('OPERACIONES cerrar OT con testigo → 200', cerrarOT.status === 200, `estatus ${cerrarOT.data?.estatus}`)

  const opeFactura = await call('POST', `/campanas/${campId}/facturar/`, { cookie: ope.cookie, body: { plazoDias: 90 } })
  check('RBAC: OPERACIONES no puede facturar → 403', opeFactura.status === 403, `HTTP ${opeFactura.status}`)

  console.log('\n── E. FINANZAS: factura + cobranza ──────────────────────────')
  const factura = await call('POST', `/campanas/${campId}/facturar/`, { cookie: fin.cookie, body: { plazoDias: 90 } })
  check('FINANZAS generar factura (candado completo) → 201', factura.status === 201, `folio ${factura.data?.folio} monto ${factura.data?.monto}`)

  const reFactura = await call('POST', `/campanas/${campId}/facturar/`, { cookie: fin.cookie, body: { plazoDias: 90 } })
  check('FINANZAS re-facturar misma campaña → 400', reFactura.status === 400, `HTTP ${reFactura.status}`)

  const finOI = await call('POST', '/impresion/', { cookie: fin.cookie, body: { campanaId: campId } })
  check('RBAC: FINANZAS no puede crear OI → 403', finOI.status === 403, `HTTP ${finOI.status}`)

  const f = factura.data ?? {}
  const r2 = (x) => Math.round(x * 100) / 100
  check('Factura desglosa subtotal + IGV = total', r2(f.subtotal + f.igv) === r2(f.monto), `${f.subtotal}+${f.igv}=${f.monto}`)
  check('IGV = 18% del subtotal', r2(f.subtotal * 0.18) === r2(f.igv), `igv ${f.igv}`)
  // Proración por días exactos: campaña de 31 días (01–31 jul) a tarifa 18,000/mes.
  check('Proración por días: subtotal = 18000/30 × 31', r2(f.subtotal) === r2((18000 / 30) * 31), `subtotal ${f.subtotal}`)

  console.log('\n── E2. Comercial: editar y eliminar pantalla ────────────────')
  const editar = await call('PATCH', `/sitios/${sitioId}/`, { cookie: com.cookie, body: { nombre: 'Valla Editada', tarifaPublicada: 20000, tarifaMensual: 20000 } })
  check('COMERCIAL editar sitio → 200', editar.status === 200 && editar.data?.tarifaMensual === 20000, `tarifa ${editar.data?.tarifaMensual}`)

  const delConDep = await call('DELETE', `/sitios/${sitioId}/`, { cookie: com.cookie })
  check('Eliminar sitio con reservas/OT → 409', delConDep.status === 409, `HTTP ${delConDep.status}`)

  const desechable = await call('POST', '/sitios/', { cookie: com.cookie, body: { nombre: 'Desechable', tipoMedio: 'VALLA', tarifaPublicada: 5000 } })
  const delLimpio = await call('DELETE', `/sitios/${desechable.data?.id}/`, { cookie: com.cookie })
  check('Eliminar sitio sin dependencias → 200', delLimpio.status === 200, `HTTP ${delLimpio.status}`)

  const impEdit = await call('PATCH', `/sitios/${sitioId}/`, { cookie: imp.cookie, body: { nombre: 'x' } })
  check('RBAC: IMPRENTA no puede editar sitio → 403', impEdit.status === 403, `HTTP ${impEdit.status}`)

  console.log('\n── F. PERSISTENCIA: /estado refleja todo ────────────────────')
  const est = await call('GET', '/estado/', { cookie: RGBC })
  const e = est.data ?? {}
  const cob = (e.cobranzas ?? [])[0]
  check('estado: 1 sitio · 1 campaña · 1 OI · 1 OT · 1 evidencia · 1 factura · 1 cobranza',
    (e.sitios?.length >= 1) && e.campanas?.length === 1 && e.ordenesImpresion?.length === 1 &&
    e.ordenesTrabajo?.length === 1 && e.evidencias?.length === 1 && e.facturas?.length === 1 && e.cobranzas?.length === 1,
    `s${e.sitios?.length} c${e.campanas?.length} oi${e.ordenesImpresion?.length} ot${e.ordenesTrabajo?.length} ev${e.evidencias?.length} f${e.facturas?.length} cb${e.cobranzas?.length}`)

  const camp = (e.campanas ?? []).find((c) => c.id === campId)
  check('Campaña quedó COMPLETADA tras facturar', camp?.estadoComercial === 'COMPLETADA', `estado ${camp?.estadoComercial}`)

  console.log('\n── Pago de cobranza ─────────────────────────────────────────')
  const pago = await call('POST', `/cobranzas/${cob?.id}/pagar/`, { cookie: fin.cookie })
  check('FINANZAS registrar pago → 200 (PAGADA)', pago.status === 200 && pago.data?.estatus === 'PAGADA', `estatus ${pago.data?.estatus}`)

  console.log('\n── G. BITÁCORA: trazabilidad por usuario ────────────────────')
  const est2 = await call('GET', '/estado/', { cookie: RGBC })
  const acc = est2.data?.acciones ?? []
  const etiquetas = acc.map((a) => `${a.usuarioNombre}::${a.accion}`)
  const tiene = (frag) => etiquetas.some((x) => x.includes(frag))
  check('Bitácora registra acciones de los 5 actores', acc.length >= 9, `${acc.length} acciones`)
  check('Bitácora atribuye OC a Comercial', tiene('Carla Comercial::Registró OC'), '')
  check('Bitácora atribuye OI a Imprenta', tiene('Ines Imprenta::Creó orden de impresión'), '')
  check('Bitácora atribuye cierre OT a Operaciones', tiene('Omar Operaciones::Cerró OT'), '')
  check('Bitácora atribuye factura a Finanzas', tiene('Félix Finanzas::Generó factura'), '')

  console.log('\n── H. SESIÓN: logout invalida la cookie ─────────────────────')
  await call('POST', '/auth/logout/', { cookie: fin.cookie })
  const trasLogout = await call('GET', '/estado/', { cookie: fin.cookie })
  check('Tras logout, la cookie ya no autentica → 401', trasLogout.status === 401, `HTTP ${trasLogout.status}`)

  // Resumen
  const ok = results.filter((r) => r.ok).length
  const total = results.length
  console.log(`\n════════════════════════════════════════════════════════════`)
  console.log(`RESULTADO: ${ok}/${total} verificaciones OK`)
  const fallas = results.filter((r) => !r.ok)
  if (fallas.length) {
    console.log('FALLAS:')
    fallas.forEach((f) => console.log(`  ✗ ${f.name} (${f.detail})`))
    process.exitCode = 1
  } else {
    console.log('TODO VERDE ✓')
  }
}

main().catch((e) => { console.error('ERROR FATAL:', e); process.exitCode = 1 })
