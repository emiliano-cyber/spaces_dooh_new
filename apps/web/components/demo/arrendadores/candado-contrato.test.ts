import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ============================================================================
//  «Con cual de tus razones sociales se paga» tiene que PINTAR el campo.
// ----------------------------------------------------------------------------
//  EL DEFECTO, para que no vuelva. Ese cuadro llamaba a `editarContratoApi`, el
//  servidor contestaba 403 con `requiereDesbloqueo` —el PATCH de contratos pasa
//  por `exigirCambioSensible`— y el `catch` pintaba el mensaje del servidor como
//  un error rojo: «Este cambio necesita que vuelvas a teclear tu contrasena.»
//  Y no habia donde teclearla. La palabra `password` no aparecia ni una vez en
//  las 1012 lineas de `ContratoSheet.tsx`. El camino directo estaba muerto y el
//  unico rodeo era salir de la ficha, ir a «Cambios bloqueados», desbloquear y
//  volver.
//
//  QUE SE AFIRMA AQUI, en dos piezas, porque este arnes no tiene DOM:
//
//   §1 · El campo RINDE un `<input type="password">` de verdad. Se rinde el
//        componente real con `react-dom/server`, igual que `ui/Button.test.ts`.
//   §2 · El cuadro del contrato lo USA, y delega el paso en el modulo probado
//        en vez de reescribirlo. Se lee el fuente —como hace
//        `ui/reset-bordes.test.ts` con `demo.css`— porque el modal va dentro de
//        un `Dialog.Portal` de Radix, que en servidor no rinde nada.
//
//  LO QUE NO AFIRMA, dicho con todas las letras: no hay navegador. Aqui no se
//  prueba que al pulsar «Guardar» aparezca el campo, ni que el foco caiga en el.
//  Eso se ve en pantalla o con las e2e, no aqui.
// ============================================================================

const FUENTE = readFileSync(join(__dirname, 'ContratoSheet.tsx'), 'utf8')

/** El cuerpo de `RazonSocialQuePagaModal`, desde su declaracion hasta la del
 *  siguiente componente del archivo. Se acota a proposito: que OTRO modal del
 *  mismo archivo tenga un campo de contrasena no arregla este. */
function cuerpoDelModal(): string {
  const desde = FUENTE.indexOf('function RazonSocialQuePagaModal(')
  expect(desde, 'RazonSocialQuePagaModal desaparecio o se renombro').toBeGreaterThan(-1)
  const hasta = FUENTE.indexOf('function CompletarContratoModal(', desde)
  expect(hasta, 'CompletarContratoModal desaparecio o se renombro').toBeGreaterThan(desde)
  return FUENTE.slice(desde, hasta)
}

// ─── 1 · el campo existe y es de contrasena ─────────────────────────────────
describe('1 · CampoContrasena rinde un input de contrasena de verdad', () => {
  async function html(props: Record<string, unknown> = {}) {
    const { CampoContrasena } = await import('@/components/demo/ui/CampoContrasena')
    return renderToStaticMarkup(
      React.createElement(CampoContrasena as never, { valor: '', onChange: () => {}, ...props }),
    )
  }

  it('sale un <input type="password">', async () => {
    // Esta es la linea que faltaba. Sin ella el cuadro pide algo que no se
    // puede escribir.
    expect(await html()).toContain('type="password"')
  })

  it('NO sale como texto plano', async () => {
    // Un `type="text"` enseñaria la contrasena en pantalla y la ofreceria al
    // autocompletado como si fuera un dato mas.
    const markup = await html()
    expect(markup).not.toContain('type="text"')
  })

  it('le dice al gestor de contrasenas que es la ACTUAL, no una nueva', async () => {
    // `current-password`: sin esto el navegador ofrece generar una nueva, que es
    // justo lo contrario de reautenticarse.
    //
    // Sin distinguir mayusculas a proposito, y MEDIDO el 2026-09-25:
    // `react-dom/server` 18.3.1 serializa este atributo como `autoComplete`, en
    // camelCase —`autofocus`, en cambio, si lo baja—. No es un defecto del
    // componente: los nombres de atributo de HTML no distinguen mayusculas, asi
    // que el navegador lo lee igual. Afirmarlo en minuscula daria un rojo que
    // no dice nada del codigo.
    expect(await html()).toMatch(/autocomplete="current-password"/i)
  })

  it('rinde el valor que le dan, para poder ser controlado', async () => {
    expect(await html({ valor: 'abc123' })).toContain('value="abc123"')
  })

  it('lleva una etiqueta visible, no solo un recuadro', async () => {
    const markup = await html()
    expect(markup).toContain('<label')
    expect(markup).toMatch(/contrase/i)
  })
})

// ─── 2 · el cuadro de la razon social lo usa ────────────────────────────────
describe('2 · el cuadro «con cual de tus razones sociales se paga» pide la clave', () => {
  it('pinta el campo de contrasena', () => {
    // El defecto exacto del 2026-09-25: pedia la contrasena y no la pintaba.
    expect(cuerpoDelModal()).toContain('<CampoContrasena')
  })

  it('delega el paso en `confirmarConCandado` en vez de reescribirlo', () => {
    // Cuarta copia a mano del mismo bailoteo = cuarta ocasion de olvidarse del
    // input. La secuencia esta probada en `lib/cambios-candado.test.ts`.
    expect(cuerpoDelModal()).toContain('confirmarConCandado(')
  })

  it('el boton de guardar no se puede pulsar con la contrasena en blanco', () => {
    // Segunda barrera, la visible. La primera —y la que de verdad corta— es
    // `confirmarConCandado`, que devuelve «falta-contrasena» sin llamar a nada.
    expect(cuerpoDelModal()).toMatch(/disabled=\{[^}]*reautenticando && !pass/)
  })

  it('el archivo importa las dos piezas', () => {
    expect(FUENTE).toContain("from '@/components/demo/ui/CampoContrasena'")
    expect(FUENTE).toContain("from '@/lib/cambios-candado'")
  })
})
