'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, UserPlus, Mail, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'
import { SpaceOsMark } from '@/components/demo/ui/SpaceOsMark'
import { apiLogin } from '@/lib/auth-real'
import { landingDeRol } from '@/lib/data/client'
import { esEmailValido, EMAIL_INVALIDO } from '@/lib/validacion'

const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

type Modo = 'login' | 'signup' | 'forgot'

// Recuperar contraseña se apaga con NEXT_PUBLIC_RECUPERAR_PASSWORD=0.
// Motivo: sin RESEND_API_KEY no se envía ningún correo, así que el usuario
// recibe "revisa tu bandeja" y no le llega nada — peor que no ofrecerlo. La
// bandera vive en el cliente Y en el servidor (app/api/auth/forgot y /reset),
// para que apagarlo no deje el endpoint abierto emitiendo tokens.
// Ausente o cualquier valor distinto de '0' = habilitado (no cambia dev).
const RECUPERAR_HABILITADO = process.env.NEXT_PUBLIC_RECUPERAR_PASSWORD !== '0'

// Auto-registro público ("Crear cuenta"). Mismo patrón que la bandera de arriba:
// vive en el cliente Y en el servidor (app/api/signup), porque esconder el botón
// dejaría el endpoint abierto y cualquiera podría seguir creando organizaciones.
// Ausente o distinto de '0' = habilitado (no cambia dev).
const AUTOREGISTRO_HABILITADO = process.env.NEXT_PUBLIC_AUTOREGISTRO !== '0'

// Acceso con Google (ADR 0012). A diferencia de las DOS banderas de arriba, ésta
// NO se lee con `process.env` aquí: `GOOGLE_OAUTH` no lleva prefijo
// NEXT_PUBLIC_, justamente para que apagarla no exija recompilar. Así que el
// botón se pinta según lo que responda el servidor en /api/auth/metodos/.
const RUTA_GOOGLE = '/spaces-dooh/api/auth/google/inicio/'

