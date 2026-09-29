import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import bcrypt from 'bcryptjs'
import { recrearEsquema, cerrarPool, poolTest } from './db-e2e'
import { sembrarTenant, asegurarPermisos, PASSWORD_DEMO } from './semillas-e2e'
import { arrancarServidor, pararServidor, BASE, Cliente } from './servidor-e2e'

// ============================================================================
//  Subir el PDF del recibo de CFE, contra el servidor Next de verdad.
// ----------------------------------------------------------------------------
//  ─── POR QUE ESTO NO PUEDE SER UNA UNITARIA ──────────────────────────────
//  La prueba que MAS importa de este archivo es la primera, y es de empaquetado,
//  no de logica: **`pdfjs-dist` se resuelve dentro del artefacto que se
//  despliega**. En `vitest` la libreria se carga de `node_modules` y funciona
//  siempre; en la imagen de una instancia solo existe lo que Next traza o
//  empaqueta, y un `import()` dinamico que el tracing no siga sale como un
//  MODULE_NOT_FOUND **la primera vez que un cliente sube un recibo**, no al
//  construir. Medido al cerrar esta tarea: `pdfjs-dist` NO aparece como paquete
//  en `.next/standalone/node_modules` — webpack lo mete dentro de un chunk del
//  servidor. Esta prueba es lo unico que distingue «lo mete» de «lo pierde».
//
//  ─── Y LA SEGUNDA: el historial de otra organizacion no se empareja ──────
//  El emparejamiento del PDF con su predio sale del historial de
//  `consumos_energia` por numero de servicio. Si esa consulta perdiera su
//  `and tenant_id`, el recibo de un cliente se propondria contra el PREDIO DE
//  OTRA EMPRESA — y el sintoma no seria un error: seria una propuesta con un
//  nombre de predio plausible que alguien confirmaria sin mirar.
//
//  El PDF de prueba se construye aqui, byte a byte, con las DOS codificaciones
//  del recibo real: una fuente WinAnsi y una Identity-H desplazada -29 con su
//  mapa `ToUnicode`. No es un recibo del cliente: esos llevan razon social,
//  domicilio, RFC y sellos, y no se versionan.
// ============================================================================

const SERVICIO_A = '900000000001'
const SERVICIO_B = '900000000002'

const DESPLAZAMIENTO = 29
const aIdentityH = (t: string) =>
  '<' +
  [...t].map((c) => (c.charCodeAt(0) - DESPLAZAMIENTO).toString(16).padStart(4, '0')).join('') +
  '>'

