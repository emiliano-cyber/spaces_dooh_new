import { describe, it, expect } from 'vitest'
import {
  planDelCuestionario,
  camposDelPaso3,
  faltaContestarCuestionario,
  emisorPorOmision,
  resumenParaBitacora,
  claveRazonSocial,
  LIMITE_RAZON_SOCIAL,
} from './cuestionario-entidades'

// ============================================================================
//  El cuestionario de bienvenida — la traducción de las respuestas al conjunto
//  de razones sociales y roles que hay que crear.
// ----------------------------------------------------------------------------
//  Esta lógica está en un módulo PURO y no dentro de la pantalla a propósito.
//  `vitest.config.ts` no monta jsdom —lo dice en su propia cabecera— así que
//  una decisión de negocio escrita en un `.tsx` no la prueba nadie. Ya pasó en
//  este repositorio: al sacar una a un módulo propio aparecieron nueve casos en
//  rojo que llevaban meses ahí.
//
//  Lo que estas pruebas defienden es que el cuestionario NO es una encuesta:
//  de sus tres respuestas salen filas en `entidades_fiscales` y en
//  `entidad_roles`. Una traducción mal hecha no da error — da una identidad
//  fiscal equivocada, y con ella contratos pagados y comprobantes emitidos a
//  nombre de quien no era.
//
//  El catálogo de roles llega SIEMPRE por parámetro, nunca escrito aquí
//  dentro: es una decisión de negocio abierta que vive en la tabla
//  `catalogo_roles_entidad`, y una constante en el código anularía el motivo de
//  que `rol` sea texto y no un enum (ver `vault/02-Backend/entidades-fiscales.md`).
// ============================================================================

// Los cinco que hoy siembra `20260917_entidades_fiscales.sql:76`, en su orden,
// con las dos etiquetas que `20260921_corrige_acentos_catalogo_roles_entidad.sql`
// acentuó (LICENCIAS y OPERACION). Se escriben aquí como ENTRADA de las
// pruebas, que es distinto de que el módulo los conozca.
const CATALOGO = ['ARRENDAMIENTOS', 'ACTIVOS', 'LICENCIAS', 'OPERACION', 'VENTAS']
const CATALOGO_CON_ETIQUETA = [
  { rol: 'ARRENDAMIENTOS', etiqueta: 'Paga las rentas a los arrendadores' },
  { rol: 'ACTIVOS', etiqueta: 'Compra los activos y el equipo' },
  { rol: 'LICENCIAS', etiqueta: 'Trámites y licencias con gobierno' },
  { rol: 'OPERACION', etiqueta: 'Operación y nómina' },
  { rol: 'VENTAS', etiqueta: 'Vende publicidad' },
]

/** Atajo: el plan de un caso que TIENE que salir bien, o la prueba muere aquí. */
function planBueno(respuestas: Parameters<typeof planDelCuestionario>[0]) {
  const p = planDelCuestionario(respuestas, CATALOGO)
  if (!p.ok) throw new Error(`se esperaba un plan válido y salió: ${p.error}`)
  return p.entidades
}

