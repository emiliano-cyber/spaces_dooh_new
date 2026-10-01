'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/demo/ui/Button'
import { refrescarEstado } from '@/lib/data/estado-api'
import { aplicarCodigoApi, quitarCodigoApi, codigosApi, type CodigoPromocionalUI } from '@/lib/data/codigos-api'
import {
  codigoDePropuestaApi,
  decidirCodigoApi,
  type CodigoDePropuestaUI,
} from '@/lib/data/codigo-aprobacion-api'
import { admiteCupon, etiquetaEstadoCodigo, vigentesParaSelector } from '@/lib/codigo-aprobacion'

// ============================================================================
//  El bloque del CÓDIGO PROMOCIONAL en el detalle de la propuesta.  COD-01 y
//  COD-03 (decisiones del dueño del 2026-09-30).
// ----------------------------------------------------------------------------
//  Bloque aparte del descuento comercial, y no es estética: son dos cosas que
//  autoriza gente distinta. El comercial lo pone quien vende, bajo el tope de
//  la organización; el cupón lo crea Administración, aquí solo se ELIGE o se
//  TECLEA, y desde COD-03 además lo APRUEBA alguien con `comercial.aprobar`.
//  Por eso este bloque no tiene ningún campo de porcentaje.
//
//  Lo que añade COD-03, y por qué cada cosa:
//
//   · Aparece en BORRADOR, ENVIADA y RECHAZADA (`admiteCupon`). En RECHAZADA
//     avisa de que aplicarlo la REACTIVA a borrador (decisión 1): es un cambio
//     de estatus, y no debe pasar sin que quien hace clic lo sepa.
//   · Un SELECTOR de los cupones vigentes (decisión 2), además de teclearlo. La
//     lista sale de `codigosApi` —`precios.ver`, que tienen los cuatro roles de
//     venta y el vendedor— y se filtra con `vigentesParaSelector` solo como
//     comodidad: quien decide si se puede es el servidor, con su reloj.
//   · La etiqueta «Pendiente de aprobación» / «Aprobado por X», y los botones
//     Aprobar / Rechazar SOLO si el servidor dice `puedeAprobarCodigo`. No se
//     mira el rol aquí: la regla vive en la ruta, y repetirla en el navegador
//     es como divergen.
// ============================================================================

type Props = {
  propuestaId: string
  estatus: string
  codigoTexto: string | null
  codigoDescuentoPct: number
  codigoEstado: 'PENDIENTE' | 'APROBADO' | null | undefined
  /** `comercial.crear`: aplicar y quitar. */
  puedeEditar: boolean
}

