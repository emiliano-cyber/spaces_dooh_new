'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { Modal } from '@/components/demo/ui/Modal'
import { Campo } from '@/components/demo/ui/Campo'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { useSitios } from '@/lib/data/client'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { formatNumero } from '@/lib/formato-numero'
import { MODOS_GRUPO, type Valla, type GrupoVallas, type CategoriaCompetencia, type ModoGrupo } from '@/lib/vallas/tipos'
import { medidaParaArte, medidaSugeridaDeGrupo, problemasDeGrupo, siguienteNumero } from '@/lib/vallas/numeracion'
import type { Hallazgo, ResultadoReglas } from '@/lib/vallas/reglas/tipos'
import {
  listarVallasApi,
  crearVallaApi,
  actualizarVallaApi,
  borrarVallaApi,
  crearGrupoApi,
  actualizarGrupoApi,
  borrarGrupoApi,
  listarCategoriasApi,
  crearCategoriaApi,
  actualizarCategoriaApi,
  verificarVallasApi,
} from '@/lib/data/vallas-api'

// ============================================================================
//  VALLAS (esqueleto, 19/11). Cuatro tarjetas: las vallas (un número por
//  cuadro), los grupos (un número por grupo y su modo), las marcas que
//  compiten y «Verificar una marca», que corre todas las reglas de
//  `lib/vallas/reglas/` sin reservar nada.
//
//  Permisos: los de Inventario. Escribir pide `inventario.crear`.
// ============================================================================

const ENTRADA = 'w-full rounded border border-border-strong bg-surface px-2.5 py-2 text-[13px] text-ink'

function useMedida() {
  const { t, idioma } = useIdioma()
  return (ancho: number, alto: number) =>
    t('vallas.medida', { ancho: formatNumero(ancho, ancho % 1 ? 2 : 0, idioma), alto: formatNumero(alto, alto % 1 ? 2 : 0, idioma) })
}

export function VallasPantalla() {
  const { t } = useIdioma()
  const [vallas, setVallas] = useState<Valla[] | null>(null)
  const [grupos, setGrupos] = useState<GrupoVallas[]>([])
  const [categorias, setCategorias] = useState<CategoriaCompetencia[] | null>(null)

  const recargar = useCallback(async () => {
    try {
      const [v, k] = await Promise.all([listarVallasApi(), listarCategoriasApi()])
      setVallas(v.vallas)
      setGrupos(v.grupos)
      setCategorias(k)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.cargar'))
      setVallas([])
      setCategorias([])
    }
  }, [t])

  useEffect(() => {
    void recargar()
  }, [recargar])

  return (
    <div className="w-full space-y-4">
      <div>
        <h1 className="text-2xl text-ink">{t('nav.vallas')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('vallas.descripcion')}</p>
      </div>
      <TarjetaVallas vallas={vallas} grupos={grupos} recargar={recargar} />
      <TarjetaGrupos vallas={vallas ?? []} grupos={grupos} recargar={recargar} />
      <TarjetaCompetencia categorias={categorias} recargar={recargar} />
      <TarjetaVerificar vallas={vallas ?? []} />
    </div>
  )
}

// ─── Vallas ─────────────────────────────────────────────────────────────────

