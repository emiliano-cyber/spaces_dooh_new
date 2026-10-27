'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, CalendarClock } from 'lucide-react'
import {
  fijarHorarioDoohmainApi,
  programacionDoohmainApi,
  type VistaPreviaDoohmain,
} from '@/lib/data/estado-api'
import { motivoHorarioInvalido, textoHorario, textoReproducciones } from '@/lib/doohmain-programacion'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { Button } from '@/components/demo/ui/Button'

// ============================================================================
//  ProgramacionDoohmain — lo que se le va a mandar a DOOHmain, ANTES de mandarlo.
// ----------------------------------------------------------------------------
//  Pedido del dueño el 2026-10-22: «en campañas, antes de ser subida a DOOHmain,
//  que se vean las franjas de tiempo y la cantidad de repeticiones». Por cada
//  pantalla digital: a qué pantalla de DOOHmain va, con qué creativo, en qué
//  horario (la franja si la campaña tiene una; si no, todo el día) y cuántas
//  reproducciones por día y en toda la campaña. Y el cliente tal como llega.
//
//  Sale de `GET /api/campanas/:id/programacion-doohmain`, que lee con la MISMA
//  consulta que publica (`leerPlan()` en `lib/server/doohmain.ts`): lo que se
//  ve aquí es lo que se manda. Los textos («Todo el día», «Las que quepan»)
//  están en `lib/doohmain-programacion.ts`, con prueba.
//
//  `clave` cambia cuando cambia algo que mueve el plan (creativos, franja,
//  estado de la validación) y hace que se vuelva a leer.
// ============================================================================

const DESTINO: Record<string, string> = {
  otro_cms: 'No va a DOOHmain: la opera otro CMS',
  sin_pantalla: 'Sin pantalla de DOOHmain asignada',
}

// El orden en que se leen los días en México: de lunes a domingo. El valor es
// el que recibe DOOHmain (0 = domingo).
const DIAS: [number, string][] = [
  [1, 'Lun'], [2, 'Mar'], [3, 'Mié'], [4, 'Jue'], [5, 'Vie'], [6, 'Sáb'], [0, 'Dom'],
]

const inputCls =
  'h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

/**
 * El horario INDIVIDUAL de la campaña (22/10, noche): «que en campaña se pueda
 * poner una franja de tiempo individual que se mande a DOOHmain». Sin días
 * marcados, todos. Desde el 23/10 solo se ofrece a una campaña SIN franja
 * (programada o contratada); con franja, el cuadro dice cuál viaja.
 */