const CMAP = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def
/CMapName /Adobe-Identity-UCS def
/CMapType 2 def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
1 beginbfrange
<0003> <0062> <0020>
endbfrange
endcmap
CMapName currentdict /CMap defineresource pop
end
end`

/** Un recibo de CFE sintetico: PDBT, periodo de dos meses, 2748 kWh. */
function pdfRecibo(servicio: string): Buffer {
  const renglones: [number, 'ansi' | 'cid', string][] = [
    [760, 'ansi', 'Comision Federal de Electricidad'],
    [740, 'cid', `NO. DE SERVICIO: ${servicio}`],
    [720, 'cid', 'TARIFA: PDBT NO. MEDIDOR: A000AA'],
    [700, 'cid', 'PERIODO FACTURADO: 03 NOV 25-05 ENE 26'],
    [680, 'ansi', 'Energia (kWh) 74,978 72,230 2,748'],
    [660, 'ansi', 'Energia 0.00 0.00 1,846.66 1,846.66 Fac. del Periodo 7,838.61'],
    [640, 'ansi', 'Capacidad 0.00 0.00 2,791.97 2,791.97 DSAP 101.83'],
    [620, 'ansi', 'SCnMEM(1) 0.00 0.00 17.04 17.04 Adeudo Anterior 9,673.91'],
    [600, 'ansi', 'Su Pago -9,673.00'],
    [580, 'ansi', 'Total 7,941.35'],
  ]
  const contenido = renglones
    .map(([y, fuente, texto]) =>
      fuente === 'ansi'
        ? `BT /F1 10 Tf 25 ${y} Td (${texto.replace(/([()\\])/g, '\\$1')}) Tj ET`
        : `BT /F2 10 Tf 25 ${y} Td ${aIdentityH(texto)} Tj ET`,
    )
    .join('\n')

  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 8 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type0 /BaseFont /Sintetica /Encoding /Identity-H ' +
      '/DescendantFonts [6 0 R] /ToUnicode 7 0 R >>',
    '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /Sintetica ' +
      '/CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> ' +
      '/FontDescriptor 9 0 R /DW 600 >>',
    `<< /Length ${CMAP.length} >>\nstream\n${CMAP}\nendstream`,
    `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
    '<< /Type /FontDescriptor /FontName /Sintetica /Flags 4 ' +
      '/FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 ' +
      '/CapHeight 700 /StemV 80 >>',
  ]

  let pdf = '%PDF-1.5\n'
  const posiciones: number[] = []
  objetos.forEach((cuerpo, i) => {
    posiciones.push(pdf.length)
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`
  })
  const inicioXref = pdf.length
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`
  for (const p of posiciones) pdf += `${String(p).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`
  return Buffer.from(pdf, 'latin1')
}

/**
 * Cliente de multipart.
 *
 * `Cliente` de `servidor-e2e.ts` solo manda JSON, y ese archivo NO se toca
 * (invariante del repo). Asi que el login se hace con `Cliente` —que es donde
 * vive el manejo de la cookie CSRF— y aqui solo se repite lo minimo para
 * mandar un `FormData` con las mismas cookies.
 */
class SubidorDeArchivos {
  constructor(
    private cookies: string,
    private csrf: string,
    private ip: string,
  ) {}

  async subir(archivos: { nombre: string; datos: Buffer }[]) {
    const cuerpo = new FormData()
    for (const a of archivos) {
      cuerpo.append('archivos', new Blob([new Uint8Array(a.datos)], { type: 'application/pdf' }), a.nombre)
    }
    const r = await fetch(`${BASE}/api/energia/recibos/`, {
      method: 'POST',
      headers: { cookie: this.cookies, 'x-csrf-token': this.csrf, 'x-forwarded-for': this.ip },
      body: cuerpo,
      redirect: 'manual',
    })
    const texto = await r.text()
    let datos: any = null
    try { datos = texto ? JSON.parse(texto) : null } catch { datos = texto }
    return { status: r.status, datos }
  }
}

/** Entra con `fetch` crudo y devuelve las cookies, para el multipart. */
async function entrarCrudo(email: string, ip: string): Promise<SubidorDeArchivos> {
  const r = await fetch(`${BASE}/api/auth/login/`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ email, password: PASSWORD_DEMO }),
    redirect: 'manual',
  })
  if (r.status !== 200) throw new Error(`Login de ${email} fallo (${r.status})`)
  const cookies = new Map<string, string>()
  for (const [nombre, valor] of r.headers) {
    if (nombre.toLowerCase() !== 'set-cookie') continue
    for (const trozo of valor.split(/,(?=\s*[^;=]+=)/)) {
      const [par] = trozo.trim().split(';')
      const i = par.indexOf('=')
      if (i > 0) cookies.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
    }
  }
  const csrf = decodeURIComponent(cookies.get('spaces_csrf') ?? '')
  return new SubidorDeArchivos(
    [...cookies].map(([k, v]) => `${k}=${v}`).join('; '),
    csrf,
    ip,
  )
}

let orgA: Awaited<ReturnType<typeof sembrarTenant>>
let orgB: Awaited<ReturnType<typeof sembrarTenant>>
let predioA: string
let predioB: string
let subidorA: SubidorDeArchivos
let subidorComercial: SubidorDeArchivos

async function predioDe(org: Awaited<ReturnType<typeof sembrarTenant>>): Promise<string> {
  const { rows } = await poolTest().query('select predio_id from sitios where id = $1', [
    org.sitioId,
  ])
  return rows[0].predio_id as string
}

beforeAll(async () => {
  await recrearEsquema()
  await asegurarPermisos()
  orgA = await sembrarTenant('pdfa')
  orgB = await sembrarTenant('pdfb')
  predioA = await predioDe(orgA)
  predioB = await predioDe(orgB)

  // Un usuario de la MISMA organizacion SIN el modulo `operaciones`, para que
  // el 403 solo pueda venir del rol y no del tenant.
  await poolTest().query(
    `insert into usuarios (nombre, email, rol, password_hash, activo, tenant_id)
     values ($1,$2,'COMERCIAL',$3,true,$4)`,
    ['Comercial PDF', 'comercial@pdfa.test', await bcrypt.hash(PASSWORD_DEMO, 4), orgA.id],
  )

  await arrancarServidor()

  // El historial que sostiene el emparejamiento: A ya capturo un recibo del
  // SERVICIO_A en su predio, y B uno del SERVICIO_B en el suyo.
  const a = new Cliente()
  const b = new Cliente()
  await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
  await b.entrar(orgB.usuarioEmail, PASSWORD_DEMO)
  const alta = (cli: Cliente, predio: string, medidor: string) =>
    cli.pedir('/api/energia/consumos/', {
      cuerpo: { predioId: predio, periodo: '2025-06', medidor, kwh: 100, importe: 500 },
    })
  expect((await alta(a, predioA, SERVICIO_A)).status).toBe(201)
  expect((await alta(b, predioB, SERVICIO_B)).status).toBe(201)

  subidorA = await entrarCrudo(orgA.usuarioEmail, '10.9.0.1')
  subidorComercial = await entrarCrudo('comercial@pdfa.test', '10.9.0.2')
}, 180_000)

