'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, Cpu, Pencil, Loader2, CheckCircle2, UserPlus } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { StatusBadge, SITIO_TONO, SITIO_LABEL } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { actualizarSitioApi } from '@/lib/data/sitios-api'
import {
  useSitios,
  useContratos,
  useArrendadores,
  formatMonto,
  type Sitio,
  type TipoMedio,
} from '@/lib/data/client'

const TIPO_LABEL: Record<TipoMedio, string> = {
  ESPECTACULAR: 'Espectacular',
  PANTALLA_DIGITAL: 'Pantalla digital',
  PUENTE_PEATONAL: 'Puente peatonal',
  MOBILIARIO_URBANO: 'Mobiliario urbano',
  MURAL: 'Mural',
  VALLA: 'Valla',
  OTRO: 'Otro',
}

const PERIODICIDAD_LABEL: Record<string, string> = {
  SEMANAL: 'Semanal',
  CATORCENAL: 'Catorcenal',
  QUINCENAL: 'Quincenal',
  MENSUAL: 'Mensual',
  BIMESTRAL: 'Bimestral',
  TRIMESTRAL: 'Trimestral',
  SEMESTRAL: 'Semestral',
  ANUAL: 'Anual',
}
const periodicidadLabel = (p?: string) =>
  p ? PERIODICIDAD_LABEL[p.toUpperCase()] ?? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : '—'

function esDigital(s: Sitio): boolean {
  return s.tipoMedio === 'PANTALLA_DIGITAL' || s.esRotativo || s.exhibicion === 'digital' || s.exhibicion === 'rotativo'
}

