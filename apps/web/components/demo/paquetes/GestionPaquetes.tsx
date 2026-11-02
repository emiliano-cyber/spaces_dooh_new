'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Trash2, Plus, Package } from 'lucide-react'
import {
  paquetesApi,
  guardarPaqueteApi,
  borrarPaqueteApi,
  type PaqueteUI,
} from '@/lib/data/paquetes-api'
import { motivoPaqueteInvalido, repartirPaquete } from '@/lib/paquete'
import { useSitios, formatMonto } from '@/lib/data/client'
import { StatusBadge } from '@/components/demo/StatusBadge'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { useObligatorios } from '@/components/demo/ui/Campo'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { useIdioma } from '@/lib/i18n/contexto'
import { interpolarNodos } from '@/lib/i18n/nodos'
import type { Idioma } from '@/lib/i18n/idiomas'

// ============================================================================
//  El CATÁLOGO DE PAQUETES CERRADOS de la organización. ADR 0039, Fase 4.
// ----------------------------------------------------------------------------
//  LA VALIDACIÓN SE HACE AQUÍ **Y** EN EL SERVIDOR, y no es duplicación: la de
//  aquí sirve para que el dueño vea el problema ANTES de mandar, y la del
//  servidor es la que manda. Las dos llaman a la MISMA función de
//  `lib/paquete.ts` —`motivoPaqueteInvalido`—, así que no pueden divergir.
//
//  ─── LA PANTALLA ENSEÑA EL REPARTO, Y ESO ES LO MÁS ÚTIL QUE HACE ─────────
//  Un paquete no es solo un precio: es un precio que se va a repartir entre sus
//  pantallas, y ese reparto acaba en `reservas.precio`, o sea en el reporte de
//  rentabilidad y en la comparación contra la renta de cada arrendador. Si el
//  dueño no lo viera al capturar, lo descubriría meses después mirando por qué
//  una pantalla aparece en pérdida.
//
//  Se calcula con la MISMA función pura que usa el servidor (`repartirPaquete`),
//  así que lo que se ve aquí es exactamente lo que se congelará. No es una
//  estimación.
//
//  ─── LA PANTALLA DICE LO QUE CUESTA, con esas palabras ───────────────────
//  Un paquete SUSTITUYE la suma de las tarifas: no la descuenta, la reemplaza.
//  Y no admite descuento por volumen, ni código de negociación salvo que su
//  bandera lo permita. Callar eso haría que el dueño capturara una cosa
//  creyendo otra y lo descubriera en la primera cotización — o peor, no lo
//  descubriera.
//
//  EL BOTÓN DICE «ELIMINAR» Y ES LA VERDAD: nada del precio de una venta
//  depende de esta fila, porque al aplicar el paquete todo se copió a la
//  propuesta. Lo que se pierde es el enlace, y la pantalla lo avisa cuando hay
//  propuestas vivas usándolo.
// ============================================================================

const vacio = { nombre: '', precioCerrado: '', admiteCodigo: false, sitios: [] as string[] }

// Pesos ENTEROS con el formato común de la app (`formatMonto`: «$ 180,000»).
// Hasta el 2026-10-26 era un `pesos()` propio («$180,000»). Se conserva el
// mismo redondeo a peso de la pantalla de antes —el precio y las partes del
// reparto ya son enteros; la tarifa de lista puede traer centavos y se
// enseñaba redondeada— y solo se quita el «.00», que en un precio que no
// admite centavos sería ruido. NO toca `repartirPaquete`.
// I18N (lote catalogos) · el idioma solo cambia el simbolo («MX$» en ingles en
// una instancia MXN); el redondeo y el formato son los de siempre.
const montoEntero = (n: number, idioma: Idioma = 'es') => formatMonto(Math.round(n), idioma).replace('.00', '')

