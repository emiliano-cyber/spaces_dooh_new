'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Trash2, Plus } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { useCandado, PasoContrasena } from '@/components/demo/ui/candado'
import { AvisoFranjaCMS } from './AvisoFranjaCMS'
import {
  catalogoRejillaApi,
  rejillaDeSitioApi,
  actualizarRejillaApi,
  type FranjaUI,
  type TemporadaUI,
  type FilaRejillaUI,
} from '@/lib/data/rejilla-api'
import { UNIDADES_VENTA, motivoModalidadInvalida } from '@/lib/modalidades'

// ============================================================================
//  Las tarifas por FRANJA y TEMPORADA de UNA pantalla. ADR 0039, Fase 1.
// ----------------------------------------------------------------------------
//  ─── POR QUÉ UN CUADRO APARTE DE «Tarifas por unidad» ─────────────────────
//  Son DOS tablas con dos semánticas distintas y meterlas en el mismo formulario
//  obligaría a que un solo botón sirviera para las dos:
//   · `sitio_modalidades` es la tarifa BASE, y su re-importación PISA — el CSV
//     es la verdad completa de esa pantalla.
//   · `sitio_tarifas` es la REJILLA, y NUNCA se pisa en bloque: lo que no viene
//     no es «bórralo», es «no se tocó».
//  Confundirlas es cómo se pierde un precio sin que nada falle.
//
//  ─── LA REJILLA ES DISPERSA, y este cuadro lo dice ────────────────────────
//  Se captura SOLO donde el dueño quiera. Una combinación sin fila se resuelve
//  cayendo al escalón siguiente, hasta la tarifa base. Por eso el cuadro puede
//  quedarse vacío para siempre sin que nada deje de venderse.
//
//  ─── EL MISMO CANDADO QUE LAS MODALIDADES ─────────────────────────────────
//  `PATCH /api/sitios/:id/rejilla` es sensible ENTERA, igual que
//  `/modalidades`, y por el mismo motivo: es el mismo dinero. `useCandado` se
//  queda el diff armado UNA vez, así que confirmar con la contraseña repite ESE
//  cambio en vez de releer el formulario, que el usuario pudo tocar mientras
//  tecleaba.
// ============================================================================

type Clave = { unidad: string; franjaId: string | null; temporadaId: string | null }

const clave = (f: Clave) => `${f.unidad}|${f.franjaId ?? ''}|${f.temporadaId ?? ''}`

