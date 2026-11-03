'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Languages } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Campo } from '@/components/demo/ui/Campo'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'

const API = '/spaces-dooh/api'
const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// ─── «Mi cuenta → Idioma» (IDIOMA-USUARIO, 03/11) ───────────────────────────
//
// Decisión del dueño: «el idioma de lo demás se debe poder configurar por
// usuario y navegador». Esto es la parte «por usuario»: se guarda en la cuenta
// (`PUT /api/perfil/idioma`) y la sigue a cualquier dispositivo. «Usar el
// idioma del navegador» la borra y deja mandar a lo de siempre: la cookie del
// navegador y, sin ella, su `Accept-Language`.
//
// Con un solo idioma encendido (hoy, en toda la flota) NO SE PINTA: no hay nada
// que elegir, y la página queda idéntica a la de antes de esta tarea.
//
// Al guardar, `router.refresh()`: el servidor ya dejó la cookie de la cuenta en
// la respuesta, así que el layout raíz vuelve con el idioma nuevo y
// `ProveedorIdioma` se alinea sin recargar ni parpadear.
export function IdiomaCuenta() {
  const { t, puedeElegir, disponibles } = useIdioma()
  const router = useRouter()
  const [preferido, setPreferido] = useState<Idioma | 'navegador' | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!puedeElegir) return
    let vivo = true
    fetch(`${API}/perfil/idioma/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { preferido?: Idioma | null } | null) => {
        if (vivo && d) setPreferido(d.preferido ?? 'navegador')
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [puedeElegir])

  if (!puedeElegir) return null

  async function guardar(valor: Idioma | 'navegador') {
    const anterior = preferido
    setPreferido(valor)
    setBusy(true)
    try {
      const r = await fetch(`${API}/perfil/idioma/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idioma: valor }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? t('idioma.cuenta.error'))
      toast.success(t('idioma.cuenta.toast'))
      router.refresh()
    } catch (e) {
      setPreferido(anterior)
      toast.error(e instanceof Error ? e.message : t('idioma.cuenta.error'))
    }
    setBusy(false)
  }

  return (
    <CardColapsable
      id="configuracion.idioma"
      titulo={t('idioma.cuenta.titulo')}
      icono={<Languages className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <p className="text-[12px] text-muted">{t('idioma.cuenta.ayuda')}</p>
      <Campo label={t('idioma.etiqueta')}>
        <select
          className={inputCls}
          value={preferido ?? ''}
          disabled={busy || preferido === null}
          onChange={(e) => guardar(e.target.value as Idioma | 'navegador')}
        >
          {preferido === null && <option value="">{t('comun.cargando')}</option>}
          <option value="navegador">{t('idioma.cuenta.navegador')}</option>
          {/* Cada idioma se nombra en sí mismo, como en el selector del login. */}
          {disponibles.map((i) => (
            <option key={i} value={i}>
              {t(`idioma.${i}` as 'idioma.es' | 'idioma.en' | 'idioma.it')}
            </option>
          ))}
        </select>
      </Campo>
    </CardColapsable>
  )
}
