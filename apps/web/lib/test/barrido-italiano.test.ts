import { describe, it, expect } from 'vitest'
import { culpablesEnItaliano } from './barrido-italiano'

// Lote L5 del italiano (2026-11-03): el barrido tiene que morder en los dos
// sentidos y no dar falsos positivos con lo que se dice igual.
const DIC = {
  es: { a: 'Guardar los cambios', b: 'Dashboard', c: 'Hola {nombre}, bienvenido' },
  en: { a: 'Save the changes', b: 'Dashboard', c: 'Hello {nombre}, welcome' },
  it: { a: 'Salva le modifiche', b: 'Dashboard', c: 'Ciao {nombre}, benvenuto' } as Partial<Record<string, string>>,
}

describe('culpablesEnItaliano', () => {
  it('limpio con el italiano', () => {
    expect(culpablesEnItaliano('<p>Salva le modifiche</p><p>Dashboard</p>', DIC)).toEqual([])
  })
  it('caza una frase espanola y una inglesa (la caida)', () => {
    expect(culpablesEnItaliano('<p>Guardar los cambios</p><b title="Save the changes">x</b>', DIC)).toEqual([
      'es · a · «Guardar los cambios»',
      'en · a · «Save the changes»',
    ])
  })
  it('parte por los huecos y respeta `ignorar`', () => {
    expect(culpablesEnItaliano('<p>Hello Ana, welcome</p>', { ...DIC }, { minimo: 6 })).toEqual(['en · c · «, welcome»'])
    expect(culpablesEnItaliano('<p>Guardar los cambios</p>', DIC, { ignorar: ['Guardar los cambios'] })).toEqual([])
  })
})
