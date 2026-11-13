'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Bell, Save } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Campo } from '@/components/demo/ui/Campo'
import { Button } from '@/components/demo/ui/Button'
import { useTexto } from '@/lib/i18n/contexto'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import { normalizarTelefono, type CanalAviso, type PreferenciaAviso, type TipoAviso } from '@/lib/avisos'

const API = '/spaces-dooh/api'
const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

interface Respuesta {
  tipos: TipoAviso[]
  activos: PreferenciaAviso[]
  telefono: string | null
  canales: { correo: { configurado: boolean }; whatsapp: { configurado: boolean; sembrado: boolean } }
}

const clave = (tipo: string, canal: string) => `${tipo}:${canal}`

// Las claves del diccionario van en minúsculas (`diccionario.ts`, regla 1).
const claveTipo = (tipo: TipoAviso) => tipo.toLowerCase() as Lowercase<TipoAviso>

// Es una marca, como «Space OS»: no se traduce (`diccionario.ts`, regla 5).
const WHATSAPP = 'WhatsApp'

/** El conjunto marcado → la lista que espera `PUT /api/perfil/avisos`. Pura. */
export function activosDe(marcados: ReadonlySet<string>): PreferenciaAviso[] {
  return [...marcados].sort().map((k) => {
    const [tipo, canal] = k.split(':') as [TipoAviso, CanalAviso]
    return { tipo, canal }
  })
}

// ─── Configuración → Avisos (AVISOS-CANAL, 12/11) ───────────────────────────
//
// Pedido del dueño: «hacer los avisos por correo y dejar sembrada la opción de
// envío por WhatsApp; lo de olvidé contraseña, solo correo».
//
// Una fila por tipo de aviso de la campana, una columna por canal. La de
// WhatsApp va APAGADA (sembrada): el número ya se puede dejar, pero la casilla
// no se marca hasta que el servidor tenga el canal. Sin nada encendido, nada
// cambia: la campana sigue enseñándolo todo, como siempre.
export function AvisosCuenta() {
  const t = useTexto()
  const { sesion } = useSesionCtx()
  const [datos, setDatos] = useState<Respuesta | null>(null)
  const [marcados, setMarcados] = useState<Set<string>>(new Set())
  const [telefono, setTelefono] = useState('')
  const [busy, setBusy] = useState(false)

  function aplicar(d: Respuesta) {
    setDatos(d)
    setMarcados(new Set(d.activos.map((a) => clave(a.tipo, a.canal))))
    setTelefono(d.telefono ?? '')
  }

  useEffect(() => {
    let vivo = true
    fetch(`${API}/perfil/avisos/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Respuesta | null) => {
        if (vivo && d) aplicar(d)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  if (!datos) return null

  const whatsappActivo = datos.canales.whatsapp.configurado
  const telefonoMal = normalizarTelefono(telefono) === false

  function alternar(tipo: TipoAviso, canal: CanalAviso) {
    setMarcados((prev) => {
      const s = new Set(prev)
      const k = clave(tipo, canal)
      if (s.has(k)) s.delete(k)
      else s.add(k)
      return s
    })
  }

  async function guardar() {
    setBusy(true)
    try {
      const r = await fetch(`${API}/perfil/avisos/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activos: activosDe(marcados), telefono }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? t('cuenta.avisos.error'))
      aplicar(d as Respuesta)
      toast.success(t('cuenta.avisos.guardado'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cuenta.avisos.error'))
    }
    setBusy(false)
  }

  return (
    <CardColapsable
      id="configuracion.avisos"
      titulo={t('cuenta.avisos.titulo')}
      icono={<Bell className="h-4 w-4 text-muted" />}
      contentClassName="space-y-3"
    >
      <p className="text-[12px] text-muted">{t('cuenta.avisos.ayuda')}</p>
      <p className="text-[12px] text-muted">
        {datos.canales.correo.configurado
          ? t('cuenta.avisos.correo.destino', { email: sesion?.usuario.email ?? '' })
          : t('cuenta.avisos.correo.apagado')}
      </p>

      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wide text-muted">
            <th className="py-1.5 font-medium">{t('cuenta.avisos.col.aviso')}</th>
            <th className="w-20 py-1.5 text-center font-medium">{t('cuenta.avisos.col.correo')}</th>
            <th className="w-24 py-1.5 text-center font-medium">{WHATSAPP}</th>
          </tr>
        </thead>
        <tbody>
          {datos.tipos.map((tipo) => (
            <tr key={tipo} className="border-t border-border">
              <td className="py-2 pr-2 text-ink">{t(`cuenta.avisos.tipo.${claveTipo(tipo)}`)}</td>
              <td className="py-2 text-center">
                <input
                  type="checkbox"
                  aria-label={`${t('cuenta.avisos.col.correo')} · ${t(`cuenta.avisos.tipo.${claveTipo(tipo)}`)}`}
                  checked={marcados.has(clave(tipo, 'correo'))}
                  disabled={busy}
                  onChange={() => alternar(tipo, 'correo')}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </td>
              <td className="py-2 text-center">
                <input
                  type="checkbox"
                  aria-label={`${WHATSAPP} · ${t(`cuenta.avisos.tipo.${claveTipo(tipo)}`)}`}
                  title={whatsappActivo ? undefined : t('cuenta.avisos.whatsapp.casilla')}
                  checked={marcados.has(clave(tipo, 'whatsapp'))}
                  disabled={busy || !whatsappActivo}
                  onChange={() => alternar(tipo, 'whatsapp')}
                  className="h-4 w-4 accent-[var(--accent)] disabled:opacity-40"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!whatsappActivo && <p className="text-[12px] text-muted">{t('cuenta.avisos.whatsapp.pronto')}</p>}
      <Campo label={t('cuenta.avisos.telefono.etiqueta')} error={telefonoMal ? t('cuenta.avisos.telefono.ayuda') : undefined}>
        <input
          className={inputCls}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+52 55 1234 5678"
          value={telefono}
          disabled={busy}
          onChange={(e) => setTelefono(e.target.value)}
        />
      </Campo>
      {!telefonoMal && <p className="-mt-1 text-[12px] text-muted">{t('cuenta.avisos.telefono.ayuda')}</p>}
      <p className="text-[12px] text-muted">{t('cuenta.avisos.recuperar')}</p>

      <Button size="sm" disabled={busy || telefonoMal} onClick={guardar}>
        <Save className="h-3.5 w-3.5" /> {busy ? t('admin.comun.guardando') : t('cuenta.avisos.guardar')}
      </Button>
    </CardColapsable>
  )
}