export function RejillaDialog({
  sitio,
  open,
  onClose,
}: {
  sitio: { id: string; nombre: string; exhibicion?: string | null }
  open: boolean
  onClose: () => void
}) {
  const [franjas, setFranjas] = useState<FranjaUI[]>([])
  const [temporadas, setTemporadas] = useState<TemporadaUI[]>([])
  const [filas, setFilas] = useState<FilaRejillaUI[]>([])
  const [tarifas, setTarifas] = useState<Record<string, string>>({})
  const [quitadas, setQuitadas] = useState<string[]>([])
  const [nueva, setNueva] = useState({ unidad: '', franjaId: '', temporadaId: '', tarifa: '' })
  const [cargando, setCargando] = useState(true)
  const candado = useCandado()

  // Las unidades que ESTA pantalla admite. Se reutiliza `motivoModalidadInvalida`
  // en vez de rehacer la regla: una lona no tiene loop, así que no hay spot que
  // vender por franja tampoco. Si el importador lo rechaza, este cuadro también.
  const admitidas = UNIDADES_VENTA.filter((u) => !motivoModalidadInvalida(u, sitio.exhibicion))

  useEffect(() => {
    if (!open) return
    let vivo = true
    setCargando(true)
    setQuitadas([])
    setNueva({ unidad: '', franjaId: '', temporadaId: '', tarifa: '' })
    Promise.all([catalogoRejillaApi(), rejillaDeSitioApi(sitio.id)])
      .then(([cat, r]) => {
        if (!vivo) return
        setFranjas(cat.franjas)
        setTemporadas(cat.temporadas)
        setFilas(r)
        setTarifas(Object.fromEntries(r.map((f) => [clave(f), String(f.tarifaPublicada)])))
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo leer la rejilla'))
      .finally(() => vivo && setCargando(false))
    return () => {
      vivo = false
    }
  }, [open, sitio.id])

  function etiquetaFranja(id: string | null) {
    if (!id) return 'Todo el día'
    const f = franjas.find((x) => x.id === id)
    // Si la franja se dio de baja ya no viene en el catálogo activo. Se enseña
    // el identificador antes que un hueco: una fila que no se sabe de qué franja
    // es no se puede corregir.
    return f ? `${f.nombre} · ${f.horaInicio}–${f.horaFin}` : id
  }
  function etiquetaTemporada(id: string | null) {
    if (!id) return 'Todo el año'
    return temporadas.find((x) => x.id === id)?.nombre ?? id
  }

  async function guardar() {
    const guardarLista: (Clave & { tarifaPublicada: number })[] = []
    // Solo lo que CAMBIÓ de verdad: reescribir una tarifa con su mismo valor
    // dejaría una fila en la bitácora diciendo que se tocó algo que nadie tocó.
    for (const f of filas) {
      const k = clave(f)
      if (quitadas.includes(k)) continue
      const texto = (tarifas[k] ?? '').trim()
      if (texto === '') continue
      const valor = Number(texto)
      if (!Number.isFinite(valor) || valor === f.tarifaPublicada) continue
      guardarLista.push({
        unidad: f.unidad,
        franjaId: f.franjaId,
        temporadaId: f.temporadaId,
        tarifaPublicada: valor,
      })
    }
    const valorNueva = Number(nueva.tarifa.trim())
    if (nueva.unidad && nueva.tarifa.trim() !== '' && Number.isFinite(valorNueva)) {
      guardarLista.push({
        unidad: nueva.unidad,
        franjaId: nueva.franjaId || null,
        temporadaId: nueva.temporadaId || null,
        tarifaPublicada: valorNueva,
      })
    }
    const quitarLista = quitadas
      .map((k) => filas.find((f) => clave(f) === k))
      .filter((f): f is FilaRejillaUI => !!f)
      .map((f) => ({ unidad: f.unidad, franjaId: f.franjaId, temporadaId: f.temporadaId }))

    if (!guardarLista.length && !quitarLista.length) {
      onClose()
      return
    }
    await candado.ejecutar({
      guardar: () => actualizarRejillaApi(sitio.id, { guardar: guardarLista, quitar: quitarLista }),
      alLograr: () => {
        toast.success('Tarifas por franja guardadas')
        onClose()
      },
      alFallar: (m) => toast.error(m),
      mensajeSiFalla: 'No se pudieron guardar las tarifas por franja',
    })
  }

  const sinCatalogo = franjas.length === 0 && temporadas.length === 0

  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          candado.olvidar()
          onClose()
        }
      }}
      title="Tarifas por franja y temporada"
      subtitle={sitio.nombre}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={candado.enviando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={candado.enviando || sinCatalogo || (candado.reautenticando && !candado.pass)}
            onClick={candado.reautenticando ? () => void candado.reintentar() : () => void guardar()}
          >
            {candado.enviando
              ? 'Guardando…'
              : candado.reautenticando
                ? 'Confirmar y guardar'
                : 'Guardar tarifas'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <PasoContrasena candado={candado} onEnter={() => void candado.reintentar()} />
        <AvisoFranjaCMS />

        {sinCatalogo ? (
          <p className="rounded-md border border-border bg-surface-2 px-3 py-2 text-[12px] text-muted">
            Esta organización todavía no tiene franjas ni temporadas. Se declaran una sola vez en{' '}
            <b className="text-ink">Franjas y temporadas</b>, y valen para todo el inventario.
          </p>
        ) : (
          <p className="text-[12px] text-muted">
            Solo hace falta capturar las combinaciones que tengan un precio distinto. Lo que no esté
            aquí se cobra con la tarifa por unidad de siempre — la rejilla no obliga a llenar nada.
          </p>
        )}

        {cargando ? (
          <p className="text-[12px] text-muted">Cargando…</p>
        ) : (
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                <th className="py-1.5 pr-2 font-medium">Unidad</th>
                <th className="pr-2 font-medium">Franja</th>
                <th className="pr-2 font-medium">Temporada</th>
                <th className="pr-2 text-right font-medium">Tarifa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => {
                const k = clave(f)
                const fuera = quitadas.includes(k)
                return (
                  <tr key={k} className={'border-b border-border ' + (fuera ? 'line-through opacity-50' : '')}>
                    <td className="py-1.5 pr-2 capitalize">{f.unidad}</td>
                    <td className="pr-2">{etiquetaFranja(f.franjaId)}</td>
                    <td className="pr-2">{etiquetaTemporada(f.temporadaId)}</td>
                    <td className="pr-2 text-right">
                      <input
                        type="number"
                        step="0.01"
                        aria-label={`Tarifa de ${f.unidad}`}
                        className="h-7 w-24 rounded border border-border-strong bg-surface px-2 text-right"
                        value={tarifas[k] ?? ''}
                        disabled={fuera}
                        onChange={(e) => setTarifas({ ...tarifas, [k]: e.target.value })}
                      />
                    </td>
                    <td className="text-right">
                      <button
                        type="button"
                        aria-label={fuera ? 'Conservar' : 'Quitar'}
                        onClick={() =>
                          setQuitadas(fuera ? quitadas.filter((x) => x !== k) : [...quitadas, k])
                        }
                        className="text-danger hover:underline"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!sinCatalogo && (
                <tr>
                  <td className="py-2 pr-2">
                    <select
                      aria-label="Unidad de la nueva tarifa"
                      className="h-7 rounded border border-border-strong bg-surface px-1"
                      value={nueva.unidad}
                      onChange={(e) => setNueva({ ...nueva, unidad: e.target.value })}
                    >
                      <option value="">Unidad…</option>
                      {admitidas.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pr-2">
                    <select
                      aria-label="Franja de la nueva tarifa"
                      className="h-7 rounded border border-border-strong bg-surface px-1"
                      value={nueva.franjaId}
                      onChange={(e) => setNueva({ ...nueva, franjaId: e.target.value })}
                    >
                      <option value="">Todo el día</option>
                      {franjas.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.nombre} · {f.horaInicio}–{f.horaFin}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pr-2">
                    <select
                      aria-label="Temporada de la nueva tarifa"
                      className="h-7 rounded border border-border-strong bg-surface px-1"
                      value={nueva.temporadaId}
                      onChange={(e) => setNueva({ ...nueva, temporadaId: e.target.value })}
                    >
                      <option value="">Todo el año</option>
                      {temporadas.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="pr-2 text-right">
                    <input
                      type="number"
                      step="0.01"
                      aria-label="Tarifa de la nueva fila"
                      className="h-7 w-24 rounded border border-border-strong bg-surface px-2 text-right"
                      value={nueva.tarifa}
                      onChange={(e) => setNueva({ ...nueva, tarifa: e.target.value })}
                    />
                  </td>
                  <td className="text-right text-muted">
                    <Plus className="ml-auto h-3.5 w-3.5" />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </Modal>
  )
}
