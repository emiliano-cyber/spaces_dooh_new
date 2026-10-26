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
const montoEntero = (n: number) => formatMonto(Math.round(n)).replace('.00', '')

export function GestionPaquetes() {
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
      setError(e instanceof Error ? e.message : 'No se pudo leer el catálogo de paquetes')
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
    const motivo = motivoPaqueteInvalido({
      nombre: nuevo.nombre,
      precioCerrado: nuevo.precioCerrado as unknown as number,
      sitios: nuevo.sitios,
    })
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
      setError(e instanceof Error ? e.message : 'No se pudo guardar el paquete')
    }
  }

  async function alternarActivo(p: PaqueteUI) {
    try {
      await guardarPaqueteApi({ ...p, activo: !p.activo })
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar el paquete')
    }
  }

  async function eliminar(id: string) {
    try {
      await borrarPaqueteApi(id)
      await cargar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar el paquete')
    }
  }

  // Esqueleto y no un «Cargando…» en texto (rediseño del 2026-10-26).
  if (cargando) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Cargando los paquetes">
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
        <b>El precio del paquete SUSTITUYE la suma de las tarifas de lista: no la descuenta, la
        reemplaza.</b>{' '}
        Da igual lo que sumen las pantallas — se cobra el precio del paquete.
        <br />
        Por eso un paquete <b>no admite descuento por volumen</b> (su precio ya lo lleva dentro) ni
        código de negociación, salvo que marques la casilla de abajo. El descuento comercial de la
        propuesta sí se sigue aplicando encima.
        <br />
        Y <b>quitar una pantalla de una propuesta ya cotizada NO baja el precio</b>: el reparto se
        recalcula entre las que quedan y la propuesta lo avisa.
      </div>

      {/* PLEG-02 · la lista se pliega; el aviso de arriba y el alta de abajo
          no (el alta es un formulario y plegarlo borraría la vista de lo que se
          está capturando).

          Rediseño del 2026-10-26 · subtítulo de una frase y la explicación
          como primera línea del contenido: con dos renglones de subtítulo el
          chevrón de plegar se caía debajo del texto. */}
      <CardColapsable
        id="paquetes.lista"
        titulo="Paquetes de la organización"
        subtitulo="Se reparte a prorrata de la tarifa de lista"
        contentClassName="space-y-3"
      >
        <p className="rounded-md border border-border bg-surface-2 px-4 py-2 text-[12px] text-muted">
          El precio se reparte entre las pantallas <b>a prorrata de su tarifa de lista</b>, y la
          suma de las partes da el precio del paquete <b>al peso</b>. Ese reparto es el ingreso
          que el reporte de rentabilidad le atribuye a cada pantalla.
        </p>
        <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-medium">Paquete</th>
              <th className="px-3 py-2 font-medium">Pantallas</th>
              <th className="px-3 py-2 text-right font-medium">Precio cerrado</th>
              <th className="px-3 py-2 font-medium">¿Códigos?</th>
              <th className="px-3 py-2 text-right font-medium">En uso</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paquetes.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-2.5 text-muted">
                  Todavía no hay ninguno. Sin paquetes, todo se vende al precio de tarifa — que es
                  exactamente como funciona hoy.
                </td>
              </tr>
            )}
            {paquetes.map((p) => (
              <tr key={p.id} className={p.activo ? '' : 'text-muted'}>
                <td className="px-3 py-2.5">
                  <div className={p.activo ? 'font-medium text-ink' : ''}>{p.nombre}</div>
                  {/* El estado con chip y palabra, no solo con el gris. */}
                  <StatusBadge tono={p.activo ? 'verde' : 'neutro'} className="mt-1">
                    {p.activo ? 'Activo' : 'Desactivado'}
                  </StatusBadge>
                </td>
                {/* Los nombres A LA VISTA, en una línea recortada; el `title`
                    se queda para la lista completa. Antes solo estaban en el
                    `title`, y en una pantalla táctil no se veían nunca. */}
                <td className="max-w-[18rem] px-3 py-2.5" title={p.sitios.map(nombreDe).join(' · ')}>
                  <div className="demo-num text-ink">{p.sitios.length} pantalla{p.sitios.length === 1 ? '' : 's'}</div>
                  <div className="truncate text-[11px] text-muted">{p.sitios.map(nombreDe).join(' · ')}</div>
                </td>
                <td className="demo-num whitespace-nowrap px-3 py-2.5 text-right font-medium">{montoEntero(p.precioCerrado)}</td>
                <td className="px-3 py-2.5">
                  <span className="whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                    {p.admiteCodigo ? 'Admite código' : 'Precio final'}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span
                    className="demo-num whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] text-muted"
                    title="Propuestas que aplican este paquete"
                  >
                    En uso · {p.aplicadoEn}
                  </span>
                </td>
                <td className="space-x-3 whitespace-nowrap px-3 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => void alternarActivo(p)}
                    className="text-[12px] font-medium text-info hover:underline"
                    title="Desactivar conserva la definición y deja de poder venderse. Lo ya cotizado y lo ya aprobado no se mueven."
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                  <Button
                    type="button"
                    onClick={() => void eliminar(p.id)}
                    size="sm"
                    variant="ghost"
                    className="text-error hover:text-error"
                    title="Eliminar: ninguna venta se mueve, porque su precio ya está copiado en cada propuesta. Lo que se pierde es saber de qué paquete salió."
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
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
          <Package className="h-4 w-4 text-muted" /> Nuevo paquete
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[12px]" data-falta={ob.falta('nombre') || undefined}>
            <EtiquetaCompacta texto="Nombre" obligatorio falta={ob.falta('nombre')} />
            <input
              aria-label="Nombre del paquete"
              className={`${CAMPO} w-56`}
              placeholder="p. ej. Paquete Periférico"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
          </label>
          <label className="text-[12px]" data-falta={ob.falta('precioCerrado') || undefined}>
            <EtiquetaCompacta texto="Precio del conjunto (pesos enteros)" obligatorio falta={ob.falta('precioCerrado')} />
            {/* Pesos ENTEROS (decimales 0): el reparto no admite centavos. Lo
                que no se entiende llega como 'NaN' y `motivoPaqueteInvalido`
                lo rechaza («tiene que ser un numero»). */}
            <CampoCifra
              aria-label="Precio cerrado del paquete"
              decimales={0}
              className={`${CAMPO} demo-num w-36 text-right`}
              placeholder="p. ej. 180,000"
              valor={nuevo.precioCerrado}
              onCambio={(crudo) => setNuevo({ ...nuevo, precioCerrado: crudo })}
            />
          </label>
          <label className="flex h-9 items-center gap-1.5 text-[12px] text-ink">
            <input
              type="checkbox"
              aria-label="Admite código de negociación encima"
              checked={nuevo.admiteCodigo}
              onChange={(e) => setNuevo({ ...nuevo, admiteCodigo: e.target.checked })}
            />
            Admite código de negociación encima
          </label>
        </div>

        <div className="mt-4">
          <p className={`mb-1 text-[12px] ${ob.falta('sitios') ? 'text-error' : 'text-muted'}`}>
            Pantallas del paquete
            <span aria-hidden="true" className="ml-0.5 text-error">*</span>
            <span className="sr-only"> (obligatorio)</span> (mínimo 2). Una propuesta solo puede aplicar este paquete si
            tiene <b>exactamente</b> estas pantallas.
            <span className="ml-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
              <span className="demo-num">{nuevo.sitios.length}</span> elegida{nuevo.sitios.length === 1 ? '' : 's'}
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
                <span className="demo-num shrink-0 text-[12px] text-muted">{montoEntero(listaDe(s.id))} de lista</span>
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
                Lista <span className="demo-num text-ink">{montoEntero(sumaListas)}</span>
              </span>
              <span className="text-muted">
                Paquete <span className="demo-num font-medium text-ink">{montoEntero(precio)}</span>
              </span>
              {sumaListas > 0 && (
                <span className={precio < sumaListas ? 'text-muted' : 'font-medium text-[#9a6700]'}>
                  {precio < sumaListas
                    ? <>se deja de cobrar <span className="demo-num text-ink">{montoEntero(sumaListas - precio)}</span></>
                    : <>se cobra <span className="demo-num">{montoEntero(precio - sumaListas)}</span> POR ENCIMA de la lista</>}
                </span>
              )}
            </div>
            <p className="text-[12px] text-muted">
              Así se repartiría entre las pantallas — y esto es lo que el reporte de rentabilidad
              le atribuirá a cada una:
            </p>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">Pantalla</th>
                    <th className="px-3 py-2 text-right font-medium">Lista</th>
                    <th className="px-3 py-2 text-right font-medium">Parte del paquete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previsto.map((x) => (
                    <tr key={x.id}>
                      <td className="px-3 py-2 text-ink">{nombreDe(x.id)}</td>
                      <td className="demo-num whitespace-nowrap px-3 py-2 text-right text-muted">{montoEntero(x.lista)}</td>
                      <td className="demo-num whitespace-nowrap px-3 py-2 text-right font-medium text-ink">{montoEntero(x.parte)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border-strong">
                    <td className="px-3 py-2 font-medium text-ink" colSpan={2}>
                      Suma de las partes <span className="font-normal text-muted">— cuadra al peso</span>
                    </td>
                    <td className="demo-num whitespace-nowrap px-3 py-2 text-right font-semibold text-ink">
                      {montoEntero(previsto.reduce((s, x) => s + x.parte, 0))}
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
            <Plus className="h-3.5 w-3.5" /> Crear paquete
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
  return (
    <span className={`mb-0.5 block ${falta ? 'text-error' : 'text-muted'}`}>
      {texto}
      {obligatorio && (
        <>
          <span aria-hidden="true" className="ml-0.5 text-error">*</span>
          <span className="sr-only"> (obligatorio)</span>
        </>
      )}
    </span>
  )
}
