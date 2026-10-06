import type { ReactNode } from 'react'
import { estadoDelModulo } from '@/lib/server/space-eye'
import { DemoSpaceEyes } from '@/components/demo/space-eyes/DemoSpaceEyes'
import { SinRespuesta } from '@/components/demo/space-eyes/SinRespuesta'

// El estado se decide en CADA visita: activar el módulo o que su servidor vuelva
// tiene que verse al recargar, sin esperar a un despliegue.
export const dynamic = 'force-dynamic'

// Todo /space-eyes/* pasa por aqui. Una empresa sin Space Eyes ve la
// demostración en cualquiera de sus pantallas (nunca una vacía o con errores),
// y una que lo tiene pero con su servidor de cámaras caído ve un aviso claro en
// vez de un error por cada petición. Ninguna pantalla del módulo tiene que
// saber de esto.
export default async function SpaceEyesLayout({ children }: { children: ReactNode }) {
  const estado = await estadoDelModulo()
  if (estado === 'no_contratado') return <DemoSpaceEyes />
  if (estado === 'sin_respuesta') return <SinRespuesta />
  return <>{children}</>
}
