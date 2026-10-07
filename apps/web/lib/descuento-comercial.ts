// El descuento comercial de una propuesta se muestra SIEMPRE con dos decimales,
// y por omisión «0.00» (pedido del dueño, 06/10). La columna es numeric(5,2):
// mostrar «0» o un campo vacío hacía dudar de si había descuento o faltaba el dato.
export function pctConDosDecimales(pct: number | null | undefined): string {
  return (Number.isFinite(pct) ? (pct as number) : 0).toFixed(2)
}