const hoyLocal = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function BloqueCodigoPropuesta({
  propuestaId,
  estatus,
  codigoTexto,
  codigoDescuentoPct,
  codigoEstado,
  puedeEditar,
}: Props) {
  const [info, setInfo] = useState<CodigoDePropuestaUI | null>(null)
  const [catalogo, setCatalogo] = useState<CodigoPromocionalUI[]>([])
  const [codInput, setCodInput] = useState('')
  const [codSel, setCodSel] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')

  // El estado y el permiso de decidir, del SERVIDOR. Se relee cada vez que el
  // cupón cambia en el estado global, para que la etiqueta no se quede vieja.
  async function releer() {
    try {
      setInfo(await codigoDePropuestaApi(propuestaId))
    } catch {
      setInfo(null)
    }
  }
  useEffect(() => {
    void releer()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propuestaId, codigoTexto, codigoEstado])

  // El catálogo para el selector. Fallo TRAGADO a propósito, igual que el de
  // paquetes: sin `precios.ver` la lista sale vacía y queda el campo de texto.
  useEffect(() => {
    let vivo = true
    void codigosApi()
      .then((cs) => { if (vivo) setCatalogo(cs) })
      .catch(() => { if (vivo) setCatalogo([]) })
    return () => { vivo = false }
  }, [])

  const estado = info?.codigoEstado ?? codigoEstado ?? null
  const etiqueta = etiquetaEstadoCodigo(estado, info?.codigoAprobadoPor ?? null)
  const admite = admiteCupon(estatus)
  const puedeDecidir = info?.puedeAprobarCodigo === true && estado === 'PENDIENTE' && admite
  const vigentes = vigentesParaSelector(catalogo, hoyLocal())

  if (!puedeEditar && !puedeDecidir) return null

  async function despues() {
    await refrescarEstado()
    await releer()
  }

  /**
   * Aplica el código. **Aquí no se valida nada del cupón**: la vigencia y los
   * usos son un reloj y un contador, y ninguno vive en el navegador (B40). El
   * mensaje del servidor se enseña TAL CUAL porque distingue «no existe» de
   * «venció» de «se agotó».
   */
  async function aplicar() {
    const codigo = (codSel || codInput).trim()
    if (!codigo) {
      toast.error('Elige o teclea el código promocional')
      return
    }
    setGuardando(true)
    try {
      const r = (await aplicarCodigoApi(propuestaId, codigo)) as Awaited<
        ReturnType<typeof aplicarCodigoApi>
      > & { reactivada?: boolean }
      toast.success(
        `Código ${r.codigo} aplicado (${r.descuentoPct} %): pendiente de aprobación` +
          (r.reactivada ? '. La propuesta vuelve a borrador.' : ''),
      )
      setCodInput('')
      setCodSel('')
      await despues()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  /** Quita el código y DEVUELVE EL USO al cupón. */
  async function quitar() {
    setGuardando(true)
    try {
      await quitarCodigoApi(propuestaId)
      toast.success('Código quitado; su uso vuelve al cupón')
      await despues()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  async function aprobar() {
    setGuardando(true)
    try {
      await decidirCodigoApi(propuestaId, { decision: 'APROBAR' })
      toast.success('Código aprobado: el cliente ya lo ve en su propuesta')
      await despues()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  async function rechazar() {
    if (motivo.trim().length < 3) {
      toast.error('Escribe el motivo del rechazo')
      return
    }
    setGuardando(true)
    try {
      await decidirCodigoApi(propuestaId, { decision: 'RECHAZAR', motivo: motivo.trim() })
      toast.success('Código rechazado; se quitó y su uso vuelve al cupón')
      setRechazando(false)
      setMotivo('')
      await despues()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setGuardando(false)
    }
  }

  const campo =
    'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

  return (
    <div className="rounded-md border border-border bg-surface-2/40 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[12px] font-medium text-ink">Código promocional</span>
        {etiqueta && (
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              estado === 'PENDIENTE'
                ? 'border-[#f59e0b40] text-[#9a6700]'
                : 'border-[#10b98140] text-[#0f7a55]'
            }`}
          >
            {etiqueta}
          </span>
        )}
      </div>

      {codigoTexto ? (
        <>
          <p className="mt-0.5 text-[11px] text-muted">
            Esta propuesta lleva el código <b className="font-mono">{codigoTexto}</b> con un{' '}
            <b>{codigoDescuentoPct} %</b>, que ya está congelado: si el código cambia o se borra,
            este precio no se mueve.
          </p>
          {estado === 'PENDIENTE' && (
            <p className="mt-1 text-[11px] text-[#9a6700]">
              <b>El cliente todavía no lo ve:</b> su liga enseña la propuesta sin este descuento
              hasta que un administrador o gerente lo apruebe. Si la acepta así, la acepta sin
              cupón. Mientras esté pendiente, la propuesta no se puede aprobar por dentro.
            </p>
          )}
          {admite ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {puedeDecidir && !rechazando && (
                <>
                  <Button size="sm" onClick={aprobar} disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Aprobar código'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRechazando(true)} disabled={guardando}>
                    Rechazar…
                  </Button>
                </>
              )}
              {puedeDecidir && rechazando && (
                <>
                  <input
                    aria-label="Motivo del rechazo"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo del rechazo"
                    maxLength={500}
                    className={`${campo} w-64 px-3`}
                  />
                  <Button size="sm" onClick={rechazar} disabled={guardando || motivo.trim().length < 3}>
                    {guardando ? 'Rechazando…' : 'Confirmar rechazo'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setRechazando(false); setMotivo('') }}>
                    Cancelar
                  </Button>
                </>
              )}
              {puedeEditar && !rechazando && (
                <>
                  <Button size="sm" variant="ghost" onClick={quitar} disabled={guardando}>
                    {guardando ? 'Quitando…' : 'Quitar código'}
                  </Button>
                  <span className="text-[11px] text-muted">Quitarlo devuelve su uso al cupón.</span>
                </>
              )}
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted">
              La propuesta ya está aprobada; el código quedó fijo.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-0.5 text-[11px] text-muted">
            Se aplica <b>después</b> del descuento comercial y se <b>compone</b> con él: un 20 % y
            un 20 % dejan al cliente pagando el 64 %, no el 60 %. Al aplicarlo se consume uno de
            sus usos — quitarlo lo devuelve — y queda <b>pendiente de aprobación</b>: el cliente no
            lo ve hasta que un administrador o gerente lo apruebe.
          </p>
          {estatus === 'RECHAZADA' && (
            <p className="mt-1 text-[11px] text-[#9a6700]">
              Esta propuesta está rechazada: <b>aplicar un cupón la reactiva a borrador.</b>
            </p>
          )}
          {admite && puedeEditar ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {vigentes.length > 0 && (
                <select
                  aria-label="Cupón vigente"
                  value={codSel}
                  onChange={(e) => { setCodSel(e.target.value); if (e.target.value) setCodInput('') }}
                  className={campo}
                >
                  <option value="">Elige un cupón vigente…</option>
                  {vigentes.map((c) => (
                    <option key={c.id} value={c.codigo}>
                      {c.codigo} — {c.descuentoPct} % ·{' '}
                      {c.usosMaximos == null ? 'sin tope de usos' : `quedan ${c.usosMaximos - c.usos}`}
                    </option>
                  ))}
                </select>
              )}
              <input
                aria-label="Código promocional"
                value={codInput}
                onChange={(e) => { setCodInput(e.target.value); if (e.target.value) setCodSel('') }}
                placeholder={vigentes.length > 0 ? 'o tecléalo' : 'VERANO20'}
                className={`${campo} w-36 px-3 font-mono uppercase`}
              />
              <Button
                size="sm"
                onClick={aplicar}
                disabled={guardando || (codSel === '' && codInput.trim() === '')}
              >
                {guardando ? 'Aplicando…' : 'Aplicar'}
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-[12px] text-muted">
              {admite ? 'No tienes permiso para aplicar códigos.' : 'La propuesta ya está aprobada; no admite código.'}
            </p>
          )}
        </>
      )}
    </div>
  )
}
