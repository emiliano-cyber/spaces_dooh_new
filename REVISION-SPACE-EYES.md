# Revisión de Space Eyes — rama `feat/space-eyes-con-mejoras`

Guía para Emiliano **y para su agente de Claude**. Está escrita para seguirse
de arriba abajo. No hace falta haber estado en las conversaciones: todo lo
necesario está en esta rama.

> **Reglas para el agente que revise**
> - No fusionar a `main` ni abrir PR: la decisión es de Emiliano.
> - **No correr prettier** (no hay configuración y reformatea archivos enteros).
> - No desplegar ni tocar producción (`159.203.188.58`, puertos 4000/4100/4200).
> - Las zonas ROJAS (§3) solo se aprueban por una persona.
> - Reportar hallazgos con archivo y línea; si algo no se puede probar sin
>   hardware, decirlo en vez de suponerlo.

## 1. Qué hay en la rama

22 commits sobre `main` (`git log --oneline origin/main..HEAD`) más la carpeta
**`space-eye/`**, que trae el código de Space Eye con **todo su historial**
(servidor, agentes de Raspberry y PC, app Android). Antes vivía solo en la
computadora de Carlos; se subió aquí para que la revisión y la imagen de
producción salgan de un solo lugar. Entró con el commit de fusión `b69dcab6`;
su historia (131 commits) está en el segundo padre: `git log b69dcab6^2`. No
es un workspace de npm ni de turbo, y la imagen de SPACE OS no lo incluye
(solo copia `.next/standalone`).

| Etapa / tema | Commits (SPACE OS) | Dónde mirar |
|---|---|---|
| Módulo nativo: menú, ficha, fallas, creativos, vivo | `e5a64943` … `f7ff1404` | `apps/web/components/demo/space-eyes/`, `app/(app)/(shell)/space-eyes/`, `app/api/space-eyes/` |
| Space Eye dentro de cada instancia (ADR 0041) | `863ecaa7`, `c4920d85` | `docs/adr/0041-space-eye-vive-dentro-de-cada-instancia.md`, `infra/eyes/`, `infra/scripts/update-eyes.sh` |
| Etapa 1 · demo para quien no lo tiene | `e9f71710` | `DemoSpaceEyes.tsx`, `SinRespuesta.tsx`, `estadoDelModulo()` |
| Etapa 2 · alta con código / QR / microSD | `4f37600f`, `9f1eb57e` | `AltaDispositivo.tsx`, `lib/space-eyes-kit-pi.ts` |
| Etapa 3 · mudanza de equipos | `2ad01254` (manual) | `space-eye/docs/MUDANZA_DE_EQUIPOS.md` |
| Etapa 4 · licencia por módulo + alta `--con-eyes` (**ROJO**) | `1baedd26`, `fcc06c46` | `apps/flota/`, `infra/scripts/update.sh`, `instalar-hijo.sh` |
| Campañas de Operaciones → foto de prueba; fotos juntas; aviso de apagón | `7b1af3bf` | `lib/server/space-eyes-campanas.ts`, `CreativosConfig.tsx`, `PantallaConfig.tsx` |
| Responsivo (celular a 2560 px) | último commit | componentes del módulo |
| Manuales | último commit | `vault/08-Manuales/manual-space-eyes.md`, `manual-tecnico-space-eyes.md` |

**Para entenderlo rápido:** leer primero
`vault/08-Manuales/manual-tecnico-space-eyes.md` (arquitectura, flujos,
datos, API, pruebas y trampas) y después el manual de usuario.

## 2. Qué revisar, en orden de importancia

1. **Cambios FUERA del módulo de Space Eyes** (los que pueden afectar al resto):
   - `app/api/estado/route.ts`: una línea que sincroniza campañas **aparte de
     la respuesta** (`void`, respiro de 2 min, nunca lanza). Revisar que no
     agregue espera ni errores al shell.
   - `app/api/creatividades/[id]/route.ts`, `app/api/campanas/[id]/confirmar/route.ts`,
     `lib/server/creativos-controller.ts`: una llamada a
     `avisarCambioDeCampanas()` tras el éxito. No cambian lo que responden.
   - `lib/server/space-eyes-campanas.ts`: **solo lee** (`qConTenant` con la
     empresa explícita). Revisar la consulta (reservas `CONFIRMADA`, campañas
     `CONFIRMADA`/`ACTIVA`, creativo `VALIDADA` y sin `retirado_en`) y que
     el origen `spaceos:<tenant>` aísle a cada empresa.
