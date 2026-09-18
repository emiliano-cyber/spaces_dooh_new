'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/demo/ui/Button'
import { Card, CardContent } from '@/components/demo/ui/Card'
import { crearEntidadApi, desactivarEntidadApi, editarEntidadApi } from '@/lib/data/estado-api'
import type { RolCatalogo } from '@/lib/cuestionario-entidades'
import {
  BORRADOR_VACIO,
  entidadesOrdenadas,
  loQueFaltaEnElBorrador,
  rolesCompartidos,
  rolesSinDueno,
  type BorradorEntidad,
  type EntidadUI,
} from './gestion'

// ============================================================================
//  Alta, edición, baja y reactivación de las razones sociales del OWNER.
// ----------------------------------------------------------------------------
//  Hasta el 2026-09-18 esto estaba construido y NO se usaba desde la
//  aplicación: los endpoints existían desde el 17/09 y ninguna pantalla los
//  llamaba. Peor: la pantalla de bienvenida le decía al usuario que fuera a
//  Administración a gestionarlas, y en Administración no había nada. Una
//  promesa escrita que el producto no cumplía.
//
//  ─── Lo que NO se decide aquí ─────────────────────────────────────────────
//  Los CINCO papeles son fijos para toda la flota (decisión de Jochelo del
//  18/09) y se leen de `catalogo_roles_entidad` con su etiqueta y su orden.
//  Fijos NO es quemados: siguen en la tabla porque corregir una etiqueta o
//  añadir un sexto es un `insert`, no reconstruir la imagen y actualizar cada
//  instancia. Esta pantalla NO ofrece crear, renombrar ni borrar papeles.
//
//  ─── Y lo que se PINTA aunque incomode ───────────────────────────────────
//  Un papel sin dueño y un papel compartido se dicen en voz alta. Los dos se
//  notan tarde y en otra pantalla: sin dueño de `VENTAS`, ningún comprobante se
//  preasigna; con dos que venden, el selector no propone nada. Ninguna de las
//  dos cosas da error, y por eso hay que decirlas donde se pueden arreglar.
//
//  La lógica —qué es un duplicado, qué impide guardar, qué papeles están
//  huérfanos— vive en `gestion.ts` y está probada. Aquí solo se pinta:
//  `vitest.config.ts` no monta jsdom y un `.tsx` no se prueba en este
//  repositorio.
// ============================================================================

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

