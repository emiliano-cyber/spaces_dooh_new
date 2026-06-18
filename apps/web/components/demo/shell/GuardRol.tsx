'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { landingDeRol } from '@/lib/data/client'
import { useSesionCtx } from './SesionContext'
import type { RolDemo } from '@/lib/data/types'

// Guard de acceso a nivel de RUTA. Ocultar el ítem del menú no basta: un link
// directo (p. ej. desde el pipeline / OT) puede llevar a una página que el rol
// no debe ver. Este componente bloquea el render y redirige a la landing del rol
// si no está en `roles`. Úsalo en el layout del segmento a proteger.
export function GuardRol({ roles, children }: { roles: RolDemo[]; children: React.ReactNode }) {
  const { sesion } = useSesionCtx() // undefined = cargando | null = sin sesión
  const router = useRouter()
  const rol = sesion?.usuario.rol
  const permitido = !!rol && roles.includes(rol)
  const clave = roles.join(',')

  useEffect(() => {
    if (sesion === undefined) return // aún cargando
    if (!rol) {
      router.replace('/demo/login')
    } else if (!roles.includes(rol)) {
      router.replace(landingDeRol(rol))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesion, rol, clave, router])

  if (sesion === undefined || !permitido) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
      </div>
    )
  }

  return <>{children}</>
}
