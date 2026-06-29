# SPACES OS — Complemento al manual (cambios recientes)

> Este documento solo cubre los **cambios recientes**. Como **no modifican cómo
> usas la app**, el resto se mantiene en el **Manual de usuario completo**
> (`MANUAL_COMPLETO.md`). Demo · datos ficticios.

---

## 1. Bitácora a prueba de manipulación (append-only)

La pantalla **Actividad** (la bitácora) **se ve y se usa exactamente igual**: registra **quién hizo qué y cuándo** en cada acción del sistema, con filtros por **fecha, hora y usuario**.

**Qué cambió (de fondo):** la bitácora ahora es **inmutable**. Los registros **no se pueden editar ni borrar** — quedan asegurados a nivel de base de datos. Esto la convierte en **evidencia confiable** de lo que ocurrió (no hay forma de alterar el historial).

- No tienes que hacer nada distinto; sigues consultando la bitácora como siempre.
- El único caso en que se vacía por completo es al **reiniciar el demo** desde cero (operación de administración).

![Actividad — bitácora](manual-shots/full/18-actividad.png)
*La pantalla de Actividad no cambia; lo que cambió es que su historial es ahora inalterable.*

> Nota: esto da inmutabilidad a nivel de base (no-edición / no-borrado). El
> sellado criptográfico avanzado (anclar huellas on-chain) es alcance de una fase futura.

---

## 2. Calidad de código (interno — sin cambio para el usuario)

Se configuró el **linter (ESLint)** del proyecto con la configuración recomendada de Next.js. Es una mejora **técnica/interna** para mantener el código sano y consistente.

**Impacto para el usuario: ninguno.** No cambia ninguna pantalla, flujo ni comportamiento de la app.

---

*Para el manual completo de todas las funciones (configuración, agencias/comisiones, clientes, inventario, propuestas, campañas, creativos, imprenta, operaciones, validación de publicación, facturación, arrendadores, dashboard y bitácora), consulta `MANUAL_COMPLETO.md` / `Manual_Completo_SPACES_OS.pdf`.*
