import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  El ARRANQUE de una organización no pasa por el guard del Dueño, y eso es
//  DELIBERADO. Esta prueba existe para que siga siéndolo.
// ----------------------------------------------------------------------------
//  ADR 0040 · el guard 3 dice «nadie nombra a un Dueño salvo un Dueño». Pero
//  cuando nace la PRIMERA organización de una instancia **no hay ningún Dueño**
//  que pueda autorizarlo: exigirlo dejaría el producto imposible de instalar.
//
//  La exención no es una bandera ni un `if`, que es lo que la haría frágil: es
//  una separación de caminos.
//
//    · `crearUsuarioCtrl` — el alta CON SESIÓN, desde Administración. Recibe el
//      actor y **aplica el guard**.
//    · `crearOrgConDueno` — el arranque. Llama a `crearUsuario` (el repo)
//      directamente, y **no puede** aplicar el guard porque no hay actor.
//
//  ⚠️ EL RIESGO QUE ESTA PRUEBA CUBRE, y no es hipotético: alguien que quiera
//  «no duplicar el alta» hará que `crearOrgConDueno` llame a `crearUsuarioCtrl`.
//  Es un refactor que parece limpio, deja las dos suites de arranque en rojo con
//  un 403 que no explica nada, y en una instancia real se manifiesta como «el
//  alta no funciona» el día de la instalación. Aquí se ve al instante y con el
//  motivo escrito.
//
//  Se lee el CÓDIGO y no el comportamiento a propósito: lo que hay que fijar es
//  la forma —quién llama a quién—, y eso no se observa desde fuera.
// ============================================================================

const CUENTAS = join(__dirname, 'server', 'cuentas-controller.ts')

// El cuerpo sin comentarios: este archivo MENCIONA `crearUsuarioCtrl` en su
// prosa, y un `toContain` sobre el texto entero casaría con la mención. Es la
// misma trampa que ya se pagó una vez midiendo la migración de los roles.
function codigo(ruta: string): string {
  return readFileSync(ruta, 'utf8')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

describe('el arranque crea su Dueño sin pasar por el guard', () => {
  const src = codigo(CUENTAS)

  it('`crearOrgConDueno` llama al REPO, no al controller de usuarios', () => {
    expect(src).toMatch(/crearUsuario\s*\(/)
  })

  it('y NO llama a `crearUsuarioCtrl` por ninguna vía', () => {
    // Si esto se pone rojo, el arranque acaba de quedar sujeto al guard 3 y una
    // instancia nueva no se puede instalar: no hay Dueño que autorice al primer
    // Dueño.
    expect(src).not.toMatch(/crearUsuarioCtrl/)
  })

  it('importa `crearUsuario` del repo, que es de donde tiene que venir', () => {
    expect(src).toMatch(/import\s*\{[^}]*crearUsuario[^}]*\}\s*from\s*'\.\/usuarios-repo'/)
  })
})