function HorarioIndividual({
  campanaId,
  actual,
  franja,
  onGuardado,
}: {
  campanaId: string
  actual: VistaPreviaDoohmain['horarioIndividual']
  // 23/10 · la franja que la campaña YA tiene. Con ella no se ofrece capturar
  // otro horario: «si la campaña ya tiene franja de horario no debe de tener la
  // opción de añadir otra». El servidor lo rechaza igual (409).
  franja: VistaPreviaDoohmain['franjaCampana']
  onGuardado: () => void
}) {
  const puede = usePuede('comercial', 'crear')
  const [inicio, setInicio] = useState(actual?.horaInicio ?? '')
  const [fin, setFin] = useState(actual?.horaFin ?? '')
  const [dias, setDias] = useState<number[]>(actual?.dias ?? [])
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => {
    setInicio(actual?.horaInicio ?? '')
    setFin(actual?.horaFin ?? '')
    setDias(actual?.dias ?? [])
  }, [actual?.horaInicio, actual?.horaFin, actual?.dias?.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  async function guardar(horario: { horaInicio: string; horaFin: string; dias: number[] | null } | null) {
    setError(null)
    if (horario) {
      const motivo = motivoHorarioInvalido(horario)
      if (motivo) return setError(motivo)
    }
    setGuardando(true)
    try {
      await fijarHorarioDoohmainApi(campanaId, horario)
      onGuardado()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar')
    }
    setGuardando(false)
  }

  if (franja) {
    return (
      <div className="mb-3 rounded border border-border bg-surface p-2 text-[12px] text-ink">
        <span className="text-muted">
          Horario en DOOHmain: la franja {franja.origen === 'programada' ? 'programada' : 'contratada'}
        </span>{' '}
        <b>{franja.nombre}</b>, {franja.horaInicio} a {franja.horaFin}. La campaña ya tiene franja, así que no lleva
        otro horario.
        {/* Una campaña que ya tenía los dos de antes de esta regla: se avisa y
            solo se ofrece quitar el individual, que hoy es el que viaja. */}
        {actual && (
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-warning">
              Tiene además un horario propio ({actual.horaInicio} a {actual.horaFin}), de antes, y es el que se
              manda: quítalo para que viaje la franja.
            </span>
            {puede && (
              <Button size="sm" variant="secondary" disabled={guardando} onClick={() => void guardar(null)}>
                Quitar
              </Button>
            )}
          </div>
        )}
        {error && <p className="m-0 mt-1 text-[12px] text-error">{error}</p>}
      </div>
    )
  }

  if (!puede) {
    return actual ? (
      <p className="m-0 mb-2 text-[12px] text-ink">
        <span className="text-muted">Horario de la campaña:</span> {actual.horaInicio} a {actual.horaFin}
      </p>
    ) : null
  }

  return (
    <div className="mb-3 rounded border border-border bg-surface p-2">
      <div className="mb-1.5 text-[12px] font-medium text-ink">Horario de esta campaña en DOOHmain</div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-[12px] text-muted">
          De
          <input aria-label="Hora de inicio" type="time" className={inputCls} value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label className="flex items-center gap-1 text-[12px] text-muted">
          a
          <input aria-label="Hora de fin" type="time" className={inputCls} value={fin} onChange={(e) => setFin(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Días de la semana">
          {DIAS.map(([d, nombre]) => {
            const marcado = dias.includes(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={marcado}
                onClick={() => setDias(marcado ? dias.filter((x) => x !== d) : [...dias, d])}
                className={`h-7 rounded border px-1.5 text-[11px] ${
                  marcado ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-border bg-surface text-muted'
                }`}
              >
                {nombre}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] text-muted">
          Solo para campañas sin franja horaria. Sin días marcados, sale todos los días.
        </span>
        <div className="flex gap-1.5">
          {actual && (
            <Button size="sm" variant="secondary" disabled={guardando} onClick={() => void guardar(null)}>
              Quitar
            </Button>
          )}
          <Button
            size="sm"
            disabled={guardando || !inicio || !fin}
            onClick={() => void guardar({ horaInicio: inicio, horaFin: fin, dias: dias.length ? dias : null })}
          >
            Guardar horario
          </Button>
        </div>
      </div>
      {error && <p className="m-0 mt-1 text-[12px] text-error">{error}</p>}
    </div>
  )
}

export function ProgramacionDoohmain({ campanaId, clave }: { campanaId: string; clave: string }) {
  const [v, setV] = useState<(VistaPreviaDoohmain & { publicacionEncendida: boolean }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  // La franja programada se cambia en otro cuadro de la ficha y no llega en
  // `clave`: «Actualizar» vuelve a leer sin recargar la página.
  const [lectura, setLectura] = useState(0)

  useEffect(() => {
    let vivo = true
    programacionDoohmainApi(campanaId)
      .then((d) => {
        if (!vivo) return
        setV(d)
        setError(null)
      })
      .catch((e) => vivo && setError(e instanceof Error ? e.message : 'No se pudo leer'))
    return () => {
      vivo = false
    }
  }, [campanaId, clave, lectura])

  if (error) return <p className="mt-3 text-[12px] text-error">{error}</p>
  if (!v) return <div className="mt-3 h-16 w-full animate-pulse rounded-md bg-surface-2" />

  const c = v.cliente
  const datosCliente = [c.rfc && `RFC ${c.rfc}`, c.razonSocial, c.direccion, c.tipo].filter(Boolean).join(' · ')

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-2/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <CalendarClock className="h-4 w-4 text-muted" /> Lo que se manda a DOOHmain
        </span>
        <button
          type="button"
          onClick={() => setLectura((n) => n + 1)}
          className="text-[11px] font-medium text-info hover:underline"
        >
          Actualizar
        </button>
      </div>
      {!v.publicacionEncendida && (
        <p className="mb-2 text-[11px] text-muted">
          La publicación en DOOHmain está apagada en esta instancia: esto es lo que se mandaría.
        </p>
      )}
      <HorarioIndividual
        campanaId={campanaId}
        actual={v.horarioIndividual}
        franja={v.franjaCampana}
        onGuardado={() => setLectura((n) => n + 1)}
      />

      <p className="m-0 mb-2 text-[12px] text-ink">
        <span className="text-muted">Cliente:</span> {c.nombre}
        {datosCliente && <span className="text-muted"> · {datosCliente}</span>}
        <span className="text-muted"> · lista {v.lista}</span>
      </p>

      {v.filas.length === 0 && v.sinCreativo.length === 0 ? (
        <p className="m-0 text-[12px] text-muted">Esta campaña no tiene pantallas digitales que mandar.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead className="text-left text-[11px] text-muted">
              <tr>
                <th className="pb-1 pr-2 font-medium">Pantalla</th>
                <th className="pb-1 pr-2 font-medium">Creativo</th>
                <th className="pb-1 pr-2 font-medium">Horario</th>
                <th className="pb-1 pr-2 text-right font-medium">Por día</th>
                <th className="pb-1 text-right font-medium">Total campaña</th>
              </tr>
            </thead>
            <tbody>
              {v.filas.map((f, i) => {
                const n = textoReproducciones(f.programacion)
                return (
                  <tr key={`${f.sitio}-${f.creativoNombre}-${i}`} className="border-t border-border align-top">
                    <td className="py-1.5 pr-2 text-ink">
                      {f.sitioNombre}
                      <div className="text-[11px] text-muted">
                        {f.destino === 'doohmain' ? `→ ${f.screen}` : DESTINO[f.destino]}
                      </div>
                    </td>
                    <td className="py-1.5 pr-2 text-ink">{f.creativoNombre}</td>
                    <td className="py-1.5 pr-2 text-ink">{textoHorario(f.programacion)}</td>
                    <td className="demo-num py-1.5 pr-2 text-right text-ink">{n.porDia}</td>
                    <td className="demo-num py-1.5 text-right font-medium text-ink">{n.total}</td>
                  </tr>
                )
              })}
              {v.sinCreativo.map((h) => (
                <tr key={`hueco-${h.sitio}`} className="border-t border-border">
                  <td className="py-1.5 pr-2 text-ink">{h.sitioNombre}</td>
                  <td colSpan={4} className="py-1.5 text-amber-800">
                    <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                    Sin creativo aprobado asignado: al publicar, esta pantalla no recibe nada.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 mt-2 text-[11px] text-muted">
        Del {v.fechaInicio} al {v.fechaFin}. Si la campaña tiene franja, DOOHmain reparte las del día dentro de ese
        horario. Un anuncio ya publicado no cambia de horario al volver a publicar.
      </p>
    </div>
  )
}
