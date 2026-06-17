'use client'

import { useEffect } from 'react'
import { refrescarSitios } from '@/lib/data/sitios-api'

// Carga los sitios desde la BD al entrar al shell (una vez). El resto de las
// pantallas leen del store ya hidratado.
export function HidratarSitios() {
  useEffect(() => {
    refrescarSitios()
  }, [])
  return null
}
