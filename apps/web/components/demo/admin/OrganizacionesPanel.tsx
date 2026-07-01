'use client'

import { useEffect, useState } from 'react'
import { Building2, Plus, Check, LogIn, RotateCcw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'

const API = '/spaces-dooh/api'

interface Org {
  id: string
  nombre: string
  slug: string
  creadoEn: string
}

const inputCls =
  'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// Panel de organizaciones (CRMs). Solo se muestra al super-admin de la
// plataforma (el GET responde 403 al resto → el panel no se monta).
export function OrganizacionesPanel() {
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [activo, setActivo] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
  const [nombre, setNombre] = useState('')
  const [adminNombre, setAdminNombre] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function cargar() {
    const r = await fetch(`${API}/tenants/`, { cache: 'no-store' })
    if (!r.ok) { setVisible(false); return }
    const d = await r.json()
    setOrgs(d.tenants ?? [])
    setActivo(d.activo ?? null)
  }
  useEffect(() => { cargar() }, [])

  async function cambiar(tenantId: string | null) {
    setBusy(true)
    await fetch(`${API}/tenant-activo/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tenantId: tenantId ?? '' }),
    })
    // Recargar la app para re-hidratar el estado con el CRM elegido.
    window.location.href = '/spaces-dooh/demo'
  }

  async function crear() {
    if (!nombre.trim() || !adminNombre.trim() || !adminEmail.trim()) {
      setMsg('Completa el nombre de la organización y el usuario administrador.')
      return
    }
    setBusy(true)
    setMsg(null)
    const r = await fetch(`${API}/tenants/`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        nombre: nombre.trim(),
        admin: { nombre: adminNombre.trim(), email: adminEmail.trim() },
      }),
    })
    const d = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(d.error ?? 'No se pudo crear la organización'); return }
    setMsg(`Organización "${d.tenant.nombre}" creada. Usuario: ${d.usuario.email} · contraseña: spaces123`)
    setNombre(''); setAdminNombre(''); setAdminEmail('')
    cargar()
  }

  if (!visible) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Building2 className="h-4 w-4 text-muted" />
        <CardTitle>Organizaciones (CRMs)</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-[12px] text-muted">
          Cada organización es un <b className="text-ink">CRM propio</b> con sus datos y sus
          usuarios (operativos) aislados. Puedes crear organizaciones nuevas y cambiar entre
          ellas para administrarlas.
        </p>

        {/* Lista de organizaciones */}
        <ul className="divide-y divide-border rounded-md border border-border">
          {(orgs ?? []).map((o) => {
            const esActivo = o.id === activo
            return (
              <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{o.nombre}</span>
                    {esActivo && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#10b98140] px-2 py-0.5 text-[10.5px] font-medium text-[#0f7a55]">
                        <Check className="h-3 w-3" /> Activo
                      </span>
                    )}
                  </div>
                  <div className="demo-num text-[11px] text-muted">{o.slug}</div>
                </div>
                {!esActivo && (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => cambiar(o.id)}>
                    <LogIn className="h-3.5 w-3.5" /> Entrar
                  </Button>
                )}
              </li>
            )
          })}
          {orgs && orgs.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-muted">Sin organizaciones.</li>
          )}
        </ul>

        <div className="mt-2">
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => cambiar(null)}>
            <RotateCcw className="h-3.5 w-3.5" /> Volver a mi CRM
          </Button>
        </div>

        {/* Crear organización */}
        <div className="mt-4 rounded-md border border-border bg-surface-2 p-3">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium text-ink">
            <Plus className="h-4 w-4" /> Nueva organización
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Nombre de la organización</span>
              <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Media Norte" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Usuario admin (nombre)</span>
              <input className={inputCls} value={adminNombre} onChange={(e) => setAdminNombre(e.target.value)} placeholder="Ej. Ana López" />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-muted">Correo del admin</span>
              <input className={inputCls} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="ana@media-norte.mx" />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" disabled={busy} onClick={crear}>
              {busy ? 'Creando…' : 'Crear organización'}
            </Button>
            <span className="text-[11px] text-muted">Se crea con su usuario Dueño (contraseña inicial: spaces123).</span>
          </div>
          {msg && <p className="mt-2 text-[12px] text-info">{msg}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
