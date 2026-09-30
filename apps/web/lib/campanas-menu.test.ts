import { describe, it, expect } from 'vitest'
import { CLAVE_MENU_CAMPANAS, leerMenuPlegado, serializarMenuPlegado } from './campanas-menu'

// ============================================================================
//  Si el menú lateral de campañas (el del detalle/pipeline) está plegado.
//  Pedido del dueño el 2026-09-30: «ese menú también debe de poderse minimizar
//  en TODOS los tamaños de pantalla».
//
//  Lo que se fija aquí es que la preferencia NUNCA esconda el menú por error:
//  viene de localStorage, y localStorage puede traer cualquier cosa. Ante la
//  duda, el menú se ve — que es como estaba antes de este cambio.
// ============================================================================

describe('la clave de localStorage', () => {
  it('es propia y sigue el prefijo del resto de preferencias', () => {
    expect(CLAVE_MENU_CAMPANAS).toBe('spaces:campanas-menu')
  })
})

describe('leer la preferencia guardada', () => {
  it('sin nada guardado: el menú se ve (desplegado)', () => {
    expect(leerMenuPlegado(null)).toBe(false)
    expect(leerMenuPlegado('')).toBe(false)
  })

  it('lo que se guardó vuelve igual, en los dos sentidos', () => {
    expect(leerMenuPlegado(serializarMenuPlegado(true))).toBe(true)
    expect(leerMenuPlegado(serializarMenuPlegado(false))).toBe(false)
  })

  it('basura NO pliega el menú: solo el valor exacto lo hace', () => {
    for (const raro of ['{no es json', 'true', 'si', '2', ' 1', '1 ', 'null', '[]', '{"plegado":true}']) {
      expect(leerMenuPlegado(raro), `«${raro}» no debería plegar el menú`).toBe(false)
    }
  })
})
