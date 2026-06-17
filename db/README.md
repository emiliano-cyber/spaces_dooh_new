# Base de datos — Spaces (PostgreSQL)

`schema.sql` crea todo el modelo que hoy maneja la demo en memoria, para empezar
a **guardar la información de verdad**. Es PostgreSQL puro (sin Prisma), un solo
schema `public`.

## 1. Crear la base y correr el esquema

```bash
# Requiere PostgreSQL 13+ (por gen_random_uuid integrado / pgcrypto)
createdb spaces
psql -d spaces -f db/schema.sql
```

En Windows / PgAdmin: crea la base `spaces`, abre el Query Tool y ejecuta el
contenido de `schema.sql`.

Verifica:
```bash
psql -d spaces -c "\dt"      # lista las tablas
psql -d spaces -c "\dT"      # lista los tipos (enums)
```

## 2. Qué incluye

- **Enums** para todos los estatus (sitio, contrato, OT, campaña, cobranza, etc.).
- **Tablas** (mapean 1:1 los tipos de `apps/web/lib/data/types.ts`):
  `usuarios`, `config_negocio`, `sitios`, `sitio_modalidades`, `arrendadores`,
  `contratos_arrendamiento`, `pagos_renta`, `incidencias`, `clientes`,
  `campanas`, `creatividades`, `reservas`, `ordenes_trabajo`, `evidencias_ot`,
  `ordenes_impresion`, `facturas`, `cobranzas`, `acciones`.
- **Llaves foráneas** con `on delete` razonable, **índices** en FKs y filtros
  comunes, **UNIQUE** en claves de negocio (`codigo_proveedor`, folios, email,
  `portal_token`), y **trigger** que mantiene `actualizado_en`.

### Notas de mapeo demo → DB
- IDs: la demo usa strings; aquí son `uuid` con `default gen_random_uuid()`.
  Las **claves de negocio** (codigo_proveedor, folios) viven aparte como UNIQUE.
- Una pantalla con varias modalidades de venta = 1 fila en `sitios` + N filas en
  `sitio_modalidades` (esto es la agrupación por `codigo_proveedor` del importador).
- `evidencias_ot.tomada_en` = fecha de creación de la imagen (EXIF/archivo);
  `evidencias_ot."timestamp"` = fecha de subida.
- El **candado de facturación** se deriva de
  `campanas.oc_recibida AND fotos_comprobatorias AND reporte_publicacion`.

## 3. Cómo conectará la app (post-junta, sin cablear todavía)

La demo está desacoplada: las pantallas solo llaman a `lib/data/client.ts`, que
hoy usa `adapters/mock.ts` (estado en memoria). Para guardar en esta BD:

1. Levantar un API (p. ej. Fastify/Express o el `apps/api` existente) con
   endpoints que lean/escriban estas tablas (mismas firmas que el mock:
   `getSitios`, `altaSitio`, `importarInventario`, `reservar`, `confirmarReserva`,
   `cerrarOT`, `generarFactura`, …).
2. Implementar esos `fetch` dentro de `adapters/http.ts` (hoy es un stub).
3. Prender el flag `NEXT_PUBLIC_DEMO_HTTP=1`.

No hay que tocar ninguna pantalla: solo se cambia la capa de datos. Cada acción
de escritura debe además insertar en `acciones` (usuario + timestamp) para
mantener la bitácora.

## 4. Pendientes sugeridos
- **Datos semilla** (INSERTs equivalentes al seed de la demo) — pedir aparte.
- **Multi-tenant**: envolver en `CREATE SCHEMA <tenant>` por dueño (RGB, etc.).
- **Auth real** (hoy el login es mock); `usuarios.password_hash` cuando aplique.
