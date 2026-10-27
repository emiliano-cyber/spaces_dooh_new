'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, Building2, Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { useConfigNegocio } from '@/lib/data/client'
import { conteo } from '@/lib/plural'
import { EmptyState } from '@/components/demo/EmptyState'
import { Chip, TONO } from '@/components/demo/admin/Chip'
import { Button } from '@/components/demo/ui/Button'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
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
  // Solo para PINTAR cuál es la principal (la que sale en contratos y en el
  // Dashboard). Se lee del store, que ya la trae; aquí no se cambia: eso vive
  // en Administración → Configuración.
  const principalId = useConfigNegocio()?.entidadPrincipalId ?? null
  const activas = entidades.filter((e) => e.activo !== false).length
  const deBaja = entidades.length - activas
  const avisos = huerfanos.length + compartidos.length

  const falta = loQueFaltaEnElBorrador(borrador, {
    existentes: entidades,
    editando,
    catalogo: claves,
  })
  // OBLIG-01 · la razón social es lo único obligatorio (`entidades-controller.ts:35`).
  // Vacía, ya no se regaña al abrir el formulario ni se deshabilita el botón:
  // se pulsa y el campo se pinta en rojo. Los OTROS motivos de
  // `loQueFaltaEnElBorrador` —demasiado larga, duplicada— se siguen enseñando
  // al teclear y siguen bloqueando, como antes.
  const ob = useObligatorios({ razonSocial: borrador.razonSocial }, ['razonSocial'])
  const motivo = ob.faltan.length > 0 ? null : falta

  function abrirAlta() {
    ob.reiniciar()
    setEditando(null)
    setCreando(true)
    setBorrador(BORRADOR_VACIO)
  }
  function abrirEdicion(e: EntidadUI) {
    ob.reiniciar()
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
    ob.reiniciar()
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
    const completos = ob.validar()
    if (!completos || falta || ocupado) return
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
    // `border-accent/40` no se generaba (ver la cabecera de `admin/Chip.tsx`):
    // el borde sale del tono «acento», y el texto vuelve a `ink`.
    <div className={cn('space-y-3 rounded border p-3', TONO.acento, 'text-ink')}>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Campo label="Razón social" obligatorio falta={ob.falta('razonSocial')} className="sm:col-span-2">
          <input
            className={inputCls}
            value={borrador.razonSocial}
            onChange={(ev) => setBorrador({ ...borrador, razonSocial: ev.target.value })}
            placeholder="Denominación fiscal, como aparece en la constancia"
            autoFocus
          />
        </Campo>
        <Campo label="RFC">
          <input
            className={cn(inputCls, 'demo-num uppercase')}
            value={borrador.rfc}
            onChange={(ev) => setBorrador({ ...borrador, rfc: ev.target.value.toUpperCase() })}
            placeholder="XAXX010101000"
            maxLength={13}
          />
        </Campo>
        <Campo label="Régimen fiscal">
          <input
            className={inputCls}
            value={borrador.regimen}
            onChange={(ev) => setBorrador({ ...borrador, regimen: ev.target.value })}
            placeholder="601 - General de Ley Personas Morales"
            maxLength={120}
          />
        </Campo>
        <Campo label="CP fiscal">
          <input
            className={cn(inputCls, 'demo-num')}
            value={borrador.cpFiscal}
            onChange={(ev) => setBorrador({ ...borrador, cpFiscal: ev.target.value })}
            placeholder="03100"
            maxLength={5}
          />
        </Campo>
        <Campo label="Serie de folios">
          <input
            className={cn(inputCls, 'uppercase')}
            value={borrador.serieFolios}
            onChange={(ev) =>
              setBorrador({ ...borrador, serieFolios: ev.target.value.toUpperCase() })
            }
            placeholder="A"
            maxLength={20}
          />
        </Campo>
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
                  'm-0 cursor-pointer rounded-full border px-2.5 py-1 text-[12px] transition-colors',
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

      {motivo && (
        <p role="alert" className="text-[12px] text-error">
          {motivo}
        </p>
      )}
      <div className="flex gap-2">
        <Button size="sm" disabled={!!motivo || ocupado} onClick={guardar}>
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
        <div className={cn('space-y-1.5 rounded-md border p-3 text-[12.5px]', TONO.aviso)}>
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

      {/* Los avisos de arriba quedan FUERA a propósito: plegar la lista no debe
          esconder que un papel se quedó sin dueño.
          «Nueva razón social» va DENTRO y no en `accion`: abre el formulario
          aquí mismo, y con la tarjeta plegada el clic no enseñaría nada. El
          borrador vive en este componente, así que plegar a medio capturar
          no lo pierde. */}
      <CardColapsable
        id="razones-sociales.lista"
        titulo="Razones sociales"
        contentClassName="space-y-4"
        resumen={entidades.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            <Chip tono="exito" punto><span className="demo-num">{conteo(activas, 'activa')}</span></Chip>
            <Chip punto><span className="demo-num">{deBaja}</span> de baja</Chip>
            {/* El detalle de los avisos sigue FUERA de la tarjeta (ver arriba);
                esto solo los cuenta para que se vean con la tarjeta plegada. */}
            {avisos > 0 && <Chip tono="aviso"><span className="demo-num">{conteo(avisos, 'aviso')}</span></Chip>}
          </div>
        ) : undefined}
      >
      {puedeEditar && !creando && !editando && ordenadas.length > 0 && (
        <Button variant="success" size="sm" onClick={abrirAlta}>
          <Plus className="h-3.5 w-3.5" /> Nueva razón social
        </Button>
      )}
      {creando && formulario}

      {ordenadas.length === 0 && !creando ? (
          // El vacío lleva sus dos salidas al lado: el mismo «Nueva razón
          // social» de arriba y el cuestionario de bienvenida, que antes era
          // un párrafo suelto debajo de la tarjeta, lejos del vacío.
          <EmptyState
            icon={Building2}
            titulo="Todavía no hay ninguna razón social registrada."
            detalle="Es la identidad fiscal del negocio: con cuál pagas las rentas, con cuál compras los activos, con cuál tramitas licencias y con cuál vendes. Pueden ser varias, y es lo normal."
            className="py-8"
            accion={
              <div className="flex flex-col items-center gap-2">
                {puedeEditar && (
                  <Button variant="success" size="sm" onClick={abrirAlta}>
                    <Plus className="h-3.5 w-3.5" /> Nueva razón social
                  </Button>
                )}
                <p className="m-0 text-[12.5px] text-muted">
                  Si prefieres capturarlas contestando tres preguntas, el{' '}
                  <Link href="/bienvenida" className="text-muted underline hover:text-ink">
                    cuestionario de bienvenida
                  </Link>{' '}
                  las crea de una vez con sus papeles.
                </p>
              </div>
            }
          />
      ) : (
        // Lista del Dashboard: filas separadas por `divide-y`, sin la caja con
        // borde dentro de otra caja, y SIN viñetas (`preflight` está apagado y
        // un <ul> sin `list-none` pinta el «•» del navegador).
        <ul className="m-0 list-none divide-y divide-border p-0">
          {ordenadas.map((e) =>
            editando === e.id ? (
              <li key={e.id} className="py-3">{formulario}</li>
            ) : (
              <li
                key={e.id}
                className={cn(
                  'py-3 first:pt-0 last:pb-0',
                  e.activo === false && 'opacity-70',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13.5px] font-medium text-ink">{e.razonSocial}</span>
                      {e.id === principalId && (
                        <Chip tono="acento" title="Sale en contratos y en el Dashboard · se cambia en Administración → Configuración">
                          Principal
                        </Chip>
                      )}
                      {e.activo === false && <Chip>Dada de baja</Chip>}
                    </div>
                    <p className="m-0 mt-0.5 text-[12px] text-muted">
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
                            className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] text-ink"
                          >
                            {etiquetaDe(r)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  {puedeEditar && (
                    <div className="flex w-full shrink-0 flex-wrap gap-1.5 sm:w-auto">
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
                          variant="danger"
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
      </CardColapsable>
    </div>
  )
}
