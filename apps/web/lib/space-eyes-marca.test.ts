import { describe, expect, it } from 'vitest'
import {
  cajaMarca,
  crc32,
  crearZip,
  dibujarMarca,
  giroDeFoto,
  lienzoGirado,
  lineasMarca,
  marcaDeFoto,
  medidasMarca,
  nombreDescarga,
  nombreEnZip,
  nombresUnicos,
  parsearEstilo,
  type Contexto2D,
  type FotoConMarca,
} from './space-eyes-marca'

const base: FotoConMarca = {
  id: 7,
  storage_path: '/storage/photos/4/abc.jpg?exp=1&sig=x',
  taken_at: '2026-10-01T15:30:05Z',
  device_name: 'Reforma 222',
  watermark_baked: 0,
  overlay_enabled: 1,
  overlay_x: 20,
  overlay_y: 10,
  overlay_style: '{"size":1.5,"color":"#ff0"}',
}

function ctxFalso() {
  const llamadas: { op: string; args: unknown[] }[] = []
  const ctx = {
    font: '',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    fillStyle: '',
    shadowColor: '',
    shadowBlur: 0,
    letterSpacing: '0px',
    measureText: (t: string) => ({ width: t.length * 10 }) as TextMetrics,
    beginPath: () => llamadas.push({ op: 'beginPath', args: [] }),
    moveTo: (...a: unknown[]) => llamadas.push({ op: 'moveTo', args: a }),
    arcTo: (...a: unknown[]) => llamadas.push({ op: 'arcTo', args: a }),
    closePath: () => llamadas.push({ op: 'closePath', args: [] }),
    fill: () => llamadas.push({ op: 'fill', args: [] }),
    fillText: (...a: unknown[]) => llamadas.push({ op: 'fillText', args: a }),
  }
  return { ctx: ctx as unknown as Contexto2D & typeof ctx, llamadas }
}

describe('marcaDeFoto', () => {
  it('dibuja la marca en fotos limpias con la posición y el estilo del equipo', () => {
    const m = marcaDeFoto(base)!
    expect(m.pos).toEqual({ x: 20, y: 10 })
    expect(m.estilo).toEqual({ size: 1.5, color: '#ff0' })
    expect(m.lineas[0]).toBe('Reforma 222')
    expect(m.lineas).toHaveLength(3)
  })
  it('no dibuja nada si la foto ya trae la marca quemada o está desactivada', () => {
    expect(marcaDeFoto({ ...base, watermark_baked: 1 })).toBeNull()
    expect(marcaDeFoto({ ...base, watermark_baked: null })).toBeNull()
    expect(marcaDeFoto({ ...base, overlay_enabled: 0 })).toBeNull()
    expect(marcaDeFoto({ ...base, overlay_enabled: false })).toBeNull()
  })
  it('usa 50 / 92 por omisión y tolera un estilo ilegible', () => {
    const m = marcaDeFoto({ ...base, overlay_x: null, overlay_y: null, overlay_style: '{roto' })!
    expect(m.pos).toEqual({ x: 50, y: 92 })
    expect(m.estilo).toBeNull()
  })
})

describe('lineasMarca', () => {
  it('cae a SPACE EYE sin nombre y omite la fecha si no hay', () => {
    expect(lineasMarca({ taken_at: null, device_name: null })).toEqual(['SPACE EYE'])
  })
})

describe('parsearEstilo', () => {
  it('acepta objeto, texto JSON o nada', () => {
    expect(parsearEstilo({ bg: false })).toEqual({ bg: false })
    expect(parsearEstilo('{"bg":false}')).toEqual({ bg: false })
    expect(parsearEstilo(null)).toBeNull()
    expect(parsearEstilo('null')).toBeNull()
  })
})

describe('giro', () => {
  it('solo acepta 90, 180 y 270', () => {
    expect(giroDeFoto({ display_rotation: 90 })).toBe(90)
    expect(giroDeFoto({ display_rotation: '270' })).toBe(270)
    expect(giroDeFoto({ display_rotation: 45 })).toBe(0)
    expect(giroDeFoto(null)).toBe(0)
  })
  it('intercambia ancho y alto a 90 y 270', () => {
    expect(lienzoGirado(400, 300, 90)).toEqual({ ancho: 300, alto: 400 })
    expect(lienzoGirado(400, 300, 450)).toEqual({ ancho: 300, alto: 400 })
    expect(lienzoGirado(400, 300, 180)).toEqual({ ancho: 400, alto: 300 })
  })
})

