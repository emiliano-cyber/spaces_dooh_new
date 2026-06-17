'use client'

import { useEffect } from 'react'
import { refrescarEstado } from '@/lib/data/estado-api'

// Carga el estado persistido (sitios, clientes, campañas, reservas…) desde la
// BD al entrar al shell. El resto de las pantallas leen del store ya hidratado.
export function HidratarSitios() {
  useEffect(() => {
    refrescarEstado()
  }, [])
  return null
}
