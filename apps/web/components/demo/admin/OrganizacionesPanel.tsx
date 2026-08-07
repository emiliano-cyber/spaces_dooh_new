'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, LogIn, RotateCcw, Plus } from 'lucide-react'
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
// El alta de organizaciones nuevas se hace AQUÍ (ver `NuevaOrganizacion`).
export function OrganizacionesPanel() {
  const [orgs, setOrgs] = useState<Org[] | null>(null)
  const [activo, setActivo] = useState<string | null>(null)
  // Se distingue NO TENER PERMISO de que la carga falle. Antes las dos cosas
  // escondían el panel entero, y eso deja adivinando a quien esperaba
  // encontrarlo aquí: no aparece, y nada dice por qué. Sin permiso se explica;
  // con un fallo de red no se inventa una explicación que puede ser falsa.
  const [estado, setEstado] = useState<'cargando' | 'ok' | 'sin-permiso' | 'error'>('cargando')
  const [busy, setBusy] = useState(false)

  async function cargar() {
    try {
      const r = await fetch(`${API}/tenants/`, { cache: 'no-store' })
      if (r.status === 401 || r.status === 403) { setEstado('sin-permiso'); return }
      if (!r.ok) { setEstado('error'); return }
      const d = await r.json()
      setOrgs(d.tenants ?? [])
      setActivo(d.activo ?? null)
      setEstado('ok')
    } catch {
      setEstado('error')
    }
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

  // Mientras carga no se pinta nada: un panel que aparece y desaparece al
  // segundo es peor que uno que tarda un instante en aparecer.
  if (estado === 'cargando' || estado === 'error') return null

  // Sin permiso: se explica en vez de esfumarse, y se dice a quién pedírselo.
  // No cambia ningún permiso — el servidor sigue respondiendo 403 igual.
  if (estado === 'sin-permiso') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Building2 className="h-4 w-4 text-muted" />
          <CardTitle>Organizaciones (CRMs)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[12px] text-muted">
            Crear organizaciones y cambiar entre ellas está reservado al
            <b className="text-ink"> administrador de la plataforma</b>. Tu usuario administra
            su propia organización, no el conjunto.
            <br />
            Si necesitas una organización nueva, pídesela a quien administre Space OS.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Building2 className="h-4 w-4 text-muted" />
        <CardTitle>Organizaciones (CRMs)</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Antes esto mandaba a «Crear cuenta» del login. En producción ese
            botón NO EXISTE —el auto-registro está apagado a propósito— así que
            la instrucción llevaba a un callejón sin salida: no había ninguna
            forma de crear una organización. El endpoint sí existía
            (POST /api/tenants, protegido por super-admin); lo que faltaba era
            esta pantalla. */}
        <p className="mb-3 text-[12px] text-muted">
          Cada organización es un <b className="text-ink">CRM propio</b> con sus datos y sus
          usuarios (operativos) aislados. Aquí puedes <b className="text-ink">cambiar entre ellas</b> y
          dar de alta una nueva.
        </p>

        <NuevaOrganizacion onCreada={cargar} />

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

// ─── Alta de organización ───────────────────────────────────────────────────
// Solo la ve el super-admin, porque este panel entero no se monta para el
// resto (el GET de /api/tenants responde 403 y `visible` queda en false). El
// endpoint además exige `administracion.crear` Y `puedeCambiarCrm()`, así que
// el permiso no depende de que la pantalla se esconda.
//
// Esto NO es el auto-registro público: aquél sigue apagado en producción a
// propósito. Aquí el alta la hace alguien identificado y con permiso, que es
// exactamente la diferencia que hacía falta.
function NuevaOrganizacion({ onCreada }: { onCreada: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const [org, setOrg] = useState('')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [conGoogle, setConGoogle] = useState(false)
  const [googleDisponible, setGoogleDisponible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  // La bandera de Google no viaja al cliente, así que se pregunta al servidor.
  useEffect(() => {
    if (!abierto) return
    let vivo = true
    fetch(`${API}/auth/metodos/`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.google === true) setGoogleDisponible(true) })
      .catch(() => { /* sin opción, que es el estado seguro */ })
    return () => { vivo = false }
  }, [abierto])

  // El mínimo es el que exige el SERVIDOR (8, con letra y número). Pedir menos
  // aquí deja pasar algo que vuelve rechazado sin motivo aparente.
  const valido = !!org.trim() && !!nombre.trim() && !!email.trim() && (conGoogle || password.trim().length >= 8)

  async function crear() {
    setEnviando(true)
    setError(null)
    try {
      const r = await fetch(`${API}/tenants/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          nombre: org.trim(),
          admin: {
            nombre: nombre.trim(),
            email: email.trim(),
            cargo: 'Dueño',
            // Una de las dos, nunca las dos.
            ...(conGoogle ? { entraConGoogle: true } : { password: password.trim() }),
          },
        }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo crear la organización')
      setOrg(''); setNombre(''); setEmail(''); setPassword(''); setConGoogle(false)
      setAbierto(false)
      onCreada()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo crear la organización')
    }
    setEnviando(false)
  }

  const campoCls =
    'h-9 w-full rounded border border-border-strong bg-surface px-2.5 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

  if (!abierto) {
    return (
      <div className="mb-3">
        <Button size="sm" onClick={() => setAbierto(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva organización
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-3 space-y-2.5 rounded-md border border-border bg-bg p-3">
      <div className="text-[12px] font-medium text-ink">Nueva organización</div>
      <div>
        <label className="mb-1 block text-[11px] text-muted">Nombre de la organización</label>
        <input className={campoCls} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Mi Empresa SA de CV" autoFocus />
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-muted">Nombre del Dueño</label>
          <input className={campoCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">Su correo</label>
          <input className={campoCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" />
        </div>
      </div>

      {googleDisponible && (
        <label className="flex cursor-pointer items-start gap-2 rounded border border-border bg-surface p-2.5">
          <input type="checkbox" className="mt-0.5" checked={conGoogle} onChange={(e) => { setConGoogle(e.target.checked); setError(null) }} />
          <span className="text-[12px] leading-snug">
            <span className="font-medium text-ink">El Dueño entra con su cuenta de Google</span>
            <span className="block text-muted">
              No tendrás que inventar ni enviarle ninguna contraseña. Su correo de Google
              debe ser el mismo que escribiste arriba.
            </span>
          </span>
        </label>
      )}

      {/* Desaparece —no se deshabilita— cuando entra con Google: un campo gris
          que sigue ahí invita a preguntarse si hay que rellenarlo igual. */}
      {!conGoogle && (
        <div>
          <label className="mb-1 block text-[11px] text-muted">Contraseña del Dueño</label>
          <input className={campoCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8, con letra y número" />
        </div>
      )}

      {error && <p className="text-[12px] text-error">{error}</p>}

      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" variant="secondary" onClick={() => { setAbierto(false); setError(null) }}>Cancelar</Button>
        <Button size="sm" disabled={!valido || enviando} onClick={crear}>
          {enviando ? 'Creando…' : 'Crear organización'}
        </Button>
      </div>
    </div>
  )
}
