---
name: codigo-muerto-alcanzable
description: En este repo un componente puede importar código muerto sin estar montado - hay que verificar quién lo importa, no solo qué importa él
metadata:
  type: project
---

**Antes de afirmar que un componente «depende» de algo, comprueba quién importa a
ese componente.**

**Why:** en Space OS hay una capa de componentes que importan el `AuthProvider` JWT
muerto (`lib/auth-context.tsx`) y la bóveda los daba por vivos y en riesgo. Al mirar
los importadores resultó que **ninguno está montado**:

- `components/operaciones/OTMovil.tsx` — nadie lo importa. La página
  `app/(app)/m/ot/[id]/page.tsx` renderiza `OTVista`, no `OTMovil`.
- `components/shared/PermissionGuard.tsx` — nadie lo importa.
- `components/campanas/ReadinessPanel.tsx` y `ReporteVisual.tsx` — nadie los importa,
  pese a figurar en `vault/03-Frontend/modulos-internos.md` como componentes de `/campanas/[id]`.

Eso convirtió una pregunta abierta con «posible impacto operativo real» (¿funciona la
OT móvil en campo?) en un no-problema, y rebajó el riesgo de retirar el `AuthProvider`.

**How to apply:** dos greps, no uno. Primero `grep -rn 'NombreComponente' app components`
excluyendo su propio archivo; si sale vacío, es código muerto por muy vivo que parezca
su contenido. Lo mismo antes de decir que una variable de entorno «solo la lee X».

Relacionadas: [[trampas-verificacion-boveda]] · [[reconocimiento-space-os]]
