# SPACE OS — Design System

Sistema de diseño único para el shell de SPACE OS (`/demo`). Deriva del Brand
Identity de AS Network (hoja 8 del brand book: SPACE OS). Su fin: que SPACE OS se
perciba como un producto empresarial propio, sólido y de la marca — no como un
SaaS genérico de IA.

> **Alcance:** solo el shell `/demo` (producto vivo, 26 pantallas + librería de
> componentes). No se toca backend, lógica, rutas, permisos ni comportamiento.
> Solo cambia la capa visual. Todo cuelga de tokens en `app/demo/demo.css`.

## Principios de marca (de dónde sale cada decisión)

1. **Una página = tinta cálida + UN color de producto.** Para SPACE OS ese color
   es el **azul eléctrico**. Nada de segundos colores compitiendo.
2. **Neutros cálidos, nunca grises fríos.** Es el rasgo que más distingue la marca
   de un template genérico. Tinta `#1C1612`, crema, bordes cálidos.
3. **Flat absoluto.** Cero gradientes, cero sombras, bordes de 1px. La jerarquía se
   construye con color, peso tipográfico y espacio — no con profundidad falsa.
4. **Certeza, cero hype.** Sentence case siempre, copy afirmativo, números en mono.

## 1. Color

| Token | Valor | Uso |
|---|---|---|
| `--ink` | `#1C1612` | Texto principal, centros de icono. Tinta **cálida**, no negro. |
| `--muted` | `#6E6155` | Texto secundario (gris cálido, legible AA). |
| `--bg` | `#FAF7F2` | Fondo de página (blanco cálido). |
| `--surface` | `#FFFFFF` | Tarjetas, superficie principal. |
| `--surface-2` | `#F3EEE3` | Crema: rellenos sutiles, hover, bloques de código. |
| `--border` | `#EAE4D8` | Borde claro cálido (1px). |
| `--border-strong` | `#D9D0C1` | Borde acentuado (inputs, divisores fuertes). |
| `--accent` | `#0A66FF` | **Azul SPACE OS.** Acciones primarias, foco, enlaces. Nunca navy. |
| `--accent-hover` | `#0052D6` | Hover del azul. |
| `--accent-soft` | `#EAF1FF` | Fondo de seleccionado / info sutil. |
| `--live` | `#F59E0B` | Ámbar. **Solo** estados «activo / al aire». |
| `--fuego` | `#EB4B0A` | Fuego AS Network. **Solo** picos/endoso (uso rarísimo). |
| `--success` / `--success-soft` | `#1DA850` / `#E6F6EC` | Éxito (verde de marca). |
| `--warning` | `#F59E0B` | Advertencia. |
| `--error` / `--error-soft` | `#DC2626` / `#FDECEC` | Error. |
| `--info` | `#0A66FF` | Informativo (= azul). |

**Reglas:** el azul es el único color de producto en pantalla; ámbar/fuego/verde
son estados puntuales, no decoración. Fondos siempre blanco/crema.

## 2. Tipografía

- **Cabinet Grotesk** 700–800 → display y títulos (`h1`–`h3`), wordmark. Sentence
  case; tracking ajustado por escala (`h1` −0.02em … `h3` −0.01em). Wordmark en
  caps con tracking +0.03em (`.demo-wordmark`).
- **General Sans** 400–600 → UI y cuerpo.
- **JetBrains Mono** → números técnicos: folios, IDs, montos, IPs, tags
  (`.demo-num`, con `tabular-nums`).
- **Nunca Title Case.** Siempre sentence case.

Se cargan por Fontshare (`<head>` del root layout) y next/font (mono).

## 3. Escala de espaciado y radios

- Espaciado: escala de Tailwind (múltiplos de 4px). Densidad de enterprise: paddings
  compactos y consistentes; aire entre secciones, no dentro de controles.
- Radios (tailwind): `sm 4` · `DEFAULT 6` · `md 8` · `lg 10`. Discretos — flat no es
  esquinas vivas, pero tampoco pills.
- Transición base: `180ms`.

## 4. Estados de componentes

- **hover:** superficie → `surface-2`; primario azul → `accent-hover`.
- **focus:** anillo azul (`ring-2 ring-accent`), visible siempre (accesibilidad).
- **active:** leve oscurecido; sin desplazamiento ni sombra.
- **disabled:** opacidad reducida, sin puntero.
- **selected/live:** `accent-soft` (azul) para selección; `live` (ámbar) para «al aire».

## 5. Iconografía

- UI: **lucide outline**, 1px, tamaño consistente por contexto (14–20px).
- Marca: burst radial de SPACE OS (12 rayos azules alternando largo/corto +
  cuadrado tinta) para el wordmark del shell/login. No mezclar con iconos de UI.

## 6. Reglas duras (checklist «no-genérico»)

- [ ] Cero sombras (`shadow-*`) y cero gradientes.
- [ ] Bordes de 1px, cálidos (`--border`).
- [ ] Ningún gris frío (todo pasa por los tokens cálidos).
- [ ] Azul como único primario; ámbar solo «live».
- [ ] Títulos en Cabinet Grotesk; números en JetBrains Mono; sentence case.

## Estado de implementación

- **Fase 1 — Fundación (hecha):** tokens cálidos + azul primario + semáforos de
  marca + escala tipográfica + `.demo-wordmark`, en `demo.css` y `tailwind.config`.
  Cascada a las 26 pantallas.
- **Fase 2 — Componentes (hecha):** Button (hover azul dedicado, foco con anillo
  visible), StatusBadge realineado a la paleta de marca (verde #1DA850, rojo
  #DC2626, fondos `*-soft`), Topbar a tokens, sombras eliminadas (drawer, propuesta).
  Card/Sheet/Tabs/Modal ya eran planos y tokenizados → heredan la marca solos.
  Nuevo token `--warning-soft`.
- **Fase 3 — Shell (hecha):** logotipo burst de SPACE OS (`SpaceOsMark`), Sidebar
  (burst + wordmark + navegación activa en azul con indicador), Login (burst +
  wordmark), Dashboard verificado. Sin sombras.
- **Fase 4 — Pulido por pantalla** y verificación visual (pendiente): revisar las
  26 pantallas una a una, casing (sentence case), densidad y estados vacíos.

Verificación: `tsc` limpio, `next lint` limpio, y render real 200 de `/demo`
(dashboard) y `/demo/login` con el nuevo sistema aplicado.
