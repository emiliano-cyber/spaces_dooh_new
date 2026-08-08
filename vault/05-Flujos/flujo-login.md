---
tipo: flujo
estado: verificado
actualizado: 2026-08-07
tags: [flujo, auth, login]
archivos:
  - apps/web/app/(app)/login/page.tsx
  - apps/web/app/api/auth/login/route.ts
  - apps/web/lib/server/auth.ts
  - apps/web/middleware.ts
  - db/migrations/20260720_hard1_usuarios_rls.sql
---

# Flujo: login con contraseña

Del clic a la cookie, y de la cookie al primer dato.

```mermaid
sequenceDiagram
    autonumber
    actor U as Usuario
    participant P as login/page.tsx
    participant MW as middleware.ts
    participant RT as /api/auth/login
    participant RL as rate-limit.ts
    participant AU as auth.ts
    participant PG as Postgres

    U->>P: correo + contraseña
    P->>MW: POST /api/auth/login
    Note over MW: exento de CSRF (bootstrap de sesión)
    MW->>RT: next()
    RT->>RL: limitar('login:'+ip, 10, 5min)
    alt superó el límite
        RL-->>U: 429 + Retry-After
    end
    RT->>PG: select … from auth_usuario_por_email($email)
    Note over PG: SECURITY DEFINER — `usuarios` es fail-closed<br/>y aún no hay tenant que fijar
    PG-->>RT: fila o nada
    RT->>AU: verifyPassword(plano, password_hash)
    alt inválido o inactivo
        RT-->>U: 401 «Correo o contraseña inválidos»
        Note over RT: mensaje único: no revela si el correo existe
    else válido
        RT->>AU: crearSesion(usuario.id)
        AU->>PG: insert into sesiones (token 256 bits, expira +30d)
        RT->>AU: permisosDeRol(rol)
        AU->>PG: select … from rol_permisos where rol = $1
        RT-->>U: 200 {usuario, permisos}<br/>Set-Cookie spaces_sesion (httpOnly)<br/>Set-Cookie spaces_csrf (legible por JS)
    end
```

## Y en la siguiente petición

```mermaid
sequenceDiagram
    autonumber
    participant N as Navegador
    participant MW as middleware.ts
    participant RT as route handler
    participant AU as auth.ts
    participant TN as tenant.ts
    participant DB as db.ts
    participant PG as Postgres

    N->>MW: GET /inicio (cookie spaces_sesion)
    MW->>MW: ¿existe la cookie? (NO la valida)
    MW->>N: renderiza el shell
    N->>RT: GET /api/estado + x-csrf-token
    RT->>AU: exigir()
    AU->>PG: auth_usuario_por_sesion($token)
    PG-->>AU: usuario (o nada si expiró / inactivo)
    AU->>AU: ¿debeCambiarPassword? → 403 y corta TODO
    RT->>DB: q('select … ')
    DB->>TN: tenantActual()
    TN-->>DB: tenant_id de la sesión
    DB->>PG: begin; set_config('app.tenant_id', …, true); SELECT; commit
    PG-->>RT: filas ya filtradas por RLS
```

## Puntos donde esto se rompe

| Síntoma | Causa probable |
|---|---|
| Todas las mutaciones dan **403 CSRF** | El parche de `fetch` no se instaló ([[estado-y-data-fetching]]) |
| Login correcto pero cero datos | Consulta con `qRaw` en vez de `q` → RLS devuelve vacío ([[multi-tenancy-y-rls]]) |
| Bucle de redirección al login | Cookie sin `Secure` sobre HTTPS, o `COOKIE_SECURE` mal puesto |
| 401 en todo tras restablecer | `debe_cambiar_password` activo — es lo esperado |

## Relacionadas
[[autenticacion-y-sesion]] · [[flujo-acceso-con-google]] ·
[[multi-tenancy-y-rls]] · [[acceso-y-sesion-ui]] · [[MOC-Proyecto]]
