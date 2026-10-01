'use client'

import { Galeria } from '@/components/demo/space-eyes/Galeria'

// Pantalla "Galería" de Space Eyes: todas las fotos de los equipos de la
// instancia. El alcance por empresa lo pone la llave de servicio en el
// servidor, y el permiso lo exige el BFF (`inventario.ver`); aquí no se decide
// nada de eso.
export default function SpaceEyesGaleriaPage() {
  return <Galeria />
}
