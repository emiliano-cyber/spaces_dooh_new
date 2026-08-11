'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import {
  crearRazonSocialApi,
  editarRazonSocialApi,
  borrarRazonSocialApi,
} from '@/lib/data/estado-api'

// ============================================================================
//  Alta, edición y baja de las razones sociales de cada propietario.
//
//  Una razón social es a nombre de QUIÉN factura el arrendador. Un mismo dueño
//  puede tener varias (una por inmueble, o una persona física y una moral), y
//  cada contrato ancla la suya. Hasta ahora solo existía el endpoint de alta y
//  ninguna pantalla lo llamaba: las razones sociales solo aparecían si las
//  creaba el importador, y no había forma de corregir un RFC mal capturado.
// ============================================================================

export interface RazonSocial {
  id: string
  arrendadorId: string
  razonSocial: string
  rfc: string | null
  regimen: string | null
}

export interface ArrendadorLite {
  id: string
  nombre: string
}

const inputCls =
  'h-8 w-full rounded border border-border-strong bg-surface px-2 text-[12.5px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// El RFC se valida en el servidor; aquí solo se avisa antes de mandarlo, para no
// gastar un viaje en un error de dedo evidente.
const RFC_RE = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/i

interface Borrador {
  razonSocial: string
  rfc: string
  regimen: string
}
const VACIO: Borrador = { razonSocial: '', rfc: '', regimen: '' }

