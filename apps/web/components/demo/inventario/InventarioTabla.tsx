'use client'

import { useMemo, useRef, useState } from 'react'
import { Search, Cpu, Pencil, Loader2, CheckCircle2, UserPlus, Tag, X, Building2, Download } from 'lucide-react'
import { Card } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { CRUDO_INVALIDO } from '@/lib/captura-cifra'
import { SiteFicha } from '@/components/demo/comercial/SiteFicha'
import { StatusBadge, SITIO_TONO, SITIO_LABEL, disponibilidadInventario } from '@/components/demo/StatusBadge'
import { usePuede } from '@/components/demo/shell/SesionContext'
import { actualizarSitioApi, actualizarTarifasApi } from '@/lib/data/sitios-api'
import { editarContratoApi, actualizarRentasApi } from '@/lib/data/estado-api'
import { useCandado, DialogoCandado } from '@/components/demo/ui/candado'
import { crearLote, type Lote } from '@/lib/cambios-lote'
import { periodicidadLabel } from '@/lib/renta-periodicidad'
import { planearRentaMasiva } from '@/lib/renta-masiva'
import { descargarInventario } from '@/lib/inventario-export'
import { ubicacion } from '@/lib/ubicacion'
import { etiquetaTipoMedio } from '@/lib/tipo-medio'
import {
  useSitios,
  useContratos,
  useArrendadores,
  medioLabel,
  formatMonto,
  type Sitio,
} from '@/lib/data/client'

// Etiquetas de periodicidad: lib/renta-periodicidad.ts, junto al enum.

/**
 * Lo que dice el cuadro de la contraseña de un cambio masivo, ANTES de pedirla.
 *
 * Existe porque un lote no es una acción: es N. Si el servidor rechazó el lote
 * entero —lo normal, porque las N salen contra la misma sesión y el candado las
 * para todas— no hay nada que confesar. Pero si alguna llegó a aplicarse, callar
 * el número sería exactamente el defecto que B38 vino a cerrar, movido de sitio:
 * el usuario teclearía la contraseña creyendo que no ha cambiado nada.
 */
function avisoDeLote(lote: Lote | null): string {
  const base = 'Este cambio es sensible: tu organización pide que vuelvas a identificarte.'
  if (!lote || lote.aplicadas() === 0) return base
  const faltan = lote.pendientes()
  const ya = lote.aplicadas()
  return (
    `${lote.frase()} Confirmar aplica SOLO ${faltan === 1 ? 'la que falta' : `las ${faltan} que faltan`}; ` +
    `${ya === 1 ? 'la que ya cambió no se vuelve' : `las ${ya} que ya cambiaron no se vuelven`} a tocar. ${base}`
  )
}

