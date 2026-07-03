'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, LogIn, RotateCcw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/demo/ui/Card'
import { Button } from '@/components/demo/ui/Button'

const API = '/spaces-dooh/api'

interface Org {
  id: string
  nombre: string
  slug: string
  creadoEn: string
}

// Panel de organizaciones (CRMs). Solo se muestra al super-admin de la
// plataforma (el GET responde 403 al resto → el panel no se monta).
// El alta de organizaciones nuevas se hace en el login → "Crear cuenta".
export function OrganizacionesPanel() {
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [activo, setActivo] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
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
          usuarios (operativos) aislados. Aquí puedes <b className="text-ink">cambiar entre ellas</b> para
          administrarlas. Para dar de alta una organización nueva, usa <b className="text-ink">“Crear cuenta”</b> en
          la pantalla de inicio de sesión.
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
      </CardContent>
    </Card>
  )
}
