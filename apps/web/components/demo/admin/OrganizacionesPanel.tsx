'use client'

import { useEffect, useState } from 'react'
import { Building2, Check, LogIn, RotateCcw, Plus } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Button } from '@/components/demo/ui/Button'
import { Campo, useObligatorios } from '@/components/demo/ui/Campo'
import { Chip } from './Chip'
import { validarPassword, REGLA_PASSWORD } from '@/lib/password'

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
  // Llega PLEGADA por omisión: a quien no la puede usar le basta el título y
  // el subtítulo; la explicación está a un clic. Antes abría desplegada y
  // encabezando Administración, que es lo primero que veía la Dueña.
  if (estado === 'sin-permiso') {
    return (
      <CardColapsable
        id="admin.organizaciones"
        titulo="Organizaciones (CRMs)"
        icono={<Building2 className="h-4 w-4 text-muted" />}
        subtitulo="Reservado al administrador de la plataforma"
        defaultAbierto={false}
      >
          <p className="text-[12px] text-muted">
            Crear organizaciones y cambiar entre ellas está reservado al
            <b className="text-ink"> administrador de la plataforma</b>. Tu usuario administra
            su propia organización, no el conjunto.
            <br />
            Si necesitas una organización nueva, pídesela a quien administre Space OS.
          </p>
      </CardColapsable>
    )
  }

  // OJO: el formulario de `NuevaOrganizacion` guarda lo tecleado en SU propio
  // estado, que vive DENTRO del contenido plegable. Plegar la tarjeta con el
  // alta a medias la desmonta y lo tecleado se pierde.
  return (
    <CardColapsable
      id="admin.organizaciones"
      titulo="Organizaciones (CRMs)"
      icono={<Building2 className="h-4 w-4 text-muted" />}
    >
        {/* Antes esto mandaba a «Crear cuenta» del login. En producción ese
            botón NO EXISTE —el auto-registro está apagado a propósito— así que
            la instrucción llevaba a un callejón sin salida: no había ninguna
            forma de crear una organización. El endpoint sí existía
            (POST /api/tenants, protegido por super-admin); lo que faltaba era
            esta pantalla. */}
        {/* La leyenda que habia aqui --«cada organizacion es un CRM propio…
            aqui puedes cambiar entre ellas y dar de alta una nueva»-- salio el
            2026-09-04. Describia el modelo ANTERIOR al de instancias soberanas:
            hoy cada owner corre su propia copia en su propio servidor, y en la
            instancia de un cliente no hay «entre ellas» a las que cambiar. La
            pantalla se conserva porque el PADRE si administra varias; lo que se
            retira es la frase que la vendia como el modelo del producto. */}

        <NuevaOrganizacion onCreada={cargar} />

        {/* Lista de organizaciones */}
        <ul className="m-0 list-none divide-y divide-border rounded-md border border-border p-0">
          {(orgs ?? []).map((o) => {
            const esActivo = o.id === activo
            return (
              <li key={o.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-ink">{o.nombre}</span>
                    {esActivo && (
                      <Chip tono="exito">
                        <Check className="h-3 w-3 text-[#0f7a55]" /> Activo
                      </Chip>
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
    </CardColapsable>
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
  // La misma funcion que corre el servidor: `length >= 8` dejaba pasar
  // «aaaaaaaa», que rebota con «debe incluir al menos un numero».
  //
  // OBLIG-01 · los vacíos ya no deshabilitan el botón: se pulsa y se pinta en
  // rojo lo que falta (`cuentas-controller.ts:29-35`). Una contraseña ESCRITA
  // que no cumple la regla sí lo deshabilita, como antes.
  const ob = useObligatorios({ org, nombre, email, password }, [
    'org',
    'nombre',
    'email',
    { campo: 'password', si: !conGoogle },
  ])
  const passwordInvalida = !conGoogle && !!password && !!validarPassword(password)

  async function crear() {
    if (!ob.validar()) return
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
      ob.reiniciar()
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
        <Button variant="success" size="sm" onClick={() => setAbierto(true)}>
          <Plus className="h-3.5 w-3.5" /> Nueva organización
        </Button>
      </div>
    )
  }

  return (
    <div className="mb-3 space-y-2.5 rounded-md border border-border bg-bg p-3">
      <div className="text-[12px] font-medium text-ink">Nueva organización</div>
      <Campo label="Nombre de la organización" obligatorio falta={ob.falta('org')}>
        <input className={campoCls} value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Mi Empresa SA de CV" autoFocus />
      </Campo>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Campo label="Nombre del Dueño" obligatorio falta={ob.falta('nombre')}>
          <input className={campoCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <Campo label="Su correo" obligatorio falta={ob.falta('email')}>
          <input className={campoCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@empresa.com" />
        </Campo>
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
        <Campo label="Contraseña del Dueño" obligatorio falta={ob.falta('password')}>
          <input className={campoCls} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={REGLA_PASSWORD} />
        </Campo>
      )}

      {error && <p className="text-[12px] text-error">{error}</p>}

      <div className="flex justify-end gap-2 pt-0.5">
        <Button size="sm" variant="secondary" onClick={() => { setAbierto(false); setError(null); ob.reiniciar() }}>Cancelar</Button>
        <Button variant="success" size="sm" disabled={passwordInvalida || enviando} onClick={crear}>
          {enviando ? 'Creando…' : 'Crear organización'}
        </Button>
      </div>
    </div>
  )
}
