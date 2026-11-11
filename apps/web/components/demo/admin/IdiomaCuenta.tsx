'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Languages } from 'lucide-react'
import { CardColapsable } from '@/components/demo/ui/CardColapsable'
import { Campo } from '@/components/demo/ui/Campo'
import { useIdioma } from '@/lib/i18n/contexto'
import { traducir } from '@/lib/i18n/diccionario'
import { COOKIE_IDIOMA, resolverIdioma, type Idioma } from '@/lib/i18n/idiomas'

const API = '/spaces-dooh/api'
const inputCls =
  'h-10 w-full rounded border border-border-strong bg-surface px-3 text-[13px] text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent'

// ─── B69 · el aviso, en el idioma al que se pasa ────────────────────────────
//
// El `t` de la pantalla es el del idioma de ANTES: el nuevo llega con el
// `router.refresh()`, cuando el aviso ya se pinto. Al pasar a italiano decia
// «Language saved». El aviso se dice en el idioma de destino, que el cliente
// conoce sin esperar al servidor: el elegido, o con «Usar el idioma del
// navegador» la misma regla que `resolverIdioma` aplica en el servidor
// (cookie > navegador > español, entre los encendidos). La lista
// `navigator.languages` es de donde el navegador saca su `Accept-Language`.
// Sin cambio de idioma, el destino es el de ahora y el aviso, el de siempre.
export function idiomaTrasGuardar(
  valor: Idioma | 'navegador',
  ctx: { actual: Idioma; disponibles: readonly Idioma[]; cookie: string | null; navegador: readonly string[] },
): Idioma {
  if (valor !== 'navegador') return ctx.disponibles.includes(valor) ? valor : ctx.actual
  return resolverIdioma({ cookie: ctx.cookie, cabecera: ctx.navegador.join(','), permitidos: ctx.disponibles })
}

export function avisoIdiomaGuardado(destino: Idioma): string {
  return traducir(destino, 'idioma.cuenta.toast')
}

// El contexto, armado de las CADENAS que da el navegador (validacion del
// pulido, 04/11: armado en linea, tres mutantes sobrevivian). Pura: se prueba
// con cadenas, y la tarjeta solo le pasa lo que leen las dos de abajo.
export function contextoDelNavegador(
  actual: Idioma,
  disponibles: readonly Idioma[],
  cadenaCookie: string,
  idiomasNavegador: readonly string[],
): { actual: Idioma; disponibles: readonly Idioma[]; cookie: string | null; navegador: readonly string[] } {
  const m = cadenaCookie.match(new RegExp('(?:^|; )' + COOKIE_IDIOMA + '=([^;]*)'))
  return { actual, disponibles, cookie: m ? decodeURIComponent(m[1]) : null, navegador: idiomasNavegador }
}

/** `document.cookie`, o '' en el servidor. */
export function cadenaCookieDelDocumento(): string {
  return typeof document === 'undefined' ? '' : document.cookie
}

/** `navigator.languages` (de donde sale el `Accept-Language`), o [] en el servidor. */
export function idiomasDelNavegador(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  return navigator.languages ?? [navigator.language]
}

// ─── Guardar el idioma EN LA CUENTA, desde donde sea ────────────────────────
//
// La usan esta tarjeta y el menú de la cuenta de la barra superior
// (`shell/IdiomaMenu.tsx`, 06/11). Las dos guardan en la CUENTA y no solo en la
// cookie del navegador por la precedencia (cuenta > cookie > Accept-Language):
// un selector que tocara solo la cookie no haría NADA a quien ya tiene un idioma
// guardado en su cuenta — lo vería «cambiar» sin ningún efecto.
//
// Lanza con el mensaje del servidor (o `respaldo`) para que quien la llama lo
// enseñe en su aviso. `pedir` se inyecta solo para las pruebas.
export async function guardarIdiomaDeCuenta(
  valor: Idioma | 'navegador',
  respaldo: string,
  pedir: typeof fetch = fetch,
): Promise<void> {
  const r = await pedir(`${API}/perfil/idioma/`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idioma: valor }),
  })
  if (r.ok) return
  const d = await r.json().catch(() => ({}))
  throw new Error((d as { error?: string }).error ?? respaldo)
}

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
  const { t, idioma, puedeElegir, disponibles } = useIdioma()
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
      await guardarIdiomaDeCuenta(valor, t('idioma.cuenta.error'))
      toast.success(
        avisoIdiomaGuardado(
          idiomaTrasGuardar(
            valor,
            contextoDelNavegador(idioma, disponibles, cadenaCookieDelDocumento(), idiomasDelNavegador()),
          ),
        ),
      )
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
          {/* Cada idioma se nombra en sí mismo, como en el selector del login.
              Los que manda el servidor (los encendidos). Entre la ola 0 del
              portugués y P3 (05/11) aquí se quitaba `pt`; la base ya lo
              acepta (`20261105_idioma_portugues.sql`). */}
          {disponibles.map((i) => (
            <option key={i} value={i}>
              {t(`idioma.${i}` as 'idioma.es' | 'idioma.en' | 'idioma.it' | 'idioma.pt')}
            </option>
          ))}
        </select>
      </Campo>
    </CardColapsable>
  )
}