// El callback devuelve un CÓDIGO en `?google=…`, nunca el texto del error: lo
// que llega por la URL no se interpola en la página. Aquí se traduce contra una
// lista cerrada, y un código desconocido cae en el mensaje genérico en vez de
// pintarse tal cual.
const MOTIVOS_GOOGLE: Record<string, string> = {
  no_disponible: 'El acceso con Google no está disponible en este momento.',
  cancelado: 'Cancelaste el acceso con Google.',
  invalido: 'No se pudo completar el acceso con Google. Vuelve a intentarlo.',
  no_registrado:
    'Esa cuenta de Google no está dada de alta. Pide a tu administrador que te agregue.',
  inactivo: 'Tu usuario está desactivado. Pide a tu administrador que lo reactive.',
  ya_vinculada:
    'Tu usuario ya tiene otra cuenta de Google vinculada. Pide a tu administrador que la revise.',
}

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [organizacion, setOrganizacion] = useState('')
  const [nombre, setNombre] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [enlaceDev, setEnlaceDev] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [googleDisponible, setGoogleDisponible] = useState(false)

  // Se pregunta al servidor porque la bandera no viaja al cliente (ver
  // RUTA_GOOGLE arriba). Empieza en `false`: si la consulta falla, NO se pinta
  // el botón. Al revés —optimista— se ofrecería una entrada que responde 503, y
  // el usuario se quedaría culpando a su cuenta de Google.
  useEffect(() => {
    let vivo = true
    fetch('/spaces-dooh/api/auth/metodos/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (vivo && d?.google === true) setGoogleDisponible(true)
      })
      .catch(() => {
        /* sin botón, que es el estado seguro */
      })
    return () => {
      vivo = false
    }
  }, [])

  // Mensaje de vuelta del callback de Google, si lo hay. Se lee una sola vez y
  // se limpia de la barra de direcciones: dejarlo ahí haría que recargar
  // reprodujera un error que ya no corresponde a nada.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const motivo = p.get('google')
    if (!motivo) return
    setError(MOTIVOS_GOOGLE[motivo] ?? 'No se pudo entrar con Google.')
    p.delete('google')
    const q = p.toString()
    window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : ''))
  }, [])

  const esSignup = modo === 'signup'
  const esForgot = modo === 'forgot'

  function cambiarModo(m: Modo) {
    setModo(m)
    setError(null)
    setAviso(null)
    setEnlaceDev(null)
    // La contraseña NO se arrastra entre formularios: tecleada para entrar, se
    // reenviaba precargada al alta y se registraban cuentas con la contraseña
    // real de otra organización. El correo sí se conserva al ir a "recuperar"
    // (ahí es la conveniencia esperada), pero no al ir al alta.
    setPassword('')
    if (m === 'signup') setEmail('')
  }

  async function entrar(mail: string, pass: string) {
    const { usuario } = await apiLogin(mail.trim(), pass)
    router.push(landingDeRol(usuario.rol))
  }

  async function onSubmit() {
    setError(null)
    setAviso(null)
    // Recuperar contraseña: envía el enlace y muestra un aviso genérico.
    if (esForgot) {
      if (!esEmailValido(email)) { setError(EMAIL_INVALIDO); return }
      setEnviando(true)
      try {
        const r = await fetch('/spaces-dooh/api/auth/forgot/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo enviar el enlace')
        setAviso((d as { mensaje?: string }).mensaje ?? 'Si el correo está registrado, te enviamos un enlace.')
        setEnlaceDev((d as { enlaceDev?: string }).enlaceDev ?? null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se pudo enviar el enlace')
      }
      setEnviando(false)
      return
    }

    if (esSignup && !esEmailValido(email)) { setError(EMAIL_INVALIDO); return }
    setEnviando(true)
    try {
      if (esSignup) {
        const r = await fetch('/spaces-dooh/api/signup/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ organizacion: organizacion.trim(), nombre: nombre.trim(), email: email.trim(), password }),
        })
        const d = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error((d as { error?: string }).error ?? 'No se pudo crear la cuenta')
      }
      await entrar(email, password)
    } catch (e) {
      setError(e instanceof Error ? e.message : esSignup ? 'No se pudo crear la cuenta' : 'No se pudo iniciar sesión')
      setEnviando(false)
    }
  }

  const puedeEnviar = esForgot
    ? !!email.trim()
    : esSignup
      ? organizacion.trim() && nombre.trim() && email.trim() && password.trim().length >= 6
      : email && password

  const titulo = esSignup ? 'Crear cuenta' : esForgot ? 'Recuperar contraseña' : 'Iniciar sesión'
  const subtitulo = esSignup
    ? 'Registra tu organización y tu usuario. Tendrás tu propio CRM.'
    : esForgot
      ? 'Escribe tu correo y te enviaremos un enlace para elegir una nueva contraseña.'
      : 'Accede con tu cuenta.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2.5">
          <SpaceOsMark className="h-9 w-9 shrink-0" />
          <div className="leading-tight">
            <div className="demo-wordmark text-lg text-ink">Space OS</div>
            {/* Aquí decía «RGB Catorce S de RL de CV (PIXELED)» (M5). El login es
                PRE-sesión: todavía no se sabe de qué organización eres, así que
                no hay ningún nombre correcto que poner — y poner el de UNA le
                daba la bienvenida a las otras cuatro con el nombre de un
                competidor suyo. La empresa aparece en cuanto entras. */}
            <div className="text-[11px] text-muted">Gestión de espacios publicitarios</div>
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-5">
          <h1 className="text-base font-semibold text-ink">{titulo}</h1>
          <p className="mt-0.5 text-[12px] text-muted">{subtitulo}</p>

          {aviso ? (
            <div className="mt-4 space-y-2 rounded-md border border-[#10b98133] bg-[#10b9810d] p-3 text-[12px]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0f7a55]" />
                <span className="text-ink">{aviso}</span>
              </div>
              {enlaceDev && (
                <div className="border-t border-[#10b98133] pt-2">
                  <div className="mb-1 text-[11px] font-medium text-muted">Enlace (solo en desarrollo):</div>
                  <a href={enlaceDev} className="break-all text-[11px] font-medium text-info hover:underline">{enlaceDev}</a>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                onSubmit()
              }}
              className="mt-4 space-y-3"
            >
              {esSignup && (
                <>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-ink">Organización</span>
                    <input className={inputCls} value={organizacion} onChange={(e) => setOrganizacion(e.target.value)} placeholder="Ej. Media Norte" autoFocus />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[12px] font-medium text-ink">Tu nombre</span>
                    <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Ana López" />
                  </label>
                </>
              )}
              <label className="block">
                <span className="mb-1 block text-[12px] font-medium text-ink">Correo</span>
                <input
                  type="email"
                  className={inputCls}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  autoFocus={!esSignup}
                />
              </label>
              {!esForgot && (
                <label className="block">
                  <span className="mb-1 block text-[12px] font-medium text-ink">Contraseña</span>
                  <input
                    type="password"
                    className={inputCls}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={esSignup ? 'mínimo 6 caracteres' : '••••••••'}
                  />
                </label>
              )}
              {error && <p className="text-[12px] text-error">{error}</p>}
              <Button type="submit" className="w-full" disabled={enviando || !puedeEnviar}>
                {esSignup ? <UserPlus className="h-4 w-4" /> : esForgot ? <Mail className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {enviando
                  ? esSignup ? 'Creando cuenta…' : esForgot ? 'Enviando…' : 'Entrando…'
                  : esSignup ? 'Crear cuenta' : esForgot ? 'Enviar enlace' : 'Entrar'}
              </Button>

              {/* Enlace a recuperar contraseña (solo en login, y solo si la
                  función está habilitada — ver RECUPERAR_HABILITADO arriba). */}
              {modo === 'login' && RECUPERAR_HABILITADO && (
                <div className="text-center">
                  <button type="button" onClick={() => cambiarModo('forgot')} className="text-[12px] text-muted hover:text-info hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
              )}

              {/* Entrar con Google. Solo en login: en el alta no serviría —Google
                  NO da de alta (ADR 0012)— y en recuperar contraseña sobra.
                  Es un enlace y no un botón con onClick a propósito: /inicio/
                  responde con una redirección 302 a accounts.google.com, y eso
                  es una navegación del navegador, no un fetch. */}
              {(modo === 'login' || esSignup) && googleDisponible && (
                <>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="h-px flex-1 bg-border" />
                    <span className="text-[11px] text-muted">o</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>
                  {/* En el ALTA se manda el nombre de la organización: es el
                      único dato que Google no puede aportar y que el servidor
                      exige para crearla. Si aún no está escrito, el enlace se
                      ve apagado en vez de mandar a Google para un viaje que
                      termina en error. */}
                  <a
                    href={
                      esSignup
                        ? `${RUTA_GOOGLE}?alta=1&organizacion=${encodeURIComponent(organizacion.trim())}`
                        : RUTA_GOOGLE
                    }
                    aria-disabled={esSignup && !organizacion.trim()}
                    onClick={(e) => {
                      if (esSignup && !organizacion.trim()) {
                        e.preventDefault()
                        setError('Escribe el nombre de tu organización antes de continuar con Google.')
                      }
                    }}
                    className={`flex h-10 w-full items-center justify-center gap-2 rounded border border-border-strong bg-surface text-[13px] font-medium text-ink hover:bg-bg ${
                      esSignup && !organizacion.trim() ? 'opacity-50' : ''
                    }`}
                  >
                    <MarcaGoogle />
                    {esSignup ? 'Crear empresa con Google' : 'Continuar con Google'}
                  </a>
                </>
              )}
            </form>
          )}

          {/* Cambios de modo */}
          <div className="mt-3 text-center text-[12px] text-muted">
            {esForgot ? (
              <button type="button" onClick={() => cambiarModo('login')} className="hover:underline">
                ← Volver a <span className="font-medium text-info">iniciar sesión</span>
              </button>
            ) : AUTOREGISTRO_HABILITADO || esSignup ? (
              <button type="button" onClick={() => cambiarModo(esSignup ? 'login' : 'signup')} className="hover:underline">
                {esSignup ? '¿Ya tienes cuenta? ' : '¿No tienes cuenta? '}
                <span className="font-medium text-info">{esSignup ? 'Iniciar sesión' : 'Crear cuenta'}</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// La «G» oficial de Google. Va como SVG en línea y no como imagen remota porque
// el login carga sin sesión y sin depender de terceros — y porque las
// directrices de marca de Google exigen el logotipo con sus cuatro colores,
// sin recolorear.
function MarcaGoogle() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
      <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
      <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
    </svg>
  )
}
