'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { CloudOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/demo/ui/Button'

// ============================================================================
//  La empresa tiene Space Eyes, pero su servidor de cámaras no contesta ahora.
// ----------------------------------------------------------------------------
//  Pasa al actualizarse (unos minutos de madrugada), al reiniciarse el
//  servidor o si se cayó. En vez de que cada pantalla muestre su propio error
//  técnico, un solo aviso en palabras de todos los días. Las cámaras siguen
//  trabajando en el sitio: lo que tomen mientras tanto llega cuando vuelva.
// ============================================================================
export function SinRespuesta() {
  const router = useRouter()
  const [probando, setProbando] = useState(false)
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-soft">
        <CloudOff className="h-6 w-6 text-warning" strokeWidth={1.7} />
      </div>
      <h1 className="text-[18px] font-semibold text-ink">El servicio de cámaras no responde en este momento</h1>
      <p className="text-[13px] leading-relaxed text-muted">
        Tus equipos siguen trabajando en los sitios: lo que tomen mientras tanto aparecerá aquí en cuanto el servicio vuelva.
        Suele resolverse solo en unos minutos (por ejemplo, durante una actualización).
      </p>
      <Button
        variant="secondary"
        size="sm"
        disabled={probando}
        onClick={() => {
          setProbando(true)
          router.refresh()
          setTimeout(() => setProbando(false), 3000)
        }}
      >
        <RefreshCw className={probando ? 'mr-2 h-3.5 w-3.5 animate-spin' : 'mr-2 h-3.5 w-3.5'} />
        Volver a intentar
      </Button>
      <p className="text-[12px] text-muted">Si sigue así más de una hora, avisa a soporte desde Administración › Configuración › Soporte.</p>
    </div>
  )
}