export function GestionEntidadesFiscales({
  entidades,
  catalogo,
  puedeEditar,
  alCambiar,
}: {
  entidades: EntidadUI[]
  catalogo: RolCatalogo[]
  puedeEditar: boolean
  /** Para releer el listado con las inactivas incluidas tras cada escritura. */
  alCambiar: () => void
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [creando, setCreando] = useState(false)
  const [borrador, setBorrador] = useState<BorradorEntidad>(BORRADOR_VACIO)
  const [ocupado, setOcupado] = useState(false)

  const claves = useMemo(() => catalogo.map((c) => c.rol), [catalogo])
  const etiquetaDe = (rol: string) =>
    catalogo.find((c) => c.rol === rol)?.etiqueta ?? rol
  const ordenadas = useMemo(() => entidadesOrdenadas(entidades), [entidades])
  const huerfanos = useMemo(() => rolesSinDueno(entidades, claves), [entidades, claves])
  const compartidos = useMemo(() => rolesCompartidos(entidades, claves), [entidades, claves])

  const falta = loQueFaltaEnElBorrador(borrador, {
    existentes: entidades,
    editando,
    catalogo: claves,
  })

  function abrirAlta() {
    setEditando(null)
    setCreando(true)
    setBorrador(BORRADOR_VACIO)
  }
  function abrirEdicion(e: EntidadUI) {
    setCreando(false)
    setEditando(e.id)
    setBorrador({
      razonSocial: e.razonSocial,
      rfc: e.rfc ?? '',
      regimen: e.regimen ?? '',
      cpFiscal: e.cpFiscal ?? '',
      serieFolios: e.serieFolios ?? '',
      roles: e.roles ?? [],
    })
  }
  function cerrar() {
    setEditando(null)
    setCreando(false)
    setBorrador(BORRADOR_VACIO)
  }

  function alternarRol(rol: string) {
    setBorrador((b) => ({
      ...b,
      roles: b.roles.includes(rol) ? b.roles.filter((r) => r !== rol) : [...b.roles, rol],
    }))
  }

  async function guardar() {
    // El aviso y el guard son la MISMA función que pinta el mensaje: no es una
    // validación duplicada, es la de antes de gastar el viaje. El servidor la
    // vuelve a hacer con la suya.
    if (falta || ocupado) return
    setOcupado(true)
    try {
      const datos = {
        razonSocial: borrador.razonSocial.trim(),
        // Cadena vacía = «bórralo». Se manda `null` explícito para distinguirlo
        // de «no lo toques» (undefined), que es lo que el PATCH interpreta.
        rfc: borrador.rfc.trim() || null,
        regimen: borrador.regimen.trim() || null,
        cpFiscal: borrador.cpFiscal.trim() || null,
        serieFolios: borrador.serieFolios.trim() || null,
        roles: borrador.roles,
      }
      if (creando) {
        await crearEntidadApi(datos)
        toast.success('Razón social agregada')
      } else if (editando) {
        await editarEntidadApi(editando, datos)
        toast.success('Razón social actualizada')
      }
      cerrar()
      alCambiar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar')
    } finally {
      setOcupado(false)
    }
  }

  async function darDeBaja(e: EntidadUI) {
    setOcupado(true)
    try {
      await desactivarEntidadApi(e.id)
      // Se dice que la baja es reversible y que los documentos se conservan: sin
      // eso, «dar de baja» suena a borrar y nadie lo usa.
      toast.success('Razón social dada de baja · los documentos que la nombran se conservan')
      alCambiar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo dar de baja')
    } finally {
      setOcupado(false)
    }
  }

  async function reactivar(e: EntidadUI) {
    setOcupado(true)
    try {
      await editarEntidadApi(e.id, { razonSocial: e.razonSocial, activo: true })
      toast.success('Razón social reactivada')
      alCambiar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo reactivar')
    } finally {
      setOcupado(false)
    }
  }

  const formulario = (
    <div className="space-y-3 rounded border border-accent/40 bg-accent-soft p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11.5px] text-muted">Razón social *</span>
          <input
            className={inputCls}
            value={borrador.razonSocial}
            onChange={(ev) => setBorrador({ ...borrador, razonSocial: ev.target.value })}
            placeholder="Denominación fiscal, como aparece en la constancia"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">RFC</span>
          <input
            className={cn(inputCls, 'demo-num uppercase')}
            value={borrador.rfc}
            onChange={(ev) => setBorrador({ ...borrador, rfc: ev.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            maxLength={13}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">Régimen fiscal</span>
          <input
            className={inputCls}
            value={borrador.regimen}
            onChange={(ev) => setBorrador({ ...borrador, regimen: ev.target.value })}
            placeholder="601 - General de Ley Personas Morales"
            maxLength={120}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">CP fiscal</span>
          <input
            className={cn(inputCls, 'demo-num')}
            value={borrador.cpFiscal}
            onChange={(ev) => setBorrador({ ...borrador, cpFiscal: ev.target.value })}
            placeholder="03100"
            maxLength={5}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11.5px] text-muted">Serie de folios</span>
          <input
            className={cn(inputCls, 'uppercase')}
            value={borrador.serieFolios}
            onChange={(ev) =>
              setBorrador({ ...borrador, serieFolios: ev.target.value.toUpperCase() })
            }
            placeholder="A"
            maxLength={20}
          />
        </label>
      </div>

      <div>
        <span className="mb-1.5 block text-[11.5px] text-muted">
          Qué papel juega esta razón social
        </span>
        {/* Los cinco salen del catálogo con su etiqueta y en el orden de la
            tabla. No hay botón de «añadir papel» a propósito: son el
            vocabulario del sistema, iguales para toda la flota. */}
        <div className="flex flex-wrap gap-1.5">
          {catalogo.map((c) => {
            const puesto = borrador.roles.includes(c.rol)
            return (
              <button
                key={c.rol}
                type="button"
                onClick={() => alternarRol(c.rol)}
                aria-pressed={puesto}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                  puesto
                    ? 'border-accent bg-accent text-white'
                    : 'border-border-strong bg-surface text-ink hover:border-accent',
                )}
              >
                {c.etiqueta}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">
          Sin ningún papel también se guarda: cuál juega se puede decidir después.
        </p>
      </div>

      {falta && (
        <p role="alert" className="text-[12px] text-error">
          {falta}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={!!falta || ocupado} onClick={guardar}>
          <Check className="h-3.5 w-3.5" /> {ocupado ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button size="sm" variant="secondary" onClick={cerrar} disabled={ocupado}>
          <X className="h-3.5 w-3.5" /> Cancelar
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Los dos avisos que se notan en OTRA pantalla y semanas después. */}
      {(huerfanos.length > 0 || compartidos.length > 0) && entidades.length > 0 && (
        <div className="space-y-1.5 rounded-md border border-warning/40 bg-warning-soft p-3 text-[12.5px] text-ink">
          {huerfanos.length > 0 && (
            <p className="flex gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                Ninguna razón social activa tiene{' '}
                <b>{huerfanos.map(etiquetaDe).join(', ')}</b>. Los documentos de ese tipo van a
                nacer sin razón social hasta que se lo asignes a alguna.
              </span>
            </p>
          )}
          {compartidos.length > 0 && (
            <p className="flex gap-1.5">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
              <span>
                <b>{compartidos.map(etiquetaDe).join(', ')}</b> lo tienen dos o más. Cuando hay
                varias con el mismo papel el sistema no propone ninguna, así que habrá que
                elegirla a mano en cada contrato o comprobante.
              </span>
            </p>
          )}
        </div>
      )}

      {puedeEditar && !creando && !editando && (
        <Button size="sm" onClick={abrirAlta}>
          <Plus className="h-3.5 w-3.5" /> Nueva razón social
        </Button>
      )}
      {creando && formulario}

      {ordenadas.length === 0 && !creando ? (
        <Card>
          <CardContent className="space-y-2 pt-4">
            <p className="text-[13px] text-ink">
              Todavía no hay ninguna razón social registrada.
            </p>
            <p className="text-[12.5px] text-muted">
              Es la identidad fiscal del negocio: con cuál pagas las rentas, con cuál compras los
              activos, con cuál tramitas licencias y con cuál vendes. Pueden ser varias, y es lo
              normal.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {ordenadas.map((e) =>
            editando === e.id ? (
              <li key={e.id}>{formulario}</li>
            ) : (
              <li
                key={e.id}
                className={cn(
                  'rounded-md border border-border bg-surface p-3',
                  e.activo === false && 'opacity-70',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium text-ink">
                      {e.razonSocial}
                      {e.activo === false && (
                        <span className="ml-2 rounded border border-border-strong px-1.5 py-px text-[11px] font-normal text-muted">
                          Dada de baja
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      <span className="demo-num">{e.rfc || 'sin RFC'}</span>
                      {e.regimen ? ` · ${e.regimen}` : ''}
                      {e.cpFiscal ? ` · CP ${e.cpFiscal}` : ''}
                      {e.serieFolios ? ` · serie ${e.serieFolios}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {(e.roles ?? []).length === 0 ? (
                        <span className="text-[11.5px] text-muted">Sin papel asignado</span>
                      ) : (
                        (e.roles ?? []).map((r) => (
                          <span
                            key={r}
                            className="rounded-full border border-border-strong px-2 py-px text-[11px] text-ink"
                          >
                            {etiquetaDe(r)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  {puedeEditar && (
                    <div className="flex shrink-0 gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => abrirEdicion(e)}>
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                      {e.activo === false ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={ocupado}
                          onClick={() => reactivar(e)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={ocupado}
                          onClick={() => darDeBaja(e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Dar de baja
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}
