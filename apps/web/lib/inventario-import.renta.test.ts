import { describe, it, expect } from 'vitest'
import { validarFila } from './inventario-import'

// ============================================================================
//  Columna `renta_arrendador` del import masivo.
//
//  Es el costo del ARRENDADOR: lo que se le paga al dueño del espacio, y desde
//  el ADR 0006 el ÚNICO costo de la pantalla. Lo que entra del cliente es
//  `tarifa_publicada`; `costo_compra` dejó de ser un costo aparte y se lee como
//  sinónimo de la renta. Sin esta columna, toda pantalla importada entraba al
//  inventario con costo de renta CERO y su margen salía inflado por el importe
//  completo de la renta — el agujero que describe el ADR 0001.
//
//  Lo que estas pruebas protegen es el manejo del valor AUSENTE frente al valor
//  CERO, que aquí no son lo mismo ni de lejos:
//
//   · ausente  → pendiente de captura. El contrato nace INCOMPLETO, aparece en
//                la alerta y alguien lo completa.
//   · cero     → «este espacio es gratis». Satisface `contrato_completo_ck`,
//                DESAPARECE de la alerta y el P&L reporta margen íntegro. Un
//                dato malo que se disfraza de dato bueno.
//
//  Por eso un 0 del Excel NUNCA se guarda como 0: degrada a pendiente y avisa.
// ============================================================================

// Fila mínima que pasa las validaciones obligatorias, para que cada prueba solo
// hable de la columna que le interesa.
const base = {
  codigo_proveedor: 'DIG-001',
  nombre: 'Pantalla LED Reforma 222',
  tipo_medio: 'espectacular',
  exhibicion: 'digital',
  unidad: 'mensual',
  plaza_ciudad: 'Ciudad de Mexico',
  latitud: 19.4283,
  longitud: -99.159,
  tarifa_publicada: 145000,
}

const fila = (over: Record<string, unknown> = {}) => validarFila({ ...base, ...over }, 0)

describe('lectura de la columna', () => {
  it('toma el importe y lo deja en los datos de la fila', () => {
    const f = fila({ renta_arrendador: 45000 })
    expect(f.status).toBe('ok')
    expect(f.datos?.renta_arrendador).toBe(45000)
  })

  it('acepta `costo_arrendador` como sinónimo', () => {
    // Es como lo escribe quien lo piensa como un costo. Rechazar el archivo por
    // el sinónimo sería fricción sin ningún motivo.
    expect(fila({ costo_arrendador: 45000 }).datos?.renta_arrendador).toBe(45000)
  })

  it('lee el importe con coma decimal', () => {
    // `num()` normaliza la coma: en archivos hechos en es-MX/es-ES es frecuente.
    expect(fila({ renta_arrendador: '1250,50' }).datos?.renta_arrendador).toBe(1250.5)
  })
})

describe('compatibilidad con la plantilla vieja', () => {
  it('sin ninguna columna de costo, la fila sigue siendo válida', () => {
    // Las cargas que ya funcionaban deben seguir funcionando: el costo es
    // OPCIONAL. Si esto se rompiera, se rompería todo import existente.
    const f = fila()
    expect(f.status).toBe('ok')
    expect(f.datos?.renta_arrendador).toBeNull()
  })

  it('la columna vacía no genera advertencia', () => {
    // Una celda vacía es «no lo sé todavía», no un error del capturista.
    const f = fila({ renta_arrendador: '' })
    expect(f.status).toBe('ok')
    expect(f.datos?.renta_arrendador).toBeNull()
    expect(f.mensaje).not.toMatch(/renta/i)
  })

  it('`costo_compra` de la plantilla vieja se lee COMO la renta', () => {
    // ADR 0006: es el mismo dinero. Ignorarlo tiraría el único costo que traen
    // los archivos que los clientes ya tienen, y la pantalla entraría sin costo.
    const f = fila({ costo_compra: 82000 })
    expect(f.datos?.renta_arrendador).toBe(82000)
    expect(f.status).toBe('advertencia')
    expect(f.mensaje).toMatch(/costo_compra se registró como la renta/i)
  })

  it('ya no exige `costo_compra` para aceptar la fila', () => {
    // Antes era obligatorio: sin él la fila se rechazaba, lo que forzaba a
    // inventar un número para poder importar.
    expect(fila().status).not.toBe('error')
  })

  it('un `renta_arrendador` vacío NO tapa al `costo_compra` que sí trae importe', () => {
    // La plantilla nueva trae la columna aunque esté vacía, y `sheet_to_json`
    // la entrega como cadena vacía. Con `??` en vez de "primer valor no vacío",
    // este caso perdería el costo en silencio.
    const f = fila({ renta_arrendador: '', costo_compra: 82000 })
    expect(f.datos?.renta_arrendador).toBe(82000)
  })

  it('la columna nueva gana sobre la vieja cuando vienen las dos', () => {
    const f = fila({ renta_arrendador: 45000, costo_compra: 82000 })
    expect(f.datos?.renta_arrendador).toBe(45000)
    expect(f.mensaje).not.toMatch(/costo_compra se registró/i)
  })
})

