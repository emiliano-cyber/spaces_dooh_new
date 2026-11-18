// ¿Es un uuid? Las rutas de la campanita lo comprueban ANTES de ir a la base:
// sin esto, `/api/notificaciones/x/` llega a Postgres como `id = 'x'`, que
// contesta «invalid input syntax for type uuid», y la ruta da un 500 donde lo
// correcto es un 404 (NOTIF-USUARIO, 21/10).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function esUuid(v: string): boolean {
  return UUID.test(v)
}