export function GestionRazonesSociales({
  arrendadores,
  razones,
  contratosPorRazon,
  puedeEditar,
}: {
  arrendadores: ArrendadorLite[]
  razones: RazonSocial[]
  // Cuántos contratos facturan a cada razón social: se muestra para que se vea
  // por qué una no se puede borrar antes de intentarlo.
  contratosPorRazon: Map<string, number>
  puedeEditar: boolean
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [creandoEn, setCreandoEn] = useState<string | null>(null)
  const [borrador, setBorrador] = useState<Borrador>(VACIO)
  const [ocupado, setOcupado] = useState(false)

  function abrirEdicion(rs: RazonSocial) {
    setCreandoEn(null)
    setEditando(rs.id)
    setBorrador({ razonSocial: rs.razonSocial, rfc: rs.rfc ?? '', regimen: rs.regimen ?? '' })
  }
  function abrirAlta(arrendadorId: string) {
    setEditando(null)
    setCreandoEn(arrendadorId)
    setBorrador(VACIO)
  }
  function cerrar() {
    setEditando(null)
    setCreandoEn(null)
    setBorrador(VACIO)
  }

  const rfcInvalido = !!borrador.rfc.trim() && !RFC_RE.test(borrador.rfc.trim())
  const puedeGuardar = !!borrador.razonSocial.trim() && !rfcInvalido && !ocupado

  async function guardar() {
    if (!puedeGuardar) return
    setOcupado(true)
    try {
      const datos = {
        razonSocial: borrador.razonSocial.trim(),
        // Cadena vacía = «bórralo». Se manda null explícito para distinguirlo de
        // «no lo toques» (undefined), que es lo que el PATCH interpreta.
        rfc: borrador.rfc.trim() || null,
        regimen: borrador.regimen.trim() || null,
      }
      if (creandoEn) {
        const { contratosAdoptados } = await crearRazonSocialApi({ arrendadorId: creandoEn, ...datos })
        // Si el arrendador no tenía razón social, sus contratos nacieron sin
        // ninguna y esta alta acaba de reclamarlos. Se dice: es un cambio de
        // dato FISCAL en registros que el usuario no estaba editando, y
        // enterarse por casualidad al abrir Finanzas sería peor.
        toast.success(
          contratosAdoptados > 0
            ? `Razón social agregada · se asignó a ${contratosAdoptados} contrato${contratosAdoptados === 1 ? '' : 's'} que no tenía${contratosAdoptados === 1 ? '' : 'n'} ninguna`
            : 'Razón social agregada',
        )
      } else if (editando) {
        await editarRazonSocialApi(editando, datos)
        toast.success('Razón social actualizada')
      }
      cerrar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  async function borrar(rs: RazonSocial) {
    setOcupado(true)
    try {
      await borrarRazonSocialApi(rs.id)
      toast.success('Razón social eliminada')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar')
    } finally {
      setOcupado(false)
    }
  }

  const formulario = (
    <div className="space-y-2 rounded border border-accent/40 bg-accent-soft p-2.5">
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Razón social *</span>
          <input
            className={inputCls}
            value={borrador.razonSocial}
            onChange={(e) => setBorrador({ ...borrador, razonSocial: e.target.value })}
            placeholder="Nombre o denominación fiscal"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">RFC</span>
          <input
            className={cn(inputCls, 'demo-num uppercase', rfcInvalido && 'border-error')}
            value={borrador.rfc}
            onChange={(e) => setBorrador({ ...borrador, rfc: e.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            maxLength={13}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted">Régimen fiscal</span>
          <input
            className={inputCls}
            value={borrador.regimen}
            onChange={(e) => setBorrador({ ...borrador, regimen: e.target.value })}
            placeholder="601 - General de Ley Personas Morales"
            maxLength={120}
          />
        </label>
      </div>
      {rfcInvalido && (
        <p className="text-[11.5px] text-error">
          El RFC no tiene un formato válido (3–4 letras, 6 dígitos de fecha y 3 caracteres).
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={!puedeGuardar} onClick={guardar}>
          <Check className="h-3.5 w-3.5" /> {ocupado ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button size="sm" variant="secondary" onClick={cerrar}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  )

  return (
    <CardColapsable
      titulo="Razones sociales"
      subtitulo="A nombre de quién factura cada arrendador. Un mismo arrendador puede tener varias; el contrato elige cuál usa."
      contentClassName="space-y-4 pb-4"
    >
        {arrendadores.length === 0 ? (
          <p className="text-[13px] text-muted">
            Aún no hay arrendadores dados de alta.
          </p>
        ) : (
          arrendadores.map((a) => {
            const suyas = razones.filter((r) => r.arrendadorId === a.id)
            return (
              <div key={a.id} className="rounded border border-border">
                <div className="flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-2">
                  <span className="text-[13px] font-medium text-ink">{a.nombre}</span>
                  {puedeEditar && creandoEn !== a.id && (
                    <Button size="sm" variant="secondary" onClick={() => abrirAlta(a.id)}>
                      <Plus className="h-3.5 w-3.5" /> Agregar
                    </Button>
                  )}
                </div>

                <div className="space-y-2 p-3">
                  {creandoEn === a.id && formulario}

                  {suyas.length === 0 && creandoEn !== a.id ? (
                    <p className="flex items-start gap-2 text-[12.5px] text-[#9a6700]">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Sin razón social. Los contratos de este arrendador no podrán anclar
                      a quién se factura.
                    </p>
                  ) : (
                    suyas.map((rs) =>
                      editando === rs.id ? (
                        <div key={rs.id}>{formulario}</div>
                      ) : (
                        <div
                          key={rs.id}
                          className="flex flex-wrap items-start justify-between gap-2 rounded border border-border px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <div className="text-[13px] text-ink">{rs.razonSocial}</div>
                            <div className="demo-num mt-0.5 text-[11.5px] text-muted">
                              RFC: {rs.rfc || <span className="text-[#9a6700]">falta</span>}
                              {' · '}
                              Régimen: {rs.regimen || <span className="text-[#9a6700]">falta</span>}
                            </div>
                            {(contratosPorRazon.get(rs.id) ?? 0) > 0 && (
                              <div className="mt-0.5 text-[11.5px] text-muted">
                                {contratosPorRazon.get(rs.id)} contrato
                                {contratosPorRazon.get(rs.id) === 1 ? '' : 's'} factura
                                {contratosPorRazon.get(rs.id) === 1 ? '' : 'n'} aquí
                              </div>
                            )}
                          </div>
                          {puedeEditar && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => abrirEdicion(rs)}
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11.5px] text-info hover:bg-surface-2"
                              >
                                <Pencil className="h-3 w-3" /> Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => borrar(rs)}
                                disabled={ocupado || (contratosPorRazon.get(rs.id) ?? 0) > 0}
                                title={
                                  (contratosPorRazon.get(rs.id) ?? 0) > 0
                                    ? 'Hay contratos que facturan a esta razón social'
                                    : 'Eliminar'
                                }
                                className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[11.5px] text-error hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      ),
                    )
                  )}
                </div>
              </div>
            )
          })
        )}
    </CardColapsable>
  )
}
