'use client'

import { useMemo, useRef, useState } from 'react'
import { simboloMoneda } from '@/lib/i18n/dinero'
import { Search, Cpu, Pencil, Loader2, CheckCircle2, UserPlus, Tag, X, Building2, Download } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import {
  IndicadoresInventario,
  ChipsFiltroInventario,
  FILTROS_VACIOS,
  claseContrato,
  claseMedio,
  tonoDisponibilidad,
  type FiltrosInventario,
} from '@/components/demo/inventario/ResumenInventario'
import { Button } from '@/components/demo/ui/Button'
import { CampoCifra } from '@/components/demo/ui/CampoCifra'
import { CRUDO_INVALIDO, ejemploCifra } from '@/lib/captura-cifra'
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
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { textoDisponibilidad, textoMedio, textoTipoMedio } from '@/components/demo/inventario/etiquetas'
import {
  useSitios,
  useContratos,
  useArrendadores,
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
//
// I18N (2026-11-02) · la frase va ENTERA en el diccionario, una por cada
// combinacion de singular y plural.
//
// Segunda vuelta (validador, medio 2): `lote.frase()` (`lib/cambios-lote.ts`)
// devuelve espanol y se colaba entera en el cuadro ingles. Se arma aqui con
// claves desde los mismos numeros —aplicadas, pendientes, total— y la misma
// unidad, sin tocar `lib/`; `textos/inventario.test.ts` exige que en espanol
// salga EXACTAMENTE `lote.frase()`. Se exportan para que esa prueba LLAME a
// estas y no reescriba la formula (costura 2: sobrevivian los mutantes D1, `ya`
// por `faltan`, y D2, la unidad fija en el subtitulo).
export type T = (clave: ClaveTexto, v?: Record<string, string | number>) => string
export type UnidadLote = 'pantalla' | 'contrato'
export function fraseDeLote(lote: Lote, unidad: UnidadLote, t: T): string {
  const total = lote.total()
  const clave: ClaveTexto =
    unidad === 'pantalla'
      ? total === 1 ? 'inventario.lote.unidad.pantalla' : 'inventario.lote.unidad.pantallas'
      : total === 1 ? 'inventario.lote.unidad.contrato' : 'inventario.lote.unidad.contratos'
  return t('inventario.lote.frase', { ya: lote.aplicadas(), total, faltan: lote.pendientes(), unidad: t(clave) })
}
export function avisoDeLote(lote: Lote | null, unidad: UnidadLote, t: T): string {
  const base = t('inventario.lote.base')
  if (!lote || lote.aplicadas() === 0) return base
  const faltan = lote.pendientes()
  const ya = lote.aplicadas()
  const clave: ClaveTexto =
    faltan === 1
      ? ya === 1 ? 'inventario.lote.uno-uno' : 'inventario.lote.uno-otros'
      : ya === 1 ? 'inventario.lote.otros-uno' : 'inventario.lote.otros-otros'
  return t(clave, { frase: fraseDeLote(lote, unidad, t), faltan, ya, base })
}

// Tabla del inventario completo con columnas (incluye propietario, renta y
// periodicidad de pago tomados del contrato vigente de cada sitio).
export function InventarioTabla() {
  const sitios = useSitios()
  const contratos = useContratos()
  const arrendadores = useArrendadores()
  const puedeEditar = usePuede('comercial', 'crear')
  const { idioma, t } = useIdioma()
  // La renta al arrendador se rige por OTRO permiso, no por el de Comercial.
  // Es dinero que sale hacia el propietario, no un precio de venta: quien
  // comercializa no debería poder cambiar lo que se le paga al dueño del
  // espacio. Es exactamente el riesgo que anotó `CAMPO_COL` en sitios-repo al
  // dejar la renta fuera de la ruta de inventario. El servidor lo vuelve a
  // exigir en PATCH /api/contratos/[id] (`exigirCambioSensible`), así que esto
  // solo decide si se pinta el lápiz.
  const puedeEditarRenta = usePuede('arrendadores', 'crear')
  const [q, setQ] = useState('')
  // Chips de filtro (26/10). Se suman al buscador sobre la MISMA `filtrados`:
  // de ella dependen la descarga, «Seleccionar todo» y el cambio masivo.
  const [filtros, setFiltros] = useState<FiltrosInventario>(FILTROS_VACIOS)
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
  // De que es el lote en curso, para poder nombrar su unidad en el aviso.
  const unidadLoteRef = useRef<UnidadLote>('pantalla')

  // Generar el archivo es trabajo sincrono en el navegador y puede fallar (un
  // inventario enorme agota memoria). Sin este catch el error moria en la
  // consola y el usuario se quedaba mirando un boton que "no hizo nada".
  function bajar(formato: 'xlsx' | 'csv') {
    try {
      descargarInventario(filtrados, formato)
    } catch {
      notify(t('inventario.tabla.no-archivo'))
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

  // Misma resolución del contrato que la fila (`r` más abajo): del predio, o
  // del sitio si es un contrato antiguo.
  const tieneContrato = (s: Sitio) =>
    !!(s.predioId ? rentaPorSitio.porPredio.get(s.predioId) : rentaPorSitio.porSitio.get(s.id))
  const hayChips = !!(filtros.disp || filtros.medio || filtros.contrato)

  const filtrados = sitios.filter((s) => {
    if (filtros.disp && tonoDisponibilidad(s) !== filtros.disp) return false
    if (filtros.medio && claseMedio(s) !== filtros.medio) return false
    if (filtros.contrato && claseContrato(s, tieneContrato(s)) !== filtros.contrato) return false
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
      notify(t('inventario.tabla.cifra-ilegible', { ejemplo: ejemploCifra('15,000.50', idioma) }))
      return
    }
    const num = Number(valorTarifa.replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(num)) {
      notify(t('inventario.tabla.numero-valido'))
      return
    }
    if (modoTarifa === 'fijar' && num < 0) {
      notify(campoMasivo === 'renta' ? t('inventario.tabla.renta-negativa') : t('inventario.tabla.tarifa-negativa'))
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
        ? t('inventario.tabla.fijar-tarifa-en', { monto: formatMonto(num, idioma) })
        : t('inventario.tabla.ajustar-tarifa', { pct: `${num >= 0 ? '+' : ''}${num}` })
    if (
      !window.confirm(
        t(objetivos.length === 1 ? 'inventario.tabla.aplicar-pantallas.uno' : 'inventario.tabla.aplicar-pantallas.otros', {
          resumen,
          n: objetivos.length,
        }),
      )
    )
      return
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
    unidadLoteRef.current = 'pantalla'
    await candado.ejecutar({
      guardar: lote.paso,
      alLograr: () => {
        notify(
          t(lote.aplicadas() === 1 ? 'inventario.tabla.tarifa-actualizada.uno' : 'inventario.tabla.tarifa-actualizada.otros', {
            n: lote.aplicadas(),
          }),
        )
        limpiarSel()
      },
      // Sin el cuadro a la vista este aviso es la ÚNICA salida que tiene el
      // fallo, y ya lleva la cuenta de cuántas sí se aplicaron: `lote.paso()`
      // lanza esa frase, no un texto genérico. En el idioma de quien mira: si es
      // la frase del lote, se arma con claves.
      alFallar: (m) => notify(m === lote.frase() ? fraseDeLote(lote, 'pantalla', t) : m),
      mensajeSiFalla: t('inventario.tabla.no-masivo'),
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
      notify(t('inventario.tabla.renta-mayor-cero'))
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
          ? t('inventario.tabla.sin-contrato-masivo')
          : t('inventario.tabla.sin-importe-masivo'),
      )
      return
    }

    const n = plan.cambios.length
    const resumen =
      modoTarifa === 'fijar'
        ? t('inventario.tabla.fijar-renta-en', { monto: formatMonto(num, idioma) })
        : t('inventario.tabla.ajustar-renta', { pct: `${num >= 0 ? '+' : ''}${num}` })
    // Cada parrafo es una frase entera del diccionario; se separan con una
    // linea en blanco, como antes.
    const aviso =
      t(n === 1 ? 'inventario.tabla.aplicar-contratos.uno' : 'inventario.tabla.aplicar-contratos.otros', { resumen, n }) +
      (plan.alcanceExtra > 0
        ? '\n\n' +
          t(plan.alcanceExtra === 1 ? 'inventario.tabla.alcance-extra.uno' : 'inventario.tabla.alcance-extra.otros', {
            n: plan.alcanceExtra,
          })
        : '') +
      (plan.sinContrato > 0
        ? '\n\n' +
          t(plan.sinContrato === 1 ? 'inventario.tabla.omitir-sin-contrato.uno' : 'inventario.tabla.omitir-sin-contrato.otros', {
            n: plan.sinContrato,
          })
        : '') +
      (plan.omitidosSinImporte > 0
        ? '\n\n' +
          t(
            plan.omitidosSinImporte === 1
              ? 'inventario.tabla.omitir-sin-importe.uno'
              : 'inventario.tabla.omitir-sin-importe.otros',
            { n: plan.omitidosSinImporte },
          )
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
    unidadLoteRef.current = 'contrato'
    await candado.ejecutar({
      guardar: lote.paso,
      alLograr: () => {
        notify(
          t(lote.aplicadas() === 1 ? 'inventario.tabla.renta-actualizada.uno' : 'inventario.tabla.renta-actualizada.otros', {
            n: lote.aplicadas(),
          }),
        )
        limpiarSel()
      },
      alFallar: (m) => notify(m === lote.frase() ? fraseDeLote(lote, 'contrato', t) : m),
      mensajeSiFalla: t('inventario.tabla.no-masivo-renta'),
    })
    setAplicando(false)
  }

  return (
    <>
    {/* Indicadores (26/10): cuentas sobre el inventario COMPLETO que ya está en
        memoria, como el resumen que ponen arriba los referentes (Broadsign,
        HighSign). Solo se ven en la vista de lista: la página no monta esta
        tabla en las vistas de alta. */}
    <IndicadoresInventario sitios={sitios} tieneContrato={tieneContrato} />

    {/* Plegable (pedido del 20/10). El buscador `q` y la selección `sel` viven
        en ESTE componente, fuera de la tarjeta, así que plegar y desplegar no
        los pierde: solo se desmonta la tabla. */}
    <CardColapsable
      id="inventario.pantallas"
      titulo={t('inventario.kpi.pantallas')}
      className="overflow-hidden"
      contentClassName="px-0 pb-0"
      resumen={<span className="text-[12px] text-muted">{t('inventario.tabla.de', { n: filtrados.length, total: sitios.length })}</span>}
      accion={
          /* Descarga lo FILTRADO, no todo: si alguien buscó "Reforma" y pulsa
              descargar, espera esas pantallas. Con el buscador vacío `filtrados`
              es el inventario completo, así que el caso normal no cambia. */
          <div className="flex items-center gap-1">
            <Download className="h-3.5 w-3.5 text-muted" />
            <button
              onClick={() => bajar('xlsx')}
              disabled={filtrados.length === 0}
              title={t('inventario.tabla.excel-title')}
              className="rounded px-1.5 py-1 text-[12px] font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
            >
              Excel
            </button>
            <button
              onClick={() => bajar('csv')}
              disabled={filtrados.length === 0}
              title={t('inventario.tabla.csv-title')}
              className="rounded px-1.5 py-1 text-[12px] font-medium text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:text-muted"
            >
              CSV
            </button>
          </div>
      }
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border px-3 py-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('inventario.tabla.buscar')}
            className="h-9 w-full rounded border border-border-strong bg-surface pl-8 pr-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
        <ChipsFiltroInventario
          sitios={sitios}
          tieneContrato={tieneContrato}
          filtros={filtros}
          onCambio={setFiltros}
        />
        {hayChips && (
          <button
            type="button"
            onClick={() => setFiltros(FILTROS_VACIOS)}
            className="inline-flex items-center gap-1 rounded bg-transparent px-1.5 py-1 text-[12px] text-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> {t('inventario.tabla.quitar-filtros')}
          </button>
        )}
      </div>

      {/* Barra de cambio MASIVO de tarifa (sin Excel): aparece al seleccionar. */}
      {puedeEditar && sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-accent-soft px-3 py-2 text-[12px]">
          <span className="inline-flex items-center gap-1.5 font-medium text-ink">
            <Tag className="h-3.5 w-3.5 text-info" />
            {t(sel.size === 1 ? 'inventario.tabla.seleccionadas.uno' : 'inventario.tabla.seleccionadas.otros', { n: sel.size })}
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
                {t('inventario.tabla.tarifa')}
              </button>
              <button
                type="button"
                onClick={() => setCampoMasivo('renta')}
                className={`border-l border-border-strong px-2 py-1 font-medium transition-colors ${campoMasivo === 'renta' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}
              >
                {t('inventario.tabla.renta')}
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
              {campoMasivo === 'renta' ? t('inventario.tabla.fijar-renta') : t('inventario.tabla.fijar-tarifa')}
            </button>
            <button
              type="button"
              onClick={() => setModoTarifa('ajustar')}
              className={`border-l border-border-strong px-2 py-1 font-medium transition-colors ${modoTarifa === 'ajustar' ? 'bg-accent text-white' : 'text-muted hover:bg-surface-2'}`}
            >
              {t('inventario.tabla.ajustar')}
            </button>
          </div>
          <div className="inline-flex items-center gap-1">
            <span className="text-muted">{modoTarifa === 'fijar' ? simboloMoneda(idioma) : ''}</span>
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
                  ? t('inventario.tabla.ph-ajuste')
                  : campoMasivo === 'renta' ? t('inventario.tabla.ph-renta') : t('inventario.tabla.ph-tarifa')
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
            {aplicando ? t('inventario.tabla.aplicando') : t('inventario.tabla.aplicar')}
          </Button>
          <button
            type="button"
            onClick={limpiarSel}
            className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-muted hover:text-ink"
          >
            <X className="h-3.5 w-3.5" /> {t('inventario.tabla.limpiar')}
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-[12px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              {puedeEditar && (
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={todosSel}
                    onChange={toggleTodos}
                    title={t('inventario.tabla.seleccionar-todo')}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                </th>
              )}
              <th className="px-3 py-2 font-medium">{t('inventario.tabla.col.pantalla')}</th>
              <th className="px-3 py-2 font-medium">{t('inventario.tabla.col.tipo')}</th>
              <th className="px-3 py-2 font-medium">{t('inventario.tabla.col.ubicacion')}</th>
              <th className="px-3 py-2 font-medium">{t('inventario.tabla.col.medio')}</th>
              <th className="px-3 py-2 text-right font-medium">{t('inventario.tabla.tarifa')}</th>
              <th className="px-3 py-2 font-medium">{t('inventario.tabla.col.disponibilidad')}</th>
              <th className="px-3 py-2 font-medium">{t('inventario.tabla.col.arrendador')}</th>
              {/* «Cada cuándo» ya no es columna (26/10): repetía «Mensual» en
                  todas las filas y se partía en dos renglones. Va bajo la renta. */}
              <th className="px-3 py-2 text-right font-medium">{t('inventario.tabla.renta')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.length === 0 ? (
              <tr>
                {/* Sin búsqueda activa el inventario está vacío de verdad; decir
                    "no coincide con la búsqueda" mandaba a limpiar un buscador
                    que ya estaba limpio (M2 de la auditoría). */}
                <td colSpan={puedeEditar ? 9 : 8} className="px-3 py-10 text-center text-muted">
                  {q
                    ? t(hayChips ? 'inventario.tabla.vacio.busqueda-filtros' : 'inventario.tabla.vacio.busqueda', { q })
                    : hayChips
                      ? t('inventario.tabla.vacio.filtros')
                      : t('inventario.tabla.vacio.inventario')}
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
                      {/* 22/10 · el id de DOOHmain que se usa al publicar, aunque
                          venga del mapa del servidor y no esté en la ficha. */}
                      {s.doohmainEfectiva && (
                        <div
                          className="demo-num text-[11px] text-muted"
                          title={t(
                            s.doohmainOrigen && s.doohmainOrigen !== 'ficha'
                              ? 'inventario.tabla.doohmain-title-servidor'
                              : 'inventario.tabla.doohmain-title',
                            { id: s.doohmainEfectiva },
                          )}
                        >
                          DOOHmain: <span className="text-ink">{s.doohmainEfectiva}</span>
                          {s.doohmainOrigen && s.doohmainOrigen !== 'ficha' && t('inventario.tabla.doohmain-servidor')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{textoTipoMedio(s.tipoMedio, t)}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {ubicacion([s.alcaldia, s.ciudad]) || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{textoMedio(s, t)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right">
                      <CeldaTarifa sitio={s} editable={puedeEditar} onSaved={notify} />
                    </td>
                    <td className="px-3 py-2.5">
                      {/* Disponibilidad comercial, no el estatus crudo: en una
                          digital lo que importa es cuántos slots quedan, y en
                          una fija basta con si se puede vender o no. */}
                      {(() => {
                        const d = disponibilidadInventario(s)
                        return <StatusBadge tono={d.tono}>{textoDisponibilidad(s, t)}</StatusBadge>
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
                    <td className="demo-num whitespace-nowrap px-3 py-2.5 text-right text-ink">
                      <CeldaRenta
                        info={r ?? null}
                        sitioNombre={s.nombre}
                        // Cuántas pantallas comparte el contrato: 1 (o suelta) se
                        // edita sin más; varias avisan antes de guardar.
                        hermanas={s.predioId ? (pantallasPorPredio.get(s.predioId) ?? 1) : 1}
                        editable={puedeEditarRenta}
                        onSaved={notify}
                      />
                      {periodicidadEff && (
                        <div className="font-sans text-[11px] text-muted">{periodicidadLabel(periodicidadEff, '—', idioma)}</div>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </CardColapsable>

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
      titulo={t('inventario.tabla.confirma')}
      subtitulo={avisoDeLote(loteRef.current, unidadLoteRef.current, t)}
      etiquetaConfirmar={t('inventario.tabla.confirmar-aplicar')}
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
  const { idioma, t } = useIdioma()

  const renta = info?.renta ?? 0
  const texto = info && info.renta > 0 ? formatMonto(info.renta, idioma) : '—'
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
      onSaved(t('inventario.renta.ilegible'))
      return
    }
    const num = Number(val.replace(/[^\d.]/g, ''))
    // Un 0 NO se guarda: `contrato_monto_ck` lo rechaza y, peor, se leería como
    // «el espacio es gratis». Sin cambio real tampoco se manda nada.
    if (!Number.isFinite(num) || num <= 0 || num === renta) {
      setEditando(false)
      if (Number.isFinite(num) && num <= 0) onSaved(t('inventario.tabla.renta-mayor-cero'))
      return
    }
    if (compartido && !window.confirm(
      t('inventario.renta.compartida-confirm', { n: hermanas, monto: formatMonto(num, idioma) }),
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
            ? t('inventario.renta.predio-actualizada', { n: hermanas })
            : t('inventario.renta.actualizada', { nombre: sitioNombre }),
        ),
      alFallar: (m) => onSaved(m),
      mensajeSiFalla: t('inventario.renta.no-actualizar'),
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
      titulo={t('inventario.tabla.confirma')}
      subtitulo={t('inventario.renta.sensible', { nombre: sitioNombre })}
      etiquetaConfirmar={t('comercial.comun.confirmar-guardar')}
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
              ? t('inventario.renta.title-compartida', { n: hermanas })
              : t('inventario.renta.title')
          }
          // 26/10 · `whitespace-nowrap` para que «$» y la cifra no se partan en
          // dos renglones, y `bg-transparent` porque sin preflight el <button>
          // hereda el gris del sistema y la celda se veía como una pastilla más
          // pesada que el dato. El lápiz y el contorno salen al pasar el ratón.
          className="group/ren demo-num ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-transparent px-1.5 py-0.5 text-ink transition-colors hover:ring-1 hover:ring-border-strong"
        >
          {texto}
          {compartido && <Building2 className="h-3 w-3 shrink-0 text-muted" />}
          <Pencil className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover/ren:opacity-100 group-focus-visible/ren:opacity-100" />
        </button>
        {dialogo}
      </>
    )
  }

  return (
    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] text-muted">{simboloMoneda(idioma)}</span>
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
  const { idioma, t } = useIdioma()
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
      onSaved(t('inventario.tarifa.ilegible'))
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
      alLograr: () => onSaved(t('inventario.tarifa.actualizada', { nombre: sitio.nombre })),
      alFallar: (m) => onSaved(m),
      mensajeSiFalla: t('inventario.tarifa.no-actualizar'),
    })
    setSaving(false)
    setEditando(false)
  }

  function cancelar() {
    resueltoRef.current = true
    setEditando(false)
  }

  if (!editable) {
    return <span className="demo-num text-ink">{formatMonto(sitio.tarifaMensual, idioma)}</span>
  }

  // En las dos ramas, por lo mismo que en `CeldaRenta`: cuando llega el 403 la
  // celda ya volvió a su forma de botón.
  const dialogo = (
    <DialogoCandado
      candado={candado}
      titulo={t('inventario.tabla.confirma')}
      subtitulo={t('inventario.tarifa.sensible', { nombre: sitio.nombre })}
      etiquetaConfirmar={t('comercial.comun.confirmar-guardar')}
    />
  )

  if (!editando) {
    return (
      <>
        <button
          type="button"
          onClick={abrir}
          title={t('inventario.tarifa.title')}
          // Igual que en `CeldaRenta`: en una línea y sin el fondo del sistema.
          className="group/tar demo-num ml-auto inline-flex items-center gap-1.5 whitespace-nowrap rounded bg-transparent px-1.5 py-0.5 text-ink transition-colors hover:ring-1 hover:ring-border-strong"
        >
          {formatMonto(sitio.tarifaMensual, idioma)}
          <Pencil className="h-3 w-3 text-muted opacity-0 transition-opacity group-hover/tar:opacity-100 group-focus-visible/tar:opacity-100" />
        </button>
        {dialogo}
      </>
    )
  }

  return (
    <span className="inline-flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <span className="text-[12px] text-muted">{simboloMoneda(idioma)}</span>
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
// v0.12.3 · la etiqueta de una pantalla propia en la columna de propietario.
// Constante y no `function`: `candado-inventario-y-fichas.test.ts` recorta cada
// celda hasta la siguiente `function` y cuenta sus `return (`; esta etiqueta no
// edita nada y no debe contarse como rama de ninguna celda.
// 26/10 · `StatusBadge` verde en vez de los `emerald-*` sueltos: el mismo chip
// que el resto de estados, con los tokens del proyecto.
// I18N: el traductor entra como argumento de una funcion inmediata y no con un
// `return` propio, por la misma prueba que cuenta los `return (` de cada celda.
const EtiquetaPropia = () =>
  ((t: ReturnType<typeof useIdioma>['t']) => (
    <span title={t('inventario.propia.title')}>
      <StatusBadge tono="verde">{t('inventario.chips.propia')}</StatusBadge>
    </span>
  ))(useIdioma().t)

// «Sin arrendador» es un PENDIENTE (falta saber a quién se le paga), así que se
// pinta en ámbar y con la misma palabra en todas las ramas. Una de ellas decía
// «arrendatario», que es quien renta el espacio, no su dueño. Constante por lo
// mismo que `EtiquetaPropia`.
const EtiquetaSinArrendador = () => <StatusBadge tono="ambar">{useIdioma().t('inventario.sin-arrendador')}</StatusBadge>

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
  const { t } = useIdioma()

  const nombreDirecto = sitio.arrendadorId ? arrById.get(sitio.arrendadorId) ?? null : null
  const display = nombreDirecto ?? propietarioContrato

  // v0.12.3 · una pantalla PROPIA no tiene arrendador: no es «Sin arrendador»
  // (un pendiente), es de la empresa. Se cambia desde su ficha. Esta rama NO
  // edita nada —no pasa por el candado—, por eso va en su propio componente y
  // no cuenta entre las tres ramas que `candado-inventario-y-fichas.test.ts`
  // exige que abran el cuadro de la contraseña.
  if (sitio.propio) return <EtiquetaPropia />

  async function elegir(e: React.ChangeEvent<HTMLSelectElement>) {
    const nuevo = e.target.value || null
    setEditando(false)
    if ((nuevo ?? null) === (sitio.arrendadorId ?? null)) return
    setSaving(true)
    await candado.ejecutar({
      guardar: () => actualizarSitioApi(sitio.id, { arrendadorId: nuevo }),
      alLograr: () =>
        onSaved(
          nuevo
            ? t('inventario.arrendador.actualizado', { nombre: sitio.nombre })
            : t('inventario.arrendador.quitado', { nombre: sitio.nombre }),
        ),
      alFallar: (m) => onSaved(m),
      mensajeSiFalla: t('inventario.arrendador.no-actualizar'),
    })
    setSaving(false)
  }

  if (!editable) {
    return display ? (
      <span className="text-ink">{display}</span>
    ) : (
      <EtiquetaSinArrendador />
    )
  }

  // En las TRES ramas de abajo. Aquí importa más que en las otras dos celdas:
  // el selector se cierra en cuanto se elige (`setEditando(false)` es la primera
  // línea de `elegir`), así que para cuando vuelve el 403 esta celda es siempre
  // la rama del botón.
  const dialogo = (
    <DialogoCandado
      candado={candado}
      titulo={t('inventario.tabla.confirma')}
      subtitulo={t('inventario.arrendador.sensible', { nombre: sitio.nombre })}
      etiquetaConfirmar={t('comercial.comun.confirmar-guardar')}
    />
  )

  if (saving) {
    return (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t('comercial.comun.guardando')}
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
          title={t('inventario.arrendador.asignar')}
          className="group/prop inline-flex max-w-full items-center gap-1.5 rounded bg-transparent px-1.5 py-0.5 text-left transition-colors hover:ring-1 hover:ring-border-strong"
        >
          {display ? <span className="truncate text-ink">{display}</span> : <EtiquetaSinArrendador />}
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
        <option value="">{t('inventario.sin-arrendador.opcion')}</option>
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
