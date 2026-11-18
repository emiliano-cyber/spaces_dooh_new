'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Languages, Loader2 } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { cn } from '@/lib/cn'
import { useIdioma } from '@/lib/i18n/contexto'
import type { ClaveTexto } from '@/lib/i18n/diccionario'
import { IDIOMAS, type Idioma } from '@/lib/i18n/idiomas'

const API = '/spaces-dooh/api'

// ============================================================================
//  IdiomasServidorPanel — «Administracion → Configuracion → Idiomas del
//  servidor» (IDIOMAS-SERVIDOR, 10/11). El boton para encender o apagar los
//  idiomas de ESTE servidor sin entrar por ssh ni recrear el contenedor.
//
//  · «Usar los de las variables» deja el servidor como antes de esta tarea
//    (`IDIOMA_INGLES=1`… en `app.env`), y viene marcado mientras nadie elija.
//  · IDIOMAS-SIN-ES (18/11), pedido del dueno: «si lo cambia, las 4 opciones
//    de abajo deben estar sin seleccionar para que el usuario elija», y el
//    espanol «tambien sin marcar y elegible». Hasta ese dia el espanol era una
//    casilla fija («siempre»). Al QUITAR «servidor» las cuatro quedan vacias;
//    lo ya guardado se muestra marcado al abrir (el vaciado es solo en el
//    momento del cambio). Guardar pide al menos uno: un servidor sin idiomas
//    no puede pintar nada, y la base tampoco lo acepta.
//  · Al guardar, `router.refresh()`: el layout raiz vuelve con los idiomas
//    nuevos y el selector aparece (o desaparece) del menu de la cuenta sin
//    recargar la pagina.
// ============================================================================

interface Estado {
  idiomas: Idioma[] | null
  activos: Idioma[]
}

// Italiano y portugues siguen en lotes de traduccion: se avisa al elegirlos.
const PARCIALES: readonly Idioma[] = ['it', 'pt']

// ─── La logica, pura y exportada para las pruebas ──────────────────────────

/** Lo elegido a mano al abrir: lo guardado, o nada si manda el servidor. */
export function elegidosAlCargar(e: Estado): Idioma[] {
  return e.idiomas ?? []
}

/**
 * Lo elegido tras marcar o quitar «servidor». Al QUITARLO, las cuatro vacias:
 * es el pedido del dueno, que quien cambia elija de cero. Al volver a
 * marcarlo da igual (se guarda `null`), y se deja vacio por lo mismo.
 */
export function elegidosAlCambiarServidor(_usarServidor: boolean, _previos: readonly Idioma[]): Idioma[] {
  return []
}

/** Lo que se manda al PUT: `null` = las variables; si no, la lista tal cual. */
export function listaAGuardar(usarServidor: boolean, elegidos: readonly Idioma[]): Idioma[] | null {
  return usarServidor ? null : IDIOMAS.filter((i) => elegidos.includes(i))
}

/** Guardar solo con un cambio, sin otra peticion en curso y nunca con 0. */
export function puedeGuardarIdiomas(
  final: readonly Idioma[] | null,
  guardado: readonly Idioma[] | null,
  guardando: boolean,
): boolean {
  if (guardando) return false
  if (final !== null && final.length === 0) return false
  return JSON.stringify(final) !== JSON.stringify(guardado)
}

export function IdiomasServidorPanel({
  onToast,
  inicial = null,
}: {
  onToast: (m: string) => void
  /** Solo para las pruebas: el estado ya leido, sin pedirlo a la API. */
  inicial?: Estado | null
}) {
  const { t } = useIdioma()
  const router = useRouter()
  const [guardado, setGuardado] = useState<Estado | null>(inicial)
  const [usarServidor, setUsarServidor] = useState(inicial ? inicial.idiomas === null : true)
  const [elegidos, setElegidos] = useState<Idioma[]>(inicial ? elegidosAlCargar(inicial) : [])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function cargar(e: Estado) {
    setGuardado(e)
    setUsarServidor(e.idiomas === null)
    setElegidos(elegidosAlCargar(e))
  }

  useEffect(() => {
    if (inicial) return
    fetch(`${API}/idiomas-servidor/`).then((r) => (r.ok ? r.json() : null)).then((d) => { if (d) cargar(d) })
  }, [inicial])

  if (!guardado) return null

  const final = listaAGuardar(usarServidor, elegidos)
  const faltaElegir = final !== null && final.length === 0

  async function guardar() {
    setGuardando(true)
    setError(null)
    try {
      const r = await fetch(`${API}/idiomas-servidor/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idiomas: final }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? t('admin.idiomas_servidor.error'))
      cargar(d as Estado)
      onToast(t('admin.idiomas_servidor.guardado'))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t('admin.idiomas_servidor.error'))
    }
    setGuardando(false)
  }

  return (
    <CardColapsable
      id="admin.config.idiomas-servidor"
      titulo={t('admin.idiomas_servidor.titulo')}
      icono={<Languages className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <p className="m-0 text-[12px] text-muted">{t('admin.idiomas_servidor.ayuda')}</p>

      <label className="flex items-center gap-2 text-[13px] text-ink">
        <input
          type="checkbox"
          checked={usarServidor}
          onChange={(e) => {
            setUsarServidor(e.target.checked)
            setElegidos(elegidosAlCambiarServidor(e.target.checked, elegidos))
          }}
        />
        {t('admin.idiomas_servidor.servidor')}
      </label>

      <div className={cn('flex flex-wrap gap-x-5 gap-y-2 pl-1', usarServidor && 'opacity-50')}>
        {IDIOMAS.map((i) => (
          <label key={i} className="flex items-center gap-1.5 text-[13px] text-ink">
            <input
              type="checkbox"
              data-idioma={i}
              disabled={usarServidor}
              checked={(usarServidor ? guardado.activos : elegidos).includes(i)}
              onChange={(e) => setElegidos((prev) => (e.target.checked ? [...prev, i] : prev.filter((x) => x !== i)))}
            />
            {t(`idioma.${i}` as ClaveTexto)}
            {PARCIALES.includes(i) && <span className="text-[11px] text-muted">({t('admin.idiomas_servidor.parcial')})</span>}
          </label>
        ))}
      </div>

      {faltaElegir && <p className="m-0 text-[12px] text-muted">{t('admin.idiomas_servidor.elegir_uno')}</p>}
      {error && <p className="m-0 text-[12px] text-error">{error}</p>}

      <div className="flex justify-end">
        <Button size="sm" type="button" disabled={!puedeGuardarIdiomas(final, guardado.idiomas, guardando)} onClick={() => { void guardar() }}>
          {guardando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {t('admin.idiomas_servidor.guardar')}
        </Button>
      </div>
    </CardColapsable>
  )
}
