import { describe, expect, it } from 'vitest'
import {
  generarCodigos,
  normalizar,
  hashDeCodigo,
  CUANTOS_CODIGOS,
} from './codigos-recuperacion'

// ============================================================================
//  Los códigos de recuperación del Dueño.  (B1 · ADR 0028)
// ----------------------------------------------------------------------------
//  Es la única puerta que le queda al Dueño de una instancia el día que pierda
//  su cuenta de Google, porque el ADR 0028 le quita la contraseña como forma de
//  entrar. Así que aquí no se prueba que «funcione»: se prueba que **no se
//  pueda entrar sin un código**, que **el mismo no valga dos veces** y que **el
//  código nunca quede escrito en ningún sitio**.
//
//  Esta parte es pura: no toca base de datos. La que sí la toca va en el repo,
//  con sus e2e — las unitarias simulan la base y NO ven los fallos de RLS.
// ============================================================================

describe('generar los códigos', () => {
  it('genera los que dice la constante, y no un número suelto por ahí', () => {
    expect(generarCodigos()).toHaveLength(CUANTOS_CODIGOS)
  })

  it('nunca repite uno en el mismo lote', () => {
    // Un lote con un duplicado le quita una vida al Dueño sin que se note.
    const codigos = generarCodigos()
    expect(new Set(codigos).size).toBe(codigos.length)
  })

  it('dos lotes seguidos no comparten ningún código', () => {
    const a = new Set(generarCodigos())
    const b = generarCodigos()
    expect(b.some((c) => a.has(c))).toBe(false)
  })

  it('tienen entropía de sobra: al menos 60 bits por código', () => {
    // Se comprueba la FORMA, que es lo que fija la entropía. Un código de
    // recuperación débil es una contraseña sin cambio forzado y para siempre.
    for (const c of generarCodigos()) {
      const utiles = c.replace(/-/g, '')
      expect(utiles.length).toBeGreaterThanOrEqual(12)
      // Base32 sin letras ambiguas: 32 símbolos → 5 bits cada uno.
      expect(utiles.length * 5).toBeGreaterThanOrEqual(60)
    }
  })

  it('no traen caracteres que se confundan al copiarlos a mano', () => {
    // Esto se lee de una pantalla y se teclea meses después, quizá desde papel.
    // `0`/`O` y `1`/`I`/`L` son la mitad de los fallos de tecleo.
    for (const c of generarCodigos()) {
      expect(c).not.toMatch(/[01OIL]/)
      expect(c).toMatch(/^[A-Z2-9-]+$/)
    }
  })
})

describe('normalizar lo que teclea una persona', () => {
  it('acepta minúsculas: nadie respeta las mayúsculas al teclear', () => {
    expect(normalizar('abcde-fghjk')).toBe('ABCDEFGHJK')
  })

  it('acepta con guiones y sin guiones, que es como se copia y se pega', () => {
    expect(normalizar('ABCDE-FGHJK')).toBe(normalizar('ABCDEFGHJK'))
  })

  it('se come los espacios de sobra, incluidos los del portapapeles', () => {
    expect(normalizar('  ABCDE - FGHJK  ')).toBe('ABCDEFGHJK')
  })

  it('lo que no sea del alfabeto se cae, no se cuela', () => {
    // Si esto dejara pasar caracteres raros, la comparación dependería de cómo
    // los normalice cada capa — y ahí es donde se cuelan las sorpresas.
    expect(normalizar("AB@#$%C';D E")).toBe('ABCDE')
    expect(normalizar('AB<script>C')).toBe('ABSCRPTC')
  })

  it('y las letras ambiguas TAMBIEN se caen, que es lo menos evidente', () => {
    // `0` `O` `1` `I` `L` no estan en el alfabeto: quien teclee una `O` donde
    // habia un `0` no existe aqui, porque ninguno de los dos existe. Lo que no
    // puede pasar es que una de ellas SOBREVIVA y cambie el hash.
    expect(normalizar('ABOIL01CDE')).toBe('ABCDE')
  })

  it('lo que no es texto no revienta', () => {
    expect(normalizar(null as unknown as string)).toBe('')
    expect(normalizar(undefined as unknown as string)).toBe('')
    expect(normalizar(12345 as unknown as string)).toBe('')
  })
})

describe('el hash con el que se guarda', () => {
  it('es determinista: el mismo código da el mismo hash', () => {
    // Y por eso se puede buscar de UNA consulta, en vez de comparar N hashes
    // lentos por intento. Ver la cabecera del módulo.
    expect(hashDeCodigo('ABCDE-FGHJK')).toBe(hashDeCodigo('ABCDE-FGHJK'))
  })

  it('normaliza antes de hashear: minúsculas y guiones dan el mismo hash', () => {
    expect(hashDeCodigo('abcde-fghjk')).toBe(hashDeCodigo('ABCDEFGHJK'))
  })

  it('códigos distintos dan hashes distintos', () => {
    expect(hashDeCodigo('ABCDE-FGHJK')).not.toBe(hashDeCodigo('ABCDE-FGHJM'))
  })

  it('NO contiene el código: es lo único que impide que un volcado los revele', () => {
    const codigo = 'ABCDE-FGHJK'
    const h = hashDeCodigo(codigo)
    expect(h).not.toContain(codigo)
    expect(h).not.toContain(normalizar(codigo))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('un código vacío no produce un hash utilizable', () => {
    // Si esto devolviera el sha256 de la cadena vacía, una fila con ese hash
    // dejaría entrar a cualquiera que mandase el campo en blanco.
    expect(hashDeCodigo('')).toBe('')
    expect(hashDeCodigo('   ')).toBe('')
    expect(hashDeCodigo('!!!')).toBe('')
  })
})