// ─────────────────────────────────────────────────────────────────────────────
describe('1 · el caso corriente: una sola razón social para todo', () => {
  // Sin este caso los negativos podrían pasar por el motivo equivocado.
  it('una empresa con una sola razón social crea UNA entidad con los CINCO roles', () => {
    const entidades = planBueno({
      variasRazonesSociales: false,
      razonSocialUnica: 'Espacios del Centro SA de CV',
    })
    expect(entidades).toHaveLength(1)
    expect(entidades[0].razonSocial).toBe('Espacios del Centro SA de CV')
    expect(entidades[0].roles).toEqual(CATALOGO)
  })

  it('no hace teclear la misma razón social cinco veces', () => {
    // Es la razón de ser de la primera pregunta: quien contesta «una sola» da
    // UN dato, no cinco. Si esto se rompiera, la pregunta 1 dejaría de
    // simplificar nada y sería solo una pregunta más.
    const campos = camposDelPaso3({ variasRazonesSociales: false }, CATALOGO_CON_ETIQUETA)
    expect(campos).toHaveLength(1)
    expect(campos[0].roles).toEqual(CATALOGO)
  })

  it('recorta y colapsa: un espacio de más no es otra empresa', () => {
    const entidades = planBueno({
      variasRazonesSociales: false,
      razonSocialUnica: '   Espacios   del Centro SA de CV  ',
    })
    expect(entidades[0].razonSocial).toBe('Espacios del Centro SA de CV')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('2 · varias razones sociales, con operación y ventas juntas', () => {
  // El caso que el dueño describió como el normal: «la mayoría son multi
  // entidad» y operación y ventas suelen coincidir.
  it('agrupa: una razón social con VARIOS roles es UNA entidad, no varias', () => {
    const entidades = planBueno({
      variasRazonesSociales: true,
      operacionYVentasJuntas: true,
      razonSocialPorRol: {
        ARRENDAMIENTOS: 'Inmuebles del Norte SA de CV',
        ACTIVOS: 'Inmuebles del Norte SA de CV',
        LICENCIAS: 'Gestoria Integral SA de CV',
        OPERACION: 'Operadora Comercial SA de CV',
        VENTAS: 'Operadora Comercial SA de CV',
      },
    })
    expect(entidades).toHaveLength(3)
    expect(entidades.map((e) => e.razonSocial)).toEqual([
      'Inmuebles del Norte SA de CV',
      'Gestoria Integral SA de CV',
      'Operadora Comercial SA de CV',
    ])
    expect(entidades[0].roles).toEqual(['ARRENDAMIENTOS', 'ACTIVOS'])
    expect(entidades[2].roles).toEqual(['OPERACION', 'VENTAS'])
  })

  it('la pregunta 2 fusiona operación y ventas en UN campo, no en dos', () => {
    const campos = camposDelPaso3(
      { variasRazonesSociales: true, operacionYVentasJuntas: true },
      CATALOGO_CON_ETIQUETA,
    )
    expect(campos).toHaveLength(4)
    const fusionado = campos.find((c) => c.roles.length === 2)!
    expect(fusionado, 'no se fusionó ningún campo').toBeDefined()
    expect(fusionado.roles).toEqual(['OPERACION', 'VENTAS'])
    // La etiqueta sale del CATÁLOGO, no de una cadena escrita en el código: la
    // etiqueta es un dato de la fila (`catalogo_roles_entidad.etiqueta`) y
    // quien la renombre en su instancia tiene que verlo en pantalla.
    expect(fusionado.etiqueta).toContain('Operación y nómina')
    expect(fusionado.etiqueta).toContain('Vende publicidad')
  })

  it('con operación y ventas juntas, contestar UNO de los dos llena el otro', () => {
    // La pantalla presenta un solo campo para los dos. Que el reparto viva
    // aquí y no en el `.tsx` es lo que hace que un cliente de la API que mande
    // solo OPERACION obtenga el mismo resultado que la pantalla.
    const entidades = planBueno({
      variasRazonesSociales: true,
      operacionYVentasJuntas: true,
      razonSocialPorRol: { OPERACION: 'Operadora Comercial SA de CV' },
    })
    expect(entidades).toHaveLength(1)
    expect(entidades[0].roles).toEqual(['OPERACION', 'VENTAS'])
  })

  it('cuando están separadas, la pregunta 3 pide los cinco por separado', () => {
    const campos = camposDelPaso3(
      { variasRazonesSociales: true, operacionYVentasJuntas: false },
      CATALOGO_CON_ETIQUETA,
    )
    expect(campos).toHaveLength(5)
    expect(campos.every((c) => c.roles.length === 1)).toBe(true)
  })

  it('un rol en blanco no se inventa una entidad: ese papel se queda sin asignar', () => {
    // Un owner puede no saber todavía con qué sociedad tramita las licencias.
    // Dejarlo en blanco es una respuesta legítima, no un error: la columna
    // `entidad_id` es nullable justamente por esto.
    const entidades = planBueno({
      variasRazonesSociales: true,
      operacionYVentasJuntas: false,
      razonSocialPorRol: { ARRENDAMIENTOS: 'Inmuebles del Norte SA de CV', LICENCIAS: '  ' },
    })
    expect(entidades).toHaveLength(1)
    expect(entidades[0].roles).toEqual(['ARRENDAMIENTOS'])
  })

  it('la misma razón social escrita de dos formas es UNA entidad', () => {
    // «ACME, S.A. de C.V.» y «Acme SA de CV» son la misma empresa teclada dos
    // veces. Crear dos filas dejaría el catálogo con un duplicado que nadie
    // puede distinguir, y el emisor por omisión ambiguo para siempre.
    const entidades = planBueno({
      variasRazonesSociales: true,
      operacionYVentasJuntas: false,
      razonSocialPorRol: { ARRENDAMIENTOS: 'ACME, S.A. de C.V.', ACTIVOS: 'Acme SA de CV' },
    })
    expect(entidades).toHaveLength(1)
    expect(entidades[0].roles).toEqual(['ARRENDAMIENTOS', 'ACTIVOS'])
    // Se conserva la PRIMERA forma tecleada, no una normalizada: lo que va a la
    // base es texto que un humano escribió, y «ACME SA DE CV» no es cómo se
    // llama la empresa.
    expect(entidades[0].razonSocial).toBe('ACME, S.A. de C.V.')
  })

  it('la clave de agrupación ignora acentos, puntos, comas y mayúsculas', () => {
    expect(claveRazonSocial('Operación, S.A. de C.V.')).toBe(
      claveRazonSocial('  operacion  SA de CV '),
    )
    expect(claveRazonSocial('Uno SA')).not.toBe(claveRazonSocial('Dos SA'))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('3 · los negativos, que son el corazón', () => {
  it('«una sola razón social» + cinco distintas se RECHAZA', () => {
    // El caso que el enunciado pone primero. Sin esto se crearían cinco
    // entidades para quien acaba de decir que tiene una.
    const p = planDelCuestionario(
      {
        variasRazonesSociales: false,
        razonSocialUnica: 'Espacios del Centro SA de CV',
        razonSocialPorRol: {
          ARRENDAMIENTOS: 'Una SA de CV',
          ACTIVOS: 'Dos SA de CV',
          LICENCIAS: 'Tres SA de CV',
          OPERACION: 'Cuatro SA de CV',
          VENTAS: 'Cinco SA de CV',
        },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toMatch(/una sola/i)
  })

  it('«una sola razón social» + una distinta de la única también se RECHAZA', () => {
    // Más sutil que el anterior y por eso más peligroso: una sola discrepancia
    // no salta a la vista, y decidir en silencio cuál gana es inventarse la
    // identidad fiscal del negocio.
    const p = planDelCuestionario(
      {
        variasRazonesSociales: false,
        razonSocialUnica: 'Espacios del Centro SA de CV',
        razonSocialPorRol: { VENTAS: 'Otra Cosa SA de CV' },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
  })

  it('un rol que no está en el catálogo se RECHAZA, y dice cuáles hay', () => {
    const p = planDelCuestionario(
      {
        variasRazonesSociales: true,
        operacionYVentasJuntas: false,
        razonSocialPorRol: { TESORERIA: 'Tesoreria SA de CV' },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toContain('TESORERIA')
    expect(p.error).toContain('VENTAS')
  })

  it('contradicción entre la pregunta 2 y el mapa: «juntas» con dos distintas', () => {
    const p = planDelCuestionario(
      {
        variasRazonesSociales: true,
        operacionYVentasJuntas: true,
        razonSocialPorRol: { OPERACION: 'Operadora SA de CV', VENTAS: 'Comercial SA de CV' },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toMatch(/operaci/i)
  })

  it('contradicción al revés: «separadas» con la MISMA para las dos', () => {
    // Igual de contradictorio, y el que se olvida. Si pasara, el plan crearía
    // una entidad con los dos roles — o sea exactamente lo que acaba de decir
    // que NO es su caso.
    const p = planDelCuestionario(
      {
        variasRazonesSociales: true,
        operacionYVentasJuntas: false,
        razonSocialPorRol: { OPERACION: 'Operadora SA de CV', VENTAS: 'Operadora SA de CV' },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
  })

  it('«una sola razón social» y a la vez operación y ventas separadas se RECHAZA', () => {
    // Con una sola sociedad, operación y ventas están forzosamente en la misma.
    const p = planDelCuestionario(
      {
        variasRazonesSociales: false,
        operacionYVentasJuntas: false,
        razonSocialUnica: 'Espacios del Centro SA de CV',
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
  })

  it('sin contestar la primera pregunta no hay plan', () => {
    const p = planDelCuestionario({ razonSocialUnica: 'Espacios SA de CV' }, CATALOGO)
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toMatch(/primera pregunta/i)
  })

  it('«varias razones sociales» sin contestar la segunda tampoco', () => {
    const p = planDelCuestionario(
      {
        variasRazonesSociales: true,
        razonSocialPorRol: { VENTAS: 'Comercial SA de CV' },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toMatch(/segunda pregunta/i)
  })

  it('«una sola» sin escribir el nombre se RECHAZA', () => {
    const p = planDelCuestionario(
      { variasRazonesSociales: false, razonSocialUnica: '   ' },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
  })

  it('«varias» sin ninguna razón social se RECHAZA: no crea nada vacío', () => {
    const p = planDelCuestionario(
      { variasRazonesSociales: true, operacionYVentasJuntas: true, razonSocialPorRol: {} },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toMatch(/al menos una/i)
  })

  it('una razón social más larga que la columna se RECHAZA antes de llegar a la base', () => {
    const p = planDelCuestionario(
      {
        variasRazonesSociales: false,
        razonSocialUnica: 'A'.repeat(LIMITE_RAZON_SOCIAL + 1),
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
  })

  it('el mismo rol repetido con otras mayúsculas se RECHAZA en vez de que gane el último', () => {
    const p = planDelCuestionario(
      {
        variasRazonesSociales: true,
        operacionYVentasJuntas: false,
        razonSocialPorRol: { ventas: 'Una SA de CV', VENTAS: 'Otra SA de CV' },
      },
      CATALOGO,
    )
    expect(p.ok).toBe(false)
    if (p.ok) return
    expect(p.error).toMatch(/repetido/i)
  })

  it('un catálogo vacío no produce un plan vacío en silencio', () => {
    const p = planDelCuestionario(
      { variasRazonesSociales: false, razonSocialUnica: 'Espacios SA de CV' },
      [],
    )
    expect(p.ok).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('4 · «el cuestionario está pendiente» se DERIVA, no se guarda', () => {
  // No hay columna en `tenants` ni en `config_negocio`, y por tanto no hay
  // migración: la pregunta «¿ya lo contestó?» es «¿tiene alguna razón social?».
  it('sin ninguna entidad, falta contestarlo', () => {
    expect(faltaContestarCuestionario(0)).toBe(true)
  })

  it('con una sola entidad ya está contestado', () => {
    expect(faltaContestarCuestionario(1)).toBe(false)
  })

  it('un recuento desconocido NO se ofrece: ante la duda, no molestar', () => {
    // Si la consulta falla, ofrecer el cuestionario a quien ya lo contestó es
    // peor que no ofrecerlo: el endpoint lo rechazaría y la pantalla se vería
    // como un error.
    expect(faltaContestarCuestionario(null)).toBe(false)
    expect(faltaContestarCuestionario(undefined)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('5 · los defaults se DERIVAN de los roles', () => {
  const entidades = [
    { id: 'E1', razonSocial: 'Inmuebles del Norte SA de CV', roles: ['ARRENDAMIENTOS'] },
    { id: 'E2', razonSocial: 'Operadora Comercial SA de CV', roles: ['OPERACION', 'VENTAS'] },
  ]

  it('si una sola entidad tiene VENTAS, ésa es el emisor por omisión', () => {
    expect(emisorPorOmision(entidades, 'VENTAS')?.id).toBe('E2')
  })

  it('con dos que venden no hay omisión: se autocorrige al alta de la segunda', () => {
    // Adivinar aquí sería emitir comprobantes a nombre de la sociedad
    // equivocada sin que nadie lo hubiera decidido.
    const dos = [...entidades, { id: 'E3', razonSocial: 'Otra Comercial SA', roles: ['VENTAS'] }]
    expect(emisorPorOmision(dos, 'VENTAS')).toBeNull()
  })

  it('si ninguna tiene el rol, no hay omisión', () => {
    expect(emisorPorOmision(entidades, 'LICENCIAS')).toBeNull()
  })

  it('una entidad dada de baja no se ofrece por omisión', () => {
    const conBaja = [
      { id: 'E4', razonSocial: 'Vieja SA', roles: ['LICENCIAS'], activo: false },
      { id: 'E5', razonSocial: 'Nueva SA', roles: ['LICENCIAS'], activo: true },
    ]
    expect(emisorPorOmision(conBaja, 'LICENCIAS')?.id).toBe('E5')
  })

  it('sin entidades no revienta', () => {
    expect(emisorPorOmision([], 'VENTAS')).toBeNull()
    expect(emisorPorOmision(null, 'VENTAS')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('6 · el resumen que va a la bitácora', () => {
  it('dice CUÁNTAS razones sociales y con QUÉ roles', () => {
    // La bitácora de un dato fiscal tiene que poder leerse después sin abrir la
    // base: saber que se creó algo no basta.
    const texto = resumenParaBitacora([
      { razonSocial: 'Inmuebles del Norte SA de CV', roles: ['ARRENDAMIENTOS', 'ACTIVOS'] },
      { razonSocial: 'Operadora Comercial SA de CV', roles: ['OPERACION', 'VENTAS'] },
    ])
    expect(texto).toContain('2')
    expect(texto).toContain('Inmuebles del Norte SA de CV')
    expect(texto).toContain('ARRENDAMIENTOS, ACTIVOS')
    expect(texto).toContain('OPERACION, VENTAS')
  })

  it('una sola se lee en singular', () => {
    const texto = resumenParaBitacora([{ razonSocial: 'Espacios SA de CV', roles: ['VENTAS'] }])
    expect(texto).toMatch(/1 raz[oó]n social/i)
  })
})
