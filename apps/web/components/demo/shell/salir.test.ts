import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cerrarSesionYSalir, RUTA_LOGIN } from './salir'

// B64 (supervision de IDIOMA-USUARIO, 04/11). Al cerrar sesion, la pantalla de
// entrar se quedaba en el idioma de la CUENTA que acababa de salir: el Topbar
// navegaba con `router.push('/login')`, que no vuelve a pintar el layout raiz
// —quien lleva el idioma—, asi que en un equipo compartido la siguiente persona
// veia «Accedi» o «Sign in» hasta recargar. El logout ya borra la cookie de la
// cuenta; lo que faltaba era una carga COMPLETA para que el servidor resuelva
// el idioma otra vez sin ella.

describe('cerrarSesionYSalir', () => {
  it('cierra la sesion y DESPUES hace una carga completa de la pantalla de entrar', async () => {
    const orden: string[] = []
    const cerrar = vi.fn(async () => { orden.push('cerrar') })
    const ir = vi.fn((url: string) => { orden.push(`ir ${url}`) })
    await cerrarSesionYSalir({ cerrar, ir })
    expect(orden).toEqual(['cerrar', `ir ${RUTA_LOGIN}`])
  })

  it('la ruta lleva el basePath y la barra final: es una URL del navegador, no del router', () => {
    expect(RUTA_LOGIN).toBe('/spaces-dooh/login/')
  })

  it('aunque el logout falle, sale igual: quedarse dentro con la sesion a medias es peor', async () => {
    const ir = vi.fn()
    await cerrarSesionYSalir({ cerrar: async () => { throw new Error('red') }, ir })
    expect(ir).toHaveBeenCalledWith(RUTA_LOGIN)
  })

  it('el Topbar sale por aqui y no por router.push', () => {
    const fuente = readFileSync(join(__dirname, 'Topbar.tsx'), 'utf8')
    expect(fuente).toMatch(/cerrarSesionYSalir\(/)
    expect(fuente).not.toMatch(/router\.push\(\s*['"]\/login/)
  })
})
