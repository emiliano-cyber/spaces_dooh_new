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
import { useSitios } from '@/lib/data/client'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'

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
//  Y no admite descuento por volumen, ni código promocional salvo que su
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

const pesos = (n: number) => `$${Math.round(n).toLocaleString('es-MX')}`

export function GestionPaquetes() {
  const sitios = useSitios()
  const [paquetes, setPaquetes] = useState<PaqueteUI[]>([])
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [nuevo, setNuevo] = useState({ ...vacio })

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
    // Se manda lo TECLEADO y no un `Number(...) || 0`: ese respaldo convertiría
    // «abc» en un paquete de precio 0, que la validación rechazaría con el
    // mensaje equivocado. Quien valida es `motivoPaqueteInvalido`.
    const motivo = motivoPaqueteInvalido({
      nombre: nuevo.nombre,
      precioCerrado: nuevo.precioCerrado as unknown as number,
      sitios: nuevo.sitios,
    })
    if (motivo) return setError(motivo)
    try {
      await guardarPaqueteApi({
        nombre: nuevo.nombre.trim(),
        precioCerrado: Number(nuevo.precioCerrado),
        admiteCodigo: nuevo.admiteCodigo,
        activo: true,
        sitios: nuevo.sitios,
      })
      setNuevo({ ...vacio })
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

  if (cargando) return <p className="text-sm text-neutral-500">Cargando los paquetes…</p>

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        <b>El precio del paquete SUSTITUYE la suma de las tarifas de lista: no la descuenta, la
        reemplaza.</b>{' '}
        Da igual lo que sumen las pantallas — se cobra el precio del paquete.
        <br />
        Por eso un paquete <b>no admite descuento por volumen</b> (su precio ya lo lleva dentro) ni
        código promocional, salvo que marques la casilla de abajo. El descuento comercial de la
        propuesta sí se sigue aplicando encima.
        <br />
        Y <b>quitar una pantalla de una propuesta ya cotizada NO baja el precio</b>: el reparto se
        recalcula entre las que quedan y la propuesta lo avisa.
      </div>

      <section>
        <h2 className="mb-1 text-sm font-semibold">Paquetes de la organización</h2>
        <p className="mb-3 text-xs text-neutral-500">
          El precio se reparte entre las pantallas <b>a prorrata de su tarifa de lista</b>, y la
          suma de las partes da el precio del paquete <b>al peso</b>. Ese reparto es el ingreso que
          el reporte de rentabilidad le atribuye a cada pantalla.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-neutral-500">
              <th className="py-1">Paquete</th>
              <th>Pantallas</th>
              <th>Precio cerrado</th>
              <th>¿Códigos?</th>
              <th>En uso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {paquetes.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 text-neutral-500">
                  Todavía no hay ninguno. Sin paquetes, todo se vende al precio de tarifa — que es
                  exactamente como funciona hoy.
                </td>
              </tr>
            )}
            {paquetes.map((p) => (
              <tr key={p.id} className={`border-b ${p.activo ? '' : 'text-neutral-400'}`}>
                <td className="py-1.5">
                  {p.nombre}
                  {!p.activo && <span className="ml-1 text-xs">(desactivado)</span>}
                </td>
                <td title={p.sitios.map(nombreDe).join(' · ')}>{p.sitios.length}</td>
                <td>{pesos(p.precioCerrado)}</td>
                <td>{p.admiteCodigo ? 'Sí' : 'No — precio final'}</td>
                <td>{p.aplicadoEn}</td>
                <td className="space-x-3 text-right">
                  <button
                    type="button"
                    onClick={() => void alternarActivo(p)}
                    className="text-xs hover:underline"
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
      </section>

      <section className="rounded-md border p-3">
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
          <Package className="h-4 w-4" /> Nuevo paquete
        </h3>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs">
            <span className="mb-0.5 block text-neutral-500">Nombre</span>
            <input
              aria-label="Nombre del paquete"
              className="w-56 rounded border px-2 py-1 text-sm"
              placeholder="Paquete Periférico"
              value={nuevo.nombre}
              onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-neutral-500">Precio del conjunto (pesos enteros)</span>
            {/* Pesos ENTEROS (decimales 0): el reparto no admite centavos. Lo
                que no se entiende llega como 'NaN' y `motivoPaqueteInvalido`
                lo rechaza («tiene que ser un numero»). */}
            <CampoCifra
              aria-label="Precio cerrado del paquete"
              decimales={0}
              className="w-36 rounded border px-2 py-1 text-sm"
              placeholder="180000"
              valor={nuevo.precioCerrado}
              onCambio={(crudo) => setNuevo({ ...nuevo, precioCerrado: crudo })}
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              aria-label="Admite código promocional encima"
              checked={nuevo.admiteCodigo}
              onChange={(e) => setNuevo({ ...nuevo, admiteCodigo: e.target.checked })}
            />
            Admite código promocional encima
          </label>
          <Button
            type="button"
            onClick={() => void anadir()}
            size="sm"
            variant="success"
          >
            <Plus className="h-3.5 w-3.5" /> Crear paquete
          </Button>
        </div>

        <div className="mt-3">
          <p className="mb-1 text-xs text-neutral-500">
            Pantallas del paquete (mínimo 2). Una propuesta solo puede aplicar este paquete si
            tiene <b>exactamente</b> estas pantallas.
          </p>
          <div className="max-h-56 overflow-auto rounded border p-2">
            {(sitios ?? []).map((s) => (
              <label key={s.id} className="flex items-center gap-2 py-0.5 text-xs">
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
                {s.nombre}
                <span className="text-neutral-400">{pesos(listaDe(s.id))} de lista</span>
              </label>
            ))}
          </div>
        </div>

        {previsto && (
          <div className="mt-3 rounded border border-blue-200 bg-blue-50 p-2 text-xs">
            <p className="mb-1">
              Suma de las tarifas de lista: <b>{pesos(sumaListas)}</b> · Precio del paquete:{' '}
              <b>{pesos(Number(nuevo.precioCerrado))}</b>
              {sumaListas > 0 && (
                <>
                  {' '}
                  ·{' '}
                  {Number(nuevo.precioCerrado) < sumaListas
                    ? `se deja de cobrar ${pesos(sumaListas - Number(nuevo.precioCerrado))}`
                    : `se cobra ${pesos(Number(nuevo.precioCerrado) - sumaListas)} POR ENCIMA de la lista`}
                </>
              )}
            </p>
            <p className="mb-1 text-neutral-600">
              Así se repartiría entre las pantallas — y esto es lo que el reporte de rentabilidad
              le atribuirá a cada una:
            </p>
            <ul>
              {previsto.map((x) => (
                <li key={x.id}>
                  {nombreDe(x.id)}: <b>{pesos(x.parte)}</b>{' '}
                  <span className="text-neutral-400">(lista {pesos(x.lista)})</span>
                </li>
              ))}
            </ul>
            <p className="mt-1">
              Suma de las partes:{' '}
              <b>{pesos(previsto.reduce((s, x) => s + x.parte, 0))}</b> — cuadra al peso.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
