//  lib/server/codigos-recuperacion.ts — la última puerta del Dueño.  (ADR 0028)
// ----------------------------------------------------------------------------
//  El ADR 0028 le quita al Dueño de una instancia la contraseña como forma de
//  ENTRAR: entra solo con Google. Estos códigos son lo único que le queda el día
//  que pierda esa cuenta, así que su modo de fallo no es «no funciona»: es
//  «alguien entra sin ser él», o «él no puede entrar nunca más».
//
//  Y resuelven un segundo problema, que es el que hace que el alta se pueda
//  automatizar: **los genera y los ve ÉL, en su navegador**. Nadie de AS OOH ve
//  nunca un secreto suyo, así que el alta deja de tener nada que entregar
//  (ADR 0029 §5).
//
//  ── Por qué sha256 y NO bcrypt, que es lo que se hace con las contraseñas ──
//
//  Una contraseña la elige una persona y tiene poca entropía: bcrypt existe para
//  que probarlas una a una salga caro. Un código de aquí es aleatorio y de ~75
//  bits, así que **la fuerza bruta ya es inviable y el hash lento no compra
//  nada**. Lo que sí costaría es real:
//
//   · bcrypt lleva sal, así que el mismo código da hashes distintos y NO se
//     puede buscar. Habría que traer los N códigos del usuario y compararlos
//     uno a uno: con 10 códigos, casi un segundo de CPU **por cada intento
//     fallido**. Eso es un vector de denegación de servicio regalado, en la
//     ruta que se usa justo cuando alguien no puede entrar.
//   · Con sha256 el hash es determinista, se indexa, y se resuelve de UNA
//     consulta.
//
//  Es el mismo razonamiento con el que F5.8 eligió un token opaco en vez de un
//  JWT firmado: el secreto tiene entropía de sobra, y lo caro sobra.
//
//  Lo que sí se conserva de la disciplina de las contraseñas: **el código nunca
//  se guarda**. La base solo ve el hash, así que un volcado no los revela.

import { createHash, randomInt } from 'node:crypto'

/**
 * Diez. Bastantes para no quedarse sin ellos por usar dos o tres, y pocos para
 * que quepan en una pantalla y en un papel.
 */
export const CUANTOS_CODIGOS = 10

/**
 * El alfabeto, **sin `0` `O` `1` `I` `L`**.
 *
 * Esto se lee de una pantalla y se teclea meses después, quizá desde un papel
 * guardado en un cajón. Esas cinco letras son la mitad de los fallos de tecleo,
 * y un fallo de tecleo aquí es un intento gastado en el peor momento posible.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Tres grupos de cinco: 15 símbolos ≈ 74 bits. */
const GRUPOS = 3
const POR_GRUPO = 5

/**
 * Deja lo que teclea una persona en la forma canónica: mayúsculas y solo el
 * alfabeto.
 *
 * Se cae todo lo demás —guiones, espacios, lo que venga pegado del
 * portapapeles— en vez de rechazarlo: **quien usa esto está teniendo un mal
 * día**, y no es el momento de discutir con él por un espacio.
 *
 * Y se normaliza en UN solo sitio a propósito. Si cada capa normalizara a su
 * manera, la comparación dependería de por dónde entró el código.
 */
export function normalizar(codigo: string): string {
  if (typeof codigo !== 'string') return ''
  const enAlto = codigo.toUpperCase()
  let limpio = ''
  for (const c of enAlto) if (ALFABETO.includes(c)) limpio += c
  return limpio
}

/**
 * El hash con el que se guarda. Cadena vacía si el código no es utilizable.
 *
 * **Devolver `''` y no el sha256 de la cadena vacía es deliberado:** si esto
 * hasheara lo vacío, una fila con ese hash dejaría entrar a cualquiera que
 * mandase el campo en blanco. Quien llame a esto tiene que tratar el `''` como
 * «no hay código», nunca como «un hash más».
 */
export function hashDeCodigo(codigo: string): string {
  const limpio = normalizar(codigo)
  if (!limpio) return ''
  return createHash('sha256').update(limpio, 'utf8').digest('hex')
}

/** Un código suelto, en la forma que se le enseña al Dueño. */
function unCodigo(): string {
  const grupos: string[] = []
  for (let g = 0; g < GRUPOS; g++) {
    let grupo = ''
    for (let i = 0; i < POR_GRUPO; i++) {
      // `randomInt` y no `Math.random()`: esto es un secreto, no un identificador.
      grupo += ALFABETO[randomInt(ALFABETO.length)]
    }
    grupos.push(grupo)
  }
  return grupos.join('-')
}

/**
 * Un lote entero, **sin repetidos**.
 *
 * Un duplicado dentro del lote le quitaría una vida al Dueño sin que nada lo
 * delatara: creería tener diez y tendría nueve.
 */
export function generarCodigos(cuantos: number = CUANTOS_CODIGOS): string[] {
  const vistos = new Set<string>()
  while (vistos.size < cuantos) vistos.add(unCodigo())
  return [...vistos]
}
