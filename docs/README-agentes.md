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

**Paso 3 — revisión:** cada manual cierra con una sección `## PENDIENTES`. Ahí está lo que
los agentes no pudieron verificar; es la lista más corta y más útil que te van a dar. Si no
hay nada, dice «Ninguno».

## Para mantenerlos al día

Los pendientes **no se rellenan a mano sobre el manual**: se corrigen en el inventario, que
es de donde se vuelve a generar. Cuando cambie algo grande, vuelve a correr el explorador y
luego el redactor que toque:
```
@manual-tecnico regenera el manual con el inventario nuevo.
```

Cada corrida escribe un archivo nuevo fechado, así que las versiones anteriores quedan como
histórico en lugar de perderse.

## Qué toca cada agente

| Agente | Escribe en | Herramientas |
|---|---|---|
| `explorador-app` | `vault/00-Inventario/` | lectura + Write |
| `manual-usuario` | `vault/08-Manuales/manual-usuario-YYYY-MM-DD.md` | lectura + Write/Edit |
| `manual-tecnico` | `vault/08-Manuales/manual-tecnico-YYYY-MM-DD.md` | lectura + Write/Edit |

Los dos redactores tienen **una sola fuente: el inventario en `vault/00-Inventario/`**. No
exploran el repositorio ni abren archivos de código, y por eso ninguno de los dos lleva
`Bash` entre sus herramientas: la restricción no depende de que se acuerden. Lo que el
inventario no cubra va a `## PENDIENTES` como pregunta, nunca relleno.

Ninguno tiene permiso para modificar código, migraciones ni configuración. Aun así vale la
pena correrlos en una rama aparte la primera vez.

## Las reglas de redacción

Viven dentro de `.claude/agents/manual-tecnico.md` y `.claude/agents/manual-usuario.md`,
numeradas, no en el prompt de cada corrida: así no hay que repetirlas ni se olvidan. Cubren
fuente, escritura, formato de salida, audiencia y las propias de cada manual. Si necesitas
cambiar cómo escriben, se edita la definición, no el encargo.

## Ajustes que quizá quieras

- **`model: opus`** está fijo en los tres. Si quieres abaratar el explorador, cámbialo a
  `sonnet`; los redactores conviene dejarlos en opus.
- **`memory: project`** solo lo tiene el explorador: va acumulando en
  `.claude/agent-memory/explorador-app/` lo que aprende del código base, y cada corrida
  siguiente arranca sabiendo dónde vive cada cosa.
- Si quieres blindar el "solo lectura" más allá del prompt, agrega un hook `PreToolUse`
  sobre `Bash` que bloquee `psql`, `ssh`, `rm` y `docker`. Aplica al explorador, que es el
  único de los tres que conserva `Bash`.