function TarjetaVallas({ vallas, grupos, recargar }: { vallas: Valla[] | null; grupos: GrupoVallas[]; recargar: () => Promise<void> }) {
  const { t } = useIdioma()
  const puede = usePuede('inventario', 'crear')
  const sitios = useSitios()
  const medida = useMedida()
  const [edicion, setEdicion] = useState<Valla | 'nueva' | null>(null)
  const nombreSitio = (id: string) => sitios?.find((s) => s.id === id)?.nombre ?? '—'

  async function borrar(v: Valla) {
    if (!window.confirm(t('vallas.borrar.confirmar', { numero: v.numero }))) return
    try {
      await borrarVallaApi(v.id)
      await recargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.borrar'))
    }
  }

  return (
    <CardColapsable
      id="vallas.lista"
      titulo={t('vallas.lista.titulo')}
      resumen={<span className="text-[12px] text-muted">{t('vallas.lista.detalle')}</span>}
      accion={
        puede ? (
          <Button size="sm" variant="success" onClick={() => setEdicion('nueva')}>
            <Plus className="h-3.5 w-3.5" /> {t('vallas.lista.nueva')}
          </Button>
        ) : undefined
      }
    >
      {vallas && vallas.length === 0 && <p className="text-[12px] text-muted">{t('vallas.lista.vacio')}</p>}
      <ul className="m-0 list-none divide-y divide-border p-0">
        {(vallas ?? []).map((v) => {
          const g = grupos.find((x) => x.id === v.grupoId) ?? null
          const arte = medidaParaArte(v, g)
          return (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                  <span className="demo-num">{v.numero}</span>
                  <span className="font-normal text-muted">{nombreSitio(v.sitioId)}</span>
                  {v.cara != null && <span className="text-[12px] font-normal text-muted">{t('vallas.lista.cara', { n: v.cara })}</span>}
                </div>
                <div className="demo-num text-[12px] text-muted">
                  {medida(v.ancho, v.alto)} · {g ? t('vallas.lista.grupo', { numero: g.numero }) : t('vallas.lista.sin-grupo')} ·{' '}
                  {arte
                    ? t(arte.origen === 'grupo' ? 'vallas.arte.grupo' : 'vallas.arte.valla', { medida: medida(arte.ancho, arte.alto) })
                    : t('vallas.arte.sin-medida')}
                </div>
              </div>
              {puede && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setEdicion(v)}>
                    <Pencil className="h-3.5 w-3.5" /> {t('vallas.editar')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => borrar(v)} aria-label={t('vallas.borrar')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {edicion && (
        <FormValla
          valla={edicion === 'nueva' ? null : edicion}
          sugerido={siguienteNumero((vallas ?? []).map((v) => v.numero), 'V-')}
          onClose={() => setEdicion(null)}
          onGuardado={recargar}
        />
      )}
    </CardColapsable>
  )
}

function FormValla({
  valla,
  sugerido,
  onClose,
  onGuardado,
}: {
  valla: Valla | null
  sugerido: string
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const { t } = useIdioma()
  const sitios = useSitios()
  // Las vallas viven en sitios fijos; los digitales se ofrecen al final por si
  // la estructura es mixta, pero el orden ayuda a encontrar las vallas.
  const opciones = useMemo(
    () =>
      [...(sitios ?? [])].sort(
        (a, b) => Number(b.tipoMedio === 'VALLA') - Number(a.tipoMedio === 'VALLA') || a.nombre.localeCompare(b.nombre),
      ),
    [sitios],
  )
  const [sitioId, setSitioId] = useState(valla?.sitioId ?? '')
  const [numero, setNumero] = useState(valla?.numero ?? sugerido)
  const [cara, setCara] = useState(valla?.cara != null ? String(valla.cara) : '')
  const [ancho, setAncho] = useState(valla ? String(valla.ancho) : '')
  const [alto, setAlto] = useState(valla ? String(valla.alto) : '')
  const [notas, setNotas] = useState(valla?.notas ?? '')
  const [enviando, setEnviando] = useState(false)

  // Al elegir un sitio, se proponen sus medidas si la valla aún no tiene.
  function elegirSitio(id: string) {
    setSitioId(id)
    const s = sitios?.find((x) => x.id === id)
    if (s && !ancho && s.ancho) setAncho(String(s.ancho))
    if (s && !alto && s.alto) setAlto(String(s.alto))
  }

  const valido = sitioId && numero.trim() && Number(ancho) > 0 && Number(alto) > 0

  async function guardar() {
    if (!valido) return
    setEnviando(true)
    const d = {
      sitioId,
      numero: numero.trim(),
      ancho: Number(ancho),
      alto: Number(alto),
      cara: cara ? Number(cara) : null,
      notas: notas.trim() || null,
    }
    try {
      if (valla) await actualizarVallaApi(valla.id, d)
      else await crearVallaApi(d)
      await onGuardado()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.guardar'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={valla ? valla.numero : t('vallas.lista.nueva')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button variant="success" size="sm" disabled={enviando || !valido} onClick={guardar}>{t('comun.guardar')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('vallas.campo.sitio')} obligatorio>
          <select value={sitioId} onChange={(e) => elegirSitio(e.target.value)} className={ENTRADA}>
            <option value="">{t('vallas.campo.sitio.elegir')}</option>
            {opciones.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label={t('vallas.campo.numero')} obligatorio>
            <input value={numero} maxLength={40} onChange={(e) => setNumero(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.campo.cara')}>
            <input type="number" min={1} max={50} value={cara} onChange={(e) => setCara(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.campo.ancho')} obligatorio>
            <input type="number" min={0} step="0.01" inputMode="decimal" value={ancho} onChange={(e) => setAncho(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.campo.alto')} obligatorio>
            <input type="number" min={0} step="0.01" inputMode="decimal" value={alto} onChange={(e) => setAlto(e.target.value)} className={ENTRADA} />
          </Campo>
        </div>
        {!valla && <p className="text-[11px] text-muted">{t('vallas.campo.numero.sugerido', { n: sugerido })}</p>}
        <Campo label={t('vallas.campo.notas')}>
          <textarea value={notas} maxLength={1000} rows={2} onChange={(e) => setNotas(e.target.value)} className={ENTRADA} />
        </Campo>
      </div>
    </Modal>
  )
}

// ─── Grupos ─────────────────────────────────────────────────────────────────

function TarjetaGrupos({ vallas, grupos, recargar }: { vallas: Valla[]; grupos: GrupoVallas[]; recargar: () => Promise<void> }) {
  const { t } = useIdioma()
  const puede = usePuede('inventario', 'crear')
  const medida = useMedida()
  const [edicion, setEdicion] = useState<GrupoVallas | 'nuevo' | null>(null)

  async function borrar(g: GrupoVallas) {
    if (!window.confirm(t('vallas.grupos.borrar.confirmar', { numero: g.numero }))) return
    try {
      await borrarGrupoApi(g.id)
      await recargar()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.borrar'))
    }
  }

  return (
    <CardColapsable
      id="vallas.grupos"
      titulo={t('vallas.grupos.titulo')}
      resumen={<span className="text-[12px] text-muted">{t('vallas.grupos.detalle')}</span>}
      accion={
        puede ? (
          <Button size="sm" variant="success" onClick={() => setEdicion('nuevo')}>
            <Plus className="h-3.5 w-3.5" /> {t('vallas.grupos.nuevo')}
          </Button>
        ) : undefined
      }
    >
      {grupos.length === 0 && <p className="text-[12px] text-muted">{t('vallas.grupos.vacio')}</p>}
      <ul className="m-0 list-none divide-y divide-border p-0">
        {grupos.map((g) => {
          const miembros = vallas.filter((v) => v.grupoId === g.id).sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0))
          const problemas = problemasDeGrupo(g, miembros)
          return (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                  <span className="demo-num">{g.numero}</span>
                  {g.nombre && <span className="font-normal text-muted">{g.nombre}</span>}
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted">
                    {t(`vallas.modo.${g.modo}` as ClaveTexto)}
                  </span>
                </div>
                <div className="demo-num text-[12px] text-muted">
                  {t(miembros.length === 1 ? 'vallas.grupos.vallas.una' : 'vallas.grupos.vallas.otras', { n: miembros.length })}
                  {miembros.length > 0 && `: ${miembros.map((v) => v.numero).join(' · ')}`}
                  {g.ancho && g.alto ? ` · ${medida(g.ancho, g.alto)}` : ''}
                </div>
                {problemas.length > 0 && (
                  <div className="text-[12px] text-warning">
                    {problemas.map((p) => t(`vallas.problema.${p.codigo}` as ClaveTexto)).join(' · ')}
                  </div>
                )}
              </div>
              {puede && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => setEdicion(g)}>
                    <Pencil className="h-3.5 w-3.5" /> {t('vallas.editar')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => borrar(g)} aria-label={t('vallas.borrar')}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {edicion && (
        <FormGrupo
          grupo={edicion === 'nuevo' ? null : edicion}
          vallas={vallas}
          sugerido={siguienteNumero(grupos.map((g) => g.numero), 'G-')}
          onClose={() => setEdicion(null)}
          onGuardado={recargar}
        />
      )}
    </CardColapsable>
  )
}

function FormGrupo({
  grupo,
  vallas,
  sugerido,
  onClose,
  onGuardado,
}: {
  grupo: GrupoVallas | null
  vallas: Valla[]
  sugerido: string
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const { t } = useIdioma()
  const medida = useMedida()
  const [numero, setNumero] = useState(grupo?.numero ?? sugerido)
  const [nombre, setNombre] = useState(grupo?.nombre ?? '')
  const [modo, setModo] = useState<ModoGrupo>(grupo?.modo ?? 'una_imagen')
  const [ancho, setAncho] = useState(grupo?.ancho != null ? String(grupo.ancho) : '')
  const [alto, setAlto] = useState(grupo?.alto != null ? String(grupo.alto) : '')
  const [elegidas, setElegidas] = useState<string[]>(() =>
    grupo ? vallas.filter((v) => v.grupoId === grupo.id).sort((a, b) => (a.posicion ?? 0) - (b.posicion ?? 0)).map((v) => v.id) : [],
  )
  const [enviando, setEnviando] = useState(false)
  const sugerida = medidaSugeridaDeGrupo(vallas.filter((v) => elegidas.includes(v.id)))

  async function guardar() {
    if (!numero.trim()) return
    setEnviando(true)
    const d = {
      numero: numero.trim(),
      nombre: nombre.trim() || null,
      modo,
      ancho: Number(ancho) > 0 ? Number(ancho) : null,
      alto: Number(alto) > 0 ? Number(alto) : null,
      vallaIds: elegidas,
    }
    try {
      if (grupo) await actualizarGrupoApi(grupo.id, d)
      else await crearGrupoApi(d)
      await onGuardado()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.guardar'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={grupo ? grupo.numero : t('vallas.grupos.nuevo')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button variant="success" size="sm" disabled={enviando || !numero.trim()} onClick={guardar}>{t('comun.guardar')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Campo label={t('vallas.grupo.campo.numero')} obligatorio>
            <input value={numero} maxLength={40} onChange={(e) => setNumero(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.grupo.campo.nombre')}>
            <input value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} className={ENTRADA} />
          </Campo>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-ink">{t('vallas.grupo.campo.modo')}</legend>
          {MODOS_GRUPO.map((m) => (
            <label key={m} className="flex items-start gap-2 text-[13px] text-ink">
              <input type="radio" name="modo" checked={modo === m} onChange={() => setModo(m)} className="mt-1" />
              <span>
                {t(`vallas.modo.${m}` as ClaveTexto)}
                <span className="block text-[11px] text-muted">{t(`vallas.modo.ayuda.${m}` as ClaveTexto)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-ink">{t('vallas.grupo.campo.vallas')}</legend>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
            {vallas.map((v) => (
              <label key={v.id} className="inline-flex items-center gap-2 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={elegidas.includes(v.id)}
                  onChange={(e) => setElegidas((x) => (e.target.checked ? [...x, v.id] : x.filter((y) => y !== v.id)))}
                />
                <span className="demo-num">{v.numero}</span>
                <span className="demo-num text-[12px] text-muted">{medida(v.ancho, v.alto)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-ink">{t('vallas.grupo.campo.medida')}</legend>
          <div className="grid grid-cols-2 gap-3">
            <Campo label={t('vallas.campo.ancho')} obligatorio={modo === 'una_imagen'}>
              <input type="number" min={0} step="0.01" value={ancho} onChange={(e) => setAncho(e.target.value)} className={ENTRADA} />
            </Campo>
            <Campo label={t('vallas.campo.alto')} obligatorio={modo === 'una_imagen'}>
              <input type="number" min={0} step="0.01" value={alto} onChange={(e) => setAlto(e.target.value)} className={ENTRADA} />
            </Campo>
          </div>
          {sugerida && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setAncho(String(sugerida.ancho))
                setAlto(String(sugerida.alto))
              }}
            >
              {t('vallas.grupo.sugerida', { medida: medida(sugerida.ancho, sugerida.alto) })}
            </Button>
          )}
        </fieldset>
      </div>
    </Modal>
  )
}

// ─── Competencia de marcas ──────────────────────────────────────────────────

const partirMarcas = (s: string) => s.split(/[\n,]/).map((x) => x.trim()).filter(Boolean)

function TarjetaCompetencia({ categorias, recargar }: { categorias: CategoriaCompetencia[] | null; recargar: () => Promise<void> }) {
  const { t } = useIdioma()
  const puede = usePuede('inventario', 'crear')
  const [edicion, setEdicion] = useState<CategoriaCompetencia | 'nueva' | null>(null)

  return (
    <CardColapsable
      id="vallas.competencia"
      titulo={t('vallas.competencia.titulo')}
      resumen={<span className="text-[12px] text-muted">{t('vallas.competencia.detalle')}</span>}
      accion={
        puede ? (
          <Button size="sm" variant="success" onClick={() => setEdicion('nueva')}>
            <Plus className="h-3.5 w-3.5" /> {t('vallas.competencia.nueva')}
          </Button>
        ) : undefined
      }
    >
      {categorias && categorias.length === 0 && <p className="text-[12px] text-muted">{t('vallas.competencia.vacio')}</p>}
      <ul className="m-0 list-none divide-y divide-border p-0">
        {(categorias ?? []).map((k) => (
          <li key={k.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${k.activo ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                {k.nombre}
                {!k.activo && (
                  <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-normal text-muted">
                    {t('vallas.competencia.inactiva')}
                  </span>
                )}
              </div>
              <div className="text-[12px] text-muted">{k.marcas.join(' · ')}</div>
            </div>
            {puede && (
              <Button size="sm" variant="secondary" onClick={() => setEdicion(k)}>
                <Pencil className="h-3.5 w-3.5" /> {t('vallas.editar')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {edicion && <FormCategoria categoria={edicion === 'nueva' ? null : edicion} onClose={() => setEdicion(null)} onGuardado={recargar} />}
    </CardColapsable>
  )
}

function FormCategoria({
  categoria,
  onClose,
  onGuardado,
}: {
  categoria: CategoriaCompetencia | null
  onClose: () => void
  onGuardado: () => Promise<void>
}) {
  const { t } = useIdioma()
  const [nombre, setNombre] = useState(categoria?.nombre ?? '')
  const [marcas, setMarcas] = useState((categoria?.marcas ?? []).join('\n'))
  const [activo, setActivo] = useState(categoria?.activo ?? true)
  const [enviando, setEnviando] = useState(false)

  async function guardar() {
    if (!nombre.trim()) return
    setEnviando(true)
    try {
      if (categoria) await actualizarCategoriaApi(categoria.id, { nombre: nombre.trim(), marcas: partirMarcas(marcas), activo })
      else await crearCategoriaApi({ nombre: nombre.trim(), marcas: partirMarcas(marcas) })
      await onGuardado()
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.guardar'))
    }
    setEnviando(false)
  }

  return (
    <Modal
      open
      onOpenChange={(v) => !v && onClose()}
      title={categoria ? categoria.nombre : t('vallas.competencia.nueva')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>{t('comun.cancelar')}</Button>
          <Button variant="success" size="sm" disabled={enviando || !nombre.trim()} onClick={guardar}>{t('comun.guardar')}</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Campo label={t('vallas.competencia.campo.nombre')} obligatorio>
          <input value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} className={ENTRADA} />
        </Campo>
        <Campo label={t('vallas.competencia.campo.marcas')}>
          <textarea value={marcas} rows={4} onChange={(e) => setMarcas(e.target.value)} className={ENTRADA} />
        </Campo>
        <p className="text-[11px] text-muted">{t('vallas.competencia.campo.marcas.ayuda')}</p>
        {categoria && (
          <label className="inline-flex items-center gap-2 text-[13px] text-ink">
            <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            {t('vallas.competencia.campo.activa')}
          </label>
        )}
      </div>
    </Modal>
  )
}

// ─── Verificar ──────────────────────────────────────────────────────────────

function TextoHallazgo({ h, vallas }: { h: Hallazgo; vallas: Valla[] }) {
  const { t } = useIdioma()
  if (h.regla === 'competencia-marcas' && h.datos) {
    const d = h.datos as Record<string, string | null>
    return (
      <>
        {t('vallas.hallazgo.competencia', {
          marca: d.marca ?? '',
          otra: d.marcaExistente ?? '',
          categoria: d.categoria ?? '',
          valla: vallas.find((v) => v.id === d.vallaOcupada)?.numero ?? '',
          inicio: d.inicio ?? '',
          fin: d.fin ?? '',
          campana: d.campanaNombre ?? '',
        })}
      </>
    )
  }
  return <>{h.mensaje}</>
}

function TarjetaVerificar({ vallas }: { vallas: Valla[] }) {
  const { t } = useIdioma()
  const [marca, setMarca] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [elegidas, setElegidas] = useState<string[]>([])
  const [resultado, setResultado] = useState<ResultadoReglas | null>(null)
  const [enviando, setEnviando] = useState(false)
  const listo = marca.trim() && desde && hasta && elegidas.length > 0

  async function verificar() {
    if (!listo) return
    setEnviando(true)
    try {
      setResultado(await verificarVallasApi({ marca: marca.trim(), fechaInicio: desde, fechaFin: hasta, vallaIds: elegidas }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('vallas.error.cargar'))
    }
    setEnviando(false)
  }

  return (
    <CardColapsable
      id="vallas.verificar"
      titulo={t('vallas.verificar.titulo')}
      resumen={<span className="text-[12px] text-muted">{t('vallas.verificar.detalle')}</span>}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Campo label={t('vallas.verificar.marca')}>
            <input value={marca} maxLength={120} onChange={(e) => setMarca(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.verificar.desde')}>
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={ENTRADA} />
          </Campo>
          <Campo label={t('vallas.verificar.hasta')}>
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={ENTRADA} />
          </Campo>
        </div>
        <fieldset className="space-y-1.5">
          <legend className="text-[12px] font-medium text-ink">{t('vallas.verificar.vallas')}</legend>
          <div className="flex flex-wrap gap-3">
            {vallas.map((v) => (
              <label key={v.id} className="inline-flex items-center gap-1.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={elegidas.includes(v.id)}
                  onChange={(e) => setElegidas((x) => (e.target.checked ? [...x, v.id] : x.filter((y) => y !== v.id)))}
                />
                <span className="demo-num">{v.numero}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Button size="sm" variant="success" disabled={enviando || !listo} onClick={verificar}>
          {t('vallas.verificar.boton')}
        </Button>
        {resultado &&
          (resultado.hallazgos.length === 0 ? (
            <p className="flex items-center gap-1.5 text-[13px] text-success">
              <ShieldCheck className="h-4 w-4" /> {t('vallas.verificar.sin-hallazgos')}
            </p>
          ) : (
            <ul className="m-0 list-none space-y-1.5 p-0">
              {resultado.hallazgos.map((h, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[13px] text-ink">
                  <ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${h.nivel === 'bloqueo' ? 'text-danger' : 'text-warning'}`} />
                  <span>
                    <strong className="font-medium">{t(h.nivel === 'bloqueo' ? 'vallas.verificar.bloquea' : 'vallas.verificar.aviso')}:</strong>{' '}
                    <TextoHallazgo h={h} vallas={vallas} />
                  </span>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </CardColapsable>
  )
}