// Tabla del inventario completo con columnas (incluye propietario, renta y
// periodicidad de pago tomados del contrato vigente de cada sitio).
export function InventarioTabla() {
  const sitios = useSitios()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const puedeEditar = usePuede('comercial', 'crear')
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState<Sitio | null>(null)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  function abrirFicha(s: Sitio) {
    setActivo(s)
    setFichaOpen(true)
  }

  function notify(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2400)
  }

  // arrendadorId → nombre (para el propietario directo del sitio y el selector).
  const arrById = useMemo(
    () => new Map((arrendadores ?? []).map((a) => [a.id, a.nombre])),
    [arrendadores],
  )

  // Renta del contrato preferente, indexada por predio (fuente actual: varias
  // pantallas comparten el contrato de su predio) y por sitio (contratos
  // antiguos, anteriores al predio).
  const rentaPorSitio = useMemo(() => {
    const PR: Record<string, number> = { VIGENTE: 0, POR_VENCER: 1, RENOVADO: 2, VENCIDO: 3, CANCELADO: 4 }
    type Info = { propietario: string; renta: number; periodicidad: string }
    const porPredio = new Map<string, Info>()
    const porSitio = new Map<string, Info>()
    for (const c of (contratos ?? []).slice().sort((a, b) => (PR[a.estatus] ?? 9) - (PR[b.estatus] ?? 9))) {
      const info: Info = {
        propietario: arrById.get(c.arrendadorId) ?? '—',
        renta: c.montoRenta,
        periodicidad: c.periodicidad,
      }
      if (c.predioId && !porPredio.has(c.predioId)) porPredio.set(c.predioId, info)
      if (!porSitio.has(c.sitioId)) porSitio.set(c.sitioId, info)
    }
    return { porPredio, porSitio }
  }, [contratos, arrendadores])

  if (!sitios) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }

  const filtrados = sitios.filter((s) => {
    if (!q) return true
    const t = `${s.nombre} ${s.codigoProveedor} ${s.alcaldia} ${s.ciudad}`.toLowerCase()
    return t.includes(q.toLowerCase())
  })

  return (
    <>
    <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar pantalla, código, distrito…"
            className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <span className="shrink-0 text-[12px] text-muted">{filtrados.length} de {sitios.length}</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Pantalla</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Ubicación</th>
              <th className="px-3 py-2 font-medium">Medio</th>
              <th className="px-3 py-2 text-right font-medium">Tarifa</th>
              <th className="px-3 py-2 font-medium">Estatus</th>
              <th className="px-3 py-2 font-medium">Arrendatario</th>
              <th className="px-3 py-2 text-right font-medium">Renta</th>
              <th className="px-3 py-2 font-medium">Cada cuándo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-muted">
                  Ningún sitio coincide con la búsqueda.
                </td>
              </tr>
            ) : (
              filtrados.map((s) => {
                // La renta sale SOLO del contrato (del predio, o del sitio si es
                // un contrato antiguo): los campos directos del sitio están
                // deprecados (Fase 1.7) y ya no se leen.
                const r = s.predioId
                  ? rentaPorSitio.porPredio.get(s.predioId)
                  : rentaPorSitio.porSitio.get(s.id)
                const rentaEff = r?.renta ?? null
                const periodicidadEff = r?.periodicidad ?? null
                return (
                  <tr key={s.id} onClick={() => abrirFicha(s)} className="cursor-pointer hover:bg-surface-2">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        <span className="truncate">{s.nombre}</span>
                        {s.computerVision && <Cpu className="h-3.5 w-3.5 shrink-0 text-info" />}
                      </div>
                      <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{TIPO_LABEL[s.tipoMedio]}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {s.alcaldia ?? '—'}{s.ciudad ? `, ${s.ciudad}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{esDigital(s) ? 'Digital' : 'Fija'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <CeldaTarifa sitio={s} editable={puedeEditar} onSaved={notify} />
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge tono={SITIO_TONO[s.estatusComercial]}>{SITIO_LABEL[s.estatusComercial]}</StatusBadge>
                    </td>
                    <td className="px-3 py-2.5">
                      <CeldaPropietario
                        sitio={s}
                        arrendadores={arrendadores ?? []}
                        arrById={arrById}
                        propietarioContrato={r?.propietario ?? null}
                        editable={puedeEditar}
                        onSaved={notify}
                      />
                    </td>
                    <td className="demo-num px-3 py-2.5 text-right text-ink">
                      {rentaEff != null ? formatMonto(rentaEff) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted">
                      {periodicidadEff ? periodicidadLabel(periodicidadEff) : '—'}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>

    <SiteFicha sitio={activo} open={fichaOpen} onOpenChange={setFichaOpen} />

    {toast && (
      <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-md border border-border bg-ink px-4 py-2.5 text-[13px] text-white">
        <span className="inline-flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" /> {toast}
        </span>
      </div>
    )}
    </>
  )
}

// Celda de "Tarifa" editable en línea: un clic sobre el monto lo convierte en
// input (Enter o perder el foco guarda, Escape cancela). Persiste con un PATCH a
// /api/sitios/:id y refresca el estado — sin abrir la ficha del sitio. Para roles
// sin permiso de edición muestra solo el monto.
function CeldaTarifa({
  sitio,
  editable,
  onSaved,
}: {
  sitio: Sitio
  editable: boolean
  onSaved: (msg: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  // Evita doble guardado cuando Enter/Escape ya resolvieron y el blur dispara otra vez.
  const resueltoRef = useRef(false)

  function abrir(e: React.MouseEvent) {
    e.stopPropagation()
    setVal(String(sitio.tarifaMensual ?? 0))
    resueltoRef.current = false
    setEditando(true)
  }

  async function guardar() {
    if (resueltoRef.current) return
    resueltoRef.current = true
    const num = Number(val.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(num) || num < 0 || num === (sitio.tarifaMensual ?? 0)) {
      setEditando(false)
      return
    }
    setSaving(true)
    try {
      await actualizarSitioApi(sitio.id, { tarifaMensual: num })
      onSaved(`Tarifa de "${sitio.nombre}" actualizada`)
    } catch {
      onSaved('No se pudo actualizar la tarifa')
    }
    setSaving(false)
    setEditando(false)
  }

  function cancelar() {
    resueltoRef.current = true
    setEditando(false)
  }

  if (!editable) {
    return <span className="demo-num text-ink">{formatMonto(sitio.tarifaMensual)}</span>
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Editar tarifa"
        className="group/tar demo-num ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-ink transition-colors hover:ring-1 hover:ring-border-strong"
      >
        {formatMonto(sitio.tarifaMensual)}
        <Pencil className="h-3 w-3 text-muted opacity-40 transition-opacity group-hover/tar:opacity-100" />
      </button>
    )
  }

  return (
    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] text-muted">$</span>
      <input
        autoFocus
        inputMode="decimal"
        value={val}
        disabled={saving}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void guardar()
          } else if (e.key === 'Escape') {
            e.preventDefault()
            cancelar()
          }
        }}
        onBlur={() => void guardar()}
        className="demo-num h-7 w-28 rounded border border-border-strong bg-surface px-2 text-right text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
    </span>
  )
}

// Celda de "Propietario" editable en línea: un clic abre un selector de
// arrendadores para asignar el dueño del inmueble sin abrir la ficha ni crear un
// contrato. Persiste el vínculo directo (sitios.arrendador_id) vía PATCH. Muestra
// con prioridad el arrendador directo; si no hay, cae al del contrato vigente.
function CeldaPropietario({
  sitio,
  arrendadores,
  arrById,
  propietarioContrato,
  editable,
  onSaved,
}: {
  sitio: Sitio
  arrendadores: { id: string; nombre: string }[]
  arrById: Map<string, string>
  propietarioContrato: string | null
  editable: boolean
  onSaved: (msg: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [saving, setSaving] = useState(false)

  const nombreDirecto = sitio.arrendadorId ? arrById.get(sitio.arrendadorId) ?? null : null
  const display = nombreDirecto ?? propietarioContrato

  async function elegir(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevo = e.target.value || null
    setEditando(false)
    if ((nuevo ?? null) === (sitio.arrendadorId ?? null)) return
    setSaving(true)
    try {
      await actualizarSitioApi(sitio.id, { arrendadorId: nuevo })
      onSaved(nuevo ? `Arrendatario actualizado en "${sitio.nombre}"` : `Arrendatario quitado de "${sitio.nombre}"`)
    } catch {
      onSaved('No se pudo actualizar el arrendatario')
    }
    setSaving(false)
  }

  if (!editable) {
    return display ? (
      <span className="text-ink">{display}</span>
    ) : (
      <span className="text-muted">Sin arrendatario</span>
    )
  }

  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
      </span>
    )
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setEditando(true)
        }}
        title="Asignar arrendatario"
        className="group/prop inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left transition-colors hover:ring-1 hover:ring-border-strong"
      >
        <span className={`truncate ${display ? 'text-ink' : 'text-muted'}`}>{display ?? 'Sin arrendatario'}</span>
        {display ? (
          <Pencil className="h-3 w-3 shrink-0 text-muted opacity-40 transition-opacity group-hover/prop:opacity-100" />
        ) : (
          <UserPlus className="h-3 w-3 shrink-0 text-muted opacity-60 transition-opacity group-hover/prop:opacity-100" />
        )}
      </button>
    )
  }

  return (
    <select
      autoFocus
      defaultValue={sitio.arrendadorId ?? ''}
      onClick={(e) => e.stopPropagation()}
      onChange={elegir}
      onBlur={() => setEditando(false)}
      className="h-7 max-w-[190px] rounded border border-border-strong bg-surface px-1.5 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <option value="">— Sin arrendatario —</option>
      {arrendadores.map((a) => (
        <option key={a.id} value={a.id}>
          {a.nombre}
        </option>
      ))}
    </select>
  )
}
