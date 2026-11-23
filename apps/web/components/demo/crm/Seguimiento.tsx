'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeftRight, FileText, Plus, Target, Trophy, Wallet } from 'lucide-react'
import { cn } from '@/lib/cn'
import { conteo } from '@/lib/plural'
import { useIdioma } from '@/lib/i18n/contexto'
import { formatFecha } from '@/lib/data/client'
import { withTrail } from '@/lib/nav-trail'
import type { Crumb } from '@/components/demo/ui/Breadcrumbs'
import { KPICard, KPICardSkeleton } from '@/components/demo/KPICard'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { cambiarEtapaApi, oportunidadesApi, type FichaOportunidad, type Oportunidad, type PaginaOportunidades } from '@/lib/data/oportunidades-api'
import { prospectosApi, type Prospecto } from '@/lib/data/captacion-api'
import { ETAPAS as ETAPAS_PROSPECTO, type Etapa as EtapaProspecto } from '@/lib/captacion'
import { CLAVE_ETAPA as CLAVE_ETAPA_PROSPECTO } from '@/components/demo/comercial-opex/ComercialOpex'
import {
  ETAPAS_ABIERTAS,
  agruparEmbudo,
  diasNegociando,
  etapaOportunidadCerrada,
  montoReferencia,
  type EtapaOportunidad,
} from '@/lib/crm'
import { FormOportunidad, type ProspectoElegido } from './FormOportunidad'
import { COLOR_ETAPA, claveEtapa } from './etiquetas'
import { tieneOportunidadAbierta } from '@/lib/prospecto-contactado'
import {
  PULSACION_LARGA_MS,
  TOLERANCIA_PULSACION_PX,
  aceptaColumna,
  aplicarPendiente,
  esArrastre,
  moverTrasCrear,
  resultadoAlSoltar,
  sePuedeArrastrar,
  velocidadAutoScroll,
  type Arrastrable,
} from '@/lib/seguimiento-arrastre'
import { ModalCambioEtapa } from './ModalCambioEtapa'

// ============================================================================
//  Seguimiento — las oportunidades en columnas por etapa (tipo Kanban).
//  ADR 0051 §7; rehecho el 18/11 (segundo pedido del dueño del día).
// ----------------------------------------------------------------------------
//  Hasta el 18/11 por la tarde había dos pestañas, «Embudo» y «Oportunidades»,
//  que enseñaban lo mismo de dos formas. El dueño: quitar Oportunidades por ser
//  casi igual, y que el embudo se llame «Seguimiento» y se vea por columnas.
//  Para que no se pierda nada de la pestaña quitada, su búsqueda y el filtro de
//  vendedor viven aquí arriba.
//
//  Lee `GET /api/oportunidades` y el servidor ya filtra por vendedor (quien no
//  tiene `comercial.aprobar` solo recibe las suyas): aquí no se decide quién ve
//  qué. El filtro de vendedor es solo una comodidad de pantalla, y por eso solo
//  sale cuando `veTodas`.
//
//  El embudo traía un <select> en cada tarjeta; aquí la tarjeta entera es el
//  enlace a la ficha (un control dentro de un enlace no se puede pulsar bien
//  en un celular). Desde el 18/11 (sexto pedido) las tarjetas SE ARRASTRAN
//  entre columnas: ver «El arrastre», abajo.
//
//  «Perdida» va plegada por omisión: es la columna que más crece y la que menos
//  se trabaja. Un chip la enseña como sexta columna.
//
//  En celular las columnas tienen ancho fijo y se desplazan en horizontal
//  DENTRO de su contenedor (`overflow-x-auto`); la página no se ensancha. En
//  pantalla ancha (xl) caben todas en una rejilla sin desplazamiento.
//
//  18/11, tercer pedido: «los prospectos se deben de ver también en
//  Seguimiento; creé uno y no se vio». Crear un prospecto (pestaña Prospectos,
//  tabla `prospectos`) NO crea oportunidad, y aquí solo se pintaban
//  oportunidades. Ahora los prospectos de tipo CLIENTE que quien mira puede
//  ver —el MISMO `GET /api/captacion` de la pestaña Prospectos, con su regla
//  `soloDe`: aquí tampoco se decide quién ve qué— y que todavía no tienen
//  oportunidad salen como tarjetas en Contacto, con «Crear oportunidad».
//  Se quedan fuera los PERDIDO y RECHAZADO (lo mismo que ofrece el alta de
//  oportunidad); un APROBADO sin oportunidad SÍ sale: ya es cliente, pero
//  nadie le está dando seguimiento, que es justo lo que esta vista enseña.
//  Un prospecto con una oportunidad ABIERTA no se repite: se ve por su
//  oportunidad (desde el 18/11, quinto pedido, con todas cerradas vuelve). Ojo: se compara contra las oportunidades que
//  llegaron (las primeras 100); con más, uno podría salir dos veces.
//
//  18/11, cuarto pedido: al pasar un prospecto a Contactado el vendedor elige
//  si sigue como prospecto o se convierte en oportunidad
//  (`lib/prospecto-contactado.ts`). El que siguió como prospecto lleva aquí,
//  junto a «Prospecto», la etapa en la que va («Contactado», «Visita»…), para
//  distinguirlo del recién captado; «Crear oportunidad» sigue a mano.
//
//  El arrastre — 18/11, sexto pedido: «que se pueda mover y se vea la
//  animación arrastrando entre cada columna, y solo al terminar de moverlo
//  abrir un modal con los campos para llenar el cambio».
//  - Pointer Events nativos, sin dependencias. Con ratón empieza al pasar
//    `UMBRAL_ARRASTRE_PX`: menos que eso es un clic y abre la ficha como
//    siempre. Con dedo empieza con PULSACIÓN LARGA (`PULSACION_LARGA_MS`):
//    deslizar sin esperar sigue desplazando el tablero en horizontal, que en
//    celular es la única forma de llegar a las columnas de la derecha. Ya en
//    arrastre, un `touchmove` no pasivo frena el scroll del navegador.
//  - Mientras se arrastra: una copia de la tarjeta sigue al puntero (levantada,
//    con sombra), el original queda tenue en su sitio, la columna bajo el
//    puntero se resalta con un hueco donde caería, y las que el servidor no
//    aceptaría (sacar algo de Ganada o Perdida; un prospecto a una cerrada) se
//    ven apagadas con «Aquí no». Cerca del borde el tablero se desplaza solo.
//  - Al soltar (`resultadoAlSoltar`, `lib/seguimiento-arrastre.ts`): fuera, en
//    la misma columna o donde no se acepta → vuelve con transición. En otra
//    columna → la tarjeta se queda ahí «pendiente» y se abre
//    `ModalCambioEtapa`; Guardar llama a `POST …/etapa`, Cancelar o un error
//    del servidor la devuelven animada a su columna. Escape cancela.
//  - Un prospecto soltado en otra columna abre `FormOportunidad` con él: el
//    alta nace en Contacto (la API no acepta la etapa al crear) y se mueve
//    justo después (`moverTrasCrear`).
//  - Teclado y quien no quiera arrastrar: el botón «Mover de etapa» de cada
//    tarjeta abre el mismo modal con un selector de etapa.
//  - Las animaciones respetan `prefers-reduced-motion`: sin vuelo de vuelta ni
//    inclinación; la copia sigue al puntero igual (eso no es animación, es
//    lo que se está moviendo).
//  - Sin `comercial.crear` (lo que exige el servidor para mover) no hay ni
//    arrastre ni botón.
// ============================================================================