describe('un valor inservible degrada a pendiente y AVISA', () => {
  it('el cero no se guarda como cero', () => {
    // El caso central. Guardar 0 haría que el espacio pareciera gratis y que el
    // contrato dejara de aparecer como pendiente: el error se volvería invisible.
    const f = fila({ renta_arrendador: 0 })
    expect(f.datos?.renta_arrendador).toBeNull()
    expect(f.status).toBe('advertencia')
    expect(f.mensaje).toMatch(/mayor que cero/i)
  })

  it('un negativo tampoco', () => {
    // `contrato_monto_ck` lo rechazaría en la BD; aquí se atrapa antes y con un
    // mensaje que dice qué pasó.
    const f = fila({ renta_arrendador: -100 })
    expect(f.datos?.renta_arrendador).toBeNull()
    expect(f.status).toBe('advertencia')
  })

  it('un texto que no es número avisa citando lo que venía', () => {
    const f = fila({ renta_arrendador: 'por definir' })
    expect(f.datos?.renta_arrendador).toBeNull()
    expect(f.status).toBe('advertencia')
    expect(f.mensaje).toContain('por definir')
  })

  it('un valor malo NUNCA tumba la fila entera', () => {
    // La pantalla debe entrar al inventario igual: perder la carga completa por
    // una celda de renta mal escrita sería peor que el dato faltante.
    const f = fila({ renta_arrendador: 'x' })
    expect(f.status).not.toBe('error')
    expect(f.datos).not.toBeNull()
    expect(f.datos?.nombre).toBe('Pantalla LED Reforma 222')
  })
})

describe('un solo costo, no dos (ADR 0006)', () => {
  it('la renta no se confunde con la tarifa', () => {
    // El error que más caro sale: la renta es lo que SALE hacia el arrendador,
    // la tarifa lo que ENTRA del cliente. Esas sí son dos cosas distintas.
    const f = fila({ renta_arrendador: 45000, tarifa_publicada: 145000 })
    expect(f.datos?.renta_arrendador).toBe(45000)
    expect(f.datos?.tarifa_publicada).toBe(145000)
  })

  it('`costo_compra` sale como ESPEJO de la renta, no como un costo propio', () => {
    // Mientras exista la columna (Fase 2 la borra), lleva el mismo importe. Dos
    // números distintos era justo el defecto que el ADR 0006 elimina.
    const f = fila({ renta_arrendador: 45000, costo_compra: 82000 })
    expect(f.datos?.costo_compra).toBe(45000)
    expect(f.datos?.costo_compra).toBe(f.datos?.renta_arrendador)
  })

  it('sin renta usable, el espejo es 0 y no el costo del archivo', () => {
    // Copiar el `costo_compra` del archivo aquí reintroduciría el segundo costo:
    // la pantalla quedaría con un costo que el P&L no reconoce.
    const f = fila({ renta_arrendador: 0, costo_compra: 82000 })
    expect(f.datos?.renta_arrendador).toBeNull()
    expect(f.datos?.costo_compra).toBe(0)
  })
})
