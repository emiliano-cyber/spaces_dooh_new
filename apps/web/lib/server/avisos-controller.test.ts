import { describe, it, expect, vi, beforeEach } from 'vitest'

// ============================================================================
//  AVISOS-CANAL (12/11) · Configuracion → Avisos, de la cuenta en sesion.
// ============================================================================

const leer = vi.fn()
const guardar = vi.fn()
vi.mock('./avisos-repo', () => ({
  leerAvisosPropios: (...a: unknown[]) => leer(...a),
  guardarAvisosPropios: (...a: unknown[]) => guardar(...a),
}))
let correoConfigurado = false
vi.mock('./avisos-canales', () => ({
  CANALES_QUE_SE_GUARDAN: ['correo'],
  estadoCanales: () => ({ correo: { configurado: correoConfigurado }, whatsapp: { configurado: false, sembrado: true } }),
}))

import { leerAvisosCtrl, guardarAvisosCtrl } from './avisos-controller'
import { MSG_AVISO } from '@/lib/avisos'

beforeEach(() => {
  leer.mockReset()
  guardar.mockReset()
  correoConfigurado = false
})

describe('leerAvisosCtrl', () => {
  it('devuelve lo guardado, los tipos y el estado de cada canal', async () => {
    leer.mockResolvedValue({ activos: [{ tipo: 'PAGO', canal: 'correo' }], telefono: '+525512345678' })
    const r = await leerAvisosCtrl('u1')
    expect(leer).toHaveBeenCalledWith('u1')
    expect(r.activos).toEqual([{ tipo: 'PAGO', canal: 'correo' }])
    expect(r.telefono).toBe('+525512345678')
    expect(r.tipos).toContain('FACTURA')
    expect(r.canales.whatsapp).toEqual({ configurado: false, sembrado: true })
    expect(r.canales.correo).toEqual({ configurado: false })
  })
  it('una cuenta que ya no existe es 404', async () => {
    leer.mockResolvedValue(null)
    await expect(leerAvisosCtrl('u1')).rejects.toMatchObject({ status: 404 })
  })
})

describe('guardarAvisosCtrl', () => {
  it('guarda lo valido para la cuenta de la SESION, no la del cuerpo', async () => {
    guardar.mockResolvedValue(true)
    leer.mockResolvedValue({ activos: [{ tipo: 'FACTURA', canal: 'correo' }], telefono: null })
    await guardarAvisosCtrl('u1', { usuarioId: 'otro', activos: [{ tipo: 'FACTURA', canal: 'correo' }], telefono: '' })
    expect(guardar).toHaveBeenCalledWith('u1', [{ tipo: 'FACTURA', canal: 'correo' }], null)
  })
  it('se puede encender el correo aunque hoy no haya clave', async () => {
    guardar.mockResolvedValue(true)
    leer.mockResolvedValue({ activos: [], telefono: null })
    await expect(guardarAvisosCtrl('u1', { activos: [{ tipo: 'OT', canal: 'correo' }] })).resolves.toBeTruthy()
  })
  it('WhatsApp todavia no: 400 con el mensaje, y no guarda nada', async () => {
    await expect(guardarAvisosCtrl('u1', { activos: [{ tipo: 'OT', canal: 'whatsapp' }] })).rejects.toMatchObject({
      status: 400,
      message: MSG_AVISO.whatsapp,
    })
    expect(guardar).not.toHaveBeenCalled()
  })
  it('un telefono mal escrito: 400 y no guarda', async () => {
    await expect(guardarAvisosCtrl('u1', { activos: [], telefono: '5512345678' })).rejects.toMatchObject({ status: 400 })
    expect(guardar).not.toHaveBeenCalled()
  })
  it('si la fila no se toco, la cuenta dejo de existir: 404', async () => {
    guardar.mockResolvedValue(false)
    await expect(guardarAvisosCtrl('u1', { activos: [] })).rejects.toMatchObject({ status: 404 })
  })
})
