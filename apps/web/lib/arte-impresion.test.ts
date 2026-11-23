import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { ARTE_IMPRESION_MAX_MB, topeArteMb, cuerpoArte, lonasDeCampana, NGINX_ARTE_MAX } from './arte-impresion'
import { IMAGEN_CREATIVO_MAX_MB } from './creativo-html'

const MB = 1024 * 1024
const RAIZ = path.resolve(__dirname, '../../..')

describe('topeArteMb', () => {
  it('una campaña FIJA (OOH) sube arte de impresión hasta el tope grande', () => {
    expect(topeArteMb('OOH')).toBe(ARTE_IMPRESION_MAX_MB)
    expect(ARTE_IMPRESION_MAX_MB).toBeGreaterThan(IMAGEN_CREATIVO_MAX_MB)
  })
  it('híbrida, digital o desconocida se queda en el tope de siempre (va también a pantallas)', () => {
    expect(topeArteMb('HIBRIDA')).toBe(IMAGEN_CREATIVO_MAX_MB)
    expect(topeArteMb('DOOH')).toBe(IMAGEN_CREATIVO_MAX_MB)
    expect(topeArteMb(null)).toBe(IMAGEN_CREATIVO_MAX_MB)
  })
  it('el tope grande es el mismo que ya acepta el servidor para `archivoUrl` (uploads.ts)', () => {
    const src = readFileSync(path.join(__dirname, 'server/uploads.ts'), 'utf8')
    const m = /creatividadImagen:\s*\{[^}]*maxMB:\s*(\d+)/.exec(src)
    expect(Number(m?.[1])).toBe(ARTE_IMPRESION_MAX_MB)
  })
})

describe('cuerpoArte', () => {
  const base = { campanaId: 'c1', nombre: 'lona.jpg', dataUrl: 'data:image/jpeg;base64,AAAA', tipo: 'image/jpeg' }
  it('hasta el tope de siempre va ENVUELTA en HTML, como hoy (compatible con el player)', () => {
    const c = cuerpoArte({ ...base, bytes: 3 * MB })
    expect(c.formato).toBe('text/html')
    expect(c.codigo).toContain('data:image/jpeg;base64,AAAA')
    expect(c.archivoUrl).toBeUndefined()
  })
  it('por encima va como imagen SOLA en `archivoUrl`: la envoltura la guardaría dos veces', () => {
    const c = cuerpoArte({ ...base, bytes: 10 * MB })
    expect(c.archivoUrl).toBe(base.dataUrl)
    expect(c.formato).toBe('image/jpeg')
    expect(c.codigo).toBeUndefined()
  })
})

describe('lonasDeCampana', () => {
  const sitios = [
    { id: 's1', nombre: 'Insurgentes', tipoMedio: 'ESPECTACULAR', ancho: 12.9, alto: 7.2 },
    { id: 's2', nombre: 'Pantalla Reforma', tipoMedio: 'PANTALLA_DIGITAL', ancho: 10, alto: 5 },
    { id: 's3', nombre: 'Muro sin medida', tipoMedio: 'MURO', ancho: null, alto: null },
    { id: 's4', nombre: 'Muro', tipoMedio: 'MURO', ancho: 3, alto: 9 },
  ]
  const reservas = [
    { campanaId: 'c1', sitioId: 's1' },
    { campanaId: 'c1', sitioId: 's2' },
    { campanaId: 'c1', sitioId: 's3' },
    { campanaId: 'c2', sitioId: 's4' },
  ]
  it('los sitios FIJOS con medida de la campaña; ni pantallas digitales ni sitios sin medida', () => {
    expect(lonasDeCampana('c1', reservas, sitios, [])).toEqual([
      { id: 's1', nombre: 'Insurgentes', ancho: 12.9, alto: 7.2, requisitos: null },
    ])
  })
  it('la medida de la orden de impresión manda sobre la del sitio', () => {
    const ois = [{ campanaId: 'c1', sitioId: 's1', ancho: 6, alto: 3 }]
    expect(lonasDeCampana('c1', reservas, sitios, ois)[0]).toEqual({ id: 's1', nombre: 'Insurgentes', ancho: 6, alto: 3, requisitos: null })
  })
  it('IMP-REQ · la lona trae los requisitos de la imprenta de su orden', () => {
    const ois = [{ campanaId: 'c1', sitioId: 's1', ancho: 6, alto: 3, imprentaRequisitos: { dpiGranVerde: 25 } }]
    expect(lonasDeCampana('c1', reservas, sitios, ois)[0].requisitos).toEqual({ dpiGranVerde: 25 })
  })
})

describe('nginx deja pasar el arte de impresión, y solo ese', () => {
  // 15 MB de imagen en base64 son 20 MB de JSON: el corte general de 12M lo
  // rechazaría en nginx, antes de llegar a la app.
  const ARCHIVOS = ['infra/nginx/instancia.conf.tpl', 'infra/nginx/demo.space-os.io.conf', 'infra/nginx/padre-ip.conf', 'infra/nginx/space-os.io.conf']
  it('el tope de nginx cubre la imagen en base64 más el sobre', () => {
    expect(NGINX_ARTE_MAX * MB).toBeGreaterThan(Math.ceil((ARTE_IMPRESION_MAX_MB * MB * 4) / 3) + 64 * 1024)
  })
  for (const f of ARCHIVOS) {
    it(`${f}: cada bloque con 12M lleva la excepción de /api/creatividades a ${NGINX_ARTE_MAX}M`, () => {
      const s = readFileSync(path.join(RAIZ, f), 'utf8')
      const generales = s.match(/^\s*client_max_body_size 12M;/gm)?.length ?? 0
      const excepciones = [
        ...s.matchAll(/location ~ \^\/spaces-dooh\/api\/creatividades\/\?\$ \{\s*client_max_body_size (\d+)M;\s*proxy_pass http:\/\/[a-z_]+;\s*\}/g),
      ]
      expect(generales).toBeGreaterThan(0)
      expect(excepciones.length).toBe(generales)
      for (const e of excepciones) expect(Number(e[1])).toBe(NGINX_ARTE_MAX)
    })
  }
})
