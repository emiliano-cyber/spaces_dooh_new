'use client'

import { GuardRol } from '@/components/demo/shell/GuardRol'

// Campañas es de Comercial/Dueño. Se protege a nivel de ruta para que ningún
// link directo (pipeline, OT, imprenta) deje entrar a otros roles.
export default function CampanasLayout({ children }: { children: React.ReactNode }) {
  return <GuardRol roles={['DUENO', 'COMERCIAL']}>{children}</GuardRol>
}