2. **Zona ROJA, etapa 4** (§3).
3. **Space Eye** (`space-eye/`): migraciones `023` y `024` (aditivas, con
   `ALGORITHM=INSTANT` en el `ENUM` de fotos), `campanasSpaceos.controller.ts`,
   `utils/versionVigilancia.ts`, cambios en `monitoreo` y `device` controllers.
4. **Agentes**: `space-eye/pi-agent/vision/` (Python) y
   `space-eye/android/app/src/main/java/com/spaceeye/agent/pantalla/` (Kotlin).

## 3. Lo que necesita tu aprobación (ROJO)

- **Licencia con módulos** (`apps/flota/licencia.mjs`, `modulo.mjs`) y que
  `infra/scripts/update.sh` baje la licencia del padre con
  `LICENCIA_DEL_PADRE=1` — zonas R2/R7. Arnés: `pruebas-update.sh` 164
  escenarios / 920 comprobaciones / 0 rojas, con mutantes.
- **Alta con `--con-eyes`** (`instalar-hijo.sh`, `altas.mjs`): DNS
  `eyes.<dominio>` y servidor de 2 GB.
- **Paso de la flota de g500 a su Space Eye** (etapa 5): solo el plan,
  `space-eye/docs/ETAPA5_MIGRACION_G500.md`; nada se ha ejecutado.

Sin las banderas (`LICENCIA_DEL_PADRE`, `--con-eyes`) todo se comporta como en
`main`.

## 4. Cómo correr las pruebas

```bash
# SPACE OS
cd apps/web
npx tsc --noEmit                      # limpio
npx eslint components/demo/space-eyes # limpio
npx vitest run                        # 249 archivos, 3443 pruebas en verde (incluye space-eyes-campanas 8/8)

# Space Eye: servidor
cd space-eye/backend && npm ci && npx tsc --noEmit
npm run prueba:agentes                # publicador de agentes (sin red)

# Raspberry
cd space-eye/pi-agent && npm ci && npm run probar          # Node 10/10
python3 -m pytest vision/pruebas                            # 79, necesita python3-opencv y numpy

# Teléfono (JDK 17)
cd space-eye/android && ./gradlew testDebugUnitTest          # 99
```

**De punta a punta sin hardware** (`space-eye/infra/ensayo-pi/`, necesita
Docker y un Space Eye local; ver el encabezado de cada script): instalación
11/11, gabinetes apagados 7/7, envío juntas y apagón 17/17, campañas 11/11,
mudanza 20/20. Y de SPACE OS a la Raspberry simulada: una campaña confirmada
en Operaciones llegó sola, la Pi bajó la referencia en 94 s y su foto de
prueba llegó 21 s después de que el arte salió en pantalla.

## 5. Lo que NO está probado todavía

- En una **Raspberry real** (solo simulada en Docker) y en un **teléfono real**
  con la app 0.16.3 (sus pruebas son unitarias; el reconocimiento con OpenCV
  del teléfono solo lo revisó el compilador).
- Los umbrales del aviso de apagón (brillo 40, desviación 14, luz alrededor 45)
  están medidos con fotos de prueba, no con la cámara del teléfono de noche ni
  a contraluz.
- La app de prueba **no** se instala en equipos de producción: la de
  producción se firma con la llave de la flota, que no está en el repo.

## 6. Para levantarlo en local (si se quiere ver funcionando)

Dos sistemas: SPACE OS (`apps/web`, puerto 3000, base Postgres) y un Space Eye
(imagen de `space-eye/Dockerfile.instancia`, puerto 4200). SPACE OS necesita
en su `app.env`: `SPACE_EYE_BASE_URL` (p. ej.
`http://host.docker.internal:4200`) y `SPACE_EYE_KEY` (la `INSTANCIA_LLAVE`
de ese Space Eye). Detalle y trampas en
`vault/08-Manuales/manual-tecnico-space-eyes.md` §8–§10.
