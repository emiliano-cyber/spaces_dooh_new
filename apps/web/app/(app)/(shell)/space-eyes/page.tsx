'use client'

import { ListaEquipos } from '@/components/demo/space-eyes/ListaEquipos'

// Pantalla "Space Eyes": todos los equipos de la instancia. El alcance por
// empresa lo pone la llave de servicio en el servidor, y el permiso lo exige el
// BFF (`inventario.ver`); aquí no se decide nada de eso.
export default function SpaceEyesPage() {
  return <ListaEquipos />
}
