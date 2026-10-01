'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Modal } from '@/components/demo/ui/Modal'
import { Button } from '@/components/demo/ui/Button'
import { NotasDeVersion } from '@/components/demo/novedades/NotasDeVersion'
import { useSesionCtx } from '@/components/demo/shell/SesionContext'
import { getNovedadesApi } from '@/lib/data/novedades-api'
import {
  claveVistas,
  debeMostrarNovedades,
  leerVistas,
  marcarVista,
  type EntradaNovedades,
} from '@/lib/novedades'

// ============================================================================
//  NovedadesDeVersion — el dialogo «Qué hay de nuevo», UNA vez por version y
//  por usuario (pedido del dueno, 2026-10-01).
// ----------------------------------------------------------------------------
//  Montado en el layout del shell, al lado de `SondeoNotificaciones`: todo
//  usuario con sesion pasa por ahi. Cuando sale lo decide
//  `debeMostrarNovedades()` (`lib/novedades.ts`, con pruebas): nunca en una
//  version sin notas, y nunca en desarrollo ni sin version sellada -- de eso
//  se encarga el servidor, que devuelve `version: null`.
//
//  "Visto" vive en `localStorage`, POR USUARIO, y no en la base: es una
//  comodidad de este navegador, no un dato del negocio. Si el almacenamiento
//  falla (ventana privada, bloqueado) el dialogo sale otra vez en la proxima
//  carga: molestia menor, y preferible a no ensenarlo nunca. Todo acceso va
//  en try/catch porque `localStorage` LANZA en esos casos.
// ============================================================================

function leer(usuarioId: string): string[] {
  try {
    return leerVistas(window.localStorage.getItem(claveVistas(usuarioId)))
  } catch {
    return []
  }
}

function guardar(usuarioId: string, version: string) {
  try {
    const clave = claveVistas(usuarioId)
    window.localStorage.setItem(clave, JSON.stringify(marcarVista(leerVistas(window.localStorage.getItem(clave)), version)))
  } catch {
    // Sin almacenamiento: se volvera a ensenar. Ver la cabecera.
  }
}

export function NovedadesDeVersion() {
  const { sesion } = useSesionCtx()
  const router = useRouter()
  const usuarioId = sesion?.usuario.id
  const [notas, setNotas] = useState<EntradaNovedades | null>(null)
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!usuarioId) return
    let vivo = true
    getNovedadesApi()
      .then((d) => {
        if (!vivo) return
        if (debeMostrarNovedades({ notas: d.notas, vistas: leer(usuarioId) })) {
          setNotas(d.notas)
          setAbierto(true)
        }
      })
      // Un fallo aqui no es asunto del usuario: no se ensena nada.
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [usuarioId])

  if (!notas || !usuarioId) return null

  // Se marca como vista al CERRAR, de cualquier forma (boton, X, Escape o
  // clic fuera): quien lo cerro, lo vio. Marcarlo al abrir lo daria por visto
  // aunque la pestana se cerrara sin mirarlo.
  function cerrar() {
    if (notas && usuarioId) guardar(usuarioId, notas.version)
    setAbierto(false)
  }

  return (
    <Modal
      open={abierto}
      onOpenChange={(v) => (v ? setAbierto(true) : cerrar())}
      title={`Qué hay de nuevo en ${notas.version}`}
      subtitle={`Esta instancia se actualizó. Esto es lo que cambió (${notas.fecha}).`}
      footer={
        <div className="flex items-center justify-between gap-2">
          {/* Navegar no es aceptar: neutro (`convenciones.md`, «Color de los botones»). */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              cerrar()
              router.push('/novedades')
            }}
          >
            Ver todas las novedades
          </Button>
          {/* Aceptar: azul. */}
          <Button size="sm" onClick={cerrar}>
            <Sparkles className="h-3.5 w-3.5" /> Entendido
          </Button>
        </div>
      }
    >
      <NotasDeVersion notas={notas} />
    </Modal>
  )
}
