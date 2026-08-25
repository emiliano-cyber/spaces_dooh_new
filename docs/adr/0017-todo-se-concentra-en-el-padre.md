# ADR 0017 — Todo se concentra en el PADRE

- **Fecha:** 2026-08-25
- **Estado:** Aceptada
- **Decide:** Emiliano
- **Sustituye a:** [ADR 0016](0016-demo-se-queda-en-su-droplet.md).
  **Restablece la decisión del [ADR 0015](0015-demo-dentro-del-padre.md)**
- **Relacionadas:** `docs/evidencias/f4-1-censo-resultado.md` ·
  `docs/evidencias/fase-3-y-4.md` · `docs/Runbook_Cierre_Fase4_DEMO.md`

---

## Contexto

Esta decisión ha cambiado **tres veces en dos días**, y conviene que la secuencia
quede escrita, porque cada giro tuvo una causa distinta:

| | Decisión | Causa |
|---|---|---|
| **ADR 0015** (24/08) | DEMO dentro del PADRE | Se creyó perdido el acceso al droplet viejo |
| **ADR 0016** (25/08) | DEMO se queda en su droplet | El censo de `F4.1` demostró que **el acceso nunca se perdió** |
| **ADR 0017** (25/08) | **Todo se concentra en el PADRE** | Decisión de producto: el droplet viejo **no forma parte del modelo objetivo** |

El ADR 0016 era correcto en su análisis técnico —reutilizar la máquina cerraba el
riesgo y costaba menos trabajo— pero razonaba **solo sobre la Fase 4**. La
decisión de arriba es de alcance mayor.

## Decisión

**El PADRE (`137.184.107.53`) es la única máquina del modelo.** DEMO vive dentro
de él, como segundo proceso en el `3001` con base `spaces_demo`, sirviendo
`demo.space-os.io`.

**El droplet viejo (`209.97.146.136`) no forma parte del modelo.** Cualquier
trabajo que se proponga sobre esa máquina **hay que justificarlo antes de
hacerlo**: no se le añaden mejoras, no se le migra nada y no se cuenta con ella
para nada del plan.

## Por qué, y qué se acepta con ello

**El motivo no es técnico, es de alcance.** El modelo de instancias soberanas
existe para que cada entorno nazca de un artefacto reproducible. Mantener viva
una máquina montada a mano en julio —con código del 11/08, con su propio
`emiliano`, su propio nginx y sus propios cinco tenants— es mantener una
excepción permanente al modelo que el plan entero intenta construir.

**Se acepta el precio que el ADR 0015 ya había escrito**, y que sigue siendo
cierto:

> **La Fase 4 no cierra su riesgo: lo transforma.** Deja de ser «demo pública =
> producción» y pasa a ser **demo pública = plano de control** — la máquina que
> guarda el super admin de toda la flota y, desde la Fase 5, las llaves de cada
> droplet.
>
> Nombre, puerto, base, proceso y usuario distintos **no son aislamiento**:
> comparten kernel, disco y red.

Los tres disparadores de revisión del ADR 0015 **siguen vigentes**: el primer
owner de pago, la demo abierta a tráfico no acompañado, y la existencia del canal
`beta`.

## Lo que el censo de `F4.1` sigue valiendo, aunque la máquina se retire

Recuperar el acceso **no fue trabajo perdido**, y paga dos veces:

**① Se sabe qué hay dentro antes de retirarla.** Cinco organizaciones —`rgb`,
`telcel`, `g500`, `eyro`, `demo-owner`—, todas de julio, y un commit `504b4fc`
que **sí está en `main`**. Apagar una máquina sin censarla es lo que este plan
llevaba semanas intentando evitar.

**② Su certificado se puede llevar al PADRE, y eso elimina una dependencia
permanente.** El ADR 0015 obligaba a emitir por **DNS-01** con un token de
Cloudflare, porque `demo.space-os.io` apuntaba a una máquina inalcanzable. Con
acceso, hay un camino más simple:

- Copiar el certificado vigente de `demo.space-os.io` —válido hasta el
  **2026-10-26**— al PADRE.
- Configurar nginx con él y **después** mover el DNS: el PADRE sirve un
  certificado válido para ese nombre **desde el primer instante**, sin ventana.
- Una vez el DNS apunta al PADRE, `certbot` toma la renovación por **HTTP-01**.

Eso **borra la trampa ④**: el token de Cloudflare que, si caducaba, mataba el
sitio en silencio 90 días después. Y borra también el riesgo del HSTS de dos
años, porque nunca llega a haber un momento sin certificado válido.

> **La decisión de retirar la máquina no obliga a tirar lo que tiene dentro.**

## Qué pasa con el droplet viejo

**No se decide aquí, y no bloquea nada.** Lo que sí cambia respecto al 24/08:
antes se decía que «no se puede apagar». **Con acceso, sí se puede** — y de forma
ordenada, con respaldo previo si se quiere.

Queda como **decisión abierta**, con tres salidas: apagarlo, conservarlo apagado
como copia, o destruirlo. Ninguna urge hasta que el DNS deje de apuntarle.

## Consecuencias operativas inmediatas

| | |
|---|---|
| `F4.2` | ✅ **Vuelve a estar cumplida.** `spaces_demo` en el PADRE, creada y migrada el 24/08, **es** la base de DEMO |
| `F4.3` | ⏳ Pendiente: certificado y nginx en el PADRE, y mover el DNS |
| `F4.4` | ⏳ Pendiente: usuario `demo`, `.env`, proceso, alta y semilla |
| `F4.5` | ⏳ 3 de 4 criterios; el del canal `beta` sigue bloqueado por TH-P4 |
| `F7.1` | 🟡 **Posible pero sin objeto**: era censar esa máquina, y ya está censada |
| `docs/Runbook_Cierre_Fase4_DEMO.md` | **Vuelve a ser el documento vigente**. Se le retira el aviso de «no lo ejecutes» |
| El token de Cloudflare | **Deja de ser necesario** si se lleva el certificado (ver arriba) |

## Alternativas descartadas

**Mantener el ADR 0016** — DEMO en su propio droplet. Cierra el riesgo de verdad
y pide menos trabajo, pero deja viva una máquina fuera del modelo. **Descartada
por alcance, no por técnica**, y sabiendo lo que cuesta.
