'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { toast } from 'sonner'
import { Check, Languages } from 'lucide-react'
import { useIdioma } from '@/lib/i18n/contexto'
import type { Idioma } from '@/lib/i18n/idiomas'
import { avisoIdiomaGuardado, guardarIdiomaDeCuenta } from '@/components/demo/admin/IdiomaCuenta'

// ─── El idioma a un clic, en el menú de la cuenta (06/11) ───────────────────
//
// Hasta hoy se cambiaba en dos sitios: el desplegable del login y la tarjeta
// «Configuración → Idioma». Dentro de la aplicación había que ir a buscarla.
// Esto lo pone en el menú de la cuenta de la barra superior, con el vigente
// marcado.
//
// Guarda EN LA CUENTA (`guardarIdiomaDeCuenta`, ver por qué en `IdiomaCuenta`),
// igual que la tarjeta: lo elegido aquí sigue a la persona a cualquier
// dispositivo. «Usar el idioma del navegador» sigue estando solo en la tarjeta,
// que es donde se explica.
//
// Con un solo idioma encendido (hoy, en toda la flota) NO SE PINTA, igual que
// los otros dos: ofrecer algo que el servidor va a ignorar sería mentir.
export function IdiomaMenu() {
  const { t, idioma, puedeElegir, disponibles } = useIdioma()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!puedeElegir || disponibles.length < 2) return null

  async function elegir(valor: string) {
    const nuevo = valor as Idioma
    if (busy || nuevo === idioma || !disponibles.includes(nuevo)) return
    setBusy(true)
    try {
      await guardarIdiomaDeCuenta(nuevo, t('idioma.cuenta.error'))
      toast.success(avisoIdiomaGuardado(nuevo))
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('idioma.cuenta.error'))
    }
    setBusy(false)
  }

  return (
    <>
      <div className="my-1 h-px bg-border" />
      <DropdownMenu.Label className="flex items-center gap-2 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">
        <Languages className="h-3.5 w-3.5" aria-hidden="true" /> {t('idioma.etiqueta')}
      </DropdownMenu.Label>
      <DropdownMenu.RadioGroup value={idioma} onValueChange={(v) => { void elegir(v) }}>
        {/* Cada idioma nombrado en sí mismo, como en el login y la tarjeta. */}
        {disponibles.map((i) => (
          <DropdownMenu.RadioItem
            key={i}
            value={i}
            disabled={busy}
            // El menú se queda abierto mientras guarda: si se cerrara al
            // instante, un error del servidor saldría sin contexto.
            onSelect={(e) => e.preventDefault()}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-surface-2"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center">
              <DropdownMenu.ItemIndicator>
                <Check className="h-3.5 w-3.5 text-accent" />
              </DropdownMenu.ItemIndicator>
            </span>
            {t(`idioma.${i}` as 'idioma.es' | 'idioma.en' | 'idioma.it' | 'idioma.pt')}
          </DropdownMenu.RadioItem>
        ))}
      </DropdownMenu.RadioGroup>
      {/* Los dos separadores van AQUÍ y no en `Topbar`: con un solo idioma el
          menú tiene que quedar idéntico al de antes, sin una raya suelta. */}
      <div className="my-1 h-px bg-border" />
    </>
  )
}
