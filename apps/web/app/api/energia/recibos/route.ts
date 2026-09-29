import { NextResponse } from 'next/server'
import { exigir } from '@/lib/server/auth'
import { respuestaError } from '@/lib/server/errores'
import { AppError } from '@/lib/server/errores'
import {
  MAXIMO_ARCHIVOS,
  MESES_ESPERADOS_VALIDOS,
  interpretarRecibosCtrl,
} from '@/lib/server/recibos-cfe/controller'
import { MAXIMO_BYTES } from '@/lib/server/recibos-cfe/lector-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ============================================================================
//  POST /api/energia/recibos — subir los PDF del recibo de CFE y PROPONER.
// ----------------------------------------------------------------------------
//  **NO GUARDA NADA.** Devuelve propuestas para que una persona las confirme, y
//  el alta sigue siendo `POST /api/energia/consumos`, que es el camino que ya
//  tiene su validacion, su indice unico y su `registrarAccion`. Abrir un
//  segundo camino de escritura habria que auditarlo aparte, y el primer fallo
//  de aislamiento de este repo entro justo por un camino que nadie miraba.
//
//  ─── EL PERMISO ES `operaciones.crear` Y NO `.ver`, Y ES A PROPOSITO ─────
//  Esta ruta no escribe, asi que `ver` bastaria para el verbo. Pero lo que
//  devuelve NO es una lectura del inventario: es el borrador de un alta, con el
//  predio al que iria cada recibo y las cifras que se guardarian. Quien no
//  puede capturar no tiene nada que hacer con eso. Se pide el permiso de la
//  ACCION que empieza, no el del verbo HTTP.
//
//  Quien captura es OPERACIONES, por la decision del dueño del 2026-09-18 («la
//  hace operaciones»), igual que el resto de `/api/energia`.
//
//  ─── ESTO RECIBE ARCHIVOS DE FUERA ──────────────────────────────────────
//  Tres cortes, y los tres ANTES de que el archivo llegue a la libreria de PDF:
//  cuantos archivos (`MAXIMO_ARCHIVOS`), cuanto pesa cada uno y cuanto pesa la
//  tanda entera. Sin el ultimo, 40 archivos de 19 MB pasan los dos primeros
//  cortes y son 760 MB en memoria — en la instancia de un cliente eso no es un
//  error de validacion, es el droplet caido.
// ============================================================================

/** Lo que puede pesar la tanda entera, sumada. */
const MAXIMO_TANDA = 60 * 1024 * 1024

export async function POST(req: Request) {
  const g = await exigir('operaciones', 'crear')
  if (!g.ok) return NextResponse.json({ error: g.error }, { status: g.status })
  try {
    const formulario = await req.formData().catch(() => {
      throw new AppError('Manda los PDF como formulario, en el campo `archivos`.', 400)
    })

    // Los meses que la persona DECLARO antes de elegir los archivos. Es una
    // expectativa, no una instruccion: el reparto sale del PDF pase lo que pase
    // (ver `recibos-cfe/propuesta.ts`). Opcional: sin el, no se compara nada.
    const crudoMeses = formulario.get('mesesEsperados')
    let mesesEsperados: number | null = null
    if (typeof crudoMeses === 'string' && crudoMeses.trim() !== '') {
      const n = Number(crudoMeses)
      // Dos comprobaciones y cada una tapa una cosa distinta:
      //
      //  · `Number.isInteger` y NO un `parseInt`: `parseInt('3 meses')` daria 3
      //    y aceptaria en silencio un valor que nadie escribio a proposito.
      //  · El rango, AQUI y antes de leer un solo archivo a memoria: con 40
      //    adjuntos de hasta 20 MB, rechazar despues de bufearlos es regalar el
      //    trabajo.
      //
      // El controller lo vuelve a comprobar por su cuenta. No es duplicacion:
      // es defensa en profundidad, porque a el se le puede llamar desde otro
      // sitio que no pase por esta ruta.
      if (!Number.isInteger(n) || !MESES_ESPERADOS_VALIDOS.includes(n as 1)) {
        throw new AppError(
          `Los meses esperados tienen que ser ${MESES_ESPERADOS_VALIDOS.join(', ')}.`,
          400,
        )
      }
      mesesEsperados = n
    }

    const partes = formulario.getAll('archivos')
    if (partes.length === 0) throw new AppError('No llego ningun archivo.', 400)
    if (partes.length > MAXIMO_ARCHIVOS) {
      throw new AppError(
        `Son ${partes.length} archivos y el maximo por tanda es ${MAXIMO_ARCHIVOS}.`,
        400,
      )
    }

    let acumulado = 0
    const archivos = []
    for (const parte of partes) {
      if (typeof parte === 'string') {
        throw new AppError('El campo `archivos` tiene que traer archivos, no texto.', 400)
      }
      if (parte.size > MAXIMO_BYTES) {
        throw new AppError(`«${parte.name}» pesa demasiado para ser un recibo de CFE.`, 413)
      }
      acumulado += parte.size
      if (acumulado > MAXIMO_TANDA) {
        throw new AppError('La tanda entera pesa demasiado. Subela en varias veces.', 413)
      }
      archivos.push({
        // El nombre solo se devuelve para que la persona reconozca el archivo.
        // No se usa para NADA mas: ni para emparejar el predio —eso sale del
        // numero de servicio que dice el PDF por dentro— ni para abrir nada en
        // disco. Un nombre de archivo lo elige quien sube.
        nombre: parte.name || 'sin nombre',
        datos: new Uint8Array(await parte.arrayBuffer()),
      })
    }

    return NextResponse.json(await interpretarRecibosCtrl(archivos, mesesEsperados))
  } catch (e) {
    return respuestaError(e)
  }
}
