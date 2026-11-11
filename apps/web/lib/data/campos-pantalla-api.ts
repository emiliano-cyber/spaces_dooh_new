'use client'

import { useEffect, useState } from 'react'
import { leerCamposOcultos, type CampoPantalla } from '@/lib/campos-pantalla'

// Los campos del alta de pantalla que oculta esta instancia (CAMPOS-PANTALLA,
// 11/11). Una sola petición por carga de la app: el valor solo cambia
// editando `app.env` y recreando el contenedor, y eso ya recarga la página.
//
// Mientras llega —o si falla— devuelve `null` y el formulario enseña TODO: es
// lo de antes, y un fallo de red no puede dejar dar de alta una pantalla sin
// los campos que esta empresa sí exige.
let cache: Promise<CampoPantalla[]> | null = null

function pedir(): Promise<CampoPantalla[]> {
  cache ??= fetch('/spaces-dooh/api/instancia/campos-pantalla/')
    .then((r) => (r.ok ? r.json() : { ocultos: [] }))
    // Se filtra otra vez con la lista de la app: lo que no conoce, no oculta.
    .then((d) => leerCamposOcultos(Array.isArray(d?.ocultos) ? d.ocultos.join(',') : '').ocultos)
    .catch(() => {
      cache = null
      return []
    })
  return cache
}

export function useCamposOcultosPantalla(): CampoPantalla[] | null {
  const [ocultos, setOcultos] = useState<CampoPantalla[] | null>(null)
  useEffect(() => {
    let vivo = true
    pedir().then((o) => vivo && setOcultos(o))
    return () => {
      vivo = false
    }
  }, [])
  return ocultos
}
