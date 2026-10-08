# Documentación de SPACE EYE

## Por dónde empezar

| Si eres… | Empieza por |
|---|---|
| **Alguien que va a usar el sistema** | [Manual de Usuario](MANUAL_USUARIO.md) |
| **Programador nuevo en el proyecto** | [Manual Técnico](MANUAL_TECNICO.md) → sección 1 y 2 |
| **Quien va a desplegar** | [Manual Técnico](MANUAL_TECNICO.md) § 16 y [DEPLOYMENT.md](DEPLOYMENT.md) |
| **Quien tiene que arreglar algo ya** | [Manual Técnico](MANUAL_TECNICO.md) § 18 (Troubleshooting) |
| **Quien quiere entender el sistema de un vistazo** | [Diagramas](DIAGRAMAS.md) § 1 |

## Los documentos

| Documento | Para quién | Qué contiene |
|---|---|---|
| **[MANUAL_USUARIO.md](MANUAL_USUARIO.md)** | Usuarios | Cada pantalla y cada botón, flujos paso a paso, problemas frecuentes |
| **[MANUAL_TECNICO.md](MANUAL_TECNICO.md)** | Programadores y administradores | Arquitectura real, APIs, base de datos, agentes, deuda técnica, troubleshooting |
| **[DIAGRAMAS.md](DIAGRAMAS.md)** | Ambos | 13 diagramas: arquitectura, flujos, autenticación, errores, costos |
| **[ESTADO_Y_HANDOFF.md](ESTADO_Y_HANDOFF.md)** | Equipo | Bitácora: qué se hizo cada sesión y por qué |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Quien despliega | Guía de despliegue |
| **[ANDROID_RESILIENCE.md](ANDROID_RESILIENCE.md)** | Programadores Android | Cómo sobrevive la app en operación desatendida |
| **[PLAN_RASPBERRY_PI5.md](PLAN_RASPBERRY_PI5.md)** | Equipo | Plan de hardware y fases de la Raspberry |
| **[PLAYLOG_PROPUESTA.md](PLAYLOG_PROPUESTA.md)** | Equipo | Propuesta original del histórico de telemetría |

## Antes de tocar producción

Tres cosas pueden causar daño **irreversible**:

1. **Perder la llave de firma de la APK.** Ningún equipo en campo se podría
   actualizar nunca más, y al reinstalar cada sitio entraría como equipo nuevo,
   perdiendo su historial. Ver Manual Técnico § 16.
2. **Eliminar un equipo.** Se lleva sus fotos, su telemetría y su historial.
3. **Desplegar sin `--env-file backend/.env`.** La contraseña del servidor de
   medios queda vacía y se rompe la vista en vivo.

## Cómo mantener esta documentación

- Si cambias un flujo, **actualiza su diagrama en el mismo commit**. Un diagrama
  desactualizado engaña más de lo que ayuda.
- Si algo del manual no coincide con lo que hace el código, **gana el código**:
  corrige el documento.
- Lo que no se pueda confirmar leyendo el código se marca como
  **"Pendiente de validar"**, no se adivina.
