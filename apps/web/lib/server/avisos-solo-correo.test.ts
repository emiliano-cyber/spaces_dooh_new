import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// ============================================================================
//  AVISOS-CANAL (12/11) · «lo de olvidé contraseña, solo correo».
// ----------------------------------------------------------------------------
//  Decision del dueno. Recuperar la contrasena y la invitacion llevan un
//  enlace para ENTRAR a la cuenta: van siempre por correo, a la direccion de
//  la cuenta, y nunca por el canal que alguien eligio para enterarse de una
//  factura. Hoy es asi; esta prueba es para que el dia que WhatsApp se
//  encienda, nadie «aproveche» y los mande tambien por ahi.
//
//  Lee el FUENTE, como `texto-fijo-spaceeyes.test.ts`: lo que se vigila es que
//  esos archivos no lleguen al reparto por canales, no lo que hacen en runtime.
// ============================================================================

const raiz = path.resolve(__dirname, '..', '..')
const fuente = (rel: string) => readFileSync(path.join(raiz, rel), 'utf8')

const SOLO_CORREO = [
  'app/api/auth/forgot/route.ts',
  'app/api/auth/reset/route.ts',
  'lib/server/usuarios-controller.ts',
]

describe('recuperar contrasena e invitaciones: solo por correo', () => {
  for (const f of SOLO_CORREO) {
    it(`${f} no usa el reparto por canales ni WhatsApp`, () => {
      const s = fuente(f)
      expect(s).not.toMatch(/avisos-canales|avisarPorCanales|enviarWhatsapp|telefono_whatsapp|whatsapp/i)
    })
  }

  it('el correo de recuperacion sale con enviarEmail, a la direccion de la cuenta', () => {
    expect(fuente('app/api/auth/forgot/route.ts')).toMatch(/enviarEmail\(/)
  })

  it('el reparto por canales no conoce los correos de cuenta', () => {
    const s = fuente('lib/server/avisos-canales.ts')
    expect(s).not.toMatch(/htmlCorreoReset|htmlCorreoInvitacion|crearReset/)
  })
})
