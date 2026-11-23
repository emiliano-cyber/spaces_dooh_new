'use client'

import { Suspense } from 'react'
import { AjustesSE } from '@/components/demo/space-eyes/AjustesSE'

// Pantalla «Ajustes» de Space Eyes: brillo por horas, marca de las fotos,
// programación y verificación, que antes eran cuatro entradas sueltas del menú.
// Los permisos los exige el BFF (`inventario.ver` para mirar, `inventario.crear`
// para guardar), no esta página.
//
// El `Suspense` no es decorativo: `AjustesSE` lee `?t=` con `useSearchParams`,
// y Next exige el límite o la compilación falla al prerenderizar.
export default function SpaceEyesAjustesPage() {
  return (
    <Suspense fallback={null}>
      <AjustesSE />
    </Suspense>
  )
}
