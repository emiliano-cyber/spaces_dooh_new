'use client'

import { AltaDispositivo } from '@/components/demo/space-eyes/AltaDispositivo'

// Alta de un equipo Space Eyes. No hay formulario que "cree" el equipo: el
// agente se registra solo al arrancar, así que esta pantalla entrega el
// instalador de cada tipo y el testigo con el que nace asignado a la empresa.
export default function NuevoDispositivoPage() {
  return <AltaDispositivo />
}
