import { describe, it, expect } from 'vitest'
import { direccionDe, remitenteConNombre } from './email-remitente'

// ============================================================================
//  La cabecera `From` de los avisos de operación.
//
//  Lo que se prueba aquí no es «concatena bien un nombre y un correo», sino los
//  dos casos en los que una cabecera mal construida hace daño de verdad:
//
//    · Una razón social mexicana lleva comas y puntos de serie («G500, S.A. de
//      C.V.»). Sin comillas, la coma parte la cabecera en DOS destinatarios y
//      el correo sale mal formado.
//    · Un CR/LF dentro del nombre es inyección de cabeceras. Hoy la API de
//      Resend recibe JSON y serializa por su cuenta, así que no hay hueco
//      explotable — pero el saneado se prueba donde está, no donde hoy da la
//      casualidad de que no hace falta.
// ============================================================================

describe('direccionDe', () => {
  it('saca la dirección de la forma «Nombre <buzon>»', () => {
    expect(direccionDe('Space OS <no-reply@pixeled.com.mx>')).toBe('no-reply@pixeled.com.mx')
  })

  it('acepta también la dirección a secas, que es como puede venir EMAIL_FROM', () => {
    expect(direccionDe('no-reply@pixeled.com.mx')).toBe('no-reply@pixeled.com.mx')
  })

  it('no se rompe con vacío', () => {
    expect(direccionDe('')).toBe('')
  })
})

describe('remitenteConNombre', () => {
  it('presenta el buzón de la plataforma con el nombre de la organización', () => {
    expect(remitenteConNombre('Space OS <no-reply@pixeled.com.mx>', 'G500')).toBe(
      '"G500" <no-reply@pixeled.com.mx>',
    )
  })

  it('el buzón NO cambia: es el dominio verificado, la organización solo pone el nombre', () => {
    // Es la propiedad que sostiene todo el diseño. Si esto dejara de cumplirse,
    // los correos saldrían diciendo venir de un dominio sin SPF/DKIM y los
    // filtros los tratarían como suplantación.
    const from = remitenteConNombre('Space OS <no-reply@pixeled.com.mx>', 'Cualquier Cosa SA')
    expect(direccionDe(from)).toBe('no-reply@pixeled.com.mx')
  })

  it('cita la razón social con coma, que sin comillas partiría la cabecera', () => {
    expect(remitenteConNombre('no-reply@pixeled.com.mx', 'G500, S.A. de C.V.')).toBe(
      '"G500, S.A. de C.V." <no-reply@pixeled.com.mx>',
    )
  })

  it('escapa las comillas del nombre en vez de dejarlas cerrar la cadena', () => {
    expect(remitenteConNombre('no-reply@x.com', 'El "Grupo"')).toBe(
      '"El \\"Grupo\\"" <no-reply@x.com>',
    )
  })

  it('quita CR y LF: un salto de línea en una cabecera es inyección', () => {
    const from = remitenteConNombre('no-reply@x.com', 'G500\r\nBcc: victima@ajeno.com')
    expect(from).not.toContain('\r')
    expect(from).not.toContain('\n')
    expect(from).toBe('"G500Bcc: victima@ajeno.com" <no-reply@x.com>')
  })

  it('sin nombre devuelve la dirección sola, no unas comillas vacías', () => {
    // `"" <buzon>` es válido pero se ve en el cliente de correo de quien lo
    // recibe, y se ve mal.
    expect(remitenteConNombre('Space OS <no-reply@x.com>', '')).toBe('no-reply@x.com')
    expect(remitenteConNombre('Space OS <no-reply@x.com>', '   ')).toBe('no-reply@x.com')
  })

  it('sin EMAIL_FROM configurado devuelve lo que haya, sin fabricar una cabecera', () => {
    expect(remitenteConNombre('', 'G500')).toBe('')
  })
})