describe('medidas y caja', () => {
  it('el tamaño de letra escala con el ancho y nunca baja de 12', () => {
    expect(medidasMarca(4200, null).fs).toBe(120)
    expect(medidasMarca(100, null).fs).toBe(12)
    expect(medidasMarca(4200, { size: 2 }).fs).toBe(200)
  })
  it('la caja se acota a 6 px de los bordes', () => {
    expect(cajaMarca(1000, 1000, 200, 100, { x: 0, y: 0 })).toEqual({ x: 6, y: 6 })
    expect(cajaMarca(1000, 1000, 200, 100, { x: 100, y: 100 })).toEqual({ x: 794, y: 894 })
    expect(cajaMarca(1000, 1000, 200, 100, { x: 50, y: 50 })).toEqual({ x: 400, y: 450 })
  })
})

describe('dibujarMarca', () => {
  it('pinta fondo y una línea de texto por renglón', () => {
    const { ctx, llamadas } = ctxFalso()
    dibujarMarca(ctx, 4200, 3000, ['a', null, 'bb'], { x: 50, y: 50 }, null)
    expect(llamadas.filter((l) => l.op === 'fill')).toHaveLength(1)
    const textos = llamadas.filter((l) => l.op === 'fillText')
    expect(textos.map((t) => t.args[0])).toEqual(['a', 'bb'])
    expect(ctx.font).toBe('bold 120px Arial, Helvetica, sans-serif')
    expect(ctx.shadowBlur).toBe(0)
    expect(ctx.textAlign).toBe('left')
  })
  it('sin fondo no rellena caja; sin líneas no hace nada', () => {
    const a = ctxFalso()
    dibujarMarca(a.ctx, 1000, 1000, ['x'], null, { bg: false, weight: 'normal' })
    expect(a.llamadas.some((l) => l.op === 'fill')).toBe(false)
    expect(a.ctx.font.startsWith('bold')).toBe(false)
    const b = ctxFalso()
    dibujarMarca(b.ctx, 1000, 1000, [], null, null)
    expect(b.llamadas).toHaveLength(0)
  })
})

describe('nombres', () => {
  it('quita la firma del nombre dentro del zip', () => {
    expect(nombreEnZip(base)).toBe('abc.jpg')
    expect(nombreEnZip({ id: 3, storage_path: '' })).toBe('photo_3.jpg')
  })
  it('arma el nombre de descarga con el equipo y la hora', () => {
    expect(nombreDescarga(base)).toBe('Reforma_222_2026-10-01T15-30-05.jpg')
  })
  it('no deja que dos fotos se pisen', () => {
    expect(nombresUnicos(['a.jpg', 'A.jpg', 'b.jpg', 'a.jpg'])).toEqual(['a.jpg', 'A (2).jpg', 'b.jpg', 'a (3).jpg'])
  })
})

describe('crearZip', () => {
  it('crc32 conocido', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })
  it('arma un zip con cabeceras locales, directorio central y cierre', () => {
    const datos = new TextEncoder().encode('hola')
    const zip = crearZip([{ nombre: 'a.jpg', datos }, { nombre: 'b.jpg', datos }], new Date(2026, 9, 1, 12, 0, 0))
    const v = new DataView(zip.buffer)
    expect(v.getUint32(0, true)).toBe(0x04034b50)
    const fin = zip.length - 22
    expect(v.getUint32(fin, true)).toBe(0x06054b50)
    expect(v.getUint16(fin + 10, true)).toBe(2)
    const inicioCentral = v.getUint32(fin + 16, true)
    expect(inicioCentral).toBe(2 * (30 + 5 + 4))
    expect(v.getUint32(inicioCentral, true)).toBe(0x02014b50)
    expect(v.getUint32(inicioCentral + 16, true)).toBe(crc32(datos))
  })
})