afterAll(async () => {
  await pararServidor()
  await cerrarPool()
})

// ─── 1 · LA QUE IMPORTA: pdfjs existe dentro del artefacto ─────────────────
describe('1 · el PDF se lee dentro del servidor construido', () => {
  it('lee las DOS codificaciones y propone las cifras del recibo', async () => {
    const r = await subidorA.subir([
      { nombre: 'recibo.pdf', datos: pdfRecibo(SERVICIO_A) },
    ])
    expect(r.status, JSON.stringify(r.datos)).toBe(200)
    expect(r.datos.leidos, JSON.stringify(r.datos.propuestas?.[0]?.avisos)).toBe(1)

    const p = r.datos.propuestas[0]
    // El numero de servicio y la tarifa van en la fuente Identity-H desplazada
    // -29: si el artefacto perdiera el mapa `ToUnicode`, esto seria basura.
    expect(p.lectura.numeroServicio).toBe(SERVICIO_A)
    expect(p.lectura.tarifa).toBe('PDBT')
    // Y los kWh y el desglose van en WinAnsi: las dos, en la misma pagina.
    expect(p.lectura.kwh).toBe(2748)
    expect(p.lectura.importe).toBe(7940.44)
    // El Total impreso NO es lo que se captura: lleva adeudo y pago dentro.
    expect(p.lectura.totalDelRecibo).toBe(7941.35)
  })

  it('NO guarda nada: el tablero sigue con el unico recibo que ya habia', async () => {
    // Es la regla que no se negocia. Si esta ruta escribiera, un recibo mal
    // leido entraria al reporte de rentabilidad sin que nadie lo mirara.
    const { rows } = await poolTest().query(
      'select count(*)::int n from consumos_energia where tenant_id = $1',
      [orgA.id],
    )
    expect(rows[0].n).toBe(1)
  })

  it('reparte el periodo bimestral en sus tres meses, conservando el importe', async () => {
    const r = await subidorA.subir([{ nombre: 'recibo.pdf', datos: pdfRecibo(SERVICIO_A) }])
    const renglones = r.datos.propuestas[0].renglones
    expect(renglones.map((x: any) => x.periodo)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
    ])
    const centavos = (n: number) => Math.round(n * 100)
    expect(renglones.reduce((a: number, x: any) => a + centavos(x.importe), 0)).toBe(
      centavos(7940.44),
    )
  })
})

// ─── 2 · el aislamiento del emparejamiento ────────────────────────────────
describe('2 · el historial de OTRA organizacion no empareja', () => {
  it('A empareja su propio servicio con SU predio', async () => {
    const r = await subidorA.subir([{ nombre: 'a.pdf', datos: pdfRecibo(SERVICIO_A) }])
    expect(r.datos.propuestas[0].predioId).toBe(predioA)
    expect(r.datos.propuestas[0].emparejamiento).toBe('historial')
  })

  it('un servicio que solo conoce B NO se empareja para A: sale sin predio', async () => {
    // El sintoma de un fallo aqui no seria un error: seria una propuesta con el
    // predio de otra empresa, con nombre plausible, que alguien confirmaria.
    const r = await subidorA.subir([{ nombre: 'b.pdf', datos: pdfRecibo(SERVICIO_B) }])
    const p = r.datos.propuestas[0]
    expect(p.predioId).toBeNull()
    expect(p.sitioId).toBeNull()
    expect(p.predioId).not.toBe(predioB)
    expect(p.emparejamiento).toBe('sin-historial')
  })
})

// ─── 3 · los negativos ────────────────────────────────────────────────────
describe('3 · negativos', () => {
  it('sin el modulo `operaciones` da 403 y no lee nada', async () => {
    const r = await subidorComercial.subir([
      { nombre: 'recibo.pdf', datos: pdfRecibo(SERVICIO_A) },
    ])
    expect(r.status, JSON.stringify(r.datos)).toBe(403)
  })

  it('sin sesion da 401', async () => {
    const anonimo = new SubidorDeArchivos('', '', '10.9.0.3')
    const r = await anonimo.subir([{ nombre: 'recibo.pdf', datos: pdfRecibo(SERVICIO_A) }])
    expect([401, 403]).toContain(r.status)
  })

  it('un archivo que NO es un PDF se anota y no tumba la tanda', async () => {
    const r = await subidorA.subir([
      { nombre: 'contrato.xlsx', datos: Buffer.from('esto no es un pdf') },
      { nombre: 'recibo.pdf', datos: pdfRecibo(SERVICIO_A) },
    ])
    expect(r.status).toBe(200)
    expect(r.datos.total).toBe(2)
    expect(r.datos.leidos).toBe(1)
    const malo = r.datos.propuestas.find((p: any) => p.archivo === 'contrato.xlsx')
    expect(malo.esRecibo).toBe(false)
    expect(malo.renglones).toEqual([])
    // Y el bueno sigue leyendose: 40 archivos no se pierden porque uno venga mal.
    const bueno = r.datos.propuestas.find((p: any) => p.archivo === 'recibo.pdf')
    expect(bueno.esRecibo).toBe(true)
  })

  it('sin archivos da 400', async () => {
    const r = await subidorA.subir([])
    expect(r.status).toBe(400)
  })
})

