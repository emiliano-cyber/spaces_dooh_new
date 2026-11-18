import { describe, it, expect } from 'vitest'
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ItemNotificacion } from './ItemNotificacion'

// ============================================================================
//  NOTIF-USUARIO · cada aviso de la campanita se puede borrar SOLO (21/10).
// ----------------------------------------------------------------------------
//  Pedido del dueño: borrar las notificaciones una por una, además de «Borrar
//  todas», y que las leídas se queden en la bandeja como ya pasaba.
//
//  Lo que se fija aquí, en el HTML que sale de verdad:
//   · cada aviso lleva su botón de borrar, con un nombre que lo diga en voz
//     alta (lector de pantalla) y no solo un icono;
//   · ese botón NO va dentro del botón que abre el aviso. Un <button> dentro de
//     otro es HTML inválido, y el navegador lo «arregla» sacándolo fuera, con lo
//     que el clic en la papelera también abría el enlace del aviso;
//   · la leída se pinta atenuada y sin el punto, pero se pinta.
// ============================================================================

const base = { id: 'N1', titulo: 'Factura emitida', detalle: 'F001-0007 · 120,000', nivel: 'ok' as const, link: '/finanzas' }
const pintar = (leida: boolean) =>
  renderToStaticMarkup(
    React.createElement(ItemNotificacion, { n: { ...base, leida }, onAbrir: () => {}, onBorrar: () => {} }),
  )

describe('el botón de borrar de cada aviso', () => {
  it('existe y dice qué borra', () => {
    expect(pintar(false)).toMatch(/<button[^>]*aria-label="Borrar la notificación Factura emitida"/)
  })

  it('NO va anidado dentro del botón que abre el aviso', () => {
    const html = pintar(false)
    // Entre la apertura del botón de abrir y su cierre no puede haber otro <button.
    const abrir = html.indexOf('<button')
    const cierre = html.indexOf('</button>', abrir)
    expect(html.slice(abrir + 1, cierre)).not.toContain('<button')
    // Y los dos botones están.
    expect(html.match(/<button/g)?.length).toBe(2)
  })
})

describe('el aviso leído', () => {
  it('se sigue pintando, atenuado', () => {
    const html = pintar(true)
    expect(html).toContain('Factura emitida')
    expect(html).toContain('opacity-60')
  })

  it('el no leído no va atenuado', () => {
    expect(pintar(false)).not.toContain('opacity-60')
  })
})