const ETAPAS_VISIBLES: EtapaOportunidad[] = ['CONTACTO', 'NECESIDAD', 'COTIZANDO', 'NEGOCIANDO', 'GANADA']

// El rastro dice «Propuestas › Seguimiento»: la ficha vive en /crm/… por
// dentro, pero quien la abre llegó desde Propuestas y ahí vuelve.
const RUTA = '/propuestas?vista=seguimiento'

// Las etapas de prospecto que se pintan aquí: todas menos las descartadas.
const ETAPAS_PROSPECTO_VISIBLES: EtapaProspecto[] = ETAPAS_PROSPECTO.filter(
  (e) => e !== 'PERDIDO' && e !== 'RECHAZADO',
)

const DIA_MS = 86_400_000

const sumaMontos = (ops: Oportunidad[]) =>
  ops.reduce((s, o) => s + (montoReferencia(o.presupuestoMin, o.presupuestoMax) ?? 0), 0)

// Sin acentos ni mayúsculas: «Jose» encuentra a «José».
const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const razonSocial = (p: Prospecto) => (typeof p.datos?.razonSocial === 'string' ? p.datos.razonSocial : null)

/**
 * Si un prospecto suelto pasa la búsqueda y el filtro de vendedor de arriba:
 * por su nombre, su contacto o su razón social, sin acentos; el vendedor es
 * quien lo captó.
 */
export function prospectoCoincide(p: Prospecto, busqueda: string, vendedor: string): boolean {
  if (vendedor && p.usuarioId !== vendedor) return false
  const q = normalizar(busqueda.trim())
  return !q || normalizar(`${p.nombre} ${p.contacto?.nombre ?? ''} ${razonSocial(p) ?? ''}`).includes(q)
}

/** Lo que espera su modal: la tarjeta ya pintada en la columna destino. */
export interface PendienteArrastre {
  tipo: 'oportunidad' | 'prospecto'
  id: string
  destino: EtapaOportunidad
}

// La clave de cada tarjeta en el DOM (`data-tarjeta`): la usan el arrastre y
// la animación de vuelta para encontrarla después de que React la mueva.
const claveTarjeta = (a: { tipo: 'oportunidad' | 'prospecto'; id: string }) => (a.tipo === 'prospecto' ? `p-${a.id}` : a.id)

// useLayoutEffect en el navegador; en el servidor (y en las pruebas, que
// rinden a HTML) no hay layout que medir y React avisaría.
const useLayoutEffectCliente = typeof window !== 'undefined' ? useLayoutEffect : useEffect

const movimientoReducido = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** El gesto en curso: de pointerdown a pointerup. Vive en un ref, no en estado. */
interface Gesto {
  item: Arrastrable
  puntero: number
  raton: boolean
  x0: number
  y0: number
  x: number
  y: number
  dx: number
  dy: number
  rect: DOMRect
  activo: boolean
  temporizador: ReturnType<typeof setTimeout> | null
  cuadro: number | null
  sobre: EtapaOportunidad | null
  limpiar: () => void
}

