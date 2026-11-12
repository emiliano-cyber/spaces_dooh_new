import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { CAMPOS_PANTALLA, leerCamposOcultos } from './campos-pantalla'

describe('leerCamposOcultos', () => {
  it('vacío o ausente no oculta nada (como antes de existir)', () => {
    expect(leerCamposOcultos(undefined)).toEqual({ ocultos: [], desconocidos: [] })
    expect(leerCamposOcultos('')).toEqual({ ocultos: [], desconocidos: [] })
  })

  it('tolera espacios, mayúsculas y repetidos', () => {
    expect(leerCamposOcultos(' Ubicacion , IMAGEN,imagen ').ocultos).toEqual(['ubicacion', 'imagen'])
  })

  it('el NOMBRE no se puede ocultar, y lo desconocido no oculta nada', () => {
    const r = leerCamposOcultos('nombre,lat,imagen')
    expect(r.ocultos).toEqual(['imagen'])
    expect(r.desconocidos).toEqual(['nombre', 'lat'])
  })
})

describe('la lista del alta y la de la aplicación son la misma', () => {
  // Si `--ocultar-campos-pantalla` aceptara un nombre que la aplicación no
  // conoce, la instancia nacería con ese campo visible sin avisar.
  it('CAMPOS_PANTALLA de entorno-instancia.sh coincide con la de aquí', () => {
    const sh = readFileSync(join(__dirname, '../../../infra/scripts/entorno-instancia.sh'), 'utf8')
    const m = /^CAMPOS_PANTALLA="([^"]*)"/m.exec(sh)
    expect(m, 'falta CAMPOS_PANTALLA en entorno-instancia.sh').not.toBeNull()
    expect(m![1].split(' ')).toEqual([...CAMPOS_PANTALLA])
  })
})
