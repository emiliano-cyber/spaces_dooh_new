'use client'

import { Graficas } from '@/components/demo/space-eyes/Graficas'

// Pantalla "Gráficas" de Space Eyes: la telemetría histórica de un equipo
// (batería, temperaturas, señal, almacenamiento) y su consumo de datos. El
// alcance por empresa lo pone la llave de servicio en el servidor.
export default function SpaceEyesGraficasPage() {
  return <Graficas />
}