// ─── 4 · el duplicado, visto ANTES de guardar ─────────────────────────────
describe('4 · el mismo recibo subido dos veces', () => {
  it('marca el mes que ya esta capturado, con las cifras de la base', async () => {
    // Se captura noviembre a mano y se vuelve a subir el mismo PDF: el renglon
    // de noviembre tiene que salir marcado, con lo que YA hay, para que quien
    // confirma pueda comparar en vez de descubrirlo con un 409.
    const a = new Cliente()
    await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
    const alta = await a.pedir('/api/energia/consumos/', {
      cuerpo: {
        predioId: predioA,
        periodo: '2025-11',
        medidor: SERVICIO_A,
        kwh: 1202.25,
        importe: 3473.94,
      },
    })
    expect(alta.status, JSON.stringify(alta.datos)).toBe(201)

    const r = await subidorA.subir([{ nombre: 'recibo.pdf', datos: pdfRecibo(SERVICIO_A) }])
    const renglones = r.datos.propuestas[0].renglones
    const noviembre = renglones.find((x: any) => x.periodo === '2025-11-01')
    expect(noviembre.yaCapturado).toBeTruthy()
    expect(noviembre.yaCapturado.importe).toBe(3473.94)
    // Y diciembre sigue limpio: se marca el mes repetido, no el recibo entero.
    expect(renglones.find((x: any) => x.periodo === '2025-12-01').yaCapturado).toBeNull()
    expect(r.datos.propuestas[0].avisos.join(' ')).toMatch(/DUPLICA/)
  })

  it('y si se guarda igual, el indice unico lo corta con un 409', async () => {
    const a = new Cliente()
    await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
    const otra = await a.pedir('/api/energia/consumos/', {
      cuerpo: {
        predioId: predioA,
        periodo: '2025-11',
        medidor: SERVICIO_A,
        kwh: 999,
        importe: 999,
      },
    })
    expect(otra.status, JSON.stringify(otra.datos)).toBe(409)
  })
})

// ─── 5 · la regla del cero, en la PUERTA del servidor ─────────────────────
describe('5 · ni kWh ni importe en cero o negativo, por la ruta directa', () => {
  const alta = async (cuerpo: Record<string, unknown>) => {
    const a = new Cliente()
    await a.entrar(orgA.usuarioEmail, PASSWORD_DEMO)
    return a.pedir('/api/energia/consumos/', { cuerpo })
  }
  // Funcion y no constante: `predioA` se rellena en `beforeAll`, y un objeto
  // literal aqui se evaluaria ANTES con `predioId: undefined` — el 400 saldria
  // por el anclaje y no por la cifra, dejando las cuatro pruebas en verde sin
  // probar nada de lo que dicen.
  const base = () => ({ predioId: predioA, periodo: '2025-08', kwh: 10, importe: 10 })

  it('kwh en cero: 400 y NO se guarda', async () => {
    const r = await alta({ ...base(), medidor: 'CERO-KWH', kwh: 0 })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    const { rows } = await poolTest().query(
      'select count(*)::int n from consumos_energia where medidor = $1',
      ['CERO-KWH'],
    )
    expect(rows[0].n).toBe(0)
  })

  it('importe en cero: 400 y NO se guarda', async () => {
    const r = await alta({ ...base(), medidor: 'CERO-IMP', importe: 0 })
    expect(r.status, JSON.stringify(r.datos)).toBe(400)
    const { rows } = await poolTest().query(
      'select count(*)::int n from consumos_energia where medidor = $1',
      ['CERO-IMP'],
    )
    expect(rows[0].n).toBe(0)
  })

  it('kwh negativo: 400', async () => {
    expect((await alta({ ...base(), medidor: 'NEG-KWH', kwh: -1 })).status).toBe(400)
  })

  it('importe negativo: 400', async () => {
    expect((await alta({ ...base(), medidor: 'NEG-IMP', importe: -500 })).status).toBe(400)
  })

  it('control positivo: con las dos cifras positivas SI se guarda', async () => {
    // Sin esto, cualquier fallo de validacion dejaria las cuatro de arriba en
    // verde sin probar nada de lo que dicen probar.
    const r = await alta({ ...base(), medidor: 'POSITIVO' })
    expect(r.status, JSON.stringify(r.datos)).toBe(201)
  })
})
