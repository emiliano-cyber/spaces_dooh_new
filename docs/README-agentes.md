# Agentes de documentación — instalación y uso

Tres subagentes de Claude Code que exploran el proyecto y escriben el manual de usuario y el
manual técnico, apoyándose en la bóveda de Obsidian que ya vive en el repo.

## Instalación

```bash
cd <raíz del proyecto>
mkdir -p .claude/agents
cp explorador-app.md manual-usuario.md manual-tecnico.md .claude/agents/
```

En `.claude/agents/` quedan versionados con el repo, así que tu equipo los hereda. Si los
prefieres solo para ti, cópialos a `~/.claude/agents/`.

Si la carpeta `.claude/agents/` no existía cuando abriste la sesión, reinicia Claude Code para
que los detecte. Después de eso, editar los archivos se toma en segundos sin reiniciar.

## Uso

Los tres corren en orden. El explorador deja un inventario en disco y los dos redactores
parten de ahí — así ninguno tiene que volver a leer todo el código base y no se pisan entre sí.

**Paso 1 — inventario:**
```
@explorador-app haz el inventario completo del proyecto. Empieza por vault/,
verifica contra el código y marca lo que ya no coincida.
```

**Paso 2 — manuales (se pueden lanzar en la misma vuelta, trabajan en carpetas distintas):**
```
Con el inventario ya escrito: usa manual-usuario para el manual de usuario final
y manual-tecnico para el técnico. Corre ambos.
```

**Paso 3 — revisión:** lee `docs/manual-usuario/00-pendientes.md` y
`docs/manual-tecnico/99-dudas.md`. Ahí está lo que los agentes no pudieron verificar; es la
lista más corta y más útil que te van a dar.

## Para mantenerlos al día

Cuando cambie algo grande, vuelve a correr el explorador y luego pide solo el capítulo
afectado:
```
@manual-tecnico actualiza 05-api.md y 04-modelo-de-datos.md con el inventario nuevo.
```

## Qué toca cada agente

| Agente | Escribe en | Herramientas |
|---|---|---|
| `explorador-app` | `vault/00-Inventario/` | lectura + Write |
| `manual-usuario` | `docs/manual-usuario/` | lectura + Write/Edit |
| `manual-tecnico` | `docs/manual-tecnico/` | lectura + Write/Edit |

Ninguno tiene permiso para modificar código, migraciones ni configuración, y los tres tienen
prohibido en su prompt correr comandos contra la base o el servidor. Aun así vale la pena
correrlos en una rama aparte la primera vez.

## Ajustes que quizá quieras

- **`model: opus`** está fijo en los tres. Si quieres abaratar el explorador, cámbialo a
  `sonnet`; los redactores conviene dejarlos en opus.
- **`memory: project`** solo lo tiene el explorador: va acumulando en
  `.claude/agent-memory/explorador-app/` lo que aprende del código base, y cada corrida
  siguiente arranca sabiendo dónde vive cada cosa.
- Si quieres blindar el "solo lectura" más allá del prompt, agrega un hook `PreToolUse`
  sobre `Bash` que bloquee `psql`, `ssh`, `rm` y `docker`.