export function Seguimiento({
  inicial = null,
  prospectosInicial = null,
  nuevaAbierta = false,
  onCerrarNueva = () => {},
  puedeCrear = false,
  ahora,
  pendienteInicial = null,
}: {
  /** Solo para pruebas: una tarjeta soltada cuyo modal está abierto. */
  pendienteInicial?: PendienteArrastre | null
  /** Solo para pruebas: lo que se pinta antes de que llegue la API. */
  inicial?: PaginaOportunidades | null
  /** Solo para pruebas: los prospectos antes de que llegue la API. */
  prospectosInicial?: Prospecto[] | null
  /** `comercial.crear`: la página ya lo sabe y lo pasa (lo usa su botón). */
  puedeCrear?: boolean
  /** El formulario de alta, que se abre desde el encabezado de la página. */
  nuevaAbierta?: boolean
  onCerrarNueva?: () => void
  /** Solo para pruebas: la fecha contra la que se cuentan los días. */
  ahora?: Date
}) {
  const { t, idioma, dinero } = useIdioma()
  const [pagina, setPagina] = useState<PaginaOportunidades | null>(inicial)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')
  const [vendedor, setVendedor] = useState('')
  const [verPerdidas, setVerPerdidas] = useState(false)
  const [prospectos, setProspectos] = useState<Prospecto[] | null>(prospectosInicial)
  // «Crear oportunidad» desde la tarjeta de un prospecto: el mismo formulario
  // que el botón del encabezado, ya con el prospecto elegido.
  const [desde, setDesde] = useState<ProspectoElegido | null>(null)

  // ── El arrastre (ver la cabecera) ──
  // La tarjeta soltada en otra columna, mientras su modal está abierto.
  const [pendiente, setPendiente] = useState<PendienteArrastre | null>(pendienteInicial)
  const pendienteRef = useRef(pendiente)
  pendienteRef.current = pendiente
  // «Mover de etapa» sin arrastrar (teclado): el mismo modal, con selector.
  const [moverSin, setMoverSin] = useState<Oportunidad | null>(null)
  // Lo que se está arrastrando ahora (para pintar la copia, el hueco y las columnas).
  const [arrastrando, setArrastrando] = useState<{ item: Arrastrable; alto: number; ancho: number } | null>(null)
  const [sobre, setSobre] = useState<EtapaOportunidad | null>(null)
  const gesto = useRef<Gesto | null>(null)
  const copiaRef = useRef<HTMLDivElement | null>(null)
  const tableroRef = useRef<HTMLDivElement | null>(null)
  // Tras un arrastre, el clic que dispara el navegador al soltar NO abre la ficha.
  const sinClic = useRef(false)
  // La animación de vuelta (FLIP): de dónde sale la tarjeta que React acaba de
  // mover. Se aplica en el layout effect, ya con la tarjeta en su sitio nuevo.
  const vuelo = useRef<{ clave: string; rect: DOMRect } | null>(null)
  // El alta desde un prospecto arrastrado: si se guardó, cerrar no lo devuelve.
  const creada = useRef(false)

  const cargar = useCallback(() => {
    const ops = oportunidadesApi({ porPagina: 100 })
      .then((p) => { setPagina(p); setError(null) })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
    // Si Captación no responde (o quien mira no la tiene), el tablero de
    // oportunidades se sigue viendo: los prospectos son un añadido.
    const pros = prospectosApi({ tipo: 'CLIENTE', etapas: ETAPAS_PROSPECTO_VISIBLES, porPagina: 100 })
      .then((p) => setProspectos(p.prospectos))
      .catch(() => setProspectos([]))
    return Promise.all([ops, pros]).then(() => undefined)
  }, [])
  useEffect(() => { void cargar() }, [cargar])

  const ops = useMemo(() => pagina?.oportunidades ?? [], [pagina])
  // Los prospectos que no tienen una oportunidad ABIERTA entre las que
  // llegaron. 18/11, quinto pedido («sí, que vuelva a aparecer como
  // prospecto»): con todas sus oportunidades cerradas (GANADA o PERDIDA)
  // vuelve a salir como tarjeta, que es justo cuando el servidor deja abrirle
  // otra (`crearOportunidad`). Hasta entonces se ocultaba con cualquiera.
  // También el APROBADO con su oportunidad ganada: el dueño lo quiso así en
  // general, aunque ya sea cliente.
  const sueltos = useMemo(
    () =>
      (prospectos ?? []).filter(
        (p) => p.tipo === 'CLIENTE' && !tieneOportunidadAbierta(p.id, ops) && ETAPAS_PROSPECTO_VISIBLES.includes(p.etapa),
      ),
    [ops, prospectos],
  )
  const cliente = (o: Oportunidad) => o.clienteNombre ?? o.prospectoNombre ?? '—'

  // Los vendedores que aparecen en lo que llegó, para el filtro.
  const vendedores = useMemo(() => {
    const m = new Map<string, string>()
    for (const o of ops) if (o.usuarioId) m.set(o.usuarioId, o.vendedorNombre ?? t('crm.cotejo.sin-vendedor'))
    for (const p of sueltos) if (p.usuarioId && !m.has(p.usuarioId)) m.set(p.usuarioId, p.vendedorNombre ?? t('crm.cotejo.sin-vendedor'))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [ops, sueltos, t])

  const filtradas = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return ops.filter(
      (o) =>
        (!vendedor || o.usuarioId === vendedor) &&
        (!q || normalizar(`${o.clienteNombre ?? ''} ${o.prospectoNombre ?? ''} ${o.nombre}`).includes(q)),
    )
  }, [ops, busqueda, vendedor])
  const sueltosFiltrados = useMemo(
    () => sueltos.filter((p) => prospectoCoincide(p, busqueda, vendedor)),
    [sueltos, busqueda, vendedor],
  )
  const columnas = useMemo(() => {
    const etapas = verPerdidas ? [...ETAPAS_VISIBLES, 'PERDIDA' as const] : ETAPAS_VISIBLES
    // Con el modal abierto, la oportunidad soltada se pinta ya en su destino.
    const op = pendiente?.tipo === 'oportunidad' ? pendiente : null
    return agruparEmbudo(aplicarPendiente(filtradas, op)).filter((c) => etapas.includes(c.etapa))
  }, [filtradas, verPerdidas, pendiente])

  // Los prospectos sueltos van en Contacto; el que se soltó en otra columna
  // (su alta está abierta), en esa.
  const extrasDe = (e: EtapaOportunidad) =>
    sueltosFiltrados.filter((p) =>
      pendiente?.tipo === 'prospecto' && pendiente.id === p.id ? pendiente.destino === e : e === 'CONTACTO',
    )

  // ── La animación de vuelta (FLIP) ──
  // Tras cada render, si algo dejó dicho de dónde venía una tarjeta, se la
  // pinta un instante allí y se la deja volar a su sitio nuevo. Web Animations
  // API: no toca el `style` que React maneja.
  useLayoutEffectCliente(() => {
    const v = vuelo.current
    if (!v) return
    vuelo.current = null
    if (movimientoReducido()) return
    const el = document.querySelector<HTMLElement>(`[data-tarjeta="${CSS.escape(v.clave)}"]`)
    if (!el?.animate) return
    const r = el.getBoundingClientRect()
    const dx = v.rect.left - r.left
    const dy = v.rect.top - r.top
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(1.03)`, boxShadow: '0 12px 28px rgba(0,0,0,.18)', zIndex: 10 },
        { transform: 'translate(0, 0) scale(1)', boxShadow: '0 0 0 rgba(0,0,0,0)', zIndex: 10 },
      ],
      { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' },
    )
  })

  /** Deja dicho que la tarjeta `clave` sale de donde está ahora (o de `rect`). */
  const volarDesde = (clave: string, rect?: DOMRect | null) => {
    const r = rect ?? document.querySelector<HTMLElement>(`[data-tarjeta="${CSS.escape(clave)}"]`)?.getBoundingClientRect()
    if (r) vuelo.current = { clave, rect: r }
  }

  // ── El gesto ──
  const terminarGesto = (g: Gesto) => {
    if (g.temporizador) clearTimeout(g.temporizador)
    if (g.cuadro != null) cancelAnimationFrame(g.cuadro)
    g.limpiar()
    if (gesto.current === g) gesto.current = null
    document.body.style.userSelect = ''
  }

  const ponerCopia = (g: Gesto) => {
    const c = copiaRef.current
    if (c) c.style.transform = `translate3d(${g.x - g.dx}px, ${g.y - g.dy}px, 0)`
  }

  // Qué columna hay bajo el puntero. La copia no recibe el puntero
  // (`pointer-events: none`), así que `elementFromPoint` ve lo de abajo.
  const buscarColumna = (g: Gesto) => {
    const col = document.elementFromPoint(g.x, g.y)?.closest<HTMLElement>('[data-columna]')
    const e = (col?.dataset.columna as EtapaOportunidad | undefined) ?? null
    if (e !== g.sobre) {
      g.sobre = e
      setSobre(e)
    }
  }

  // Cerca del borde del tablero (o de la ventana) se desplaza solo, cuadro a
  // cuadro: con el dedo quieto en el borde también tiene que avanzar.
  const autoDesplazar = (g: Gesto) => {
    const t = tableroRef.current
    if (t) {
      const r = t.getBoundingClientRect()
      const vx = velocidadAutoScroll(g.x, r.left, r.right)
      if (vx) t.scrollLeft += vx
    }
    const vy = velocidadAutoScroll(g.y, 0, window.innerHeight, 40, 14)
    if (vy) window.scrollBy(0, vy)
    buscarColumna(g)
    g.cuadro = requestAnimationFrame(() => autoDesplazar(g))
  }

  const activar = (g: Gesto) => {
    g.activo = true
    g.temporizador = null
    sinClic.current = true
    document.body.style.userSelect = 'none'
    window.getSelection?.()?.removeAllRanges()
    if (!g.raton) navigator.vibrate?.(12)
    setArrastrando({ item: g.item, alto: g.rect.height, ancho: g.rect.width })
    g.cuadro = requestAnimationFrame(() => autoDesplazar(g))
  }

  const soltar = (g: Gesto, cancelado: boolean) => {
    terminarGesto(g)
    if (!g.activo) return
    // El clic que llega justo después del pointerup no abre la ficha.
    setTimeout(() => { sinClic.current = false }, 0)
    const clave = claveTarjeta(g.item)
    const desdeRect = copiaRef.current?.getBoundingClientRect() ?? null
    const r = cancelado ? 'nada' : resultadoAlSoltar(g.item, g.sobre)
    if (r === 'cambio-etapa' || r === 'crear-oportunidad') {
      const destino = g.sobre as EtapaOportunidad
      setPendiente({ tipo: g.item.tipo, id: g.item.id, destino })
      if (r === 'crear-oportunidad') {
        const p = sueltos.find((x) => x.id === g.item.id)
        creada.current = false
        if (p) setDesde({ id: p.id, nombre: p.nombre })
      }
    }
    // Vuela de donde quedó la copia a su sitio (el de antes, o el pendiente).
    volarDesde(clave, desdeRect)
    setArrastrando(null)
    setSobre(null)
  }

  const alPresionar = (e: ReactPointerEvent<HTMLElement>, item: Arrastrable) => {
    if (!sePuedeArrastrar(item, puedeCrear) || pendiente || moverSin || gesto.current) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    // Los botones de la tarjeta («Mover de etapa», «Crear oportunidad») se pulsan, no se arrastran.
    if ((e.target as HTMLElement).closest('button')) return
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const g: Gesto = {
      item,
      puntero: e.pointerId,
      raton: e.pointerType === 'mouse',
      x0: e.clientX,
      y0: e.clientY,
      x: e.clientX,
      y: e.clientY,
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      rect,
      activo: false,
      temporizador: null,
      cuadro: null,
      sobre: null,
      limpiar: () => {},
    }
    const mover = (ev: PointerEvent) => {
      if (ev.pointerId !== g.puntero) return
      g.x = ev.clientX
      g.y = ev.clientY
      if (!g.activo) {
        const dx = g.x - g.x0
        const dy = g.y - g.y0
        if (g.raton) {
          if (esArrastre(dx, dy)) activar(g)
        } else if (Math.hypot(dx, dy) > TOLERANCIA_PULSACION_PX) {
          // El dedo se movió antes de la pulsación larga: es scroll, no arrastre.
          terminarGesto(g)
        }
        if (!g.activo) return
      }
      ponerCopia(g)
      buscarColumna(g)
    }
    const arriba = (ev: PointerEvent) => { if (ev.pointerId === g.puntero) soltar(g, false) }
    const cancelar = (ev: PointerEvent) => { if (ev.pointerId === g.puntero) soltar(g, true) }
    const tecla = (ev: KeyboardEvent) => { if (ev.key === 'Escape' && g.activo) { ev.preventDefault(); soltar(g, true) } }
    // Ya arrastrando con el dedo, el navegador NO debe desplazar la página.
    const tocar = (ev: TouchEvent) => { if (g.activo && ev.cancelable) ev.preventDefault() }
    // La pulsación larga sobre un enlace abre el menú del sistema en Android.
    const menu = (ev: Event) => { if (!g.raton) ev.preventDefault() }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', arriba)
    window.addEventListener('pointercancel', cancelar)
    window.addEventListener('keydown', tecla)
    window.addEventListener('touchmove', tocar, { passive: false })
    window.addEventListener('contextmenu', menu)
    g.limpiar = () => {
      window.removeEventListener('pointermove', mover)
      window.removeEventListener('pointerup', arriba)
      window.removeEventListener('pointercancel', cancelar)
      window.removeEventListener('keydown', tecla)
      window.removeEventListener('touchmove', tocar)
      window.removeEventListener('contextmenu', menu)
    }
    gesto.current = g
    if (!g.raton) g.temporizador = setTimeout(() => activar(g), PULSACION_LARGA_MS)
  }

  // Si la pantalla se desmonta a medio gesto, no quedan escuchas colgando.
  useEffect(() => () => { if (gesto.current) terminarGesto(gesto.current) }, [])

  // La copia arranca donde estaba la tarjeta, y se «levanta».
  useLayoutEffectCliente(() => {
    const g = gesto.current
    const c = copiaRef.current
    if (!arrastrando || !g || !c) return
    ponerCopia(g)
    const interior = c.firstElementChild as HTMLElement | null
    if (interior?.animate && !movimientoReducido()) {
      interior.animate(
        [{ transform: 'scale(1) rotate(0deg)' }, { transform: 'scale(1.04) rotate(2deg)' }],
        { duration: 160, easing: 'ease-out', fill: 'forwards' },
      )
    }
  }, [arrastrando])

  const sinClicCaptura = (e: React.MouseEvent) => {
    if (sinClic.current) {
      e.preventDefault()
      e.stopPropagation()
      sinClic.current = false
    }
  }

  // ── El modal del cambio ──
  const aMover: Oportunidad | null =
    moverSin ?? (pendiente?.tipo === 'oportunidad' ? ops.find((o) => o.id === pendiente.id) ?? null : null)

  /** Cancelar o error: la tarjeta vuelve, volando, a su columna. */
  const devolver = () => {
    const p = pendienteRef.current
    if (p) volarDesde(claveTarjeta(p))
    setPendiente(null)
    setMoverSin(null)
  }

  const alGuardarEtapa = (f: FichaOportunidad, etapa: EtapaOportunidad) => {
    const anterior = aMover
    // Desde el botón la tarjeta todavía está en su columna: que vuele a la nueva.
    if (moverSin) volarDesde(moverSin.id)
    setPagina((p) => {
      if (!p || !anterior) return p
      const porEtapa = { ...p.porEtapa }
      porEtapa[anterior.etapa] = Math.max(0, (porEtapa[anterior.etapa] ?? 0) - 1)
      porEtapa[f.etapa] = (porEtapa[f.etapa] ?? 0) + 1
      return {
        ...p,
        porEtapa,
        oportunidades: p.oportunidades.map((o) =>
          o.id === f.id
            ? { ...o, etapa: f.etapa, ganadaEn: f.ganadaEn, perdidaEn: f.perdidaEn, motivoPerdida: f.motivoPerdida, actualizadoEn: f.actualizadoEn }
            : o,
        ),
      }
    })
    setPendiente(null)
    setMoverSin(null)
    toast.success(t('crm.arrastre.movida', { etapa: t(claveEtapa(etapa)) }))
    void cargar()
  }

  const alFallarEtapa = (mensaje: string) => {
    // El texto del servidor tal cual (ya viene traducido): un 409 porque otra
    // persona la cerró, un 400… Y se relee: lo que hay ya no es lo que creíamos.
    toast.error(mensaje)
    devolver()
    void cargar()
  }

  // ── El alta desde un prospecto arrastrado ──
  const prospectoPendiente = pendiente?.tipo === 'prospecto' ? pendiente : null
  const alCerrarAlta = () => {
    setDesde(null)
    const p = pendienteRef.current
    // Cerrado sin crear: el prospecto vuelve a Contacto.
    if (p?.tipo === 'prospecto' && !creada.current) devolver()
    creada.current = false
  }
  const alCrearDesdeProspecto = (f: FichaOportunidad) => {
    const p = pendienteRef.current
    if (p?.tipo !== 'prospecto') { void cargar(); return }
    creada.current = true
    void (async () => {
      const r = await moverTrasCrear(f.id, p.destino, cambiarEtapaApi)
      if (!r.ok) toast.error(t('crm.arrastre.creada-sin-mover', { etapa: t(claveEtapa(p.destino)), error: r.error }))
      // La tarjeta sigue «pendiente» en su destino hasta que llega la
      // oportunidad nueva: así no parpadea de vuelta en Contacto.
      await cargar()
      setPendiente(null)
    })()
  }

  const rastro: Crumb[] = [
    { label: t('propuestas.lista.titulo'), href: '/propuestas' },
    { label: t('crm.pestana.seguimiento'), href: RUTA },
  ]

  // Las cifras de arriba son de TODO lo que se ve (no cambian al filtrar): los
  // conteos salen de `porEtapa`, que el servidor cuenta sobre todas; los
  // montos, de las que llegaron (las primeras 100), que es lo que hay.
  const cuenta = (e: EtapaOportunidad) => pagina?.porEtapa[e] ?? 0
  const abiertas = ETAPAS_ABIERTAS.reduce((s, e) => s + cuenta(e), 0)
  const enJuego = sumaMontos(ops.filter((o) => !etapaOportunidadCerrada(o.etapa)))
  const ganado = sumaMontos(ops.filter((o) => o.etapa === 'GANADA'))
  const cotizaciones = ops.reduce((s, o) => s + o.cotizaciones, 0)

  // El rango que dijo el cliente: «$100,000.00 – $200,000.00», o el extremo
  // que haya, o «Sin presupuesto».
  const rango = (o: Oportunidad) => {
    const { presupuestoMin: min, presupuestoMax: max } = o
    if (min == null && max == null) return null
    if (min != null && max != null && min !== max) return `${dinero(min)} – ${dinero(max)}`
    return dinero((max ?? min) as number)
  }

  const badge = (e: EtapaOportunidad) => (
    <span className={cn('rounded-full border px-2 py-0.5 text-[11px] font-medium', COLOR_ETAPA[e])}>{t(claveEtapa(e))}</span>
  )

  // Lo que dice cada tarjeta: lo mismo en el tablero y en la copia que se arrastra.
  const cuerpoOportunidad = (o: Oportunidad) => {
    const r = rango(o)
    const dias = diasNegociando(o, ahora)
    return (
      <>
        <p className="truncate text-[13px] font-medium text-ink" title={cliente(o)}>{cliente(o)}</p>
        <p className="truncate text-muted" title={o.nombre}>{o.nombre}</p>
        <p className={cn('mt-1', r == null ? 'text-muted' : 'demo-num font-medium text-ink')}>
          {r ?? t('crm.sin-presupuesto')}
        </p>
        <p className="mt-1 text-muted">
          <span className="demo-num">{conteo(o.cotizaciones, t('crm.unidad.cotizacion'), t('crm.unidad.cotizaciones'))}</span>
          {' · '}
          <span className="demo-num">
            {t('crm.seguimiento.dias', { dias: conteo(dias, t('crm.unidad.dia'), t('crm.unidad.dias')) })}
          </span>
        </p>
        {o.fechaDecision && !etapaOportunidadCerrada(o.etapa) && (
          <p className="text-muted">{t('crm.decide', { fecha: formatFecha(o.fechaDecision, idioma) })}</p>
        )}
        <p className="mt-1 truncate border-t border-border pt-1 text-muted">
          {o.vendedorNombre ?? t('crm.cotejo.sin-vendedor')}
        </p>
      </>
    )
  }
  const cuerpoProspecto = (p: Prospecto) => {
    const dias = Math.max(0, Math.floor(((ahora ?? new Date()).getTime() - Date.parse(p.creadoEn)) / DIA_MS))
    const empresa = [p.contacto?.nombre, razonSocial(p)].filter(Boolean).join(' · ')
    return (
      <>
        <span className="inline-block rounded-full border border-border bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">{t('crm.linea.prospecto')}</span>
        {p.etapa !== 'PROSPECTO' && (
          <span className="ml-1 inline-block rounded-full border border-border bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-info">{t(CLAVE_ETAPA_PROSPECTO[p.etapa])}</span>
        )}
        <p className="mt-1 truncate text-[13px] font-medium text-ink" title={p.nombre}>{p.nombre}</p>
        {empresa && <p className="truncate text-muted" title={empresa}>{empresa}</p>}
        <p className="mt-1 text-muted">
          <span className="demo-num">
            {t('crm.seguimiento.registrado', { dias: conteo(dias, t('crm.unidad.dia'), t('crm.unidad.dias')) })}
          </span>
        </p>
        <p className="mt-1 truncate border-t border-border pt-1 text-muted">
          {p.vendedorNombre ?? t('crm.cotejo.sin-vendedor')}
        </p>
      </>
    )
  }
  const etiquetaPendiente = (
    <span className="mb-1 inline-block rounded-full border border-accent bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-ink">
      {t('crm.arrastre.pendiente')}
    </span>
  )
  // Lo que se arrastra, para la copia que sigue al puntero.
  const itemArrastrado = arrastrando?.item
  const copiaOp = itemArrastrado?.tipo === 'oportunidad' ? ops.find((o) => o.id === itemArrastrado.id) : undefined
  const copiaPr = itemArrastrado?.tipo === 'prospecto' ? sueltos.find((p) => p.id === itemArrastrado.id) : undefined
  // Clases de una tarjeta que se puede arrastrar: sin selección de texto ni el
  // menú de «abrir enlace» de iOS al mantenerla pulsada.
  const arrastrableCls = 'select-none [-webkit-touch-callout:none]'

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {!pagina ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              label={t('crm.kpi.abiertas')}
              value={String(abiertas)}
              sub={t('crm.kpi.abiertas.sub')}
              tono={abiertas > 0 ? 'azul' : 'neutro'}
              icon={<Target className="h-4 w-4" />}
            />
            <KPICard
              label={t('crm.kpi.en-juego')}
              value={dinero(enJuego)}
              sub={t('crm.kpi.en-juego.sub')}
              tono="ambar"
              icon={<Wallet className="h-4 w-4" />}
            />
            <KPICard
              label={t('crm.kpi.ganadas')}
              value={dinero(ganado)}
              sub={t('crm.kpi.ganadas.sub', { ganadas: cuenta('GANADA'), perdidas: cuenta('PERDIDA') })}
              tono="verde"
              icon={<Trophy className="h-4 w-4" />}
            />
            <KPICard
              label={t('crm.cotejo.col.cotizaciones')}
              value={String(cotizaciones)}
              sub={t('crm.kpi.cotizaciones.sub')}
              icon={<FileText className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      {error && <p className="text-[13px] text-error">{error}</p>}
      {!pagina && !error && <div className="h-40 animate-pulse rounded-md bg-surface-2" aria-label={t('crm.cargando')} />}
      {pagina && ops.length === 0 && sueltos.length === 0 && <p className="py-10 text-center text-[13px] text-muted">{t('crm.vacio')}</p>}

      {pagina && (ops.length > 0 || sueltos.length > 0) && (
        <CardColapsable
          id="propuestas.seguimiento"
          titulo={t('crm.pestana.seguimiento')}
          resumen={
            <span className="text-[12px] text-muted">
              {t('crm.lista.resumen', { n: filtradas.length, total: pagina.total })}
              {pagina.veTodas ? '' : ` · ${t('crm.solo-tuyas')}`}
              {sueltos.length > 0 && ` · ${t('crm.seguimiento.prospectos', { n: sueltosFiltrados.length })}`}
            </span>
          }
        >
          {/* Filtros en una fila, como en la lista de propuestas: el chip de
              perdidas a la izquierda; vendedor y búsqueda a la derecha. */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-pressed={verPerdidas}
              onClick={() => setVerPerdidas((v) => !v)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[12px] transition-colors',
                verPerdidas ? 'border-accent bg-accent-soft font-medium text-ink' : 'border-border bg-surface text-muted hover:text-ink',
              )}
            >
              {t('crm.seguimiento.perdidas')} <span className="demo-num">{cuenta('PERDIDA')}</span>
            </button>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {pagina.veTodas && vendedores.length > 0 && (
                <select
                  aria-label={t('crm.col.vendedor')}
                  value={vendedor}
                  onChange={(e) => setVendedor(e.target.value)}
                  className="h-8 rounded border border-border-strong bg-surface px-2 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <option value="">{t('crm.seguimiento.vendedores')}</option>
                  {vendedores.map(([id, nombre]) => (
                    <option key={id} value={id}>{nombre}</option>
                  ))}
                </select>
              )}
              <input
                type="search"
                aria-label={t('crm.seguimiento.buscar')}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={t('crm.seguimiento.buscar')}
                className="h-8 w-56 max-w-full rounded border border-border-strong bg-surface px-2.5 text-[12px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          </div>

          {filtradas.length === 0 && sueltosFiltrados.length === 0 && (
            <p className="mb-3 text-[13px] text-muted">{t('crm.seguimiento.sin-resultados')}</p>
          )}

          {puedeCrear && <p className="mb-2 text-[12px] text-muted">{t('crm.arrastre.ayuda')}</p>}

          {/* Las columnas. El desplazamiento horizontal vive aquí y no en la
              página: `min-w-0` en el contenedor y ancho fijo por columna. */}
          <div ref={tableroRef} className="min-w-0 overflow-x-auto pb-1">
            <div
              className={cn(
                'flex items-start gap-3 xl:grid',
                verPerdidas ? 'xl:grid-cols-6' : 'xl:grid-cols-5',
              )}
            >
              {columnas.map((c) => {
                // Los prospectos sueltos van en Contacto, después de las
                // oportunidades de esa etapa.
                const extras = extrasDe(c.etapa)
                // Durante el arrastre: si esta columna lo recibiría, si está
                // bajo el puntero, y si es la suya (esa ni se apaga ni se resalta).
                const item = arrastrando?.item
                const suya = !!item && (item.tipo === 'prospecto' ? c.etapa === 'CONTACTO' : item.etapa === c.etapa)
                const acepta = !!item && aceptaColumna(item, c.etapa)
                const encima = acepta && sobre === c.etapa
                return (
                <section
                  key={c.etapa}
                  aria-label={t(claveEtapa(c.etapa))}
                  className={cn(
                    'w-64 shrink-0 rounded-md border border-border bg-surface-2 p-2 xl:w-auto xl:min-w-0',
                    'transition-[background-color,border-color,box-shadow,opacity] duration-150 motion-reduce:transition-none',
                    encima && 'border-accent bg-accent-soft ring-2 ring-accent',
                    item && !acepta && !suya && 'opacity-50',
                  )}
                  data-columna={c.etapa}
                >
                  <header className="mb-2 px-1">
                    <div className="flex items-center justify-between gap-2">
                      {badge(c.etapa)}
                      <span className="demo-num text-[12px] font-medium text-ink">{c.oportunidades.length + extras.length}</span>
                    </div>
                    <p className="demo-num mt-1 text-[11px] text-muted">{t('crm.embudo.total', { monto: dinero(c.total) })}</p>
                    {item && !acepta && !suya && <p className="mt-1 text-[11px] font-medium text-muted">{t('crm.arrastre.no-acepta')}</p>}
                  </header>
                  {/* `list-none` explícito: el proyecto no usa el preflight de Tailwind. */}
                  <ul className="m-0 list-none space-y-2 p-0">
                    {c.oportunidades.length === 0 && extras.length === 0 && !encima && (
                      <li className="px-1 py-2 text-[12px] text-muted">{t('crm.embudo.vacio-columna')}</li>
                    )}
                    {c.oportunidades.map((o) => {
                      const a: Arrastrable = { tipo: 'oportunidad', id: o.id, etapa: o.etapa }
                      const puede = sePuedeArrastrar(a, puedeCrear)
                      const esPendiente = pendiente?.tipo === 'oportunidad' && pendiente.id === o.id
                      const levantada = item?.tipo === 'oportunidad' && item.id === o.id
                      return (
                        <li
                          key={o.id}
                          data-tarjeta={o.id}
                          data-arrastrable={puede ? 'true' : undefined}
                          className={cn(
                            'relative rounded-md',
                            puede && arrastrableCls,
                            puede && !pendiente && 'cursor-grab active:cursor-grabbing',
                            levantada && 'opacity-30',
                          )}
                          onPointerDown={puede ? (e) => alPresionar(e, a) : undefined}
                          onClickCapture={sinClicCaptura}
                        >
                          <Link
                            href={withTrail(`/crm/oportunidades/${o.id}`, rastro)}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            className={cn(
                              'block rounded-md border bg-surface p-2.5 text-[12px] no-underline transition-colors hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
                              esPendiente ? 'border-dashed border-accent' : 'border-border',
                              puede && 'pr-9',
                            )}
                          >
                            {esPendiente && etiquetaPendiente}
                            {cuerpoOportunidad(o)}
                          </Link>
                          {/* Para teclado y para quien no quiera arrastrar: el
                              mismo modal, con la etapa en un selector. Fuera del
                              enlace (un botón dentro de un enlace no es válido). */}
                          {puede && (
                            <Button
                              variant="icon"
                              size="sm"
                              className="absolute right-1 top-1 h-7 min-h-7 w-7"
                              aria-label={`${t('crm.arrastre.mover')}: ${o.nombre}`}
                              title={t('crm.arrastre.mover')}
                              disabled={!!pendiente}
                              onClick={() => setMoverSin(o)}
                            >
                              <ArrowLeftRight className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      )
                    })}
                    {extras.map((p) => {
                      const a: Arrastrable = { tipo: 'prospecto', id: p.id }
                      const puede = sePuedeArrastrar(a, puedeCrear)
                      const esPendiente = pendiente?.tipo === 'prospecto' && pendiente.id === p.id
                      const levantada = item?.tipo === 'prospecto' && item.id === p.id
                      return (
                        // El enlace y el botón van SEPARADOS: un botón dentro
                        // de un enlace no se pulsa bien (y no es HTML válido).
                        // Borde punteado: no es una oportunidad todavía.
                        <li
                          key={`p-${p.id}`}
                          data-tarjeta={`p-${p.id}`}
                          data-arrastrable={puede ? 'true' : undefined}
                          className={cn(
                            'rounded-md border border-dashed bg-surface text-[12px] transition-colors hover:border-accent',
                            esPendiente ? 'border-accent' : 'border-border-strong',
                            puede && arrastrableCls,
                            puede && !pendiente && 'cursor-grab active:cursor-grabbing',
                            levantada && 'opacity-30',
                          )}
                          onPointerDown={puede ? (e) => alPresionar(e, a) : undefined}
                          onClickCapture={sinClicCaptura}
                        >
                          <Link
                            href={`/propuestas?vista=prospectos&prospecto=${p.id}`}
                            draggable={false}
                            onDragStart={(e) => e.preventDefault()}
                            className="block rounded-md p-2.5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            {esPendiente && <span className="mr-1">{etiquetaPendiente}</span>}
                            {cuerpoProspecto(p)}
                          </Link>
                          {puedeCrear && (
                            <div className="px-2.5 pb-2.5">
                              <Button variant="success" size="sm" className="w-full" disabled={!!pendiente} onClick={() => setDesde({ id: p.id, nombre: p.nombre })}>
                                <Plus className="h-3.5 w-3.5" /> {t('crm.form.crear')}
                              </Button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                    {/* El hueco donde caería lo que se arrastra. */}
                    {encima && arrastrando && (
                      <li
                        aria-hidden
                        style={{ height: arrastrando.alto }}
                        className="flex items-center justify-center rounded-md border-2 border-dashed border-accent bg-surface/60 text-[12px] font-medium text-accent animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none"
                      >
                        {t('crm.arrastre.suelta')}
                      </li>
                    )}
                  </ul>
                </section>
                )
              })}
            </div>
          </div>
        </CardColapsable>
      )}

      {/* La copia que sigue al puntero. En un portal al <body>: dentro de la
          tarjeta plegable un ancestro con `transform` o `overflow` la
          recortaría. `pointer-events: none` para que `elementFromPoint` vea
          la columna de debajo. */}
      {arrastrando && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={copiaRef}
            aria-hidden
            className="demo-root pointer-events-none fixed left-0 top-0 z-[60]"
            style={{ width: arrastrando.ancho }}
          >
            <div
              className={cn(
                'rounded-md border bg-surface p-2.5 text-[12px] shadow-xl ring-1 ring-accent',
                copiaPr ? 'border-dashed border-accent' : 'border-accent',
              )}
            >
              {copiaOp ? cuerpoOportunidad(copiaOp) : copiaPr ? cuerpoProspecto(copiaPr) : null}
            </div>
          </div>,
          document.body,
        )}

      {/* Fuera de la tarjeta (convenciones): plegada, el botón del encabezado
          seguiría abriendo el formulario. */}
      <FormOportunidad abierto={nuevaAbierta} onCerrar={onCerrarNueva} onGuardada={cargar} />
      <FormOportunidad
        abierto={!!desde}
        prospecto={desde}
        aviso={
          prospectoPendiente && prospectoPendiente.destino !== 'CONTACTO'
            ? t('crm.arrastre.prospecto-a', { etapa: t(claveEtapa(prospectoPendiente.destino)) })
            : null
        }
        onCerrar={alCerrarAlta}
        onGuardada={alCrearDesdeProspecto}
      />
      <ModalCambioEtapa
        oportunidad={aMover ? { id: aMover.id, nombre: aMover.nombre, cliente: cliente(aMover), etapa: aMover.etapa } : null}
        destino={moverSin ? null : pendiente?.tipo === 'oportunidad' ? pendiente.destino : null}
        onCancelar={devolver}
        onGuardada={alGuardarEtapa}
        onError={alFallarEtapa}
      />
    </>
  )
}