// Tabla del inventario completo con columnas (incluye propietario, renta y
// periodicidad de pago tomados del contrato vigente de cada sitio).
export function InventarioTabla() {
  const sitios = useSitios()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const puedeEditar = usePuede('comercial', 'crear')
  // La renta al arrendador se rige por OTRO permiso, no por el de Comercial.
  // Es dinero que sale hacia el propietario, no un precio de venta: quien
  // comercializa no debería poder cambiar lo que se le paga al dueño del
  // espacio. Es exactamente el riesgo que anotó `CAMPO_COL` en sitios-repo al
  // dejar la renta fuera de la ruta de inventario. El servidor lo vuelve a
  // exigir en PATCH /api/contratos/[id] (`exigirCambioSensible`), así que esto
  // solo decide si se pinta el lápiz.
  const puedeEditarRenta = usePuede('arrendadores', 'crear')
  const [q, setQ] = useState('')
  const [activo, setActivo] = useState<Sitio | null>(null)
  const [fichaOpen, setFichaOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  // Selección para el cambio MASIVO de tarifa (sin Excel): marcas pantallas y
  // fijas una tarifa nueva o un ajuste porcentual y se aplica a todas.
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [modoTarifa, setModoTarifa] = useState<'fijar' | 'ajustar'>('fijar')
  // Qué campo toca el cambio masivo. Arranca en 'tarifa' para que el
  // comportamiento de siempre no cambie por añadir la opción de renta.
  const [campoMasivo, setCampoMasivo] = useState<'tarifa' | 'renta'>('tarifa')
  const [valorTarifa, setValorTarifa] = useState('')
  const [aplicando, setAplicando] = useState(false)
  // B38 · los DOS cambios masivos mandan N peticiones a rutas con candado
  // (`PATCH /api/sitios/:id` ×N y `PATCH /api/contratos/:id` ×N) y hasta hoy se
  // tragaban el 403 en un `catch {}`. Un solo candado para los dos: solo hay un
  // cambio masivo en vuelo a la vez, porque el botón se bloquea con `aplicando`.
  const candado = useCandado()
  // El lote EN CURSO. Vive en una ref porque `reintentar()` vuelve a ejecutar el
  // mismo cierre y tiene que ver la lista YA RECORTADA: lo que se aplicó en el
  // primer intento no se vuelve a mandar. Ver `lib/cambios-lote.ts`.
  const loteRef = useRef<Lote | null>(null)

  // Generar el archivo es trabajo sincrono en el navegador y puede fallar (un
  // inventario enorme agota memoria). Sin este catch el error moria en la
  // consola y el usuario se quedaba mirando un boton que "no hizo nada".
  function bajar(formato: 'xlsx' | 'csv') {
    try {
      descargarInventario(filtrados, formato)
    } catch {
      notify('No se pudo generar el archivo. Prueba a filtrar para descargar menos pantallas.')
    }
  }

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
    // `contratoId` y `dePredio` los necesita la edición en línea: hay que saber
    // QUÉ contrato se toca y si es compartido, porque cambiar la renta de un
    // contrato de predio la cambia para TODAS sus pantallas a la vez.
    type Info = {
      propietario: string; renta: number; periodicidad: string
      contratoId: string; dePredio: boolean; estatus: string
    }
    const porPredio = new Map<string, Info>()
    const porSitio = new Map<string, Info>()
    for (const c of (contratos ?? []).slice().sort((a, b) => (PR[a.estatus] ?? 9) - (PR[b.estatus] ?? 9))) {
      // INCOMPLETO (ADR 0001) queda al final del orden de preferencia (PR no lo
      // lista → 9) y sin importe: renta 0 hasta que se capture.
      const info: Info = {
        propietario: (c.arrendadorId ? arrById.get(c.arrendadorId) : null) ?? '—',
        renta: c.montoRenta ?? 0,
        periodicidad: c.periodicidad ?? '',
        contratoId: c.id,
        dePredio: !!c.predioId,
        estatus: c.estatus,
      }
      if (c.predioId && !porPredio.has(c.predioId)) porPredio.set(c.predioId, info)
      if (!porSitio.has(c.sitioId)) porSitio.set(c.sitioId, info)
    }
    return { porPredio, porSitio }
  }, [contratos, arrendadores])

  // Cuántas pantallas comparten cada predio: si son varias, editar la renta del
  // contrato las afecta a todas y hay que decirlo ANTES de guardar.
  const pantallasPorPredio = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sitios ?? []) if (s.predioId) m.set(s.predioId, (m.get(s.predioId) ?? 0) + 1)
    return m
  }, [sitios])

  if (!sitios) {
    return <div className="h-64 w-full animate-pulse rounded-md bg-surface-2" />
  }

  const filtrados = sitios.filter((s) => {
    if (!q) return true
    const t = `${s.nombre} ${s.codigoProveedor} ${s.alcaldia} ${s.ciudad}`.toLowerCase()
    return t.includes(q.toLowerCase())
  })

  // Selección múltiple (sobre lo filtrado): toggle por fila y "todos".
  const idsFiltrados = filtrados.map((s) => s.id)
  const todosSel = idsFiltrados.length > 0 && idsFiltrados.every((id) => sel.has(id))
  function toggleFila(id: string) {
    setSel((prev) => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }
  function toggleTodos() {
    setSel(todosSel ? new Set() : new Set(idsFiltrados))
  }
  function limpiarSel() {
    setSel(new Set())
    setValorTarifa('')
  }

  // Aplica el cambio masivo: "fijar" pone el mismo valor a todas; "ajustar"
  // sube/baja un % sobre el valor actual de cada una.
  async function aplicarMasivo() {
    // 'NaN' = CampoCifra no entendió lo tecleado. Hay que pararlo ANTES del
    // `replace` de abajo, que lo dejaría en '' → Number('') = 0 → «fijar la
    // tarifa en $0» a todo el lote.
    if (valorTarifa === CRUDO_INVALIDO) {
      notify('La cifra no se entiende: la coma separa miles y el punto, decimales (15,000.50)')
      return
    }
    const num = Number(valorTarifa.replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(num)) {
      notify('Escribe un número válido')
      return
    }
    if (modoTarifa === 'fijar' && num < 0) {
      notify(campoMasivo === 'renta' ? 'La renta no puede ser negativa' : 'La tarifa no puede ser negativa')
      return
    }
    const objetivos = filtrados.filter((s) => sel.has(s.id))
    if (objetivos.length === 0) return

    if (campoMasivo === 'renta') return aplicarRentaMasiva(objetivos, num)
    const items = objetivos.map((s) => {
      const base = s.tarifaMensual ?? 0
      const nueva = modoTarifa === 'fijar' ? num : Math.max(0, Math.round(base * (1 + num / 100)))
      return { id: s.id, tarifa: nueva }
    })
    const resumen =
      modoTarifa === 'fijar'
        ? `fijar la tarifa en ${formatMonto(num)}`
        : `ajustar la tarifa ${num >= 0 ? '+' : ''}${num}%`
    if (!window.confirm(`¿Aplicar «${resumen}» a ${objetivos.length} pantalla${objetivos.length === 1 ? '' : 's'}?`)) return
    setAplicando(true)
    // B38 · antes esto era un `try/catch {}` que decía «No se pudo aplicar el
    // cambio masivo» y se comía el motivo. Con el control de cambios encendido
    // el motivo era el 403 del candado, y no había ningún sitio donde teclear la
    // contraseña: el camino quedaba muerto y parecía una avería.
    const lote = crearLote({
      items,
      aplicar: actualizarTarifasApi,
      unidad: 'pantalla',
      unidadPlural: 'pantallas',
    })
    loteRef.current = lote
    await candado.ejecutar({
      guardar: lote.paso,
      alLograr: () => {
        notify(`Tarifa actualizada en ${lote.aplicadas()} pantalla${lote.aplicadas() === 1 ? '' : 's'}`)
        limpiarSel()
      },
      // Sin el cuadro a la vista este aviso es la ÚNICA salida que tiene el
      // fallo, y ya lleva la cuenta de cuántas sí se aplicaron: `lote.paso()`
      // lanza esa frase, no un texto genérico.
      alFallar: (m) => notify(m),
      mensajeSiFalla: 'No se pudo aplicar el cambio masivo',
    })
    setAplicando(false)
  }

  // Renta masiva. Se opera sobre CONTRATOS, no sobre pantallas, y ahí está toda
  // la dificultad: un contrato de predio lo comparten todas sus caras.
  //
  //  · Si no se deduplica, seleccionar 5 pantallas de un predio manda 5 PATCH al
  //    MISMO contrato y el resumen diría "5 rentas actualizadas" cuando hubo una.
  //  · Si la selección deja fuera hermanas de un predio, el cambio las alcanza
  //    igual. Eso NO se puede evitar (el contrato es uno), pero sí se advierte
  //    antes: es la diferencia entre un efecto colateral y una sorpresa.
  async function aplicarRentaMasiva(objetivos: Sitio[], num: number) {
    if (modoTarifa === 'fijar' && num <= 0) {
      // Un 0 se leería como «estos espacios son gratis» y además lo rechaza
      // `contrato_monto_ck`.
      notify('La renta debe ser mayor que cero')
      return
    }
    // El reparto sobre contratos (deduplicación y alcance real) vive en
    // lib/renta-masiva.ts: es aritmética de dinero con dos trampas y está
    // probada aparte.
    const contratoDe = (s: { id: string; predioId?: string | null }) =>
      (s.predioId ? rentaPorSitio.porPredio.get(s.predioId) : rentaPorSitio.porSitio.get(s.id)) ?? null
    const plan = planearRentaMasiva(objetivos, sitios ?? [], contratoDe, modoTarifa, num)

    if (plan.cambios.length === 0) {
      notify(
        plan.sinContrato > 0
          ? 'Esas pantallas no tienen contrato todavía: captura la renta en Arrendadores.'
          : 'No hay rentas que ajustar (las seleccionadas no tienen importe capturado).',
      )
      return
    }

    const n = plan.cambios.length
    const resumen =
      modoTarifa === 'fijar'
        ? `fijar la renta en ${formatMonto(num)}`
        : `ajustar la renta ${num >= 0 ? '+' : ''}${num}%`
    const aviso =
      `¿Aplicar «${resumen}» a ${n} contrato${n === 1 ? '' : 's'}?` +
      (plan.alcanceExtra > 0
        ? `\n\nOJO: son contratos de predio compartidos. El cambio alcanza también a ` +
          `${plan.alcanceExtra} pantalla${plan.alcanceExtra === 1 ? '' : 's'} que NO seleccionaste.`
        : '') +
      (plan.sinContrato > 0
        ? `\n\n${plan.sinContrato} pantalla${plan.sinContrato === 1 ? '' : 's'} sin contrato se omitirá${plan.sinContrato === 1 ? '' : 'n'}.`
        : '') +
      (plan.omitidosSinImporte > 0
        ? `\n\n${plan.omitidosSinImporte} contrato${plan.omitidosSinImporte === 1 ? '' : 's'} sin importe capturado se omitirá${plan.omitidosSinImporte === 1 ? '' : 'n'}: no hay sobre qué aplicar el porcentaje.`
        : '')
    if (!window.confirm(aviso)) return

    setAplicando(true)
    // B38 · mismo trato que el lote de tarifas, y aquí importa más: son los
    // contratos, o sea lo que se le paga al arrendador. Que la mitad cambiara y
    // la otra mitad no, en silencio, era el peor final posible.
    const lote = crearLote({
      items: plan.cambios,
      aplicar: actualizarRentasApi,
      unidad: 'contrato',
      unidadPlural: 'contratos',
    })
    loteRef.current = lote
    await candado.ejecutar({
      guardar: lote.paso,
      alLograr: () => {
        notify(`Renta actualizada en ${lote.aplicadas()} contrato${lote.aplicadas() === 1 ? '' : 's'}`)
        limpiarSel()
      },
      alFallar: (m) => notify(m),
      mensajeSiFalla: 'No se pudo aplicar el cambio masivo de renta',
    })
    setAplicando(false)
  }

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
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[12px] text-muted">{filtrados.length} de {sitios.length}</span>
          {/* Descarga lo FILTRADO, no todo: si alguien buscó "Reforma" y pulsa
              descargar, espera esas pantallas. Con el buscador vacío `filtrados`
              es el inventario completo, así que el caso normal no cambia. */}
          <div className="flex items-center gap-1 border-l border-border pl-2">
            <Download className="h-3.5 w-3.5 text-muted" />
            <button
              onClick={() => bajar('xlsx')}
              disabled={filtrados.length === 0}
              title="Descargar en Excel, con el mismo formato que la plantilla de carga"
              className="rounded px-1.5 py-1 text-[12px] font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
            >
              Excel
            </button>
            <button
              onClick={() => bajar('csv')}
              disabled={filtrados.length === 0}
              title="Descargar en CSV, con el mismo formato que la plantilla de carga"
              className="rounded px-1.5 py-1 text-[12px] font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
            >
              CSV
            </button>
          </div>
        </div>
      </div>

      {/* Barra de cambio MASIVO de tarifa (sin Excel): aparece al seleccionar. */}
      {puedeEditar && sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent-soft px-3 py-2 text-[12px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <Tag className="h-3.5 w-3.5 text-info" />
            {sel.size} seleccionada{sel.size === 1 ? '' : 's'}
          </span>
          {/* QUÉ se edita. La tarifa es lo que ENTRA del cliente y la renta lo
              que SALE hacia el arrendador: se eligen aparte para que nadie
              cambie una creyendo que cambia la otra. La renta solo aparece si el
              rol puede tocarla — es otro permiso. */}
          {puedeEditarRenta && (
            <div className="inline-flex overflow-hidden rounded-md border border-border-strong">
              <button
                type="button"
                onClick={() => setCampoMasivo('tarifa')}
                className={`px-2 py-1 font-medium transition-colors ${campoMasivo === 'tarifa' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}
              >
                Tarifa
              </button>
              <button
                type="button"
                onClick={() => setCampoMasivo('renta')}
                className={`border-l border-border-strong px-2 py-1 font-medium transition-colors ${campoMasivo === 'renta' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}
              >
                Renta
              </button>
            </div>
          )}
          {/* Modo: fijar valor exacto o ajustar por porcentaje */}
          <div className="inline-flex overflow-hidden rounded-md border border-border-strong">
            <button
              type="button"
              onClick={() => setModoTarifa('fijar')}
              className={`px-2 py-1 font-medium transition-colors ${modoTarifa === 'fijar' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}
            >
              {campoMasivo === 'renta' ? 'Fijar renta' : 'Fijar tarifa'}
            </button>
            <button
              type="button"
              onClick={() => setModoTarifa('ajustar')}
              className={`border-l border-border-strong px-2 py-1 font-medium transition-colors ${modoTarifa === 'ajustar' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}
            >
              Ajustar %
            </button>
          </div>
          <div className="inline-flex items-center gap-1">
            <span className="text-muted">{modoTarifa === 'fijar' ? '$' : ''}</span>
            {/* Fijar = importe (sin negativos); Ajustar = porcentaje, que puede
                ser negativo. El mismo campo, con coma de miles al teclear. */}
            <CampoCifra
              valor={valorTarifa}
              minimo={modoTarifa === 'ajustar' ? null : 0}
              mostrarError={false}
              onCambio={(crudo) => setValorTarifa(crudo)}
              onKeyDown={(e) => { if (e.key === 'Enter') void aplicarMasivo() }}
              placeholder={
                modoTarifa === 'ajustar'
                  ? 'p. ej. 10 o -5'
                  : campoMasivo === 'renta' ? 'Nueva renta' : 'Nueva tarifa'
              }
              className="h-8 w-32 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
            {modoTarifa === 'ajustar' && <span className="text-muted">%</span>}
          </div>
          {/* `candado.reautenticando` entra en el `disabled` a propósito: mientras
              el cuadro de la contraseña está abierto hay un lote A MEDIO APLICAR,
              y empezar otro encima dejaría dos listas de pendientes compitiendo
              por el mismo desbloqueo. */}
          <Button
            size="sm"
            onClick={aplicarMasivo}
            disabled={aplicando || candado.reautenticando || !valorTarifa.trim()}
          >
            {aplicando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {aplicando ? 'Aplicando…' : 'Aplicar'}
          </Button>
          <button
            type="button"
            onClick={limpiarSel}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> Limpiar
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              {puedeEditar && (
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={todosSel}
                    onChange={toggleTodos}
                    title="Seleccionar todo"
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">Pantalla</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Ubicación</th>
              <th className="px-3 py-2 font-medium">Medio</th>
              <th className="px-3 py-2 text-right font-medium">Tarifa</th>
              <th className="px-3 py-2 font-medium">Disponibilidad</th>
              <th className="px-3 py-2 font-medium">Arrendador</th>
              <th className="px-3 py-2 text-right font-medium">Renta</th>
              <th className="px-3 py-2 font-medium">Cada cuándo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.length === 0 ? (
              <tr>
                {/* Sin búsqueda activa el inventario está vacío de verdad; decir
                    "no coincide con la búsqueda" mandaba a limpiar un buscador
                    que ya estaba limpio (M2 de la auditoría). */}
                <td colSpan={puedeEditar ? 10 : 9} className="px-3 py-10 text-center text-muted">
                  {q
                    ? `Ningún sitio coincide con «${q}».`
                    : 'Todavía no hay pantallas en el inventario. Agrégalas una a una o por carga masiva.'}
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
                  <tr key={s.id} onClick={() => abrirFicha(s)} className={`cursor-pointer hover:bg-surface-2 ${sel.has(s.id) ? 'bg-accent-soft' : ''}`}>
                    {puedeEditar && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={sel.has(s.id)}
                          onChange={() => toggleFila(s.id)}
                          className="h-4 w-4 accent-[var(--accent)]"
                        />
                      </td>
                    )}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-medium text-ink">
                        <span className="truncate">{s.nombre}</span>
                        {s.computerVision && <Cpu className="h-3.5 w-3.5 shrink-0 text-info" />}
                      </div>
                      <div className="demo-num text-[11px] text-muted">{s.codigoProveedor}</div>
                    </td>
                    <td className="px-3 py-2.5 text-muted">{etiquetaTipoMedio(s.tipoMedio)}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {ubicacion([s.alcaldia, s.ciudad]) || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{medioLabel(s)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <CeldaTarifa sitio={s} editable={puedeEditar} onSaved={notify} />
                    </td>
                    <td className="px-3 py-2.5">
                      {/* Disponibilidad comercial, no el estatus crudo: en una
                          digital lo que importa es cuántos slots quedan, y en
                          una fija basta con si se puede vender o no. */}
                      {(() => {
                        const d = disponibilidadInventario(s)
                        return <StatusBadge tono={d.tono}>{d.texto}</StatusBadge>
                      })()}
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
                      <CeldaRenta
                        info={r ?? null}
                        sitioNombre={s.nombre}
                        // Cuántas pantallas comparte el contrato: 1 (o suelta) se
                        // edita sin más; varias avisan antes de guardar.
                        hermanas={s.predioId ? (pantallasPorPredio.get(s.predioId) ?? 1) : 1}
                        editable={puedeEditarRenta}
                        onSaved={notify}
                      />
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

    {/* B38 · el cuadro que le faltaba a los DOS cambios masivos. No hay un
        diálogo donde meter el campo —el aviso previo es un `window.confirm`,
        que es del navegador y no admite nada dentro—, así que el 403 abre uno.
        Es la misma regla de `ui/candado.tsx`, con el envase que toca.

        El subtítulo NO es fijo, y esa es la parte que importa: si el lote quedó
        a medias, quien va a teclear la contraseña tiene que saber cuántas se
        aplicaron YA y cuántas faltan. Reintentar manda solo las que faltan. */}
    <DialogoCandado
      candado={candado}
      titulo="Confirma con tu contraseña"
      subtitulo={avisoDeLote(loteRef.current)}
      etiquetaConfirmar="Confirmar y aplicar"
    />

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
// ── Renta al arrendador, editable en línea ──────────────────────────────────
//
// Escribe en el CONTRATO (`PATCH /api/contratos/[id]`), nunca en
// `sitios.renta_arrendador`: esa columna está deprecada (M1) y ya no la lee
// nadie, así que editarla habría sido un cambio que no se ve en ningún lado.
//
// Por eso mismo la edición pasa por la ruta de contratos, que ya trae el guard
// de cambio sensible, la validación de tenant y el registro en la bitácora. Es
// el motivo por el que este campo estaba fuera de la ruta de inventario: no
// porque no debiera editarse, sino porque hacerlo por ahí lo dejaba sin ninguna
// de esas tres cosas.
function CeldaRenta({
  info,
  sitioNombre,
  hermanas,
  editable,
  onSaved,
}: {
  info: { renta: number; contratoId: string; dePredio: boolean; estatus: string } | null
  sitioNombre: string
  hermanas: number
  editable: boolean
  onSaved: (msg: string) => void
}) {
  const [editando, setEditando] = useState(false)
  const [val, setVal] = useState('')
  const [saving, setSaving] = useState(false)
  const resueltoRef = useRef(false)
  // B38 · `PATCH /api/contratos/:id` pasa entero por `exigirCambioSensible`
  // (`app/api/contratos/[id]/route.ts:25`). Esta celda SÍ enseñaba el mensaje
  // del servidor —era la mejor de las cinco de este archivo— pero lo enseñaba
  // como un aviso que se desvanece, y sin ningún sitio donde teclear la clave:
  // el camino directo quedaba muerto igual. El 403 abre un cuadro.
  const candado = useCandado()

  const renta = info?.renta ?? 0
  const texto = info && info.renta > 0 ? formatMonto(info.renta) : '—'
  // Un contrato de predio con varias caras: cambiar su renta las toca todas.
  const compartido = !!info?.dePredio && hermanas > 1

  function abrir(e: React.MouseEvent) {
    e.stopPropagation()
    if (!info) return
    setVal(renta > 0 ? String(renta) : '')
    resueltoRef.current = false
    setEditando(true)
  }

  async function guardar() {
    if (resueltoRef.current || !info) return
    resueltoRef.current = true
    // 'NaN' = CampoCifra no entendió lo tecleado; el `replace` de abajo lo
    // convertiría en 0. Se dice y no se guarda nada.
    if (val === CRUDO_INVALIDO) {
      setEditando(false)
      onSaved('La renta no se entiende: no se guardó. La coma separa miles y el punto, decimales.')
      return
    }
    const num = Number(val.replace(/[^\d.]/g, ''))
    // Un 0 NO se guarda: `contrato_monto_ck` lo rechaza y, peor, se leería como
    // «el espacio es gratis». Sin cambio real tampoco se manda nada.
    if (!Number.isFinite(num) || num <= 0 || num === renta) {
      setEditando(false)
      if (Number.isFinite(num) && num <= 0) onSaved('La renta debe ser mayor que cero')
      return
    }
    if (compartido && !window.confirm(
      `Esta renta es del contrato del predio y la comparten ${hermanas} pantallas. ` +
      `Cambiarla a ${formatMonto(num)} aplica a todas. ¿Continuar?`,
    )) {
      setEditando(false)
      return
    }
    setSaving(true)
    // El mensaje del servidor importa, y el del control de cambios ADEMÁS abre
    // el cuadro con el campo: enseñarlo y no ofrecer dónde teclearlo era dejar
    // al usuario sabiendo qué falta y sin poder hacerlo.
    await candado.ejecutar({
      guardar: () => editarContratoApi(info.contratoId, { montoRenta: num }),
      alLograr: () =>
        onSaved(
          compartido
            ? `Renta del predio actualizada (${hermanas} pantallas)`
            : `Renta de "${sitioNombre}" actualizada`,
        ),
      alFallar: (m) => onSaved(m),
      mensajeSiFalla: 'No se pudo actualizar la renta',
    })
    setSaving(false)
    setEditando(false)
  }

  function cancelar() {
    resueltoRef.current = true
    setEditando(false)
  }

  // Sin contrato no hay dónde guardar la renta. Se da de alta en Arrendadores.
  if (!editable || !info) return <span className="demo-num text-ink">{texto}</span>

  // El cuadro va en las DOS ramas de abajo, no solo en la de edición: al llegar
  // el 403 la celda ya cerró su campo (`setEditando(false)`) y se pinta como
  // botón. Si el cuadro viviera solo en la otra rama se desmontaría justo en el
  // momento en que hace falta, y el 403 volvería a no verse.
  const dialogo = (
    <DialogoCandado
      candado={candado}
      titulo="Confirma con tu contraseña"
      subtitulo={`Cambiar la renta de "${sitioNombre}" es un cambio sensible: tu organización pide que vuelvas a identificarte.`}
      etiquetaConfirmar="Confirmar y guardar"
    />
  )

  if (!editando) {
    return (
      <>
        <button
          type="button"
          onClick={abrir}
          title={
            compartido
              ? `Renta del contrato del predio — la comparten ${hermanas} pantallas`
              : 'Editar la renta que se le paga al arrendador'
          }
          className="group/ren demo-num ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-ink transition-colors hover:ring-1 hover:ring-border-strong"
        >
          {texto}
          {compartido && <Building2 className="h-3 w-3 shrink-0 text-muted" />}
          <Pencil className="h-3 w-3 text-muted opacity-40 transition-opacity group-hover/ren:opacity-100" />
        </button>
        {dialogo}
      </>
    )
  }

  return (
    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] text-muted">$</span>
      <CampoCifra
        autoFocus
        valor={val}
        disabled={saving}
        mostrarError={false}
        onCambio={(crudo) => setVal(crudo)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); void guardar() }
          if (e.key === 'Escape') { e.preventDefault(); cancelar() }
        }}
        onBlur={() => void guardar()}
        className="h-7 w-24 rounded border border-border-strong bg-surface px-2 text-right text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
      />
      {dialogo}
    </span>
  )
}

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
  // B38 · la tarifa es uno de los campos que `PATCH /api/sitios/:id` declara
  // sensibles (`app/api/sitios/[id]/route.ts:15-19`), así que el servidor pide
  // la contraseña. Esta celda tenía el defecto en su forma más cara: un
  // `catch {}` que ponía un texto propio y tiraba el del servidor.
  const candado = useCandado()

  function abrir(e: React.MouseEvent) {
    e.stopPropagation()
    setVal(String(sitio.tarifaMensual ?? 0))
    resueltoRef.current = false
    setEditando(true)
  }

  async function guardar() {
    if (resueltoRef.current) return
    resueltoRef.current = true
    // Sin esto, 'NaN' (lo tecleado no se entiende) pasaría por el `replace` a
    // '' y de ahí a una tarifa de CERO guardada en silencio.
    if (val === CRUDO_INVALIDO) {
      setEditando(false)
      onSaved('La tarifa no se entiende: no se guardó. La coma separa miles y el punto, decimales.')
      return
    }
    const num = Number(val.replace(/[^\d.]/g, ''))
    if (!Number.isFinite(num) || num < 0 || num === (sitio.tarifaMensual ?? 0)) {
      setEditando(false)
      return
    }
    setSaving(true)
    await candado.ejecutar({
      guardar: () => actualizarSitioApi(sitio.id, { tarifaMensual: num }),
      alLograr: () => onSaved(`Tarifa de "${sitio.nombre}" actualizada`),
      alFallar: (m) => onSaved(m),
      mensajeSiFalla: 'No se pudo actualizar la tarifa',
    })
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

  // En las dos ramas, por lo mismo que en `CeldaRenta`: cuando llega el 403 la
  // celda ya volvió a su forma de botón.
  const dialogo = (
    <DialogoCandado
      candado={candado}
      titulo="Confirma con tu contraseña"
      subtitulo={`Cambiar la tarifa de "${sitio.nombre}" es un cambio sensible: tu organización pide que vuelvas a identificarte.`}
      etiquetaConfirmar="Confirmar y guardar"
    />
  )

  if (!editando) {
    return (
      <>
        <button
          type="button"
          onClick={abrir}
          title="Editar tarifa"
          className="group/tar demo-num ml-auto inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-ink transition-colors hover:ring-1 hover:ring-border-strong"
        >
          {formatMonto(sitio.tarifaMensual)}
          <Pencil className="h-3 w-3 text-muted opacity-40 transition-opacity group-hover/tar:opacity-100" />
        </button>
        {dialogo}
      </>
    )
  }

  return (
    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] text-muted">$</span>
      <CampoCifra
        autoFocus
        valor={val}
        disabled={saving}
        mostrarError={false}
        onCambio={(crudo) => setVal(crudo)}
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
      {dialogo}
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
  // B38 · `arrendadorId` también está en los campos sensibles de
  // `PATCH /api/sitios/:id`, y con razón: es a quién se le va a pagar la renta.
  // Esta celda se tragaba el 403 con un `catch {}` — y el cliente ni siquiera
  // levantaba el error, así que decía «Arrendador actualizado» sin haberlo
  // cambiado. Ver el comentario de `actualizarSitioApi`.
  const candado = useCandado()

  const nombreDirecto = sitio.arrendadorId ? arrById.get(sitio.arrendadorId) ?? null : null
  const display = nombreDirecto ?? propietarioContrato

  async function elegir(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevo = e.target.value || null
    setEditando(false)
    if ((nuevo ?? null) === (sitio.arrendadorId ?? null)) return
    setSaving(true)
    await candado.ejecutar({
      guardar: () => actualizarSitioApi(sitio.id, { arrendadorId: nuevo }),
      alLograr: () =>
        onSaved(nuevo ? `Arrendador actualizado en "${sitio.nombre}"` : `Arrendador quitado de "${sitio.nombre}"`),
      alFallar: (m) => onSaved(m),
      mensajeSiFalla: 'No se pudo actualizar el arrendador',
    })
    setSaving(false)
  }

  if (!editable) {
    return display ? (
      <span className="text-ink">{display}</span>
    ) : (
      <span className="text-muted">Sin arrendador</span>
    )
  }

  // En las TRES ramas de abajo. Aquí importa más que en las otras dos celdas:
  // el selector se cierra en cuanto se elige (`setEditando(false)` es la primera
  // línea de `elegir`), así que para cuando vuelve el 403 esta celda es siempre
  // la rama del botón.
  const dialogo = (
    <DialogoCandado
      candado={candado}
      titulo="Confirma con tu contraseña"
      subtitulo={`Cambiar el arrendador de "${sitio.nombre}" es un cambio sensible: decide a quién se le paga la renta, así que tu organización pide que vuelvas a identificarte.`}
      etiquetaConfirmar="Confirmar y guardar"
    />
  )

  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Guardando…
        {dialogo}
      </span>
    )
  }

  if (!editando) {
    return (
      <>
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
        {dialogo}
      </>
    )
  }

  return (
    <>
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
      {dialogo}
    </>
  )
}
