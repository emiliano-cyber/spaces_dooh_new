import { describe, it, expect } from 'vitest'
// @ts-expect-error — módulo .mjs sin tipos, como el resto de `apps/flota`
import { esDeNuestraZona, zonaDe, crearRegistroA } from './dns.mjs'

// ============================================================================
//  El registro A en Cloudflare.  (ADR 0027)
//
//  Solo se toca el DNS de una zona que AS OOH controla. Si el dominio es del
//  owner, el alta se para y espera -- esa es la parte "soberana" del modelo y no
//  se automatiza porque no es nuestra.
//
//  Y la lección de dos horas del 2026-09-03 vive aquí dentro: PROXY APAGADO.
// ============================================================================

const ZONAS = { 'space-os.io': 'zona-abc123' }

function cloudflareFalso(respuesta: any = { success: true, result: { id: 'rec1' } }, status = 200) {
  const llamadas: any[] = []
  const pedir = async (url: string, opciones: any) => {
    llamadas.push({ url, opciones, cuerpo: JSON.parse(opciones.body) })
    return { ok: status < 400, status, json: async () => respuesta }
  }
  return { pedir, llamadas }
}

describe('de quién es el dominio', () => {
  it('reconoce lo que cuelga de una zona nuestra', () => {
    expect(esDeNuestraZona('ensayo.space-os.io', ZONAS)).toBe(true)
    expect(zonaDe('ensayo.space-os.io', ZONAS)).toBe('zona-abc123')
  })

  it('el dominio de un owner NO es nuestro', () => {
    expect(esDeNuestraZona('space-os.pixeled.com.mx', ZONAS)).toBe(false)
    expect(zonaDe('space-os.pixeled.com.mx', ZONAS)).toBeNull()
  })

  it('y no se deja engañar por un nombre que TERMINA parecido', () => {
    // `space-os.io.malo.com` no cuelga de nuestra zona. Comparar por sufijo sin
    // el punto sería regalarle a cualquiera un registro en nuestra cuenta.
    expect(esDeNuestraZona('space-os.io.malo.com', ZONAS)).toBe(false)
    expect(esDeNuestraZona('nospace-os.io', ZONAS)).toBe(false)
  })

  it('la zona misma cuenta como nuestra', () => {
    expect(esDeNuestraZona('space-os.io', ZONAS)).toBe(true)
  })
})

describe('el registro se crea con el proxy APAGADO', () => {
  it('proxied va en false, siempre', async () => {
    // Dos horas el 2026-09-03 esperando un registro que existía pero resolvía a
    // Cloudflare. Con el proxy encendido el certificado se pediría sobre una
    // máquina que no es la del owner. Por eso esto está en el código y no en la
    // cabeza de quien rellena el formulario.
    const cf = cloudflareFalso()
    await crearRegistroA('ensayo.space-os.io', '157.245.143.158', {
      zonas: ZONAS,
      token: 'tok',
      pedir: cf.pedir,
    })
    expect(cf.llamadas[0].cuerpo.proxied).toBe(false)
    expect(cf.llamadas[0].cuerpo.type).toBe('A')
    expect(cf.llamadas[0].cuerpo.name).toBe('ensayo.space-os.io')
    expect(cf.llamadas[0].cuerpo.content).toBe('157.245.143.158')
  })

  it('va a la zona correcta', async () => {
    const cf = cloudflareFalso()
    await crearRegistroA('ensayo.space-os.io', '1.2.3.4', { zonas: ZONAS, token: 'tok', pedir: cf.pedir })
    expect(cf.llamadas[0].url).toContain('zona-abc123')
  })
})

describe('lo que NO hace', () => {
  it('se niega a tocar un dominio que no es de una zona nuestra', async () => {
    const cf = cloudflareFalso()
    await expect(
      crearRegistroA('space-os.pixeled.com.mx', '1.2.3.4', { zonas: ZONAS, token: 'tok', pedir: cf.pedir }),
    ).rejects.toThrow(/zona/i)
    expect(cf.llamadas, 'ni siquiera se llama a Cloudflare').toHaveLength(0)
  })

  it('sin token, para antes de llamar', async () => {
    const cf = cloudflareFalso()
    await expect(
      crearRegistroA('ensayo.space-os.io', '1.2.3.4', { zonas: ZONAS, token: '', pedir: cf.pedir }),
    ).rejects.toThrow(/CLOUDFLARE/)
    expect(cf.llamadas).toHaveLength(0)
  })

  it('una IP que no es una IP no se manda', async () => {
    const cf = cloudflareFalso()
    for (const mala of ['no-una-ip', '1.2.3', '999.1.1.1', '1.2.3.4; id', '']) {
      await expect(
        crearRegistroA('ensayo.space-os.io', mala, { zonas: ZONAS, token: 'tok', pedir: cf.pedir }),
      ).rejects.toThrow()
    }
    expect(cf.llamadas).toHaveLength(0)
  })
})

describe('cuando Cloudflare dice que no', () => {
  it('el error se propaga con su motivo', async () => {
    const cf = cloudflareFalso({ success: false, errors: [{ code: 81057, message: 'Record already exists.' }] })
    await expect(
      crearRegistroA('ensayo.space-os.io', '1.2.3.4', { zonas: ZONAS, token: 'tok', pedir: cf.pedir }),
    ).rejects.toThrow(/already exists/)
  })

  it('pero el TOKEN nunca aparece en el error', async () => {
    // Este mensaje acaba en el registro del alta, que el panel enseña en una
    // pagina web.
    const cf = cloudflareFalso({ success: false, errors: [{ message: 'nope' }] }, 403)
    try {
      await crearRegistroA('ensayo.space-os.io', '1.2.3.4', {
        zonas: ZONAS,
        token: 'TOKEN-SECRETO-DE-CLOUDFLARE',
        pedir: cf.pedir,
      })
      expect.unreachable('deberia haber lanzado')
    } catch (e: any) {
      expect(e.message).not.toContain('TOKEN-SECRETO-DE-CLOUDFLARE')
    }
  })
})