export function GestionPaquetes() {
  const { idioma, t } = useIdioma()
  const sitios = useSitios()
  const [paquetes, setPaquetes] = useState<PaqueteUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ ...vacio })
  // OBLIG-01 · lo que exige el servidor (`paquetes-controller.ts:37-55`): el
  // nombre, el precio y las pantallas. Que sean al menos dos lo dice
  // `motivoPaqueteInvalido`; aquí solo se marca la lista VACÍA.
  const ob = useObligatorios(nuevo, ['nombre', 'precioCerrado', 'sitios'])

  const cargar = useCallback(async () => {
    try {
      setPaquetes(await paquetesApi())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('catalogos.paquetes.no-leer'))
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const nombreDe = useCallback(
    (id: string) => (sitios ?? []).find((s) => s.id === id)?.nombre ?? id,
    [sitios],
  )
  // La tarifa de lista de cada pantalla, que es el PESO del reparto. Se lee del
  // inventario cargado; una pantalla sin tarifa pesa 0 y el reparto lo resuelve
  // repartiendo equitativamente si todas pesan 0 (ver `repartirPaquete`).
  const listaDe = useCallback(
    (id: string) => {
      const s: any = (sitios ?? []).find((x) => x.id === id)
      const v = Number(s?.tarifaMensual ?? s?.tarifa_mensual ?? 0)
      return Number.isFinite(v) ? v : 0
    },
    [sitios],
  )

  // La PREVISTA del reparto del paquete que se está capturando. Misma función
  // que el servidor: lo que se ve aquí es lo que se congelará.
  const previsto = useMemo(() => {
    const total = Number(nuevo.precioCerrado)
    if (!Number.isFinite(total) || total <= 0 || nuevo.sitios.length === 0) return null
    const partes = repartirPaquete(nuevo.sitios.map(listaDe), total)
    return nuevo.sitios.map((id, i) => ({ id, parte: partes[i] ?? 0, lista: listaDe(id) }))
  }, [nuevo.precioCerrado, nuevo.sitios, listaDe])

  const sumaListas = useMemo(
    () => nuevo.sitios.reduce((s, id) => s + listaDe(id), 0),
    [nuevo.sitios, listaDe],
  )

  async function anadir() {
    const completos = ob.validar()
    // Se manda lo TECLEADO y no un `Number(...) || 0`: ese respaldo convertiría
    // «abc» en un paquete de precio 0, que la validación rechazaría con el
    // mensaje equivocado. Quien valida es `motivoPaqueteInvalido`.
    const motivo = motivoPaqueteInvalido(
      {
        nombre: nuevo.nombre,
        precioCerrado: nuevo.precioCerrado as unknown as number,
        sitios: nuevo.sitios,
      },
      idioma,
    )
    if (!completos || motivo) return setError(motivo)
    try {
      await guardarPaqueteApi({
        nombre: nuevo.nombre.trim(),
        precioCerrado: Number(nuevo.precioCerrado),
        admiteCodigo: nuevo.admiteCodigo,
        activo: true,
        sitios: nuevo.sitios,
      })
      setNuevo({ ...vacio })
      ob.reiniciar()
      await cargar()
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('catalogos.paquetes.no-guardar'))
    }
  }

  async function alternarActivo(p: PaqueteUI) {
    try {
      await guardarPaqueteApi({ ...p, activo: !p.activo })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('catalogos.paquetes.no-cambiar'))
    }
  }

  async function eliminar(id: string) {
    try {
      await borrarPaqueteApi(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('catalogos.paquetes.no-eliminar'))
    }
  }

  // Esqueleto y no un «Cargando…» en texto (rediseño del 2026-10-26).
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label={t('catalogos.paquetes.cargando')}>
        <div className="h-20 animate-pulse rounded-md bg-surface-2" />
        <div className="h-40 animate-pulse rounded-md bg-surface-2" />
      </div>
    )
  }

  const precio = Number(nuevo.precioCerrado)

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-error bg-error-soft px-3 py-2 text-[13px] text-error">
          {error}
        </p>
      )}

      {/* La franja ámbar del proyecto (tokens del Dashboard); mismo texto. */}
      <div className="rounded-md border border-[#f59e0b40] bg-warning-soft px-3 py-2 text-[12px] text-[#9a6700]">
        <b>{t('catalogos.paquetes.aviso.sustituye')}</b>{' '}
        {t('catalogos.paquetes.aviso.da-igual')}
        <br />
        {interpolarNodos(t('catalogos.paquetes.aviso.volumen'), { negrita: <b>{t('catalogos.paquetes.aviso.volumen.negrita')}</b> })}
        <br />
        {interpolarNodos(t('catalogos.paquetes.aviso.quitar'), { negrita: <b>{t('catalogos.paquetes.aviso.quitar.negrita')}</b> })}
      </div>

      {/* PLEG-02 · la lista se pliega; el aviso de arriba y el alta de abajo
          no (el alta es un formulario y plegarlo borraría la vista de lo que se
          está capturando).

          Rediseño del 2026-10-26 · subtítulo de una frase y la explicación
          como primera línea del contenido: con dos renglones de subtítulo el
          chevrón de plegar se caía debajo del texto. */}
      <CardColapsable
        id="paquetes.lista"
        titulo={t('catalogos.paquetes.lista.titulo')}
        subtitulo={t('catalogos.paquetes.lista.subtitulo')}
        contentClassName="space-y-3"
      >
        <p className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted">
          {interpolarNodos(t('catalogos.paquetes.lista.explicacion'), {
            prorrata: <b>{t('catalogos.paquetes.lista.explicacion.prorrata')}</b>,
            peso: <b>{t('catalogos.paquetes.lista.explicacion.peso')}</b>,
          })}
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">{t('catalogos.paquetes.col.paquete')}</th>
              <th className="px-3 py-2 font-medium">{t('catalogos.paquetes.col.pantallas')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('catalogos.paquetes.col.precio')}</th>
              <th className="px-3 py-2 font-medium">{t('catalogos.paquetes.col.codigos')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('catalogos.paquetes.col.en-uso')}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paquetes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-2.5 text-muted">
                  {t('catalogos.paquetes.vacio')}
                </td>
              </tr>
            )}
            {paquetes.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'text-muted'}>
                <td className="px-3 py-2.5">
                  <div className={p.activo ? 'font-medium text-ink' : ''}>{p.nombre}</div>
                  {/* El estado con chip y palabra, no solo con el gris. */}
                  <StatusBadge tono={p.activo ? 'verde' : 'neutro'} className="mt-1">
                    {p.activo ? t('catalogos.paquetes.activo') : t('catalogos.paquetes.desactivado')}
                  </StatusBadge>
                </td>
                {/* Los nombres A LA VISTA, en una línea recortada; el `title`
                    se queda para la lista completa. Antes solo estaban en el
                    `title`, y en una pantalla táctil no se veían nunca. */}
                <td className="max-w-[18rem] px-3 py-2.5" title={p.sitios.map(nombreDe).join(' · ')}>
                  <div className="demo-num text-ink">{t(p.sitios.length === 1 ? 'catalogos.paquetes.pantallas.uno' : 'catalogos.paquetes.pantallas.otros', { n: p.sitios.length })}</div>
                  <div className="truncate text-[11px] text-muted">{p.sitios.map(nombreDe).join(' · ')}</div>
                </td>
                <td className="demo-num whitespace-nowrap px-3 py-2.5 text-right font-medium">{montoEntero(p.precioCerrado, idioma)}</td>
                <td className="px-3 py-2.5">
                  <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                    {p.admiteCodigo ? t('catalogos.paquetes.admite-codigo') : t('catalogos.paquetes.precio-final')}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className="demo-num whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                    title={t('catalogos.paquetes.en-uso.title')}
                  >
                    {t('catalogos.paquetes.en-uso', { n: p.aplicadoEn })}
                  </span>
                </td>
                <td className="space-x-3 whitespace-nowrap px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => void alternarActivo(p)}
                    className="text-[12px] font-medium text-info hover:underline"
                    title={t('catalogos.paquetes.desactivar.title')}
                  >
                    {p.activo ? t('catalogos.paquetes.desactivar') : t('catalogos.paquetes.activar')}
                  </button>
                  <Button
                    type="button"
                    onClick={() => void eliminar(p.id)}
                    size="sm"
                    variant="ghost"
                    className="text-error hover:text-error"
                    title={t('catalogos.paquetes.eliminar.title')}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {t('catalogos.comun.eliminar')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </CardColapsable>

      {/* Rediseño del 2026-10-26 · el formulario en el orden en que se piensa:
          nombre y precio → pantallas → reparto previsto → «Crear paquete» AL
          FINAL. El botón estaba arriba, antes de haber elegido pantallas. Es el
          mismo `anadir()`. */}
      <section className="rounded-md border border-border bg-surface p-4">
        <h3 className="mb-3 flex items-center gap-1.5 text-[14px] font-medium text-ink">
          <Package className="h-4 w-4 text-muted" /> {t('catalogos.paquetes.nuevo')}
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px]" data-falta={ob.falta('nombre') || undefined}>
            <EtiquetaCompacta texto={t('catalogos.comun.nombre')} obligatorio falta={ob.falta('nombre')} />
            <input
              aria-label={t('catalogos.paquetes.nombre.aria')}
              className={`${CAMPO} w-56`}
              placeholder={t('catalogos.paquetes.nombre.placeholder')}
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
          </label>
          <label className="text-[12px]" data-falta={ob.falta('precioCerrado') || undefined}>
            <EtiquetaCompacta texto={t('catalogos.paquetes.precio')} obligatorio falta={ob.falta('precioCerrado')} />
            {/* Pesos ENTEROS (decimales 0): el reparto no admite centavos. Lo
                que no se entiende llega como 'NaN' y `motivoPaqueteInvalido`
                lo rechaza («tiene que ser un numero»). */}
            <CampoCifra
              aria-label={t('catalogos.paquetes.precio.aria')}
              decimales={0}
              idioma={idioma}
              className={`${CAMPO} demo-num w-36 text-right`}
              placeholder={t('catalogos.paquetes.precio.placeholder', { ejemplo: '180,000' })}
              valor={nuevo.precioCerrado}
              onCambio={(crudo) => setNuevo({ ...nuevo, precioCerrado: crudo })}
            />
          </label>
          <label className="flex h-9 items-center gap-1.5 text-[12px] text-ink">
            <input
              type="checkbox"
              aria-label={t('catalogos.paquetes.admite-codigo-encima')}
              checked={nuevo.admiteCodigo}
              onChange={(e) => setNuevo({ ...nuevo, admiteCodigo: e.target.checked })}
            />
            {t('catalogos.paquetes.admite-codigo-encima')}
          </label>
        </div>

        <div className="mt-4">
          <p className={`mb-1 text-[12px] ${ob.falta('sitios') ? 'text-error' : 'text-muted'}`}>
            {t('catalogos.paquetes.pantallas-del-paquete')}
            <span aria-hidden="true" className="ml-0.5 text-error">*</span>
            <span className="sr-only">{t('compartidos.campo.obligatorio')}</span>
            {interpolarNodos(t('catalogos.paquetes.minimo'), { exactamente: <b>{t('catalogos.paquetes.minimo.exactamente')}</b> })}
            <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              {interpolarNodos(
                t(nuevo.sitios.length === 1 ? 'catalogos.paquetes.elegidas.uno' : 'catalogos.paquetes.elegidas.otros'),
                { n: <span className="demo-num">{nuevo.sitios.length}</span> },
              )}
            </span>
          </p>
          <div className={`max-h-56 divide-y divide-border overflow-auto rounded-md border px-3 py-1 ${ob.falta('sitios') ? 'border-error' : 'border-border'}`}>
            {(sitios ?? []).map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-1.5 text-[13px] text-ink">
                <input
                  type="checkbox"
                  checked={nuevo.sitios.includes(s.id)}
                  onChange={(e) =>
                    setNuevo({
                      ...nuevo,
                      sitios: e.target.checked
                        ? [...nuevo.sitios, s.id]
                        : nuevo.sitios.filter((x) => x !== s.id),
                    })
                  }
                />
                <span className="min-w-0 flex-1 truncate">{s.nombre}</span>
                <span className="demo-num shrink-0 text-[12px] text-muted">{t('catalogos.paquetes.de-lista', { monto: montoEntero(listaDe(s.id), idioma) })}</span>
              </label>
            ))}
          </div>
        </div>

        {previsto && (
          // Rediseño del 2026-10-26 · el reparto previsto es LA pieza de esta
          // pantalla y se leía como una nota azul. Ahora es una tabla de dinero:
          // los MISMOS `previsto` y `sumaListas`, con el resumen arriba en la
          // franja secundaria del Dashboard.
          <div className="mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px]">
              <span className="text-muted">
                {interpolarNodos(t('catalogos.paquetes.resumen.lista'), { monto: <span className="demo-num text-ink">{montoEntero(sumaListas, idioma)}</span> })}
              </span>
              <span className="text-muted">
                {interpolarNodos(t('catalogos.paquetes.resumen.paquete'), { monto: <span className="demo-num font-medium text-ink">{montoEntero(precio, idioma)}</span> })}
              </span>
              {sumaListas > 0 && (
                <span className={precio < sumaListas ? 'text-muted' : 'font-medium text-[#9a6700]'}>
                  {precio < sumaListas
                    ? interpolarNodos(t('catalogos.paquetes.resumen.deja-de-cobrar'), { monto: <span className="demo-num text-ink">{montoEntero(sumaListas - precio, idioma)}</span> })
                    : interpolarNodos(t('catalogos.paquetes.resumen.por-encima'), { monto: <span className="demo-num">{montoEntero(precio - sumaListas, idioma)}</span> })}
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted">
              {t('catalogos.paquetes.reparto.intro')}
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">{t('catalogos.paquetes.reparto.pantalla')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('catalogos.paquetes.reparto.lista')}</th>
                    <th className="px-3 py-2 text-right font-medium">{t('catalogos.paquetes.reparto.parte')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previsto.map((x) => (
                    <tr key={x.id}>
                      <td className="px-3 py-2 text-ink">{nombreDe(x.id)}</td>
                      <td className="demo-num whitespace-nowrap px-3 py-2 text-right text-muted">{montoEntero(x.lista, idioma)}</td>
                      <td className="demo-num whitespace-nowrap px-3 py-2 text-right font-medium text-ink">{montoEntero(x.parte, idioma)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border-strong">
                    <td className="px-3 py-2 font-medium text-ink" colSpan={2}>
                      {interpolarNodos(t('catalogos.paquetes.reparto.suma'), { cuadra: <span className="font-normal text-muted">{t('catalogos.paquetes.reparto.cuadra')}</span> })}
                    </td>
                    <td className="demo-num whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                      {montoEntero(previsto.reduce((s, x) => s + x.parte, 0), idioma)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            onClick={() => void anadir()}
            size="sm"
            variant="success"
          >
            <Plus className="h-3.5 w-3.5" /> {t('catalogos.paquetes.crear')}
          </Button>
        </div>
      </section>
    </div>
  )
}

// Campos del alto y el borde del resto de los formularios (rediseño del
// 2026-10-26); el `placeholder` en gris para que no se lea como un valor.
const CAMPO =
  'h-9 rounded border border-border-strong bg-surface px-2 text-[13px] text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent'

// OBLIG-01 · la etiqueta de la fila de alta, con asterisco y en rojo si falta.
// NO es el `Campo` compartido a propósito: la fila es `items-end` con anchos
// fijos, y el «Falta este dato» que `Campo` pinta debajo subiría la casilla
// que falta por encima de las demás. El borde rojo del control lo pone igual
// `globals.css` por el `data-falta` del <label>; el motivo, el aviso de arriba.
function EtiquetaCompacta({ texto, obligatorio = false, falta = false }: { texto: string; obligatorio?: boolean; falta?: boolean }) {
  const t = useIdioma().t
  return (
    <span className={`mb-0.5 block ${falta ? 'text-error' : 'text-muted'}`}>
      {texto}
      {obligatorio && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-error">*</span>
          <span className="sr-only">{t('compartidos.campo.obligatorio')}</span>
        </>
      )}
    </span>
  )
}
